import type { PrismaClient } from "@prisma/client";

/**
 * Borrado de cuenta en dos fases.
 *
 * 1. El usuario lo confirma tecleando una palabra aleatoria: se cierra la
 *    sesión y el perfil desaparece de los grupos, pero NO se borra nada.
 * 2. Pasados DELETION_GRACE_DAYS, el barrido del cron elimina la cuenta y todo
 *    lo que cuelga de ella.
 *
 * Volver a iniciar sesión durante la fase 1 cancela el borrado y el perfil
 * reaparece en sus grupos tal y como estaba.
 */

export const DELETION_GRACE_DAYS = 15;

/** Palabras cortas, sin tildes y fáciles de teclear en el móvil. */
const WORDS = [
  "banco", "pesa", "barra", "disco", "cinta", "remo", "sentadilla", "pecho",
  "espalda", "biceps", "triceps", "pierna", "gluteo", "hombro", "cardio",
  "serie", "repeticion", "descanso", "racha", "rutina", "gimnasio", "proteina",
];

export function randomDeletionWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)] ?? "gimnasio";
}

/** Fecha en la que expira el plazo de gracia de un borrado pedido en `at`. */
export function deletionDeadline(at: Date): Date {
  return new Date(at.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/** ¿Sigue dentro del plazo en el que basta con entrar para cancelarlo? */
export function withinGracePeriod(requestedAt: Date, now = new Date()): boolean {
  return deletionDeadline(requestedAt).getTime() > now.getTime();
}

/** Cancela un borrado pendiente. Se llama al iniciar sesión. */
export async function cancelDeletion(db: PrismaClient, userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: null, deletionWord: null },
  });
}

/**
 * Elimina de verdad a los usuarios cuyo plazo ya venció.
 *
 * Todo lo que cuelga de la cuenta cae por `onDelete: Cascade`, incluidas sus
 * pertenencias a grupos. Los grupos que creó sobreviven: `createdById` queda a
 * null y el resto de miembros los conserva.
 */
export async function purgeExpiredDeletions(db: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const expired = await db.user.findMany({
    where: { deletionRequestedAt: { not: null, lte: cutoff } },
    select: { id: true },
  });
  for (const { id } of expired) {
    await db.user.delete({ where: { id } });
  }
  return expired.length;
}
