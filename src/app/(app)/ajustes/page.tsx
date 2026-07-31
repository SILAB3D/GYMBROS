"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { signOut } from "next-auth/react";
import {
  LogOut, Camera, Wallet, Eye, GraduationCap, User, Bell, ShieldAlert,
  KeyRound, ChevronDown,
} from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Avatar } from "@/components/ui";
import { AdminView } from "@/components/views/admin-view";
import { PushSettings } from "@/components/push-settings";
import { useViewAsUser } from "@/lib/use-view-as-user";
import { useTutorialLaunch } from "@/lib/use-tutorial-launch";

const NOTIFY_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "prs", label: "PRs del grupo" },
  { key: "workouts", label: "Entrenos del grupo" },
  { key: "streaks", label: "Rachas y semanas" },
  { key: "reminders", label: "Recordatorios de entreno" },
  { key: "system", label: "Sistema, encuestas y logros" },
];

function resizeImage(file: File, size = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const side = Math.min(img.width, img.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Sección plegable, cerrada por defecto. */
function Section({ icon, title, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold">{icon} {title}</span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border p-4">{children}</div>
    </details>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${on ? "bg-accent" : "bg-border"}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-bg transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data: me, isLoading } = api.user.me.useQuery();
  const [form, setForm] = useState({ name: "", avatarUrl: "", gymStartDate: "" });
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewAsUser, setViewAsUser] = useViewAsUser();
  const [, setTutorial] = useTutorialLaunch();

  useEffect(() => {
    if (me) {
      setForm({
        name: me.name,
        avatarUrl: me.avatarUrl ?? "",
        gymStartDate: me.gymStartDate ? format(me.gymStartDate, "yyyy-MM-dd") : "",
      });
    }
  }, [me]);

  const update = api.user.updateProfile.useMutation({
    onSuccess: () => { utils.user.me.invalidate(); setMessage("Guardado ✅"); },
  });
  const changePassword = api.user.changePassword.useMutation({
    onSuccess: () => { setPasswords({ current: "", next: "" }); setMessage("Contraseña cambiada ✅"); },
    onError: (e) => setMessage(e.message),
  });
  const resetData = api.user.resetData.useMutation({
    onSuccess: () => { utils.invalidate(); setMessage("Perfil reseteado ✅"); },
    onError: (e) => setMessage(e.message),
  });

  if (isLoading || !me) return <Spinner />;

  const prefs = (me.notifyPrefs ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-8">
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-bold">Ajustes</h1>

        {/* Perfil */}
        <Section icon={<User className="h-4 w-4" />} title="Perfil">
          <div className="flex items-center gap-4">
            <Avatar name={form.name || me.name} src={form.avatarUrl || null} size={64} />
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try { const url = await resizeImage(file); setForm((f) => ({ ...f, avatarUrl: url })); }
                  catch { setMessage("No se pudo procesar la imagen"); }
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="h-4 w-4" /> Subir foto
                </Button>
                {form.avatarUrl && (
                  <Button variant="ghost" size="sm" className="text-red-400" onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Fecha de inicio en el gimnasio</Label>
            <Input type="date" value={form.gymStartDate} onChange={(e) => setForm((f) => ({ ...f, gymStartDate: e.target.value }))} />
          </div>
          <Button
            loading={update.isLoading}
            onClick={() => update.mutate({
              name: form.name,
              avatarUrl: form.avatarUrl || null,
              gymStartDate: form.gymStartDate ? new Date(form.gymStartDate) : null,
            })}
          >
            Guardar cambios
          </Button>
        </Section>

        {/* Notificaciones */}
        <Section icon={<Bell className="h-4 w-4" />} title="Notificaciones">
          <PushSettings />
          <div className="space-y-2">
            <p className="text-sm font-medium">Categorías (todas activas por defecto)</p>
            {NOTIFY_CATEGORIES.map((c) => {
              const on = prefs[c.key] !== false;
              return (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{c.label}</span>
                  <Toggle on={on} onClick={() => update.mutate({ notifyPrefs: { ...prefs, [c.key]: !on } })} />
                </div>
              );
            })}
          </div>
        </Section>

        {/* Inversión */}
        <Section icon={<Wallet className="h-4 w-4" />} title="Apartado de inversión">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Muestra u oculta la sección de coste en el menú.</span>
            <Toggle on={me.investmentEnabled} onClick={() => update.mutate({ investmentEnabled: !me.investmentEnabled })} />
          </div>
        </Section>

        {/* Cuenta */}
        <Section icon={<KeyRound className="h-4 w-4" />} title="Cuenta">
          <div>
            <Label>Contraseña actual</Label>
            <Input type="password" autoComplete="current-password" value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} />
          </div>
          <div>
            <Label>Nueva contraseña (mínimo 8 caracteres)</Label>
            <Input type="password" autoComplete="new-password" value={passwords.next}
              onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} />
          </div>
          <Button variant="secondary" disabled={!passwords.current || passwords.next.length < 8}
            loading={changePassword.isLoading} onClick={() => changePassword.mutate(passwords)}>
            Cambiar contraseña
          </Button>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm text-muted">Cerrar sesión en este dispositivo</span>
            <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
          <p className="text-xs text-muted">Cuenta creada el {format(me.createdAt, "dd/MM/yyyy")} · {me.email}</p>
        </Section>

        {/* Ayuda */}
        <Section icon={<GraduationCap className="h-4 w-4" />} title="Ayuda">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Repasa el tutorial de bienvenida.</span>
            <Button variant="secondary" size="sm" onClick={() => setTutorial(true)}>Ver tutorial</Button>
          </div>
        </Section>

        {/* Administración: ver como usuario */}
        {me.role === "ADMIN" && (
          <Section icon={<Eye className="h-4 w-4" />} title="Vista de administrador">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Ver la app como un usuario estándar (oculta la administración).</span>
              <Toggle on={viewAsUser} onClick={() => setViewAsUser(!viewAsUser)} />
            </div>
          </Section>
        )}

        {/* Zona peligrosa */}
        <Section icon={<ShieldAlert className="h-4 w-4 text-red-400" />} title="Zona peligrosa">
          <p className="text-sm text-muted">
            Resetear el perfil elimina <strong>todos</strong> tus registros. Se conservan tu cuenta y tus rutinas. No se puede deshacer.
          </p>
          <Button variant="danger" loading={resetData.isLoading}
            onClick={() => {
              const a = prompt('Escribe RESET para borrar todos tus registros de forma permanente:');
              if (a === "RESET") resetData.mutate({ confirmation: "RESET" });
              else if (a !== null) setMessage("Reset cancelado");
            }}>
            Resetear mi perfil
          </Button>
        </Section>

        {message && <p className="px-1 text-sm text-accent">{message}</p>}
      </div>

      {me.role === "ADMIN" && !viewAsUser && (
        <div className="border-t border-border pt-6">
          <AdminView />
        </div>
      )}
    </div>
  );
}
