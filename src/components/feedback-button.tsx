"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Botón flotante visible en toda la app: cualquier usuario puede enviar
 * sugerencias de mejora o reportar bugs. Los admins las ven en /admin.
 *
 * Se retira solo tras 3 segundos sin scroll, esté la página donde esté: el
 * temporizador arranca al montar y se reinicia con cualquier gesto, así que
 * también desaparece en pantallas cortas que no llegan a desplazarse.
 */
const HIDE_AFTER_MS = 3000;

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Visible al hacer scroll; se esconde tras 3 segundos de inactividad.
  // Se escuchan también rueda y arrastre: en una página que no desborda no hay
  // evento "scroll", y antes el botón se quedaba clavado en pantalla.
  useEffect(() => {
    const scheduleHide = () => {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    };
    const wake = () => {
      setVisible(true);
      scheduleHide();
    };
    scheduleHide();
    const events = ["scroll", "wheel", "touchmove"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(hideTimer.current);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

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
        className={cn(
          // Relleno de acento y anillo propio: sobre cualquier fondo de la app
          // se distingue al instante, que antes se perdía contra las tarjetas.
          "fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full",
          "bg-gradient-to-br from-accent to-accent/70 text-accent-fg",
          "shadow-lg shadow-accent/25 ring-1 ring-accent/40 ring-offset-2 ring-offset-bg",
          "transition-all duration-300 hover:scale-105 hover:shadow-accent/40 active:scale-95",
          "md:bottom-6 md:right-6",
          !visible && !open && "pointer-events-none translate-y-3 scale-90 opacity-0",
        )}
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Feedback 💬"
        subtitle={sent ? undefined : "Bugs y mejoras para el admin"}
        footer={
          !sent && (
            <Button
              className="w-full"
              disabled={text.trim().length < 5}
              loading={create.isLoading}
              onClick={() => create.mutate({ text: text.trim() })}
            >
              Enviar
            </Button>
          )
        }
      >
        {sent ? (
          <p className="py-6 text-center text-accent">¡Gracias! Tu comentario se ha enviado ✅</p>
        ) : (
          <div className="space-y-3">
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
          </div>
        )}
      </Modal>
    </>
  );
}
