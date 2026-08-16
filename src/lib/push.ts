/**
 * Alta de notificaciones push en el dispositivo actual.
 *
 * La lógica vive aquí porque la usan dos sitios: el interruptor de Ajustes y
 * el aviso que salta al entrar cuando faltan los permisos del navegador.
 */

export type Platform = "android" | "ios" | "desktop";

export type PushEnableResult =
  | { ok: true }
  | { ok: false; error: string; pushServiceError: boolean; denied: boolean };

type SubscriptionPayload = { endpoint: string; p256dh: string; auth: string };

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** ¿Hay soporte de push en este navegador? */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone/iPad fuera de la pantalla de inicio: ahí el push no existe. */
export function isIosBrowserTab(): boolean {
  if (typeof window === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return /android/i.test(ua) ? "android" : "desktop";
}

/**
 * ¿La suscripción existente se creó con la clave VAPID que usamos ahora?
 * Si el servidor rota la clave, el navegador rechaza cualquier alta nueva con
 * un escueto «push service error» hasta que se da de baja la anterior.
 */
function usesSameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const raw = sub.options?.applicationServerKey;
  if (!raw) return true; // el navegador no lo expone: no hay nada que comparar
  const current = new Uint8Array(raw);
  return current.length === key.length && current.every((v, i) => v === key[i]);
}

/** El navegador no da detalles del fallo: se reconoce por el nombre o el texto. */
export function isPushServiceError(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  const message = err instanceof Error ? err.message : String(err);
  return (
    name === "AbortError" ||
    name === "NotAllowedError" ||
    /push service|registration failed|abort/i.test(message)
  );
}

/**
 * Pide permiso, se suscribe y guarda la suscripción en el servidor.
 * Debe llamarse desde un gesto del usuario: el navegador exige interacción
 * para mostrar el diálogo de permisos.
 */
export async function enablePush(
  save: (payload: SubscriptionPayload) => Promise<unknown>,
  drop: (payload: { endpoint: string }) => Promise<unknown>,
): Promise<PushEnableResult> {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) throw new Error("Push no configurado en el servidor (falta la clave VAPID)");
    const key = urlBase64ToUint8Array(publicKey);

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        error: "Permiso de notificaciones denegado",
        pushServiceError: false,
        denied: permission === "denied",
      };
    }

    // Una suscripción anterior con otra clave VAPID (o de una instalación ya
    // rota) hace fallar el alta: se retira antes de volver a pedirla.
    const existing = await registration.pushManager.getSubscription();
    if (existing && !usesSameKey(existing, key)) {
      await drop({ endpoint: existing.endpoint }).catch(() => undefined);
      await existing.unsubscribe().catch(() => undefined);
    }

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as BufferSource,
        });
      } catch (err) {
        // Segundo intento tras limpiar del todo: a veces el servicio de push
        // deja el registro en un estado inconsistente y así se recupera.
        if (!isPushServiceError(err)) throw err;
        const stale = await registration.pushManager.getSubscription();
        await stale?.unsubscribe().catch(() => undefined);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as BufferSource,
        });
      }
    }

    const json = sub.toJSON();
    await save({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo activar",
      pushServiceError: isPushServiceError(err),
      denied: typeof Notification !== "undefined" && Notification.permission === "denied",
    };
  }
}
