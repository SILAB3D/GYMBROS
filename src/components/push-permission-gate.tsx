"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, LifeBuoy, ChevronDown, SlidersHorizontal, Send } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Modal } from "@/components/ui";
import { PushHelp } from "@/components/push-help";
import { cn } from "@/lib/utils";
import {
  enablePush, pushSupported, isIosBrowserTab, detectPlatform, type Platform,
} from "@/lib/push";

/** Se deja respirar a la pantalla de carga antes de aparecer. */
const DELAY_MS = 2500;

/**
 * Al entrar en la app comprueba el permiso de notificaciones del navegador
 * (el del dispositivo, no las categorías de Ajustes) y, si falta, lo pide con
 * un aviso. Sale en CADA acceso mientras el permiso siga sin concederse:
 * cerrarlo solo lo descarta para esta visita, no lo silencia.
 *
 * Las encuestas pendientes tienen prioridad por ser bloqueantes; en cuanto se
 * responden, el aviso aparece sin necesidad de recargar.
 */
export function PushPermissionGate() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [iosBrowser, setIosBrowser] = useState(false);

  const [tested, setTested] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const subscribe = api.push.subscribe.useMutation();
  const unsubscribe = api.push.unsubscribe.useMutation();
  const test = api.push.test.useMutation({
    onSuccess: (result) => {
      setTested(result.delivered);
      setTestError(null);
    },
    onError: (err) => {
      setTested(null);
      setTestError(err.message);
    },
  });
  const { data: polls } = api.poll.listActive.useQuery();
  const pollPending = (polls ?? []).some((p) => p.myVote === null);

  useEffect(() => {
    if (!pushSupported() || pollPending) return;
    setPlatform(detectPlatform());
    setIosBrowser(isIosBrowserTab());

    const timer = setTimeout(() => {
      void (async () => {
        // "granted" sin suscripción también cuenta: el permiso está dado pero
        // este dispositivo aún no recibiría nada.
        if (Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) return;
        }
        setDenied(Notification.permission === "denied");
        setOpen(true);
      })();
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [pollPending]);

  /** Cierra el aviso solo para esta visita: al volver a entrar reaparece. */
  function dismiss() {
    setOpen(false);
  }

  async function activate() {
    setBusy(true);
    setError(null);
    setShowHelp(false);
    const result = await enablePush(
      (payload) => subscribe.mutateAsync(payload),
      (payload) => unsubscribe.mutateAsync(payload),
    );
    if (result.ok) {
      setDone(true);
      setTimeout(() => setOpen(false), 1200);
    } else {
      setError(result.error);
      setDenied(result.denied);
      if (result.pushServiceError || result.denied) setShowHelp(true);
    }
    setBusy(false);
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="Activa las notificaciones"
      subtitle="Hace falta el permiso del dispositivo"
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
          <BellRing className="h-5 w-5 text-accent" />
        </span>
      }
      footer={
        !done && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/ajustes" className="flex-1" onClick={dismiss}>
              <Button variant="secondary" className="w-full">
                <SlidersHorizontal className="h-4 w-4" /> Ver ajustes
              </Button>
            </Link>
            <Button variant="ghost" className="flex-1" onClick={dismiss}>
              Ahora no
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            Sin el permiso del navegador, GymBros no puede avisarte de nada aunque lo tengas todo
            activado dentro de la app.
          </p>
          <p className="text-sm text-muted">
            Después, desde <strong>Ajustes → Notificaciones</strong>, eliges qué avisos quieres
            recibir y cuáles no: PRs del grupo, rachas, recordatorios, avisos del administrador…
          </p>
        </div>

        {done ? (
          <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">
            ¡Listo! Ya recibirás notificaciones en este dispositivo ✅
          </p>
        ) : iosBrowser ? (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
            📱 En iPhone: pulsa <strong>Compartir → Añadir a pantalla de inicio</strong>, abre
            GymBros desde el icono nuevo y acepta el aviso desde ahí (requiere iOS 16.4+).
          </p>
        ) : (
          <Button size="lg" className="w-full" loading={busy} onClick={activate}>
            <BellRing className="h-4 w-4" /> Conceder permiso
          </Button>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{error}</p>
            {tested !== null && (
              <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">
                Prueba enviada a {tested} {tested === 1 ? "dispositivo" : "dispositivos"} ✅ Si te
                llega, el permiso ya está concedido en alguno de ellos.
              </p>
            )}
            {testError && <p className="text-sm text-red-400">Prueba fallida: {testError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowHelp((v) => !v)}>
                <LifeBuoy className="h-3.5 w-3.5" /> ¿Cómo lo soluciono?
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHelp && "rotate-180")} />
              </Button>
              {/* Diagnóstico extra: revela si el fallo es de este dispositivo
                  o del envío en sí. */}
              <Button
                size="sm" variant="secondary" loading={test.isLoading}
                onClick={() => {
                  setTested(null);
                  setTestError(null);
                  test.mutate();
                }}
              >
                <Send className="h-3.5 w-3.5" /> Probar envío
              </Button>
            </div>
            {showHelp && <PushHelp platform={platform} denied={denied} />}
          </div>
        )}
      </div>
    </Modal>
  );
}
