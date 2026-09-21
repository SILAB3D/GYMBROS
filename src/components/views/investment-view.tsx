"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, Trash2, AlertTriangle, RefreshCw, Info, CalendarDays, CalendarCheck, Repeat } from "lucide-react";
import { api } from "@/trpc/react";
import { Badge, Button, Card, Input, Label, Spinner, Stat } from "@/components/ui";
import { GymHeader } from "@/components/gym-header";
import { cn } from "@/lib/utils";

const FREQUENCIES = [
  { months: 1, label: "Mensual" },
  { months: 2, label: "Bimestral" },
  { months: 3, label: "Trimestral" },
  { months: 6, label: "Semestral" },
  { months: 12, label: "Anual" },
] as const;

/** Fila del cartel "Mi suscripción": etiqueta a la izquierda, dato a la derecha. */
function SubRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icon}
        </span>
        <span className="min-w-0 text-sm text-muted">{label}</span>
      </span>
      <span className="shrink-0 text-right text-sm font-semibold">{value}</span>
    </div>
  );
}

const euros = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function InvestmentView() {
  const utils = api.useUtils();
  const { data, isLoading } = api.subscription.get.useQuery();
  const [form, setForm] = useState({ startDate: "", periodMonths: "1", customMonths: "", price: "", autoRenew: false });
  const [editing, setEditing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (data?.sub) {
      const isStandard = FREQUENCIES.some((f) => f.months === data.sub!.periodMonths);
      setForm({
        startDate: format(data.sub.startDate, "yyyy-MM-dd"),
        periodMonths: isStandard ? String(data.sub.periodMonths) : "custom",
        customMonths: isStandard ? "" : String(data.sub.periodMonths),
        price: String(data.sub.price),
        autoRenew: data.sub.autoRenew,
      });
    }
  }, [data?.sub]);

  const save = api.subscription.set.useMutation({
    onSuccess: () => {
      utils.subscription.invalidate();
      setEditing(false);
    },
  });
  const remove = api.subscription.remove.useMutation({
    onSuccess: () => {
      utils.subscription.invalidate();
      setForm({ startDate: "", periodMonths: "1", customMonths: "", price: "", autoRenew: false });
    },
  });
  const renew = api.subscription.renew.useMutation({
    onSuccess: () => utils.subscription.invalidate(),
  });
  // Cambio optimista del auto-renovado: el interruptor y el aviso reaccionan al instante
  const setAutoRenew = api.subscription.setAutoRenew.useMutation({
    onMutate: async ({ autoRenew }) => {
      await utils.subscription.get.cancel();
      const previous = utils.subscription.get.getData();
      if (previous?.sub && previous.stats) {
        utils.subscription.get.setData(undefined, {
          sub: { ...previous.sub, autoRenew },
          // al activar la renovación automática la suscripción deja de estar caducada
          stats: { ...previous.stats, expired: autoRenew ? false : previous.stats.expired },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.subscription.get.setData(undefined, context.previous);
    },
    onSettled: () => utils.subscription.invalidate(),
  });

  if (isLoading) return <Spinner />;

  const months = form.periodMonths === "custom" ? +form.customMonths : +form.periodMonths;
  const valid = form.startDate && form.price && +form.price > 0 && months >= 1 && months <= 24;
  const showForm = !data?.sub || editing;

  return (
    <div className="space-y-6">
      <GymHeader />

      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Wallet className="h-5 w-5 text-accent" /> Mi inversión
      </h2>

      {showForm ? (
        <Card className="space-y-4">
          <h3 className="font-semibold">Configura tu suscripción</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Día del primer pago</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Frecuencia</Label>
              <select
                value={form.periodMonths}
                onChange={(e) => setForm((f) => ({ ...f, periodMonths: e.target.value }))}
                className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.months} value={f.months}>{f.label}</option>
                ))}
                <option value="custom">Personalizada…</option>
              </select>
              {form.periodMonths === "custom" && (
                <Input
                  type="number" min={1} max={24} placeholder="¿Cada cuántos meses?"
                  className="mt-2"
                  value={form.customMonths}
                  onChange={(e) => setForm((f) => ({ ...f, customMonths: e.target.value }))}
                />
              )}
            </div>
            <div>
              <Label>Precio por pago (€)</Label>
              <Input
                type="number" min={0} step="0.01" placeholder="29.90"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoRenew}
              onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))}
              className="h-4 w-4 accent-[hsl(var(--accent))]"
            />
            Renovación automática (si no, cada renovación se confirma a mano)
          </label>
          <div className="flex gap-2">
            <Button
              disabled={!valid}
              loading={save.isLoading}
              onClick={() =>
                save.mutate({
                  startDate: new Date(form.startDate),
                  periodMonths: months,
                  price: +form.price,
                  autoRenew: form.autoRenew,
                })
              }
            >
              Guardar
            </Button>
            {data?.sub && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </Card>
      ) : (
        data?.sub &&
        data.stats && (
          <>
            {data.stats.expired && (
              <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-400/40 bg-amber-400/5">
                <p className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    Tu suscripción terminó el{" "}
                    <strong>{format(data.stats.coverageEnd, "d MMM yyyy", { locale: es })}</strong>.
                    Confírmala si has renovado, o actívala en automático.
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" loading={renew.isLoading} onClick={() => renew.mutate()}>
                    <RefreshCw className="h-3.5 w-3.5" /> He renovado (+1 periodo)
                  </Button>
                  <Button
                    size="sm" variant="secondary"
                    loading={setAutoRenew.isLoading}
                    onClick={() => setAutoRenew.mutate({ autoRenew: true })}
                  >
                    Activar automática
                  </Button>
                </div>
              </Card>
            )}

            {/* Los datos que se consultan de un vistazo, uno por fila. El
                importe vive en la cabecera: repetirlo dentro de una fila la
                partía en tres líneas en el móvil. */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/40 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold leading-tight">Mi suscripción</h3>
                  <p className="truncate text-xs text-muted">
                    {euros(data.sub.price)} cada{" "}
                    {data.sub.periodMonths === 1 ? "mes" : `${data.sub.periodMonths} meses`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="text-red-400"
                    title="Eliminar la suscripción"
                    aria-label="Eliminar la suscripción"
                    onClick={() => {
                      if (confirm("¿Eliminar la configuración de tu suscripción?")) remove.mutate();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <SubRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="Fecha de inicio"
                value={format(data.sub.startDate, "d MMM yyyy", { locale: es })}
              />
              <SubRow
                icon={<CalendarCheck className="h-4 w-4" />}
                label="Fecha de finalización"
                value={format(data.stats.coverageEnd, "d MMM yyyy", { locale: es })}
              />
              <SubRow
                icon={<Repeat className="h-4 w-4" />}
                label="Modalidad de renovación"
                value={
                  <Badge className={data.sub.autoRenew ? "bg-accent/15 text-accent" : "bg-surface-2 text-fg"}>
                    {data.sub.autoRenew ? "Automática" : "Manual"}
                  </Badge>
                }
              />
            </Card>

            <div className="grid gap-3 md:grid-cols-3">
              <Stat
                label="Invertido total"
                value={euros(data.stats.totalPaid)}
                sub={`${data.stats.payments} pagos desde el inicio`}
              />

              {/* El coste por sesión manda: va grande y en acento, y debajo,
                  en pequeño, la cuenta de la que sale. Tres columnas iguales
                  cortaban las etiquetas en el móvil; aquí el texto fluye. */}
              <Card className="relative overflow-hidden md:col-span-2">
                <div
                  className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full blur-3xl"
                  style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.2), transparent 70%)" }}
                />

                <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                    Coste por sesión
                  </span>
                  <span className="text-[11px] text-muted">
                    {format(data.stats.currentPeriod.from, "d MMM", { locale: es })} –{" "}
                    {format(data.stats.currentPeriod.to, "d MMM yyyy", { locale: es })}
                  </span>
                </div>

                <p className="relative mt-2 text-4xl font-extrabold leading-none tracking-tight text-accent">
                  {data.stats.currentPeriod.costPerSession !== null
                    ? euros(data.stats.currentPeriod.costPerSession)
                    : "—"}
                </p>
                <p className="relative mt-1 text-xs text-muted">
                  {data.stats.currentPeriod.costPerSession !== null
                    ? "cada vez que vas, en el periodo en curso"
                    : "sin asistencias todavía en este periodo"}
                </p>

                {/* La cuenta, en una línea que se parte sola si no cabe */}
                <div className="relative mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <span className="font-semibold tabular-nums">{euros(data.stats.currentPeriod.invested)}</span>
                  <span className="text-xs text-muted">de inversión</span>
                  <span className="text-muted">÷</span>
                  <span className="font-semibold tabular-nums">{data.stats.currentPeriod.sessions}</span>
                  <span className="text-xs text-muted">
                    {data.stats.currentPeriod.sessions === 1 ? "asistencia" : "asistencias"}
                  </span>
                </div>
              </Card>
            </div>

            {/* Historial: el periodo a la izquierda con todo el ancho que
                necesita y las dos cifras en columnas fijas. Con tres columnas
                iguales hasta el encabezado se partía en dos líneas. */}
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-border bg-surface-2/40 px-4 py-3">
                <h3 className="font-semibold leading-tight">Historial de costes</h3>
                {data.stats.isLongPeriod && (
                  <button
                    onClick={() => setInfoOpen((v) => !v)}
                    aria-label="Cómo se calcula"
                    aria-expanded={infoOpen}
                    className={cn(
                      "rounded-full p-1 transition",
                      infoOpen ? "bg-accent/15 text-accent" : "text-muted hover:text-fg",
                    )}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {data.stats.isLongPeriod && infoOpen && (
                <p className="border-b border-border bg-accent/5 px-4 py-2.5 text-[11px] leading-snug text-muted">
                  Tu plan se paga por periodos de {data.stats.periodMonths} meses, así que el coste
                  por sesión se calcula sobre el periodo completo y no mes a mes.
                </p>
              )}

              <div className="grid grid-cols-[1fr_4rem_5.5rem] gap-2 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <span>{data.stats.isLongPeriod ? "Periodo" : "Mes"}</span>
                <span className="text-center">Sesiones</span>
                <span className="text-right">€ / sesión</span>
              </div>

              {data.stats.rows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_4rem_5.5rem] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0"
                >
                  <span className="truncate capitalize">
                    {data.stats!.isLongPeriod
                      ? `${format(row.from, "MMM yy", { locale: es })} – ${format(row.to, "MMM yy", { locale: es })}`
                      : format(row.from, "MMMM yyyy", { locale: es })}
                  </span>
                  <span className="text-center tabular-nums text-muted">{row.sessions}</span>
                  <span
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      row.costPerSession === null ? "text-xs font-normal text-muted" : "text-accent",
                    )}
                  >
                    {row.costPerSession !== null ? euros(row.costPerSession) : "sin sesiones"}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )
      )}
    </div>
  );
}
