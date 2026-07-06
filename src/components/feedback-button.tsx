"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Modal } from "@/components/ui";

/**
 * Botón flotante visible en toda la app: cualquier usuario puede enviar
 * sugerencias de mejora o reportar bugs. Los admins las ven en /admin.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const create = api.feedback.create.useMutation({
    onSuccess: () => {
      setSent(true);
      setText("");
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 1600);
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Enviar feedback"
        aria-label="Enviar feedback"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-2 text-muted shadow-lg transition hover:text-accent md:bottom-6 md:right-6"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Feedback 💬">
        {sent ? (
          <p className="py-6 text-center text-accent">¡Gracias! Tu comentario se ha enviado ✅</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              ¿Has encontrado un bug o se te ocurre una mejora? Cuéntalo aquí y el admin lo revisará.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Ej: al terminar un entreno me gustaría que…"
              className="w-full rounded-xl border border-border bg-surface-2 p-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
            {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
            <Button
              className="w-full"
              disabled={text.trim().length < 5}
              loading={create.isLoading}
              onClick={() => create.mutate({ text: text.trim() })}
            >
              Enviar
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
