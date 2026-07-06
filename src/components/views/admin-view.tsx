"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Shield, Trash2, Megaphone, MessageSquare, Check, Undo2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export function AdminView() {
  const utils = api.useUtils();
  const { data: users, isLoading } = api.admin.users.useQuery();
  const { data: rules } = api.admin.listRules.useQuery();
  const { data: feedbacks } = api.feedback.listAll.useQuery();

  const [broadcast, setBroadcast] = useState({ title: "", body: "" });
  const [sent, setSent] = useState(false);

  const updateRule = api.admin.updateRule.useMutation({
    onSuccess: () => utils.admin.listRules.invalidate(),
  });
  const setRole = api.admin.setRole.useMutation({ onSuccess: () => utils.admin.users.invalidate() });
  const deleteUser = api.admin.deleteUser.useMutation({ onSuccess: () => utils.admin.users.invalidate() });
  const setFeedbackStatus = api.feedback.setStatus.useMutation({
    onSuccess: () => utils.feedback.listAll.invalidate(),
  });
  const deleteFeedback = api.feedback.delete.useMutation({
    onSuccess: () => utils.feedback.listAll.invalidate(),
  });
  const sendBroadcast = api.admin.broadcast.useMutation({
    onSuccess: () => {
      setBroadcast({ title: "", body: "" });
      setSent(true);
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Shield className="h-5 w-5 text-accent" /> Administración
      </h2>

      {/* Usuarios */}
      <Card>
        <h3 className="mb-3 font-semibold">Usuarios ({users?.length})</h3>
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

      {/* Sistema de puntos */}
      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold">Sistema de puntos</h3>
          <p className="text-xs text-muted">
            Cada regla se otorga automáticamente. Puedes cambiar los puntos o desactivarlas.
          </p>
        </div>
        <div className="space-y-2">
          {rules?.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-2.5",
                !r.enabled && "opacity-50",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <button
                  title={r.enabled ? "Desactivar" : "Activar"}
                  onClick={() => updateRule.mutate({ id: r.id, enabled: !r.enabled })}
                  className={cn(
                    "h-5 w-9 shrink-0 rounded-full p-0.5 transition",
                    r.enabled ? "bg-accent" : "bg-border",
                  )}
                >
                  <span
                    className={cn(
                      "block h-4 w-4 rounded-full bg-bg transition-transform",
                      r.enabled && "translate-x-4",
                    )}
                  />
                </button>
                <span className="truncate text-sm">{r.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Input
                  type="number" min={0} defaultValue={r.points} className="h-8 w-20 text-center"
                  onBlur={(e) => {
                    const v = +e.target.value;
                    if (v !== r.points && v >= 0) updateRule.mutate({ id: r.id, points: v });
                  }}
                />
                <span className="text-xs text-muted">pts</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Feedback */}
      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <MessageSquare className="h-4 w-4" /> Feedback de los usuarios ({feedbacks?.length ?? 0})
        </h3>
        {feedbacks?.length === 0 ? (
          <p className="text-sm text-muted">Nadie ha enviado comentarios todavía.</p>
        ) : (
          <div className="space-y-2">
            {feedbacks?.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl bg-surface-2 p-3",
                  f.status === "RESOLVED" && "opacity-60",
                )}
              >
                <div>
                  <p className={cn("text-sm", f.status === "RESOLVED" && "line-through")}>{f.text}</p>
                  <p className="mt-1 text-xs text-muted">
                    {f.user.name} · {format(f.createdAt, "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm" variant="ghost"
                    title={f.status === "OPEN" ? "Marcar resuelto" : "Reabrir"}
                    onClick={() =>
                      setFeedbackStatus.mutate({ id: f.id, status: f.status === "OPEN" ? "RESOLVED" : "OPEN" })
                    }
                  >
                    {f.status === "OPEN" ? <Check className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="text-red-400" title="Eliminar"
                    onClick={() => deleteFeedback.mutate({ id: f.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Aviso al grupo */}
      <Card className="space-y-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Megaphone className="h-4 w-4" /> Notificación a todo el grupo
        </h3>
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
