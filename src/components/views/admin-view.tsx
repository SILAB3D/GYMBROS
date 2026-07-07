"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Shield, Trash2, Megaphone, MessageSquare, Check, Undo2, BarChart3, Eye, Plus, Lock, LockOpen } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Badge, Modal } from "@/components/ui";
import { PollAnswerCard } from "@/components/poll-card";
import { cn } from "@/lib/utils";

export function AdminView() {
  const utils = api.useUtils();
  const { data: users, isLoading } = api.admin.users.useQuery();
  const { data: rules } = api.admin.listRules.useQuery();
  const { data: feedbacks } = api.feedback.listAll.useQuery();

  const [broadcast, setBroadcast] = useState({ title: "", body: "" });
  const [sent, setSent] = useState(false);
  const [poll, setPoll] = useState({ title: "", description: "", options: ["", ""], schedule: "now" as "now" | "h22" | "h10" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pollSent, setPollSent] = useState(false);
  const { data: pollResults } = api.poll.results.useQuery();

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
  const createPoll = api.poll.create.useMutation({
    onSuccess: () => {
      utils.poll.invalidate();
      setPoll({ title: "", description: "", options: ["", ""], schedule: "now" });
      setPreviewOpen(false);
      setPollSent(true);
    },
  });
  const setPollClosed = api.poll.setClosed.useMutation({ onSuccess: () => utils.poll.invalidate() });
  const deletePoll = api.poll.delete.useMutation({ onSuccess: () => utils.poll.invalidate() });
  const sendBroadcast = api.admin.broadcast.useMutation({
    onSuccess: () => {
      setBroadcast({ title: "", body: "" });
      setSent(true);
      // La notificación también llega al propio admin: refrescar su campanita al momento
      utils.notification.invalidate();
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
        <div className="space-y-1">
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

      {/* Encuestas */}
      <Card className="space-y-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4" /> Encuestas
          </h3>
          <p className="text-xs text-muted">Pregunta al grupo; los resultados se ven aquí abajo.</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={poll.title} placeholder="¿Cambiamos el horario de los sábados?"
              onChange={(e) => setPoll((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Input value={poll.description}
              onChange={(e) => setPoll((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <Label>Opciones</Label>
            <div className="space-y-2">
              {poll.options.map((option, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={option}
                    placeholder={`Opción ${i + 1}`}
                    onChange={(e) =>
                      setPoll((p) => ({
                        ...p,
                        options: p.options.map((o, j) => (j === i ? e.target.value : o)),
                      }))
                    }
                  />
                  {poll.options.length > 2 && (
                    <Button
                      size="sm" variant="ghost" className="text-red-400 self-center"
                      onClick={() =>
                        setPoll((p) => ({ ...p, options: p.options.filter((_, j) => j !== i) }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {poll.options.length < 6 && (
                <Button size="sm" variant="secondary"
                  onClick={() => setPoll((p) => ({ ...p, options: [...p.options, ""] }))}>
                  <Plus className="h-3.5 w-3.5" /> Añadir opción
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label>Envío</Label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "now", label: "Inmediatamente" },
                { key: "h22", label: "A las 22:00" },
                { key: "h10", label: "A las 10:00" },
              ] as const).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setPoll((p) => ({ ...p, schedule: s.key }))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition",
                    poll.schedule === s.key
                      ? "bg-accent font-medium text-accent-fg"
                      : "bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {poll.schedule !== "now" && (
              <p className="mt-1 text-xs text-muted">Del siguiente día disponible (hoy si aún no ha pasado la hora).</p>
            )}
          </div>
          <Button
            variant="secondary"
            disabled={poll.title.trim().length < 2 || poll.options.filter((o) => o.trim()).length < 2}
            onClick={() => {
              setPollSent(false);
              setPreviewOpen(true);
            }}
          >
            <Eye className="h-4 w-4" /> Previsualizar y enviar
          </Button>
          {pollSent && <p className="text-sm text-accent">Encuesta enviada a todo el grupo ✅</p>}
        </div>

        {(pollResults?.length ?? 0) > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Resultados</p>
            {pollResults?.map((p) => (
              <div key={p.id} className="space-y-1.5 rounded-xl bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {p.title}{" "}
                    {p.closed && <Badge className="ml-1">cerrada</Badge>}
                    {p.pending && (
                      <Badge className="ml-1 bg-amber-400/15 text-amber-400">
                        programada · {format(p.publishAt, "d MMM HH:mm")}
                      </Badge>
                    )}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm" variant="ghost"
                      title={p.closed ? "Reabrir" : "Cerrar votación"}
                      onClick={() => setPollClosed.mutate({ id: p.id, closed: !p.closed })}
                    >
                      {p.closed ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="text-red-400" title="Eliminar"
                      onClick={() => {
                        if (confirm("¿Eliminar la encuesta y sus votos?")) deletePoll.mutate({ id: p.id });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.options.map((option, i) => {
                  const count = p.counts[i] ?? 0;
                  const pct = p.total > 0 ? Math.round((count / p.total) * 100) : 0;
                  return (
                    <div key={i} className="relative overflow-hidden rounded-lg bg-bg/40 px-2 py-1 text-xs">
                      <span className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${pct}%` }} />
                      <span className="relative flex justify-between">
                        <span>{option}</span>
                        <span className="text-muted">{count} · {pct}%</span>
                      </span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted">{p.total} {p.total === 1 ? "voto" : "votos"}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Previsualización: así la verán los miembros */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Así la recibirá el grupo">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
            <PollAnswerCard
              preview
              selected={null}
              poll={{
                id: "preview",
                title: poll.title.trim(),
                description: poll.description.trim() || null,
                options: poll.options.map((o) => o.trim()).filter(Boolean),
              }}
            />
          </div>
          <p className="text-xs text-muted">
            Los miembros la verán en un aviso obligatorio: solo podrán responder o posponer 30 min
            (máximo 3 veces).
            {poll.schedule === "now"
              ? " Se enviará inmediatamente."
              : ` Se enviará a las ${poll.schedule === "h22" ? "22:00" : "10:00"} del siguiente día disponible.`}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={createPoll.isLoading}
              onClick={() =>
                createPoll.mutate({
                  title: poll.title.trim(),
                  description: poll.description.trim() || undefined,
                  options: poll.options.map((o) => o.trim()).filter(Boolean),
                  schedule: poll.schedule,
                })
              }
            >
              {poll.schedule === "now" ? "Enviar a todos" : "Programar envío"}
            </Button>
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              Seguir editando
            </Button>
          </div>
        </div>
      </Modal>

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
