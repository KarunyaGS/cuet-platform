/**
 * The look and the words of every email CUET Prep sends. One shared layout, one function per message. The same functions
 * are used to send, to preview in the admin console and to send a test to the signed-in staff member, so what staff see
 * is what students get.
 */

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function layout(heading: string, paragraphs: string[], button?: { label: string; url: string }, footer?: string, links?: { label: string; url: string }[]) {
  const text = [heading, '', ...paragraphs, ...(links ?? []).flatMap((l) => ['', l.label, l.url]), ...(button ? ['', `${button.label}: ${button.url}`] : []), '', footer ?? 'CUET Prep'].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f4f0;font-family:Arial,Helvetica,sans-serif;color:#1c1b19">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:14px;font-weight:bold;letter-spacing:.04em;margin:0 0 20px">CUET Prep</p>
<div style="background:#ffffff;border:1px solid #e3e0d8;border-radius:10px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(p)}</p>`).join('\n')}
${(links ?? []).map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 10px"><a href="${esc(l.url)}" style="color:#1f4fd8">${esc(l.label)}</a></p>`).join('\n')}
${button ? `<p style="margin:20px 0 4px"><a href="${esc(button.url)}" style="display:inline-block;background:#1f4fd8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:11px 18px;border-radius:8px">${esc(button.label)}</a></p>
<p style="font-size:12px;line-height:1.5;color:#6b6860;margin:12px 0 0;word-break:break-all">If the button does not work, copy this address into your browser: ${esc(button.url)}</p>` : ''}
</div>
<p style="font-size:12px;line-height:1.5;color:#6b6860;margin:16px 4px 0">${esc(footer ?? 'You are receiving this because of your CUET Prep account.')}</p>
</div></body></html>`;
  return { text, html };
}


type Built = ReturnType<typeof layout>;
export interface NoticeLine { authority: string; publishedOn: string | null; title: string; url: string }

export const templates = {
  verify: (name: string, url: string): Built =>
    layout('Confirm your email address', [`Hello ${name},`, 'Please confirm that this address belongs to you. The link works once and expires in 48 hours.', 'If you did not create a CUET Prep account, you can ignore this email.'], { label: 'Confirm my email', url }),

  reset: (name: string, url: string): Built =>
    layout('Reset your password', [`Hello ${name},`, 'We received a request to reset the password of your CUET Prep account. The link below works once and expires in one hour.', 'If you did not ask for this, you can ignore this email. Your password stays the same.'], { label: 'Choose a new password', url }),

  passwordChanged: (name: string): Built =>
    layout('Your password was changed', [`Hello ${name},`, 'The password of your CUET Prep account was just changed, and other devices were signed out.', 'If this was not you, reset your password now from the sign-in page and tell the CUET Prep team.']),

  /** Sent once, after the student confirms the address. It promises nothing that is not in the app. */
  welcome: (name: string, base: string): Built =>
    layout(
      'Welcome to CUET Prep',
      [
        `Hello ${name},`,
        'Your email address is confirmed. Here is a simple way to begin:',
        '• Choose your exam and subjects on your profile page, so practice starts with your subjects.',
        '• Practise a few questions, and save the ones you want to revise.',
        '• Email reminders are off until you switch them on from your profile page. You decide which ones you get.',
      ],
      { label: 'Open CUET Prep', url: `${base}/dashboard` },
      'You are receiving this one-time welcome because you confirmed your CUET Prep account.',
    ),

  studyReminder: (name: string, items: string[], base: string, stop: string): Built =>
    layout('Your study plan for today', [`Hello ${name},`, ...items.map((i) => `• ${i}`)], { label: 'Open CUET Prep', url: `${base}/dashboard` }, `You asked for study reminders by email. To stop them, open ${stop} or turn them off on your profile page.`),

  /** The date is the one the student entered; the email says so and sends them to official notices for the real schedule. */
  examCountdown: (name: string, days: number, dateLabel: string, base: string, stop: string): Built =>
    layout(
      days === 1 ? 'Your exam is tomorrow' : `${days} days to your exam`,
      [
        `Hello ${name},`,
        `You told us your exam is on ${dateLabel}.`,
        days === 1 ? 'Rest well. Check your admit card and exam centre on the official NTA website.' : 'A steady routine from here counts for more than a last-minute rush. Keep an eye on the official NTA notices for the admit card and exam centre.',
        'This is the date you entered on your profile page. The official date is on the NTA website, and if it differs, please update it.',
      ],
      { label: 'Open CUET Prep', url: `${base}/dashboard` },
      `You asked for study reminders by email. To stop them, open ${stop} or turn them off on your profile page.`,
    ),

  revisionDue: (name: string, due: number, base: string, stop: string): Built =>
    layout(
      due === 1 ? 'One card to revise today' : `${due} cards to revise today`,
      [`Hello ${name},`, `${due === 1 ? 'One of your revision cards is' : `${due} of your revision cards are`} due today. A few minutes now helps you remember it.`],
      { label: 'Revise now', url: `${base}/bookmarks/review` },
      `You asked for revision reminders by email. To stop them, open ${stop} or turn them off on your profile page.`,
    ),

  noticeAlert: (name: string, shown: NoticeLine[], more: boolean, base: string, stop: string): Built =>
    layout(
      shown.length === 1 ? 'A new official notice' : 'New official notices',
      [`Hello ${name},`, 'These were published on the official websites of the National Testing Agency (NTA) and the University Grants Commission (UGC). Each link opens the notice itself on the official site.', ...(more ? ['There are more; open the updates page to see all of them.'] : [])],
      { label: 'All government updates', url: `${base}/updates` },
      `You asked for emails about new official notices. Rely on the official notice itself for anything that affects you. To stop these emails, open ${stop} or turn them off on your profile page.`,
      shown.map((n) => ({ label: `${n.authority}${n.publishedOn ? `, ${n.publishedOn}` : ''}: ${n.title}`, url: n.url })),
    ),
};

/** Every message that can be previewed or sent as a test, with made-up sample data (never a real student's). */
export const TEMPLATE_NAMES = ['welcome', 'verify', 'reset', 'passwordChanged', 'studyReminder', 'examCountdown', 'revisionDue', 'noticeAlert'] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export function sampleEmail(name: TemplateName, base: string): Built & { subject: string } {
  const who = 'Asha';
  const stop = `${base}/unsubscribe#sample-token`;
  switch (name) {
    case 'welcome': return { subject: 'Welcome to CUET Prep', ...templates.welcome(who, base) };
    case 'verify': return { subject: 'Confirm your email for CUET Prep', ...templates.verify(who, `${base}/verify-email#sample-token`) };
    case 'reset': return { subject: 'Reset your CUET Prep password', ...templates.reset(who, `${base}/reset-password#sample-token`) };
    case 'passwordChanged': return { subject: 'Your CUET Prep password was changed', ...templates.passwordChanged(who) };
    case 'studyReminder': return { subject: '2 planned tasks left today', ...templates.studyReminder(who, ['2 planned tasks left today. Open the planner to tick them off or move them.', '5 more questions to reach today’s goal. Daily practice picks questions for you.'], base, stop) };
    case 'examCountdown': return { subject: '7 days to your exam', ...templates.examCountdown(who, 7, '20 May 2027', base, stop) };
    case 'revisionDue': return { subject: '3 cards to revise today', ...templates.revisionDue(who, 3, base, stop) };
    case 'noticeAlert':
      return {
        subject: '2 new official notices',
        ...templates.noticeAlert(
          who,
          [
            { authority: 'NTA', publishedOn: '2026-11-10', title: 'Sample notice from the National Testing Agency', url: 'https://nta.ac.in/' },
            { authority: 'UGC', publishedOn: '2026-11-12', title: 'Sample letter from the University Grants Commission', url: 'https://www.ugc.gov.in/' },
          ],
          false,
          base,
          stop,
        ),
      };
  }
}
