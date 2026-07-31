"use client";

import Link from "next/link";
import { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, getDay, getDaysInMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

export function CommunityCalendarView() {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = api.attendance.communityMonth.useQuery({
    year: cursor.getFullYear(),
    month: cursor.getMonth(),
  });

  const byDay = data ?? {};
  const first = startOfMonth(cursor);
  const offset = (getDay(first) + 6) % 7;
  const days = getDaysInMonth(first);
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];
  const maxCount = Math.max(1, ...Object.values(byDay).map((m) => m.length));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario de la comunidad</h1>
        <p className="text-sm text-muted">Quién ha entrenado cada día del mes.</p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setCursor((c) => subMonths(c, 1)); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: es })}</h2>
          <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setCursor((c) => addMonths(c, 1)); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase text-muted">
              {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <div key={`e${i}`} />;
                const key = format(date, "yyyy-MM-dd");
                const members = byDay[key] ?? [];
                const intensity = members.length / maxCount;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(members.length > 0 ? key : null)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition",
                      members.length === 0 ? "bg-surface-2 text-muted" : "font-bold text-accent-fg",
                      selected === key && "ring-2 ring-fg",
                    )}
                    style={members.length > 0 ? { backgroundColor: `hsl(var(--accent) / ${0.25 + intensity * 0.75})` } : undefined}
                  >
                    {date.getDate()}
                    {members.length > 0 && <span className="text-[9px] leading-none">{members.length}👤</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {selected && (byDay[selected]?.length ?? 0) > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold capitalize">
            {format(new Date(`${selected}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })}
          </h3>
          <div className="flex flex-wrap gap-2">
            {byDay[selected]!.map((m) => (
              <Link key={m.id} href={`/perfil/${m.id}`}
                className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm transition hover:bg-accent/15">
                <Avatar name={m.name} src={m.avatarUrl} size={22} /> {m.name}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
