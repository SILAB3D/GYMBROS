"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner, Avatar } from "@/components/ui";

export default function SettingsPage() {
  const utils = api.useUtils();
  const { data: me, isLoading } = api.user.me.useQuery();
  const [form, setForm] = useState({ name: "", avatarUrl: "", gymStartDate: "" });
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [message, setMessage] = useState<string | null>(null);

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

  if (isLoading || !me) return <Spinner />;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <Card className="space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        <div className="flex items-center gap-4">
          <Avatar name={form.name || me.name} src={form.avatarUrl || null} size={64} />
          <div className="flex-1">
            <Label>URL del avatar</Label>
            <Input
              value={form.avatarUrl}
              placeholder="https://…"
              onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            />
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

      {message && <p className="text-sm text-accent">{message}</p>}

      <p className="text-xs text-muted">
        Cuenta creada el {format(me.createdAt, "dd/MM/yyyy")} · {me.email}
      </p>
    </div>
  );
}
