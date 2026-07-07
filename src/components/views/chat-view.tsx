"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Avatar, Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ChatView() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const { data: messages, isLoading } = api.chat.list.useQuery(undefined, {
    refetchInterval: 5_000, // casi tiempo real sin websockets
  });
  const { data: users } = api.user.list.useQuery();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = api.chat.send.useMutation({
    onSuccess: () => {
      setText("");
      utils.chat.list.invalidate();
    },
  });
  const sendError = send.error?.message ?? null;
  const remove = api.chat.delete.useMutation({ onSuccess: () => utils.chat.list.invalidate() });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  if (isLoading) return <Spinner />;

  const avatarOf = (userId: string) => users?.find((u) => u.id === userId)?.avatarUrl ?? null;
  const myId = session?.user.id;

  return (
    <div className="flex h-[65dvh] flex-col rounded-2xl border border-border bg-surface">
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
              {!mine && <Avatar name={m.user.name} src={avatarOf(m.user.id)} size={28} />}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2",
                  mine ? "rounded-br-md bg-accent/20" : "rounded-bl-md bg-surface-2",
                )}
              >
                {!mine && <p className="text-xs font-semibold text-accent">{m.user.name}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                <p className="mt-0.5 text-right text-[10px] text-muted">
                  {format(m.createdAt, "d MMM · HH:mm", { locale: es })}
                </p>
              </div>
              {(mine || session?.user.role === "ADMIN") && (
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
          className="h-10 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
        <Button type="submit" disabled={text.trim().length === 0} loading={send.isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
