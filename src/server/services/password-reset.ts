/**
 * Recuperación de contraseña sin email.
 *
 * GymBros no tiene proveedor de correo, pero sí notificaciones push atadas a
 * dispositivos donde el usuario ya inició sesión: eso hace de segundo factor.
 * Si alguien no tiene push (iPhone en pestaña, permisos denegados, móvil
 * nuevo), un admin genera el mismo enlace a mano desde el panel.
 *
 * El token se guarda hasheado (sha256): quien lea la base de datos no puede
 * usarlo. El original solo existe en la URL que recibe el usuario.
 */

import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

/** Ventana de validez del enlace. Corta a propósito: se pide y se usa al momento. */
const TTL_MINUTES = 30;

/** Máximo de solicitudes por cuenta dentro de RATE_WINDOW_MINUTES. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MINUTES = 15;

export const RESET_TTL_MINUTES = TTL_MINUTES;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crea un vale nuevo e invalida los anteriores del usuario, para que un enlace
 * viejo que siga en el historial de notificaciones no valga nada.
 *
 * Devuelve el token en claro: es la única vez que existe fuera de la URL.
 */
export async function createResetToken(db: PrismaClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      },
    }),
  ]);
  return token;
}

/**
 * ¿Se ha pasado esta cuenta de solicitudes? Se cuenta sobre la propia tabla
 * para no depender de Redis ni de memoria del proceso (en Vercel hay varios).
 */
export async function resetRequestsExceeded(db: PrismaClient, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000);
  const recent = await db.passwordResetToken.count({
    where: { userId, createdAt: { gte: since } },
  });
  return recent >= RATE_LIMIT;
}

/** ¿El token existe, no ha caducado y no se ha usado? Sin efectos secundarios. */
export async function resetTokenIsValid(db: PrismaClient, token: string): Promise<boolean> {
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return !!row && row.usedAt === null && row.expiresAt > new Date();
}

export type ConsumeResult = { ok: true; email: string } | { ok: false; reason: "invalid" };

/**
 * Cambia la contraseña y quema el token en la misma transacción: si dos
 * peticiones llegan a la vez, solo una encuentra el vale sin usar.
 */
export async function consumeResetToken(
  db: PrismaClient,
  token: string,
  newPassword: string,
): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!row || row.usedAt !== null || row.expiresAt <= new Date()) {
    return { ok: false, reason: "invalid" };
  }

  const passwordHash = await hash(newPassword, 12);
  const burned = await db.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (burned.count === 0) return { ok: false, reason: "invalid" }; // otra petición se adelantó

  const user = await db.user.update({
    where: { id: row.userId },
    data: { passwordHash },
    select: { email: true },
  });
  return { ok: true, email: user.email };
}

/** URL absoluta que se envía por push o que copia el admin. */
export function resetUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  return `${base.replace(/\/$/, "")}/recuperar/${token}`;
}
