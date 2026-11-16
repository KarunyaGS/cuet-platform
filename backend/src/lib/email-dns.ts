/**
 * Checks that a sending domain's DNS records are in place for Cloudflare Email Sending. Pure logic: the lookups are passed in, so the
 * same code is tested offline and used by `backend/scripts/check-email-dns.mjs` against real DNS.
 *
 * The record names are the ones Cloudflare's documentation gives for an onboarded sending domain
 * (https://developers.cloudflare.com/email-service/configuration/domains/):
 *   SPF   TXT cf-bounce.<domain>              "v=spf1 include:_spf.mx.cloudflare.net ~all"
 *   MX    MX  cf-bounce.<domain>              (bounce handling)
 *   DKIM  TXT cf-bounce._domainkey.<domain>   "v=DKIM1; h=sha256; k=rsa; p=..."
 *   DMARC TXT _dmarc.<domain>                 "v=DMARC1; p=..."
 * It can only tell that records exist and are well formed. That mail is actually accepted is proved by one real delivery.
 */
export type Lookup = (name: string, type: 'TXT' | 'MX') => Promise<string[]>;
export type Status = 'PASS' | 'WARN' | 'FAIL';
export interface DnsCheck {
  key: 'spf' | 'mx' | 'dkim' | 'dmarc';
  name: string;
  status: Status;
  detail: string;
}

const clean = (d: string) => d.trim().toLowerCase().replace(/\.$/, '');
export const validDomain = (d: string) => /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(clean(d));

/** Splits a tag list such as "v=DMARC1; p=reject; rua=mailto:x@y" into its tags. */
const tags = (record: string) => Object.fromEntries(record.split(';').map((t) => t.trim()).filter(Boolean).map((t) => [t.slice(0, t.indexOf('=')).trim().toLowerCase(), t.slice(t.indexOf('=') + 1).trim()]));

export async function checkSendingDomain(domainInput: string, lookup: Lookup): Promise<{ domain: string; checks: DnsCheck[]; ready: boolean }> {
  const domain = clean(domainInput);
  if (!validDomain(domain)) throw new Error(`"${domainInput}" is not a domain name`);
  const checks: DnsCheck[] = [];
  const safe = async (name: string, type: 'TXT' | 'MX') => {
    try {
      return await lookup(name, type);
    } catch (e) {
      throw new Error(`Could not look up ${type} ${name}: ${(e as Error).message}`);
    }
  };

  // SPF
  const spfName = `cf-bounce.${domain}`;
  const spf = (await safe(spfName, 'TXT')).filter((r) => /^v=spf1(\s|$)/i.test(r));
  if (!spf.length) checks.push({ key: 'spf', name: spfName, status: 'FAIL', detail: 'No SPF record. Onboard the domain in Email Service, Email Sending, and wait 5 to 15 minutes.' });
  else if (spf.length > 1) checks.push({ key: 'spf', name: spfName, status: 'FAIL', detail: `${spf.length} SPF records found. A name must have exactly one; several cause SPF failures.` });
  else if (!/include:_spf\.mx\.cloudflare\.net/i.test(spf[0]!)) checks.push({ key: 'spf', name: spfName, status: 'FAIL', detail: 'The SPF record does not include _spf.mx.cloudflare.net, so Cloudflare is not authorised to send.' });
  else if (/\+all\b/i.test(spf[0]!) || !/[~-]all\b/i.test(spf[0]!)) checks.push({ key: 'spf', name: spfName, status: 'FAIL', detail: 'The SPF record must end in ~all or -all (never +all).' });
  else checks.push({ key: 'spf', name: spfName, status: 'PASS', detail: spf[0]! });

  // MX for bounces
  const mx = await safe(spfName, 'MX');
  checks.push(mx.length ? { key: 'mx', name: spfName, status: 'PASS', detail: mx.join(', ') } : { key: 'mx', name: spfName, status: 'FAIL', detail: 'No MX record, so bounces cannot be received.' });

  // DKIM
  const dkimName = `cf-bounce._domainkey.${domain}`;
  const dkim = (await safe(dkimName, 'TXT')).filter((r) => /v=DKIM1/i.test(r));
  if (!dkim.length) checks.push({ key: 'dkim', name: dkimName, status: 'FAIL', detail: 'No DKIM record. Messages cannot be signed or verified.' });
  else if (!(tags(dkim[0]!)['p'] ?? '').length) checks.push({ key: 'dkim', name: dkimName, status: 'FAIL', detail: 'The DKIM record has an empty public key (p=), which means the key was revoked.' });
  else checks.push({ key: 'dkim', name: dkimName, status: 'PASS', detail: `v=DKIM1 record with a public key (${(tags(dkim[0]!)['p'] ?? '').length} characters)` });

  // DMARC
  const dmarcName = `_dmarc.${domain}`;
  const dmarc = (await safe(dmarcName, 'TXT')).filter((r) => /^v=DMARC1/i.test(r));
  if (!dmarc.length) checks.push({ key: 'dmarc', name: dmarcName, status: 'WARN', detail: 'No DMARC record. Not required, but it improves delivery. Cloudflare adds p=reject on onboarding when none exists.' });
  else {
    const t = tags(dmarc[0]!);
    const policy = (t['p'] ?? '').toLowerCase();
    if (!['none', 'quarantine', 'reject'].includes(policy)) checks.push({ key: 'dmarc', name: dmarcName, status: 'FAIL', detail: 'The DMARC record has no valid policy (p=none, quarantine or reject).' });
    else if (policy === 'none') checks.push({ key: 'dmarc', name: dmarcName, status: 'WARN', detail: `p=none: monitoring only, nothing is enforced${t['rua'] ? '' : ' and no report address (rua=) is set'}. ${dmarc[0]}` });
    else checks.push({ key: 'dmarc', name: dmarcName, status: 'PASS', detail: `${dmarc[0]}${t['rua'] ? '' : ' (no report address, rua=, is set)'}` });
  }
  return { domain, checks, ready: checks.every((c) => c.status !== 'FAIL') };
}
