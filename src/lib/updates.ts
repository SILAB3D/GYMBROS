/**
 * ============================================================================
 *  NOVEDADES DE LA APP — registro central
 * ============================================================================
 *
 * Cada entrada de esta lista se muestra UNA sola vez a cada usuario, en una
 * ventana emergente centrada, con dos botones de reacción (👍 / 🫠).
 *
 * CÓMO AÑADIR UNA NOVEDAD
 * -----------------------
 *  1. Añade un objeto NUEVO al PRINCIPIO de APP_UPDATES (el orden manda: se
 *     muestra siempre la más reciente que el usuario no haya visto).
 *  2. Elige un `id` estable y único, con el formato `vX.Y-tema`. Ese id es lo
 *     que se guarda en la base de datos para saber quién la ha visto ya:
 *     NUNCA lo cambies después de publicar, o la ventana reaparecerá a todo
 *     el mundo. Si te equivocaste en el texto, corrige el texto y deja el id.
 *  3. `title` es la actualización en cuestión: corto y concreto.
 *     `description` la resume en dos o tres frases, sin tecnicismos.
 *     `emoji` encabeza la ventana; uno solo, que represente el cambio.
 *  4. No hace falta tocar la base de datos ni desplegar nada más.
 *
 * CUÁNDO SE MUESTRA
 * -----------------
 *  Solo a quien YA tenga concedidos los permisos de notificación, para no
 *  encadenar ventanas a quien acaba de entrar. Las encuestas pendientes
 *  también tienen prioridad. Ver src/components/updates-gate.tsx.
 *
 * QUÉ PASA CON LAS REACCIONES
 * ---------------------------
 *  Se guardan en la tabla UpdateSeen (LIKE / MEH). Sirven para saber si un
 *  cambio ha gustado; el usuario no ve los votos de nadie.
 */

export type AppUpdate = {
  /** Identificador estable. Se guarda en BD: no cambiarlo tras publicar. */
  id: string;
  /** Fecha de publicación (solo informativa, formato ISO). */
  date: string;
  /** Emoji que encabeza la ventana. */
  emoji: string;
  /** La actualización en cuestión, en pocas palabras. */
  title: string;
  /** Descripción breve de qué cambia para el usuario. */
  description: string;
};

/** De la más reciente a la más antigua. */
export const APP_UPDATES: AppUpdate[] = [
  {
    id: "v3.12-recuperar-contrasena",
    date: "2026-08-17",
    emoji: "🔑",
    title: "Si olvidas tu contraseña, ya puedes recuperarla",
    description:
      "En la pantalla de inicio de sesión tienes un «He olvidado mi contraseña». Pon tu email y te llega una notificación al móvil con un enlace para elegir una nueva. Si no te llega, pídele el enlace a un admin del grupo.",
  },
  {
    id: "temporadas-trimestrales",
    date: "2026-08-17",
    emoji: "🏆",
    title: "¡Ya hay temporadas de entrenamiento!",
    description:
      "Cada tres meses se cierra una temporada y se reparten dos títulos: el ganador, que acumule más puntos, y el pancetas 🥓, para quien se quede el último. Sigue la clasificación en Comunidad → Ranking → Temporada. ¡Todos listos para entrenar!",
  },
];

/** La novedad más reciente que el usuario todavía no ha visto. */
export function nextUpdateFor(seenIds: string[]): AppUpdate | null {
  const seen = new Set(seenIds);
  return APP_UPDATES.find((u) => !seen.has(u.id)) ?? null;
}
