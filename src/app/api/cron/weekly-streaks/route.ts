import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyCommunityStreaks } from "@/server/services/community-streaks";

export const dynamic = "force-dynamic";

/** Lunes por la mañana (Vercel Cron, ver vercel.json): rachas de la comunidad. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await notifyCommunityStreaks(db);
  return NextResponse.json({ ok: true, ...result });
}
