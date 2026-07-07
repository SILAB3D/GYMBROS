"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Stat } from "@/components/ui";

const FREQUENCIES = [
  { months: 1, label: "Mensual" },
  { months: 2, label: "Bimestral" },
  { months: 3, label: "Trimestral" },
  { months: 6, label: "Semestral" },
  { months: 12, label: "Anual" },
] as const;

const euros = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function InvestmentView() {
  const utils = api.useUtils();
  const { data, isLoading } = api.subscription.get.useQuery();
  const [form, setForm] = useState({ startDate: "", periodMonths: "1", customMonths: "", price: "" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (data?.sub) {
      const isStandard = FREQUENCIES.some((f) => f.months === data.sub!.periodMonths);
      setForm({
        startDate: format(data.sub.startDate, "yyyy-MM-dd"),
        periodMonths: isStandard ? String(data.sub.periodMonths) : "custom",
        customMonths: isStandard ? "" : String(data.sub.periodMonths),
        price: String(data.sub.price),
      });
    }
  }, [data?.sub]);

  const save = api.subscription.set.useMutation({
    onSuccess: () => {
      utils.subscription.get.invalidate();
      setEditing(false);
    },
  });
  const remove = api.subscription.remove.useMutation({
    onSuccess: () => {
      utils.subscription.get.invalidate();
      setForm({ startDate: "", periodMonths: "1", customMonths: "", price: "" });
    },
  });

  if (isLoading) return <Spinner />;

  const months = form.periodMonths === "custom" ? +form.customMonths : +form.periodMonths;
  const valid = form.startDate && form.price && +form.price > 0 && months >= 1 && months <= 24;
  const showForm = !data?.sub || editing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wallet className="h-6 w-6 text-accent" /> Inversión en gimnasio
        </h1>
        <p className="text-sm text-muted">
          Cuánto te cuesta cada sesión según tu suscripción y tus asistencias reales.
        </p>
      </div>

      {showForm ? (
        <Card className="space-y-4">
          <h2 className="font-semibold">Configura tu suscripción</h2>
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
          <div className="flex gap-2">
            <Button
              disabled={!valid}
              loading={save.isLoading}
              onClick={() =>
                save.mutate({
                  startDate: new Date(form.startDate),
                  periodMonths: months,
                  price: +form.price,
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
            <Card className="flex flex-wrap items-center justify-between gap-2 py-3">
              <p className="text-sm">
                {euros(data.sub.price)}{" "}
                <span className="text-muted">
                  cada {data.sub.periodMonths === 1 ? "mes" : `${data.sub.periodMonths} meses`} · desde el{" "}
                  {format(data.sub.startDate, "d MMM yyyy", { locale: es })} · próximo pago:{" "}
                  {format(data.stats.nextPayment, "d MMM yyyy", { locale: es })}
                </span>
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  Editar
                </Button>
                <Button
                  size="sm" variant="ghost" className="text-red-400"
                  onClick={() => {
                    if (confirm("¿Eliminar la configuración de tu suscripción?")) remove.mutate();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label="Invertido total"
                value={euros(data.stats.totalPaid)}
                sub={`${data.stats.payments} pagos`}
              />
              <Stat
                label="Sesiones"
                value={data.stats.totalSessions}
                sub="desde el inicio"
              />
              <Stat
                label="€ / sesión (total)"
                value={data.stats.costPerSessionTotal !== null ? euros(data.stats.costPerSessionTotal) : "—"}
                sub={data.stats.costPerSessionTotal === null ? "aún sin sesiones" : "cuanto más vas, menos cuesta"}
              />
              <Stat
                label="Coste mensual"
                value={euros(data.stats.monthlyCost)}
                sub="parte proporcional"
              />
            </div>

            <Card className="p-0">
              <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase text-muted">
                <span>Mes</span>
                <span className="text-center">Sesiones</span>
                <span className="text-right">€ / sesión</span>
              </div>
              {data.stats.months.map((m) => (
                <div key={m.month} className="grid grid-cols-3 gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0">
                  <span className="capitalize">
                    {format(new Date(`${m.month}-01T00:00:00`), "MMMM yyyy", { locale: es })}
                  </span>
                  <span className="text-center">{m.sessions}</span>
                  <span className={`text-right font-medium ${m.costPerSession === null ? "text-muted" : "text-accent"}`}>
                    {m.costPerSession !== null ? euros(m.costPerSession) : "sin sesiones"}
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
