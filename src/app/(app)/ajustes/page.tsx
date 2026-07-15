"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { signOut } from "next-auth/react";
import { LogOut, Camera, Wallet, BellRing, Eye, GraduationCap } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Avatar } from "@/components/ui";
import { AdminView } from "@/components/views/admin-view";
import { PushSettings } from "@/components/push-settings";
import { useViewAsUser } from "@/lib/use-view-as-user";
import { useTutorialLaunch } from "@/lib/use-tutorial-launch";

/** Recorta al centro y redimensiona la imagen a 192×192 px en el navegador. */
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
  );
}

function Toggle({ on, onClick, title }: { on: boolean; onClick: () => void; title: string }) {
  return (
    <button
      title={title}
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
    onSuccess: () => {
      utils.user.me.invalidate();
      setMessage("Guardado ✅");
    },
  });
  const changePassword = api.user.changePassword.useMutation({
    onSuccess: () => {
      setPasswords({ current: "", next: "" });
      setMessage("Contraseña cambiada ✅");
    },
    onError: (e) => setMessage(e.message),
  });
  const resetData = api.user.resetData.useMutation({
    onSuccess: () => {
      utils.invalidate();
      setMessage("Perfil reseteado: todos tus registros han sido eliminados ✅");
    },
    onError: (e) => setMessage(e.message),
  });

  if (isLoading || !me) return <Spinner />;

  const prefs = (me.notifyPrefs ?? {}) as Record<string, boolean>;
  const remindersOn = prefs.reminders !== false;

  return (
    <div className="space-y-8">
      <div className="max-w-lg space-y-8">
        <h1 className="text-2xl font-bold">Ajustes</h1>

        {/* ---------- Perfil ---------- */}
        <section className="space-y-3">
          <SectionTitle>Perfil</SectionTitle>
          <Card className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={form.name || me.name} src={form.avatarUrl || null} size={64} />
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const dataUrl = await resizeImage(file);
                      setForm((f) => ({ ...f, avatarUrl: dataUrl }));
                    } catch {
                      setMessage("No se pudo procesar la imagen");
                    }
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Subir foto
                  </Button>
                  {form.avatarUrl && (
                    <Button
                      variant="ghost" size="sm" className="text-red-400"
                      onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted">Se recorta y reduce automáticamente.</p>
              </div>
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha de inicio en el gimnasio</Label>
              <Input
                type="date"
                value={form.gymStartDate}
                onChange={(e) => setForm((f) => ({ ...f, gymStartDate: e.target.value }))}
              />
            </div>
            <Button
              loading={update.isLoading}
              onClick={() =>
                update.mutate({
                  name: form.name,
                  avatarUrl: form.avatarUrl || null,
                  gymStartDate: form.gymStartDate ? new Date(form.gymStartDate) : null,
                })
              }
            >
              Guardar cambios
            </Button>
          </Card>
        </section>

        {/* ---------- Preferencias ---------- */}
        <section className="space-y-3">
          <SectionTitle>Preferencias</SectionTitle>
          <PushSettings />
          <Card className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 font-semibold">
                <BellRing className="h-4 w-4" /> Recordatorios de entreno
              </h2>
              <p className="text-sm text-muted">
                «Te queda 1 día para cumplir tu semana», «llevas 3 días sin entrenar»…
              </p>
            </div>
            <Toggle
              on={remindersOn}
              title={remindersOn ? "Desactivar" : "Activar"}
              onClick={() => update.mutate({ notifyPrefs: { ...prefs, reminders: !remindersOn } })}
            />
          </Card>
          <Card className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 font-semibold">
                <GraduationCap className="h-4 w-4" /> Tutorial de bienvenida
              </h2>
              <p className="text-sm text-muted">Repasa el recorrido inicial de la app.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setTutorial(true)}>
              Ver tutorial
            </Button>
          </Card>
          <Card className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 font-semibold">
                <Wallet className="h-4 w-4" /> Apartado de inversión
              </h2>
              <p className="text-sm text-muted">Muestra u oculta la sección de coste en el menú.</p>
            </div>
            <Toggle
              on={me.investmentEnabled}
              title={me.investmentEnabled ? "Desactivar" : "Activar"}
              onClick={() => update.mutate({ investmentEnabled: !me.investmentEnabled })}
            />
          </Card>
        </section>

        {/* ---------- Cuenta ---------- */}
        <section className="space-y-3">
          <SectionTitle>Cuenta</SectionTitle>
          <Card className="space-y-4">
            <h2 className="font-semibold">Cambiar contraseña</h2>
            <div>
              <Label>Contraseña actual</Label>
              <Input
                type="password" autoComplete="current-password"
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nueva contraseña (mínimo 8 caracteres)</Label>
              <Input
                type="password" autoComplete="new-password"
                value={passwords.next}
                onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <Button
              variant="secondary"
              disabled={!passwords.current || passwords.next.length < 8}
              loading={changePassword.isLoading}
              onClick={() => changePassword.mutate(passwords)}
            >
              Cambiar contraseña
            </Button>
          </Card>
          <Card className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-semibold">Sesión</h2>
              <p className="text-sm text-muted">Permanece abierta hasta que la cierres aquí.</p>
            </div>
            <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </Card>
          <p className="px-1 text-xs text-muted">
            Cuenta creada el {format(me.createdAt, "dd/MM/yyyy")} · {me.email}
          </p>
        </section>

        {/* ---------- Zona peligrosa ---------- */}
        <section className="space-y-3">
          <SectionTitle>Zona peligrosa</SectionTitle>
          <Card className="space-y-3 border-red-500/30">
            <p className="text-sm text-muted">
              Resetear el perfil elimina <strong>todos</strong> tus registros: entrenamientos,
              asistencias, rachas, PRs, puntos, notificaciones y logros. Se conservan tu cuenta y
              tus rutinas. No se puede deshacer.
            </p>
            <Button
              variant="danger"
              loading={resetData.isLoading}
              onClick={() => {
                const answer = prompt(
                  'Vas a borrar todos tus registros de forma permanente.\n\nEscribe RESET para confirmar:',
                );
                if (answer === "RESET") resetData.mutate({ confirmation: "RESET" });
                else if (answer !== null) setMessage("Reset cancelado: el texto no coincide");
              }}
            >
              Resetear mi perfil
            </Button>
          </Card>
        </section>

        {message && <p className="px-1 text-sm text-accent">{message}</p>}

        {/* ---------- Administración ---------- */}
        {me.role === "ADMIN" && (
          <section className="space-y-3">
            <SectionTitle>Administración</SectionTitle>
            <Card className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Eye className="h-4 w-4" /> Ver como usuario estándar
                </h2>
                <p className="text-sm text-muted">
                  Oculta la administración para ver la app como el resto del grupo.
                </p>
              </div>
              <Toggle
                on={viewAsUser}
                title={viewAsUser ? "Volver a la vista de admin" : "Activar vista de usuario"}
                onClick={() => setViewAsUser(!viewAsUser)}
              />
            </Card>
          </section>
        )}
      </div>

      {me.role === "ADMIN" && !viewAsUser && (
        <div className="border-t border-border pt-6">
          <AdminView />
        </div>
      )}
    </div>
  );
}
