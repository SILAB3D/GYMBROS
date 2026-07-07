"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card } from "@/components/ui";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Activar/desactivar notificaciones push en ESTE dispositivo. */
export function PushSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIosBrowser, setIsIosBrowser] = useState(false);

  const subscribe = api.push.subscribe.useMutation();
  const unsubscribe = api.push.unsubscribe.useMutation();

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    // iPhone/iPad en navegador (sin anclar): el push solo funciona desde pantalla de inicio
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsIosBrowser(isIos && !standalone);
    if (ok) {
      void navigator.serviceWorker.getRegistration().then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push no configurado en el servidor (falta la clave VAPID)");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permiso de notificaciones denegado");
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await subscribe.mutateAsync({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar");
    } finally {
      setBusy(false);
    }
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
        <Button variant="secondary" loading={busy} onClick={disable}>
          <BellOff className="h-4 w-4" /> Desactivar en este dispositivo
        </Button>
      ) : (
        <Button loading={busy} onClick={enable}>
          <BellRing className="h-4 w-4" /> Activar notificaciones
        </Button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </Card>
  );
}
