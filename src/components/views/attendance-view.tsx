"use client";

import { useState } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Flame, CalendarCheck } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, Stat } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";

export function AttendanceView() {
  const utils = api.useUtils();
  const [cursor, setCursor] = useState(new Date());
  const { data: stats, isLoading } = api.attendance.stats.useQuery();
  const { data: monthDays } = api.attendance.month.useQuery({
    year: cursor.getFullYear(),
    month: cursor.getMonth(),
  });
  // Check-in optimista: el día se marca en el calendario y suben los contadores al instante
  const checkIn = api.attendance.checkIn.useMutation({
    onMutate: async () => {
      const today = new Date();
      const monthInput = { year: cursor.getFullYear(), month: cursor.getMonth() };
      const viewingThisMonth =
        cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

      await Promise.all([utils.attendance.month.cancel(monthInput), utils.attendance.stats.cancel()]);
      const prevMonth = utils.attendance.month.getData(monthInput);
      const prevStats = utils.attendance.stats.getData();

      // Si hoy ya está registrado, no tocamos nada (evita contar dos veces)
      const alreadyToday = (prevMonth ?? []).some(
        (a) => new Date(a.date).toDateString() === today.toDateString(),
      );
      if (alreadyToday) return { prevMonth: undefined, prevStats: undefined, monthInput };

      if (viewingThisMonth && prevMonth) {
        utils.attendance.month.setData(monthInput, [
          ...prevMonth,
          {
            id: `temp-${Date.now()}`,
            userId: "",
            date: today,
            checkIn: today,
            checkOut: null,
            gymName: null,
            notes: null,
          },
        ]);
      }
      if (prevStats) {
        utils.attendance.stats.setData(undefined, {
          ...prevStats,
          thisWeek: prevStats.thisWeek + 1,
          thisMonth: prevStats.thisMonth + 1,
          thisYear: prevStats.thisYear + 1,
          total: prevStats.total + 1,
        });
      }
      return { prevMonth, prevStats, monthInput };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      if (context.prevMonth) utils.attendance.month.setData(context.monthInput, context.prevMonth);
      if (context.prevStats) utils.attendance.stats.setData(undefined, context.prevStats);
    },
    onSettled: () => utils.attendance.invalidate(),
  });

  if (isLoading || !stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asistencia</h1>
        <Button title="Registrar asistencia de hoy" onClick={() => checkIn.mutate({})} loading={checkIn.isLoading}>
          <CalendarCheck className="h-4 w-4" /> <span className="hidden sm:inline">Registrar hoy</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Racha semanal"
          value={
            <span className="flex items-center gap-1">
              {stats.currentStreak} <Flame className="h-5 w-5 text-orange-400" />
            </span>
          }
          sub={`Mejor: ${stats.bestStreak} semanas`}
        />
        <Stat
          label="Esta semana"
          value={stats.weeklyTargetDays > 0 ? `${stats.thisWeek}/${stats.weeklyTargetDays}` : stats.thisWeek}
          sub={stats.weeklyTargetDays > 0 ? "días planificados" : "asistencias"}
        />
        <Stat label="Este mes" value={stats.thisMonth} sub="días entrenados" />
        <Stat label="Este año" value={stats.thisYear} sub={`Total histórico: ${stats.total}`} />
        <Stat label="Promedio" value={`${stats.weeklyAvg}/sem`} sub={`${stats.monthlyAvg} al mes`} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: es })}</h2>
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <MonthCalendar
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          trainedDates={(monthDays ?? []).map((a) => a.date)}
        />
        <p className="mt-3 text-center text-sm text-muted">
          {monthDays?.length ?? 0} asistencias este mes
        </p>
      </Card>
    </div>
  );
}
