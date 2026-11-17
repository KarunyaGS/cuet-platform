/**
 * The floating Help and support widget: chat with the support team, raise a ticket, follow the tickets.
 * Everything here is real: messages and tickets are stored against the signed-in student and answered by a person in the admin console.
 * There is no automatic reply, and no "online" or reply-time claim (the platform has no availability data).
 */
import { ChevronLeft, ChevronRight, ClipboardList, Headphones, MessageCircle, Paperclip, Send, Ticket, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, type SupportAttachment, type SupportConversation, type SupportMessage, type SupportThread } from '../api';
import { useAuth } from '../ui';

type View = 'home' | 'chat' | 'new' | 'tickets' | 'ticket';
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Open', cls: 'bg-marker-soft text-marker' },
  IN_PROGRESS: { label: 'In progress', cls: 'bg-accent-soft text-accent' },
  RESOLVED: { label: 'Resolved', cls: 'bg-correct-soft text-correct' },
};

/** A draft kept in the browser for this tab, so a half-written message survives switching sections, pages and a refresh. */
function useDraft<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage may be blocked: the draft then lives only in memory */
    }
  }, [key, v]);
  return [v, setV];
}

/** A file picked but not yet sent is kept (in memory) while the student moves between sections, like the typed text. */
const pendingFiles = new Map<string, File>();
function usePendingFile(key: string): [File | null, (f: File | null) => void] {
  const [file, set] = useState<File | null>(() => pendingFiles.get(key) ?? null);
  return [
    file,
    (f) => {
      if (f) pendingFiles.set(key, f);
      else pendingFiles.delete(key);
      set(f);
    },
  ];
}

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function checkFile(f: File): string | null {
  if (!TYPES.includes(f.type)) return 'Attach a PNG, JPG, WebP or PDF file.';
  if (f.size > MAX_BYTES) return 'The file is larger than 3 MB.';
  if (f.size === 0) return 'The file is empty.';
  return null;
}

function AttachPicker({ file, onFile, error, onError }: { file: File | null; onFile: (f: File | null) => void; error: string | null; onError: (e: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0">
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        hidden
        data-support-file
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = '';
          if (!f) return;
          const bad = checkFile(f);
          onError(bad);
          onFile(bad ? null : f);
        }}
      />
      {file ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-paper px-2 py-1 text-xs text-ink-2">
          <Paperclip aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{file.name}</span>
          <button type="button" aria-label="Remove attachment" onClick={() => onFile(null)} className="shrink-0 text-ink-3 hover:text-ink">
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-2 hover:bg-ink/5 hover:text-ink">
          <Paperclip aria-hidden className="size-3.5" />
          Attach a screenshot or PDF
        </button>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-wrong" data-support-file-error>
          {error}
        </p>
      )}
    </div>
  );
}

function Bubbles({ messages, base }: { messages: SupportMessage[]; base: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  return (
    <ol className="space-y-2.5" data-support-messages>
      {messages.map((m) => (
        <li key={m.id} className={`flex flex-col ${m.from === 'YOU' ? 'items-end' : 'items-start'}`} data-from={m.from}>
          <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-snug ${m.from === 'YOU' ? 'rounded-br-sm bg-accent text-white' : 'rounded-bl-sm bg-paper text-ink'}`}>
            {m.body}
            {m.attachment && (
              <a href={`${base}/${m.id}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs underline">
                <Paperclip aria-hidden className="size-3" />
                {m.attachment.name}
              </a>
            )}
          </div>
          <span className="mt-0.5 px-1 text-[11px] text-ink-3">
            {m.from === 'SUPPORT' ? 'Support · ' : ''}
            {time(m.at)}
          </span>
        </li>
      ))}
      <div ref={end} />
    </ol>
  );
}

/** The message box with its attach button: used by the chat and by a ticket's reply. */
function Composer({ draftKey, placeholder, onSend, label }: { draftKey: string; placeholder: string; onSend: (body: string, a?: SupportAttachment) => Promise<void>; label: string }) {
  const [text, setText] = useDraft(draftKey, '');
  const [file, setFile] = usePendingFile(draftKey);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const attachment = file ? await api.supportUpload(file) : undefined;
      await onSend(text.trim(), attachment);
      setText('');
      setFile(null);
    } catch (x) {
      setErr((x as Error).message || 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="border-t border-rule p-2.5" data-support-composer>
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit(e as unknown as FormEvent);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder={placeholder}
          aria-label={label}
          className="min-h-10 flex-1 resize-none rounded-lg border border-rule-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
          <Send aria-hidden className="size-4" />
        </button>
      </div>
      <div className="mt-1.5">
        <AttachPicker file={file} onFile={setFile} error={fileErr} onError={setFileErr} />
      </div>
      {err && (
        <p role="alert" className="mt-1 text-xs text-wrong">
          {err}
        </p>
      )}
    </form>
  );
}

function ChatView({ open }: { open: boolean }) {
  const [chat, setChat] = useState<SupportConversation | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    api.supportChat().then(
      (c) => (setChat(c), setError(false)),
      () => setError(true),
    );
  }, []);
  useEffect(() => {
    load();
    if (!open) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, open]);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-support-view="chat">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {error && <p className="text-[13px] text-wrong">The conversation could not be loaded. It will retry.</p>}
        {chat && chat.messages.length === 0 && <p className="text-[13px] text-ink-2">Ask your question here. Replies from our team appear in this conversation.</p>}
        {chat && chat.messages.length > 0 && <Bubbles messages={chat.messages} base="/api/student/support/attachments" />}
      </div>
      <Composer draftKey="prepora.support.chat" label="Message" placeholder="Write a message" onSend={async (body, attachment) => setChat(await api.supportSend({ body, attachment }))} />
    </div>
  );
}

function NewTicket({ onCreated }: { onCreated: (t: SupportThread) => void }) {
  const cats = useRef<{ code: string; label: string }[]>([]);
  const [, force] = useState(0);
  const [form, setForm] = useDraft('prepora.support.ticket', { category: '', title: '', description: '' });
  const [file, setFile] = usePendingFile('prepora.support.ticket');
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<SupportThread | null>(null);
  useEffect(() => {
    api.supportCategories().then((c) => ((cats.current = c), force((n) => n + 1)), () => undefined);
  }, []);
  const field = 'w-full rounded-lg border border-rule-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent';
  const ready = form.category && form.title.trim().length >= 5 && form.description.trim().length >= 10;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const attachment = file ? await api.supportUpload(file) : undefined;
      const r = await api.supportRaise({ category: form.category, title: form.title.trim(), description: form.description.trim(), attachment });
      setForm({ category: '', title: '', description: '' });
      setFile(null);
      setMade(r.thread);
      onCreated(r.thread);
    } catch (x) {
      setErr((x as Error).message || 'Could not raise the ticket. Try again.');
    } finally {
      setBusy(false);
    }
  };
  if (made)
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5 text-center" data-support-view="created" role="status">
        <p className="text-[13px] text-ink-2">Your ticket has been raised</p>
        <p className="num mt-1 text-xl font-semibold text-ink" data-ticket-reference>
          {made.reference}
        </p>
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[made.status]!.cls}`}>{STATUS[made.status]!.label}</span>
        <p className="mt-3 text-[13px] text-ink-2">Our team will reply in My requests. Keep the reference to follow it.</p>
        <button type="button" onClick={() => setMade(null)} className="mt-3 text-[13px] font-medium text-accent hover:underline">
          Raise another ticket
        </button>
      </div>
    );
  return (
    <form onSubmit={submit} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3" data-support-view="new">
      <label className="block text-xs font-medium text-ink-2">
        What is it about?
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${field} mt-1`} aria-label="Category">
          <option value="">Choose a subject</option>
          {cats.current.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ink-2">
        Short title
        <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="In a few words" className={`${field} mt-1`} aria-label="Title" />
      </label>
      <label className="block text-xs font-medium text-ink-2">
        Details
        <textarea value={form.description} maxLength={4000} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What happened? What did you expect?" className={`${field} mt-1 resize-none`} aria-label="Description" />
      </label>
      <AttachPicker file={file} onFile={setFile} error={fileErr} onError={setFileErr} />
      {err && (
        <p role="alert" className="text-xs text-wrong">
          {err}
        </p>
      )}
      <button type="submit" disabled={!ready || busy} className="h-9 w-full rounded-lg bg-accent text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit ticket'}
      </button>
    </form>
  );
}

function TicketList({ items, onOpen, error }: { items: SupportThread[] | null; onOpen: (id: string) => void; error: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-support-view="tickets">
      {error && <p className="px-4 py-3 text-[13px] text-wrong">Your requests could not be loaded.</p>}
      {items && items.length === 0 && <p className="px-4 py-4 text-[13px] text-ink-2">You have not raised a ticket yet.</p>}
      <ul className="divide-y divide-rule">
        {(items ?? []).map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onOpen(t.id)} data-ticket-row={t.reference} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-paper">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="num text-[11px] font-semibold text-ink-3">{t.reference}</span>
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-medium ${STATUS[t.status]!.cls}`}>{STATUS[t.status]!.label}</span>
                  {t.hasUnreadReply && <span aria-label="New reply" className="size-2 rounded-full bg-accent" />}
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-medium text-ink">{t.title}</span>
                <span className="block truncate text-xs text-ink-3">
                  {t.categoryLabel} · {day(t.createdAt)}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TicketView({ id, open, onBack, onChanged }: { id: string; open: boolean; onBack: () => void; onChanged: () => void }) {
  const [t, setT] = useState<(SupportConversation & { thread: SupportThread }) | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    api.supportTicket(id).then(
      (r) => (setT(r), setError(false), onChanged()),
      () => setError(true),
    );
  }, [id, onChanged]);
  useEffect(() => {
    load();
    if (!open) return;
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load, open]);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-support-view="ticket">
      <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Back to my requests" className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-ink/5">
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        {t && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="num text-[11px] font-semibold text-ink-3">{t.thread.reference}</span>
              <span className={`rounded-full px-1.5 py-px text-[11px] font-medium ${STATUS[t.thread.status]!.cls}`} data-ticket-status>
                {STATUS[t.thread.status]!.label}
              </span>
            </div>
            <div className="truncate text-[13px] font-medium text-ink">{t.thread.title}</div>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {error && <p className="text-[13px] text-wrong">This request could not be loaded.</p>}
        {t && <Bubbles messages={t.messages} base="/api/student/support/attachments" />}
      </div>
      {t && <Composer draftKey={`prepora.support.reply.${id}`} label="Reply" placeholder={t.thread.status === 'RESOLVED' ? 'Add a reply to reopen this ticket' : 'Write a reply'} onSend={async (body, attachment) => setT(await api.supportReply(id, { body, attachment }))} />}
    </div>
  );
}

const OPTIONS: { view: Exclude<View, 'home' | 'ticket'>; title: string; text: string; icon: typeof MessageCircle }[] = [
  { view: 'chat', title: 'Chat with us', text: 'Ask a question', icon: MessageCircle },
  { view: 'new', title: 'Raise a ticket', text: 'Report a problem', icon: Ticket },
  { view: 'tickets', title: 'My support requests', text: 'Follow your tickets', icon: ClipboardList },
];

export function SupportWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('home');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportThread[] | null>(null);
  const [ticketsErr, setTicketsErr] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadTickets = useCallback(() => {
    api.supportTickets().then(
      (r) => (setTickets(r), setTicketsErr(false)),
      () => setTicketsErr(true),
    );
  }, []);
  const refreshUnread = useCallback(() => {
    api.supportUnread().then((r) => setUnread(r.unread), () => undefined);
  }, []);
  // The badge on the button: how many replies the student has not seen yet.
  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);
  useEffect(() => {
    if (open && user && view === 'tickets') loadTickets();
  }, [open, user, view, loadTickets]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (v: View) => {
    setView(v);
    if (v !== 'ticket') setTicketId(null);
  };
  const tab = (v: Exclude<View, 'ticket'>, label: string) => {
    const on = view === v || (v === 'tickets' && view === 'ticket');
    return (
      <button key={v} type="button" role="tab" aria-selected={on} onClick={() => go(v)} data-support-tab={v} className={`flex-1 rounded-md px-1 py-1.5 text-xs transition-colors ${on ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-ink/5'}`}>
        {label}
      </button>
    );
  };

  return (
    <div className="fixed right-4 bottom-20 z-40 md:right-6 md:bottom-6" data-support-widget>
      {open && (
        <div role="dialog" aria-label="Help and support" data-support-panel className="absolute right-0 bottom-16 flex h-[min(34rem,calc(100dvh-9rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-rule bg-surface shadow-xl shadow-ink/10">
          <div className="relative shrink-0 bg-gradient-to-br from-accent to-[#5b86e0] px-4 pt-3.5 pb-4 text-white">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close support" className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full text-white/90 hover:bg-white/15">
              <X aria-hidden className="size-4" />
            </button>
            <button type="button" onClick={() => go('home')} className="block text-left">
              <h2 className="text-[17px] leading-tight font-semibold">How can we help?</h2>
              <p className="mt-0.5 pr-6 text-xs text-white/85">We&apos;re here to help with your questions and concerns.</p>
            </button>
          </div>
          {!user ? (
            <div className="flex-1 px-4 py-5 text-[13px] text-ink-2" data-support-view="signin">
              <p>Sign in to chat with us, raise a ticket and follow your requests.</p>
              <Link to="/signin" onClick={() => setOpen(false)} className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-medium text-white hover:bg-accent/90">
                Sign in
              </Link>
            </div>
          ) : (
            <>
              {view !== 'home' && (
                <div role="tablist" aria-label="Support" className="flex shrink-0 gap-1 border-b border-rule px-2 py-1.5">
                  {tab('chat', 'Chat')}
                  {tab('new', 'Raise a ticket')}
                  {tab('tickets', 'My requests')}
                </div>
              )}
              {view === 'home' && (
                <ul className="flex-1 divide-y divide-rule overflow-y-auto" data-support-view="home">
                  {OPTIONS.map((o) => (
                    <li key={o.view}>
                      <button type="button" onClick={() => go(o.view)} data-support-option={o.view} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper">
                        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                          <o.icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-ink">{o.title}</span>
                          <span className="block text-xs text-ink-3">{o.text}</span>
                        </span>
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {view === 'chat' && <ChatView open={open} />}
              {view === 'new' && (
                <NewTicket
                  onCreated={(t) => {
                    setTicketId(t.id);
                    loadTickets();
                  }}
                />
              )}
              {view === 'tickets' && (
                <TicketList
                  items={tickets}
                  error={ticketsErr}
                  onOpen={(id) => {
                    setTicketId(id);
                    setView('ticket');
                  }}
                />
              )}
              {view === 'ticket' && ticketId && (
                <TicketView
                  id={ticketId}
                  open={open}
                  onBack={() => go('tickets')}
                  onChanged={() => {
                    refreshUnread();
                    loadTickets();
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close help and support' : 'Help and support'}
        aria-expanded={open}
        data-support-button
        className="relative grid size-13 place-items-center rounded-full bg-accent text-white shadow-lg shadow-ink/20 transition-colors hover:bg-accent-strong"
      >
        {open ? <X aria-hidden className="size-6" /> : <Headphones aria-hidden className="size-6" />}
        {!open && unread > 0 && (
          <span data-support-badge className="num absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-wrong px-1 text-[11px] leading-5 font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
