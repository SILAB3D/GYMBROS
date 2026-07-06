"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Lock, Trash2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Modal, Spinner, EmptyState } from "@/components/ui";

const FIELDS = [
  { key: "weightKg", label: "Peso (kg)" },
  { key: "bodyFatPct", label: "Grasa (%)" },
  { key: "muscleMassKg", label: "Masa muscular (kg)" },
  { key: "heightCm", label: "Altura (cm)" },
  { key: "waistCm", label: "Cintura (cm)" },
  { key: "chestCm", label: "Pecho (cm)" },
  { key: "armCm", label: "Brazo (cm)" },
  { key: "legCm", label: "Pierna (cm)" },
  { key: "neckCm", label: "Cuello (cm)" },
  { key: "hipCm", label: "Cadera (cm)" },
] as const;

type ChartKey = "weightKg" | "bodyFatPct" | "muscleMassKg" | "waistCm" | "armCm";
const CHART_TABS: Array<{ key: ChartKey; label: string }> = [
  { key: "weightKg", label: "Peso" },
  { key: "bodyFatPct", label: "% Grasa" },
  { key: "muscleMassKg", label: "Músculo" },
  { key: "waistCm", label: "Cintura" },
  { key: "armCm", label: "Brazo" },
];

export default function MetricsPage() {
  const utils = api.useUtils();
  const { data: metrics, isLoading } = api.metrics.list.useQuery();
  const [addOpen, setAddOpen] = useState(false);
  const [chart, setChart] = useState<ChartKey>("weightKg");
  const [form, setForm] = useState<Record<string, string>>({});

  const add = api.metrics.add.useMutation({
    onSuccess: () => {
      utils.metrics.list.invalidate();
      setAddOpen(false);
      setForm({});
    },
  });
  const remove = api.metrics.delete.useMutation({ onSuccess: () => utils.metrics.list.invalidate() });

  if (isLoading) return <Spinner />;

  const chartData = (metrics ?? [])
    .filter((m) => m[chart] != null)
    .map((m) => ({ fecha: format(m.date, "d MMM", { locale: es }), valor: m[chart] }));

  const latest = metrics?.[metrics.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Medidas corporales</h1>
          <p className="flex items-center gap-1 text-sm text-muted">
            <Lock className="h-3.5 w-3.5" /> Sección 100% privada: nadie del grupo puede ver estos datos
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva medición
        </Button>
      </div>

      {metrics?.length === 0 ? (
        <EmptyState
          icon="📏"
          title="Sin mediciones todavía"
          subtitle="Registra tu peso y medidas para ver tu evolución en gráficas"
        />
      ) : (
        <>
          {latest && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {latest.weightKg != null && (
                <Card><p className="text-xs text-muted">Peso</p><p className="text-xl font-bold">{latest.weightKg} kg</p></Card>
              )}
              {latest.bodyFatPct != null && (
                <Card><p className="text-xs text-muted">Grasa</p><p className="text-xl font-bold">{latest.bodyFatPct}%</p></Card>
              )}
              {latest.muscleMassKg != null && (
                <Card><p className="text-xs text-muted">Masa muscular</p><p className="text-xl font-bold">{latest.muscleMassKg} kg</p></Card>
              )}
              {latest.bmi != null && (
                <Card><p className="text-xs text-muted">IMC</p><p className="text-xl font-bold">{latest.bmi}</p></Card>
              )}
            </div>
          )}

          <Card>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {CHART_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setChart(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    chart === t.key ? "bg-accent text-accent-fg font-medium" : "bg-surface-2 text-muted hover:text-fg"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {chartData.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted">
                Necesitas al menos 2 mediciones para ver la evolución
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="fecha" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="valor" stroke="#22c55e" strokeWidth={2} fill="url(#g)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <section>
            <h2 className="mb-3 font-semibold">Historial</h2>
            <div className="space-y-2">
              {[...(metrics ?? [])].reverse().slice(0, 10).map((m) => (
                <Card key={m.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{format(m.date, "d MMM yyyy", { locale: es })}</p>
                    <p className="text-xs text-muted">
                      {[
                        m.weightKg != null && `${m.weightKg} kg`,
                        m.bodyFatPct != null && `${m.bodyFatPct}% grasa`,
                        m.waistCm != null && `cintura ${m.waistCm} cm`,
                        m.armCm != null && `brazo ${m.armCm} cm`,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={() => remove.mutate({ id: m.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nueva medición">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  type="number" step="0.1" min={0} placeholder="—"
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <Label>Notas privadas</Label>
            <Input value={form.notes ?? ""} placeholder="Opcional"
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
          <Button
            size="lg" className="w-full" loading={add.isLoading}
            onClick={() =>
              add.mutate({
                weightKg: form.weightKg ? +form.weightKg : null,
                bodyFatPct: form.bodyFatPct ? +form.bodyFatPct : null,
                muscleMassKg: form.muscleMassKg ? +form.muscleMassKg : null,
                heightCm: form.heightCm ? +form.heightCm : null,
                waistCm: form.waistCm ? +form.waistCm : null,
                chestCm: form.chestCm ? +form.chestCm : null,
                armCm: form.armCm ? +form.armCm : null,
                legCm: form.legCm ? +form.legCm : null,
                neckCm: form.neckCm ? +form.neckCm : null,
                hipCm: form.hipCm ? +form.hipCm : null,
                notes: form.notes || null,
              })
            }
          >
            Guardar medición
          </Button>
        </div>
      </Modal>
    </div>
  );
}
