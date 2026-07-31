"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Avatar, Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useViewAsUser } from "@/lib/use-view-as-user";

export function ChatView() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const { data: messages, isLoading } = api.chat.list.useQuery(undefined, {
    refetchInterval: 5_000, // casi tiempo real sin websockets
  });
  const { data: users } = api.user.list.useQuery();
  const [text, setText] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [viewAsUser] = useViewAsUser();

  const myId = session?.user.id;

  // Envío optimista: el mensaje aparece al instante con un id temporal y el servidor confirma detrás
  const send = api.chat.send.useMutation({
    onMutate: async ({ text: newText }) => {
      await utils.chat.list.cancel();
      const previous = utils.chat.list.getData();
      setText("");
      if (previous && myId) {
        const optimistic = {
          id: `temp-${Date.now()}`,
          userId: myId,
          text: newText,
          createdAt: new Date(),
          user: { id: myId, name: session?.user.name ?? "" },
          reactions: [] as { userId: string; emoji: string }[],
        };
        utils.chat.list.setData(undefined, [...previous, optimistic]);
      }
      return { previous, newText };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.chat.list.setData(undefined, context.previous);
      if (context?.newText) setText(context.newText); // devolver el texto para reintentar
    },
    onSettled: () => utils.chat.list.invalidate(),
  });
  const sendError = send.error?.message ?? null;

  const remove = api.chat.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.chat.list.cancel();
      const previous = utils.chat.list.getData();
      if (previous) utils.chat.list.setData(undefined, previous.filter((m) => m.id !== id));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.chat.list.setData(undefined, context.previous);
    },
    onSettled: () => utils.chat.list.invalidate(),
  });

  // Reacción optimista: se pinta/despinta al toque y se confirma detrás
  const react = api.chat.toggleReaction.useMutation({
    onMutate: async ({ messageId, emoji }) => {
      setPickerFor(null);
      await utils.chat.list.cancel();
      const previous = utils.chat.list.getData();
      if (previous && myId) {
        utils.chat.list.setData(
          undefined,
          previous.map((m) => {
            if (m.id !== messageId) return m;
            const mine = m.reactions.some((r) => r.emoji === emoji && r.userId === myId);
            return {
              ...m,
              reactions: mine
                ? m.reactions.filter((r) => !(r.emoji === emoji && r.userId === myId))
                : [...m.reactions, { userId: myId, emoji }],
            };
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.chat.list.setData(undefined, context.previous);
    },
    onSettled: () => utils.chat.list.invalidate(),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  if (isLoading) return <Spinner />;

  const avatarOf = (userId: string) => users?.find((u) => u.id === userId)?.avatarUrl ?? null;

  return (
    <div className="-mb-24 flex h-[calc(100dvh-14.5rem)] min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface md:mb-0 md:h-[calc(100dvh-11.5rem)]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            Nadie ha escrito todavía. ¡Rompe el hielo! 💬
          </p>
        )}
        {messages?.map((m) => {
          const mine = m.user.id === myId;
          return (
            <div key={m.id} className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}>
              {!mine && (
                <Link href={`/perfil/${m.user.id}`} className="shrink-0 transition hover:opacity-80">
                  <Avatar name={m.user.name} src={avatarOf(m.user.id)} size={28} />
                </Link>
              )}
              <div className={cn("max-w-[75%]", mine && "flex flex-col items-end")}>
                <button
                  type="button"
                  onClick={() => setPickerFor((p) => (p === m.id ? null : m.id))}
                  className={cn(
                    "block w-full rounded-2xl px-3 py-2 text-left",
                    mine ? "rounded-br-md bg-accent/20" : "rounded-bl-md bg-surface-2",
                  )}
                >
                  {!mine && <p className="text-xs font-semibold text-accent">{m.user.name}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                  <p className="mt-0.5 text-right text-[10px] text-muted">
                    {format(m.createdAt, "d MMM · HH:mm", { locale: es })}
                  </p>
                </button>
                {(m.reactions.length > 0 || pickerFor === m.id) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(["👍", "💪", "🔥"] as const).map((emoji) => {
                      const count = m.reactions.filter((r) => r.emoji === emoji).length;
                      const iReacted = m.reactions.some((r) => r.emoji === emoji && r.userId === myId);
                      if (count === 0 && pickerFor !== m.id) return null;
                      return (
                        <button
                          key={emoji}
                          onClick={() => react.mutate({ messageId: m.id, emoji })}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs transition",
                            iReacted ? "bg-accent/25" : "bg-surface-2 hover:bg-accent/15",
                            count === 0 && "opacity-60",
                          )}
                        >
                          {emoji}{count > 0 ? ` ${count}` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {(mine || (session?.user.role === "ADMIN" && !viewAsUser)) && (
                <button
                  title="Borrar mensaje"
                  onClick={() => remove.mutate({ id: m.id })}
                  className="text-muted/50 transition hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <p className="border-t border-border px-3 pt-2 text-xs text-red-400">
          No se pudo enviar: {sendError}
        </p>
      )}
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length > 0) send.mutate({ text: text.trim() });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje…"
          maxLength={1000}
          className="h-11 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
        <Button type="submit" disabled={text.trim().length === 0} loading={send.isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
