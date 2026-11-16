// Checks a sending domain's DNS records for Cloudflare Email Sending, using public DNS (DNS over HTTPS). Read-only: it changes nothing.
//
//   node backend/scripts/check-email-dns.mjs <domain>
//
// Example: node backend/scripts/check-email-dns.mjs mail.example.com
// Exits with 1 if any required record is missing or malformed. It cannot prove that mail is accepted; send one real email for that.
import { checkSendingDomain } from '../src/lib/email-dns.ts';

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node backend/scripts/check-email-dns.mjs <sending-domain>');
  process.exit(2);
}

const TYPE = { TXT: 16, MX: 15 };
/** Public resolver, JSON answers. Names are looked up exactly as given. */
async function lookup(name, type) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`the resolver answered ${res.status}`);
  const body = await res.json();
  return (body.Answer ?? []).filter((a) => a.type === TYPE[type]).map((a) => (type === 'TXT' ? String(a.data).replace(/^"|"$/g, '').replace(/"\s*"/g, '') : String(a.data)));
}

try {
  const r = await checkSendingDomain(domain, lookup);
  console.log(`Sending domain: ${r.domain}\n`);
  for (const c of r.checks) console.log(`${c.status.padEnd(4)}  ${c.key.padEnd(5)}  ${c.name}\n        ${c.detail}`);
  console.log(`\n${r.ready ? 'READY: every required record is present and well formed.' : 'NOT READY: fix the FAIL lines above, wait 5 to 15 minutes for DNS, and run this again.'}`);
  console.log('This checks DNS only. Confirm delivery by sending one real email to an inbox you own.');
  process.exit(r.ready ? 0 : 1);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(2);
}
