"use client";

import type { Platform } from "@/lib/push";

/**
 * Guía de resolución cuando falla el alta de notificaciones. El navegador solo
 * devuelve «push service error», sin más detalle, así que se listan las causas
 * reales ordenadas por frecuencia.
 */
export function PushHelp({ platform, denied }: { platform: Platform; denied: boolean }) {
  const steps: Array<{ title: string; detail: string }> = [];

  if (denied) {
    steps.push({
      title: "Vuelve a permitir las notificaciones",
      detail:
        "Las bloqueaste antes y el navegador ya no vuelve a preguntar. Abre el candado (o los tres puntos) de la barra de direcciones → Configuración del sitio → Notificaciones → Permitir, y recarga la página.",
    });
  }

  steps.push(
    {
      title: "Comprueba que no estás en incógnito",
      detail:
        "En una ventana privada o de incógnito las notificaciones push no funcionan: el navegador descarta el registro al cerrarla, así que el alta falla o deja de recibir avisos sin avisar. Abre GymBros en una ventana normal (o desde el icono de la pantalla de inicio) y actívalas ahí.",
    },
    {
      title: "Reinicia la app por completo",
      detail:
        "Ciérrala del todo, no solo la minimices, y vuelve a abrirla. El registro anterior puede haber quedado a medias y al reintentar se limpia solo.",
    },
  );

  if (platform === "android") {
    steps.push(
      {
        title: "Activa el servicio de mensajería de Google en el navegador",
        detail:
          "En Chrome: menú ⋮ → Configuración → Servicios de Google → activa «Usar servicios de Google para mensajería push». En Brave viene desactivado de fábrica: Configuración → Privacidad y seguridad → «Usar servicios de Google para mensajería push».",
      },
      {
        title: "Comprueba los permisos del sistema",
        detail:
          "Ajustes del móvil → Aplicaciones → tu navegador (o GymBros si la instalaste) → Notificaciones: deben estar permitidas. Revisa también que el ahorro de batería no tenga la app restringida.",
      },
      {
        title: "Actualiza los Servicios de Google Play",
        detail:
          "El push de Android depende de ellos. En móviles sin Play Services (algunos Huawei o ROMs libres) las notificaciones push no pueden funcionar.",
      },
    );
  }

  if (platform === "ios") {
    steps.push(
      {
        title: "Ábrela desde el icono de la pantalla de inicio",
        detail:
          "En iPhone y iPad el push solo funciona con la app añadida a la pantalla de inicio, nunca desde una pestaña de Safari. Necesitas iOS 16.4 o superior.",
      },
      {
        title: "Revisa los ajustes del sistema",
        detail:
          "Ajustes → Notificaciones → GymBros: deben estar permitidas. Comprueba también que no tengas activo un modo de concentración.",
      },
    );
  }

  steps.push(
    {
      title: "Desactiva VPN, DNS alternativos o bloqueadores",
      detail:
        "El alta se hace contra el servicio de push del navegador. Si una VPN, un DNS con filtros, un antivirus o un bloqueador de anuncios corta esa conexión, el alta falla. Prueba también con datos móviles en lugar de la wifi.",
    },
    {
      title: "Prueba en otra red o desde otro navegador",
      detail:
        "Algunas redes de empresa, colegios o gimnasios bloquean los servicios de push. Si en otra red funciona, el problema está en la red y no en la app.",
    },
    {
      title: "Reinstala la app",
      detail:
        "Si nada de lo anterior funciona: desinstálala de la pantalla de inicio, abre GymBros en el navegador, vuelve a añadirla y activa las notificaciones desde el icono nuevo.",
    },
  );

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">
        El navegador no detalla el motivo del fallo. Estas son las causas habituales, de más a
        menos frecuente:
      </p>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
              {i + 1}
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-tight">{s.title}</p>
              <p className="text-xs leading-snug text-muted">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
