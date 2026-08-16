"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, LifeBuoy, ChevronDown, Send } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card } from "@/components/ui";
import { PushHelp } from "@/components/push-help";
import { cn } from "@/lib/utils";
import {
  enablePush, pushSupported, isIosBrowserTab, detectPlatform, type Platform,
} from "@/lib/push";

/** Activar/desactivar notificaciones push en ESTE dispositivo. */
export function PushSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIosBrowser, setIsIosBrowser] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  const [tested, setTested] = useState<number | null>(null);

  const subscribe = api.push.subscribe.useMutation();
  const unsubscribe = api.push.unsubscribe.useMutation();
  const test = api.push.test.useMutation({
    onSuccess: (result) => {
      setTested(result.delivered);
      setError(null);
    },
    onError: (err) => {
      setTested(null);
      setError(err.message);
      setShowHelp(true);
    },
  });

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    setIsIosBrowser(isIosBrowserTab());
    setPlatform(detectPlatform());
    if (ok) {
      setDenied(Notification.permission === "denied");
      void navigator.serviceWorker.getRegistration().then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    setShowHelp(false);
    const result = await enablePush(
      (payload) => subscribe.mutateAsync(payload),
      (payload) => unsubscribe.mutateAsync(payload),
    );
    if (result.ok) {
      setSubscribed(true);
      setDenied(false);
    } else {
      setError(result.error);
      setDenied(result.denied);
      // El fallo del servicio de push casi nunca se arregla reintentando:
      // se despliegan directamente las comprobaciones que sí suelen resolverlo.
      if (result.pushServiceError || result.denied) setShowHelp(true);
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await unsubscribe.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold">Notificaciones en este dispositivo</h2>
        <p className="text-sm text-muted">
          Recibe los PRs del grupo, tus rachas y los avisos aunque la app esté cerrada.
        </p>
      </div>

      {supported === false ? (
        <p className="text-sm text-muted">Este navegador no soporta notificaciones push.</p>
      ) : isIosBrowser && !subscribed ? (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          📱 En iPhone: pulsa <strong>Compartir → Añadir a pantalla de inicio</strong>, abre
          GymBros desde el icono nuevo y vuelve aquí para activarlas (requiere iOS 16.4+).
        </p>
      ) : subscribed ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              loading={test.isLoading}
              onClick={() => {
                setTested(null);
                setError(null);
                setShowHelp(false);
                test.mutate();
              }}
            >
              <Send className="h-4 w-4" /> Enviar notificación de prueba
            </Button>
            <Button variant="secondary" loading={busy} onClick={disable}>
              <BellOff className="h-4 w-4" /> Desactivar
            </Button>
          </div>
          {tested !== null && (
            <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">
              Enviada a {tested} {tested === 1 ? "dispositivo" : "dispositivos"} ✅ Si te llega,
              los permisos están bien concedidos. Si no aparece en unos segundos, pulsa «¿Cómo lo
              soluciono?».
            </p>
          )}
          {tested !== null && (
            <Button size="sm" variant="ghost" onClick={() => setShowHelp((v) => !v)}>
              <LifeBuoy className="h-3.5 w-3.5" /> No me ha llegado
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHelp && "rotate-180")} />
            </Button>
          )}
          {tested !== null && showHelp && <PushHelp platform={platform} denied={denied} />}
        </div>
      ) : (
        <Button loading={busy} onClick={enable}>
          <BellRing className="h-4 w-4" /> Activar notificaciones
        </Button>
      )}

      {error && (
        <div className="space-y-2">
          <p className="text-sm text-red-400">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setShowHelp((v) => !v)}>
            <LifeBuoy className="h-3.5 w-3.5" /> ¿Cómo lo soluciono?
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHelp && "rotate-180")} />
          </Button>
          {showHelp && <PushHelp platform={platform} denied={denied} />}
        </div>
      )}
    </Card>
  );
}
