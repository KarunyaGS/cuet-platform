import { describe, expect, it } from 'vitest';
import { checkSendingDomain, validDomain, type Lookup } from '../src/lib/email-dns';

/** A fake DNS: records by "TYPE name". */
const dns = (records: Record<string, string[]>): Lookup => async (name, type) => records[`${type} ${name}`] ?? [];
const GOOD = {
  'TXT cf-bounce.mail.example.test': ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
  'MX cf-bounce.mail.example.test': ['10 route1.mx.cloudflare.net.'],
  'TXT cf-bounce._domainkey.mail.example.test': ['v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA'],
  'TXT _dmarc.mail.example.test': ['v=DMARC1; p=quarantine; rua=mailto:dmarc@mail.example.test'],
};
const by = (r: Awaited<ReturnType<typeof checkSendingDomain>>) => Object.fromEntries(r.checks.map((c) => [c.key, c.status]));

describe('sending domain DNS check', () => {
  it('passes a domain with SPF, bounce MX, DKIM and DMARC in place', async () => {
    const r = await checkSendingDomain('Mail.Example.Test.', dns(GOOD));
    expect(r.domain).toBe('mail.example.test');
    expect(by(r)).toEqual({ spf: 'PASS', mx: 'PASS', dkim: 'PASS', dmarc: 'PASS' });
    expect(r.ready).toBe(true);
    expect(r.checks.find((c) => c.key === 'spf')!.name).toBe('cf-bounce.mail.example.test');
  });

  it('says what is missing on a domain that has not been onboarded', async () => {
    const r = await checkSendingDomain('mail.example.test', dns({}));
    expect(by(r)).toEqual({ spf: 'FAIL', mx: 'FAIL', dkim: 'FAIL', dmarc: 'WARN' });
    expect(r.ready).toBe(false);
    expect(r.checks[0]!.detail).toMatch(/Onboard the domain/);
  });

  it('refuses a malformed SPF record, two SPF records, and one that does not authorise Cloudflare', async () => {
    const withSpf = (...spf: string[]) => checkSendingDomain('mail.example.test', dns({ ...GOOD, 'TXT cf-bounce.mail.example.test': spf }));
    expect((await withSpf('v=spf1 include:_spf.mx.cloudflare.net +all')).checks[0]).toMatchObject({ status: 'FAIL', detail: expect.stringMatching(/never \+all/) });
    expect((await withSpf('v=spf1 include:_spf.mx.cloudflare.net')).checks[0]!.status).toBe('FAIL'); // no "all"
    expect((await withSpf('v=spf1 include:_spf.mx.cloudflare.net ~all', 'v=spf1 include:other.example ~all')).checks[0]).toMatchObject({ status: 'FAIL', detail: expect.stringMatching(/exactly one/) });
    expect((await withSpf('v=spf1 include:other.example ~all')).checks[0]).toMatchObject({ status: 'FAIL', detail: expect.stringMatching(/_spf\.mx\.cloudflare\.net/) });
    expect((await withSpf('v=spf1 include:_spf.mx.cloudflare.net -all')).checks[0]!.status).toBe('PASS');
  });

  it('refuses a revoked DKIM key and an invalid DMARC policy, and warns on monitoring-only DMARC', async () => {
    const w = (over: Record<string, string[]>) => checkSendingDomain('mail.example.test', dns({ ...GOOD, ...over }));
    expect(by(await w({ 'TXT cf-bounce._domainkey.mail.example.test': ['v=DKIM1; k=rsa; p='] })).dkim).toBe('FAIL');
    expect(by(await w({ 'TXT _dmarc.mail.example.test': ['v=DMARC1; p=sometimes'] })).dmarc).toBe('FAIL');
    const monitoring = await w({ 'TXT _dmarc.mail.example.test': ['v=DMARC1; p=none'] });
    expect(by(monitoring).dmarc).toBe('WARN');
    expect(monitoring.ready).toBe(true); // a warning does not stop sending
    expect(by(await w({ 'TXT _dmarc.mail.example.test': ['v=DMARC1; p=reject'] })).dmarc).toBe('PASS');
  });

  it('refuses anything that is not a domain name, and reports a failed lookup instead of guessing', async () => {
    for (const bad of ['', 'localhost', 'http://example.com', 'a b.com', 'x'.repeat(300) + '.com']) await expect(checkSendingDomain(bad, dns({}))).rejects.toThrow(/not a domain name/);
    expect(validDomain('mail.example.co.in')).toBe(true);
    await expect(checkSendingDomain('mail.example.test', async () => { throw new Error('timeout'); })).rejects.toThrow(/Could not look up TXT cf-bounce\.mail\.example\.test: timeout/);
  });
});
