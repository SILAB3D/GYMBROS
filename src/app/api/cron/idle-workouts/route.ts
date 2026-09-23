import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyIdleWorkouts } from "@/server/services/workout-service";

export const dynamic = "force-dynamic";

/**
 * Entrenos activos con la app sin abrir desde hace 30 minutos. Necesita
 * llamarse cada pocos minutos, así que lo dispara un programador externo
 * (Vercel Hobby solo permite crons diarios). Se protege con CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await notifyIdleWorkouts(db);
  return NextResponse.json({ ok: true, sent });
}
