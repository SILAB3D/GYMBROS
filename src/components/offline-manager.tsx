"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { api } from "@/trpc/react";

/**
 * Registra el service worker (modo offline) y avisa cuando no hay conexión.
 * Al recuperar cobertura, refresca los datos y reanuda las acciones pendientes.
 */
export function OfflineManager() {
  const utils = api.useUtils();
  const [offline, setOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Registrar el SW para que la app funcione sin conexión
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setJustReconnected(true);
      void utils.invalidate(); // sincroniza al recuperar cobertura
      setTimeout(() => setJustReconnected(false), 2500);
    };
    setOffline(!navigator.onLine);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [utils]);

  if (!offline && !justReconnected) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.75rem] z-50 flex justify-center px-4 md:top-4">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg ${
          offline
            ? "border-amber-400/40 bg-amber-950/90 text-amber-200"
            : "border-accent/40 bg-surface text-accent"
        }`}
      >
        {offline ? (
          <>
            <WifiOff className="h-4 w-4" /> Sin conexión · verás lo último guardado; los cambios se sincronizarán al volver
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" /> De nuevo en línea · sincronizando
          </>
        )}
      </div>
    </div>
  );
}
