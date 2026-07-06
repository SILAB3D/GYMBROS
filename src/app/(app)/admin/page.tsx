"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Shield, Trash2, Megaphone } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Badge } from "@/components/ui";

const POINT_LABELS: Record<string, string> = {
  ATTENDANCE: "Ir al gimnasio",
  WORKOUT_COMPLETED: "Completar rutina",
  NEW_PR: "Nuevo PR",
  STREAK_7: "Racha de 7 días",
  ROUTINE_SHARED: "Compartir rutina",
  GOAL_COMPLETED: "Cumplir objetivo",
};

export default function AdminPage() {
  const utils = api.useUtils();
  const { data: users, isLoading, error } = api.admin.users.useQuery();
  const { data: pointsConfig } = api.admin.pointsConfig.useQuery();
  const [broadcast, setBroadcast] = useState({ title: "", body: "" });
  const [sent, setSent] = useState(false);

  const setPoints = api.admin.setPoints.useMutation({
    onSuccess: () => utils.admin.pointsConfig.invalidate(),
  });
  const setRole = api.admin.setRole.useMutation({ onSuccess: () => utils.admin.users.invalidate() });
  const deleteUser = api.admin.deleteUser.useMutation({ onSuccess: () => utils.admin.users.invalidate() });
  const sendBroadcast = api.admin.broadcast.useMutation({
    onSuccess: () => {
      setBroadcast({ title: "", body: "" });
      setSent(true);
    },
  });

  if (error) return <p className="py-12 text-center text-muted">Solo los administradores pueden ver esta página.</p>;
  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Shield className="h-6 w-6 text-accent" /> Administración
      </h1>

      <Card>
        <h2 className="mb-3 font-semibold">Usuarios ({users?.length})</h2>
        <div className="space-y-2">
          {users?.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
              <div>
                <p className="text-sm font-medium">
                  {u.name} {u.role === "ADMIN" && <Badge className="ml-1 bg-accent/15 text-accent">admin</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {u.email} · desde {format(u.createdAt, "dd/MM/yyyy")} · {u._count.attendances} asistencias,{" "}
                  {u._count.workouts} entrenos, {u._count.personalRecords} PRs
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm" variant="secondary"
                  onClick={() => setRole.mutate({ userId: u.id, role: u.role === "ADMIN" ? "USER" : "ADMIN" })}
                >
                  {u.role === "ADMIN" ? "Quitar admin" : "Hacer admin"}
                </Button>
                <Button
                  size="sm" variant="danger"
                  onClick={() => {
                    if (confirm(`¿Eliminar a ${u.name} y TODOS sus datos? Esta acción no se puede deshacer.`))
                      deleteUser.mutate({ userId: u.id });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Sistema de puntos</h2>
        <div className="space-y-2">
          {pointsConfig?.map((p) => (
            <div key={p.type} className="flex items-center justify-between gap-3">
              <span className="text-sm">{POINT_LABELS[p.type] ?? p.type}</span>
              <Input
                type="number" min={0} defaultValue={p.points} className="w-24"
                onBlur={(e) => {
                  const v = +e.target.value;
                  if (v !== p.points && v >= 0) setPoints.mutate({ type: p.type, points: v });
                }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Los cambios aplican a los puntos que se otorguen a partir de ahora.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Megaphone className="h-4 w-4" /> Notificación a todo el grupo
        </h2>
        <div>
          <Label>Título</Label>
          <Input value={broadcast.title} onChange={(e) => setBroadcast((b) => ({ ...b, title: e.target.value }))} />
        </div>
        <div>
          <Label>Mensaje</Label>
          <Input value={broadcast.body} onChange={(e) => setBroadcast((b) => ({ ...b, body: e.target.value }))} />
        </div>
        <Button
          disabled={!broadcast.title}
          loading={sendBroadcast.isLoading}
          onClick={() => sendBroadcast.mutate({ title: broadcast.title, body: broadcast.body || undefined })}
        >
          Enviar a todos
        </Button>
        {sent && <p className="text-sm text-accent">Enviada ✅</p>}
      </Card>
    </div>
  );
}
