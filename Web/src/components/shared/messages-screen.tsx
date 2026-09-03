'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  classesApi,
  communicationApi,
} from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/client';
import {
  entityId,
  messageSenderId,
  refDoc,
  refId,
  studentName,
  type ChatContact,
  type Message,
  type Student,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import { useChatSocket } from '@/lib/hooks/use-chat-socket';
import type { Role } from '@/lib/auth/session';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
  PageHeader,
  Spinner,
} from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { cn, formatRelative, humanize } from '@/lib/utils';

/**
 * Two-pane messaging, shared by every role that can message.
 *
 * On desktop the thread list and the conversation sit side by side; on phones
 * only one is on screen at a time and picking a thread swaps to it, with the
 * back arrow returning to the list.
 *
 * The compose picker is role-aware: an admin sees the whole school's staff and
 * parents, a parent sees their child's class teacher plus the office, and a
 * teacher sees the parents of the children in their own classes plus the
 * office — mirroring who the app lets each person start a chat with.
 */
export function MessagesScreen({
  role,
  children,
  selectedChild,
}: {
  role: Role;
  /** The parent's own children — only the parent portal supplies these. */
  children?: Student[];
  selectedChild?: Student | null;
}) {
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const threads = useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: communicationApi.threads,
    refetchInterval: 45_000,
  });

  const active = threads.data?.find((thread) => thread.userId === openThread) ?? null;
  // With nothing to pick from, the empty state in the list column says it all —
  // a second panel telling you to "pick a conversation" would be pointing at
  // an empty list.
  const hasThreads = !!threads.data?.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setComposing(true)}>
            New message
          </Button>
        }
      />

      <div className={cn('grid gap-4', hasThreads && 'lg:grid-cols-[22rem_1fr]')}>
        {/* Thread list — hidden on phones once a conversation is open. */}
        <div className={cn('space-y-2', openThread && 'hidden lg:block')}>
          {threads.isLoading ? (
            <ListSkeleton rows={4} />
          ) : threads.error ? (
            <ErrorState
              message={errorMessage(threads.error)}
              onRetry={() => threads.refetch()}
            />
          ) : !threads.data?.length ? (
            <EmptyState
              icon={<MessageSquare className="size-6" />}
              title="No conversations yet"
              message="Start one with a teacher or the school office."
              action={
                <Button variant="secondary" onClick={() => setComposing(true)}>
                  New message
                </Button>
              }
            />
          ) : (
            threads.data.map((thread) => (
              <button
                key={thread.userId}
                type="button"
                onClick={() => setOpenThread(thread.userId)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5',
                  openThread === thread.userId && 'ring-2 ring-accent',
                )}
              >
                <Avatar name={thread.name} id={thread.userId} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display font-bold">{thread.name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-[var(--color-text-muted)]">
                      {formatRelative(thread.lastAt)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">
                    {humanize(thread.role)} · {thread.lastMessage}
                  </span>
                </span>
                {thread.unread > 0 && (
                  <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                    {thread.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Conversation pane — only worth a column once there is one to open. */}
        <div className={cn(!openThread && 'hidden', hasThreads && 'lg:block')}>
          {openThread ? (
            <Conversation
              userId={openThread}
              name={active?.name ?? 'Conversation'}
              role={active?.role}
              currentUserId={session?.userId ?? ''}
              onBack={() => setOpenThread(null)}
              onSent={() => queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] })}
            />
          ) : (
            <Card className="hidden h-full min-h-72 place-items-center lg:grid">
              <p className="text-sm text-[var(--color-text-muted)]">
                Pick a conversation to read it.
              </p>
            </Card>
          )}
        </div>
      </div>

      <ComposeModal
        role={role}
        children={children ?? []}
        selectedChild={selectedChild ?? null}
        open={composing}
        onClose={() => setComposing(false)}
        onSent={setOpenThread}
      />
    </div>
  );
}

/** Day heading between message groups: Today, Yesterday, else the date. */
function dayLabel(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  const today = new Date();
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(today) - midnight(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

const clockTime = (value?: string) =>
  value ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

function Conversation({
  userId,
  name,
  role,
  currentUserId,
  onBack,
  onSent,
}: {
  userId: string;
  name: string;
  role?: string;
  currentUserId: string;
  onBack: () => void;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: ['messages', 'conversation', userId],
    queryFn: () => communicationApi.conversation(userId),
    // The socket carries new messages; this is the fallback for a dropped
    // connection, so it can be slow rather than chatty.
    refetchInterval: 60_000,
  });

  /* -- Realtime ------------------------------------------------------- */

  const socket = useChatSocket({
    userId: currentUserId,
    peerId: userId,
    onMessage: (incoming) => {
      const from = messageSenderId(incoming);
      const to = refId(incoming.recipient);
      // Only the open conversation's traffic belongs in this list; anything
      // else still refreshes the thread list so its badge and preview move.
      if (from === userId || to === userId) {
        queryClient.setQueryData<Message[]>(
          ['messages', 'conversation', userId],
          (current = []) =>
            current.some((m) => entityId(m) === entityId(incoming))
              ? current
              : [...current, incoming],
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
    },
  });

  const online = socket.onlineUserIds.includes(userId);

  // Keep the newest message in view as the thread loads and grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data, socket.peerTyping]);

  // Anything unread in this thread is read the moment it's on screen.
  useEffect(() => {
    const unread = (messages.data ?? []).filter(
      (message) => !message.read && messageSenderId(message) === userId,
    );
    if (!unread.length) return;
    void Promise.all(
      unread.map((message) => communicationApi.markMessageRead(entityId(message))),
    ).then(() => queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] }));
  }, [messages.data, userId, queryClient]);

  const send = useMutation({
    mutationFn: (body: string) => communicationApi.sendMessage({ recipientId: userId, body }),
    onSuccess: (created) => {
      setDraft('');
      socket.sendTyping(userId, false);
      // Show it straight away rather than waiting for a refetch; the socket
      // echo is de-duplicated by id, so this cannot double up.
      if (created) {
        queryClient.setQueryData<Message[]>(
          ['messages', 'conversation', userId],
          (current = []) =>
            current.some((m) => entityId(m) === entityId(created))
              ? current
              : [...current, created],
        );
      } else {
        void messages.refetch();
      }
      onSent();
    },
    onError: (error) => toast.error(errorMessage(error, 'Message not sent.')),
  });

  function submit() {
    const body = draft.trim();
    if (body) send.mutate(body);
  }

  function onDraftChange(value: string) {
    setDraft(value);
    socket.sendTyping(userId, value.trim().length > 0);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    // Stop the indicator after a pause, so it does not stick while they think.
    typingTimer.current = setTimeout(() => socket.sendTyping(userId, false), 2500);
  }

  const rows = messages.data ?? [];

  return (
    <Card className="flex h-[calc(100dvh-11rem)] flex-col overflow-hidden p-0 sm:h-[70dvh] lg:h-[calc(100dvh-13rem)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-hairline)] px-3 py-2.5 sm:px-4 sm:py-3">
        <IconButton label="Back to conversations" onClick={onBack} className="-ml-1 lg:hidden">
          <ArrowLeft className="size-5" />
        </IconButton>
        <span className="relative shrink-0">
          <Avatar name={name} id={userId} size={38} />
          {online && (
            <span
              className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white bg-[var(--color-success)]"
              aria-hidden
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold">{name}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {socket.peerTyping ? (
              <span className="font-semibold text-accent">typing…</span>
            ) : (
              [role ? humanize(role) : null, online ? 'Online' : null].filter(Boolean).join(' · ')
            )}
          </p>
        </div>
      </header>

      {/* The scroller. justify-end keeps a short thread pinned to the composer
          instead of stranding two bubbles at the top of a tall empty pane. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto bg-[var(--color-canvas)]/40">
        <div className="flex flex-col px-3 py-4 sm:px-4">
          {messages.isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : !rows.length ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              No messages yet — say hello.
            </p>
          ) : (
            rows.map((message, i) => {
              const mine = messageSenderId(message) === currentUserId;
              const previous = rows[i - 1];
              const next = rows[i + 1];
              const newDay = dayLabel(message.createdAt) !== dayLabel(previous?.createdAt);
              // Runs from one person are grouped: only the last bubble in a run
              // carries the tail and the timestamp, which is what stops a long
              // exchange reading as a wall of identical blocks.
              const sameAsPrevious =
                !newDay && !!previous && messageSenderId(previous) === messageSenderId(message);
              const endsRun =
                !next ||
                messageSenderId(next) !== messageSenderId(message) ||
                dayLabel(next.createdAt) !== dayLabel(message.createdAt);

              return (
                <div key={entityId(message)}>
                  {newDay && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--color-text-muted)] shadow-sm">
                        {dayLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex',
                      mine ? 'justify-end' : 'justify-start',
                      sameAsPrevious ? 'mt-0.5' : 'mt-2',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]',
                        mine ? 'bg-accent text-white' : 'bg-white text-[var(--color-text)]',
                        // Square off the corner nearest the speaker on the last
                        // bubble of a run — the tail that shows who is talking.
                        endsRun && (mine ? 'rounded-br-sm' : 'rounded-bl-sm'),
                      )}
                    >
                      {message.subject && (
                        <p className="mb-0.5 text-xs font-bold opacity-80">{message.subject}</p>
                      )}
                      <p className="leading-relaxed break-words whitespace-pre-wrap">
                        {message.body}
                      </p>
                      {endsRun && (
                        <p
                          className={cn(
                            'mt-1 text-right text-[10px] font-semibold',
                            mine ? 'text-white/70' : 'text-[var(--color-text-muted)]',
                          )}
                        >
                          {clockTime(message.createdAt)}
                          {mine && (
                            <span className="ml-1" title={message.read ? 'Read' : 'Sent'}>
                              {message.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {socket.peerTyping && (
            <div className="mt-2 flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-[var(--color-hairline)] bg-white p-2.5 sm:p-3"
      >
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Write a message…"
          rows={1}
          className="max-h-32 min-h-11 flex-1 resize-none"
          aria-label="Message"
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline — what people expect.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          loading={send.isPending}
          disabled={!draft.trim()}
          icon={<Send className="size-4" />}
          aria-label="Send"
          className="shrink-0"
        >
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </Card>
  );
}

/**
 * A suggested recipient, with an optional child the message is about. The
 * `relatedStudent` is sent along so the thread carries context ("Re: Aarav").
 */
interface RecipientOption extends Omit<ChatContact, 'email'> {
  email?: string | null;
  /** The child this person is linked to, when the picker is roster-driven. */
  childName?: string;
  childId?: string;
}

/**
 * Composing a message. Who you can send to depends on your role:
 *
 *  * **Admin** — anyone in the school: every teacher and parent (server-side
 *    `/contacts`).
 *  * **Parent** — their child's class teacher (plus the office), resolved from
 *    the selected child's class. The message is scoped to that child.
 *  * **Teacher** — the parents of children in their own classes (plus the
 *    office). Each parent is labelled with their child's name.
 */
function ComposeModal({
  role,
  children,
  selectedChild,
  open,
  onClose,
  onSent,
}: {
  role: Role;
  children: Student[];
  selectedChild: Student | null;
  open: boolean;
  onClose: () => void;
  onSent: (userId: string) => void;
}) {
  const [recipientId, setRecipientId] = useState('');
  const [childId, setChildId] = useState('');
  const [body, setBody] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const isAdmin = role === 'admin' || role === 'super_admin';

  // The office is a valid recipient for everyone; the server restricts what a
  // parent/teacher sees to office accounts.
  const office = useQuery({
    queryKey: ['messages', 'contacts'],
    queryFn: communicationApi.contacts,
    enabled: open,
  });

  // Classes are needed to resolve a parent's class teacher and to find a
  // teacher's own classes. `GET /classes` returns the whole school's list, so
  // the teacher's set is filtered to classes they actually teach.
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
    enabled: open && !isAdmin,
  });
  const allClasses = classesQuery.data ?? [];

  // A parent composes per child, so the child selector drives the recipient.
  const activeChild =
    children.find((child) => entityId(child) === childId) ??
    (role === 'parent' ? selectedChild : null) ??
    children[0] ??
    null;

  // The teacher's own classes, then the parents in their rosters.
  const myClasses = allClasses.filter(
    (schoolClass) => refId(schoolClass.classTeacher) === session?.userId,
  );
  const rosterQueries = useQueries({
    queries:
      role === 'teacher'
        ? myClasses.map((schoolClass) => ({
            queryKey: ['classes', entityId(schoolClass), 'students'],
            queryFn: () => classesApi.students(entityId(schoolClass)),
            enabled: open,
          }))
        : [],
  });
  const rosterStudents: Student[] = rosterQueries.flatMap((q) => q.data ?? []);

  /** Teacher's parents, one row per child, deduped by parent account. */
  const teacherContacts = useMemo(() => {
    const seen = new Set<string>();
    const list: RecipientOption[] = [];
    for (const student of rosterStudents) {
      const parentId = refId(student.parentUserId);
      if (!parentId || seen.has(parentId)) continue;
      seen.add(parentId);
      list.push({
        userId: parentId,
        name: `Parent of ${studentName(student)}`,
        role: 'parent',
        email: null,
        childName: studentName(student),
        childId: entityId(student),
      });
    }
    return list;
  }, [rosterStudents]);

  const officeContacts: RecipientOption[] = (office.data ?? []).map((contact) => ({
    ...contact,
    email: contact.email ?? null,
  }));

  // The parent's child's class teacher, from the class list.
  const classOfChild = allClasses.find(
    (schoolClass) => entityId(schoolClass) === refId(activeChild?.classId),
  );
  const childsTeacher = classOfChild ? refId(classOfChild.classTeacher) : '';
  const classTeacherContact: RecipientOption[] =
    role === 'parent' && childsTeacher
      ? [
          {
            userId: childsTeacher,
            name: refDoc(classOfChild?.classTeacher)?.name ?? 'Class teacher',
            role: 'teacher',
            email: null,
            childName: activeChild ? studentName(activeChild) : undefined,
            childId: activeChild ? entityId(activeChild) : undefined,
          },
        ]
      : [];

  // Role-specific recipients.
  const recipients: RecipientOption[] = isAdmin
    ? officeContacts
    : role === 'parent'
      ? [...classTeacherContact, ...officeContacts]
      : [...teacherContacts, ...officeContacts];

  const loadingRecipients =
    office.isLoading ||
    (!isAdmin && classesQuery.isLoading) ||
    (role === 'teacher' && rosterQueries.some((q) => q.isLoading));

  // The child the chosen recipient is linked to, carried as `relatedStudent`.
  const recipientChildId =
    recipients.find((r) => r.userId === recipientId)?.childId ?? undefined;

  // Fresh form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setRecipientId('');
    setBody('');
    setChildId('');
  }, [open]);

  const send = useMutation({
    mutationFn: () =>
      communicationApi.sendMessage({
        recipientId,
        body: body.trim(),
        // A child-scoped message (parent → class teacher, teacher → parent)
        // carries the child so the thread shows what it's about.
        ...(recipientChildId ? { relatedStudent: recipientChildId } : {}),
      }),
    onSuccess: () => {
      toast.success('Message sent.');
      void queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
      onSent(recipientId);
      setBody('');
      setRecipientId('');
      setChildId('');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'Message not sent.')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={!recipientId || !body.trim()}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {role === 'parent' && children.length > 0 && (
          <Select
            label="Child"
            value={entityId(activeChild ?? {})}
            onChange={(e) => setChildId(e.target.value)}
            options={children.map((child) => ({
              value: entityId(child),
              label: studentName(child),
            }))}
            hint="Messages go to this child's class teacher."
          />
        )}

        <Select
          label="To"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          placeholder={loadingRecipients ? 'Loading…' : 'Choose a recipient'}
          required
          options={recipients.map((recipient) => ({
            value: recipient.userId,
            label: `${recipient.name} · ${humanize(recipient.role)}`,
          }))}
        />
        <Textarea
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What would you like to say?"
          rows={5}
          required
        />
      </div>
    </Modal>
  );
}
