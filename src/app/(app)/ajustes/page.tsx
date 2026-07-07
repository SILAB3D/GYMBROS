"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { signOut } from "next-auth/react";
import { LogOut, Camera } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Avatar } from "@/components/ui";
import { AdminView } from "@/components/views/admin-view";
import { PushSettings } from "@/components/push-settings";

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

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data: me, isLoading } = api.user.me.useQuery();
  const [form, setForm] = useState({ name: "", avatarUrl: "", gymStartDate: "" });
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setMessage("Perfil actualizado ✅");
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

  return (
    <div className="space-y-6">
      <div className="max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">Ajustes</h1>

        <Card className="space-y-4">
          <h2 className="font-semibold">Perfil</h2>
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
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-4 w-4" /> Subir foto
              </Button>
              {form.avatarUrl && (
                <Button
                  variant="ghost" size="sm" className="ml-2 text-red-400"
                  onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
                >
                  Quitar
                </Button>
              )}
              <p className="text-xs text-muted">
                Se recorta y reduce automáticamente. Recuerda pulsar «Guardar cambios».
              </p>
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

        <PushSettings />

        <Card className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Sesión</h2>
            <p className="text-sm text-muted">Tu sesión permanece abierta hasta que la cierres aquí.</p>
          </div>
          <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </Card>

        <Card className="space-y-3 border-red-500/30">
          <h2 className="font-semibold text-red-400">Zona peligrosa</h2>
          <p className="text-sm text-muted">
            Resetear el perfil elimina <strong>todos</strong> tus registros: entrenamientos,
            asistencias, rachas, PRs, puntos, notificaciones y logros. Se conservan tu cuenta,
            tus rutinas y tus ejercicios personalizados. Esta acción no se puede deshacer.
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

        {message && <p className="text-sm text-accent">{message}</p>}

        <p className="text-xs text-muted">
          Cuenta creada el {format(me.createdAt, "dd/MM/yyyy")} · {me.email}
        </p>
      </div>

      {me.role === "ADMIN" && (
        <div className="border-t border-border pt-6">
          <AdminView />
        </div>
      )}
    </div>
  );
}
