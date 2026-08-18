"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Users } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Alta de cuenta con los dos caminos que ahora existen:
 *
 * - CREAR UN GRUPO: hace falta la clave maestra. Quien lo crea se queda como
 *   administrador y reparte el código a los demás.
 * - UNIRME A UN GRUPO: basta con el código que le hayan pasado.
 *
 * El perfil es único: la misma cuenta sirve para todos los grupos y lleva la
 * misma información a todos ellos.
 */
type Mode = "join" | "create";

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("join");
  const [form, setForm] = useState({
    name: "", email: "", password: "", gymStartDate: "",
    groupCode: "", groupName: "", masterKey: "",
  });
  const [error, setError] = useState<string | null>(null);

  const register = api.user.register.useMutation({
    onSuccess: async () => {
      const res = await signIn("credentials", {
        email: form.email, password: form.password, redirect: false,
      });
      if (!res?.error) {
        router.push("/panel");
        router.refresh();
      }
    },
    onError: (e) => setError(e.message),
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  return (
    <Card>
      {/* Elección de camino: es lo primero que hay que decidir */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1">
        {([
          { key: "create", label: "Crear un grupo", icon: KeyRound },
          { key: "join", label: "Unirme a un grupo", icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setMode(key); setError(null); }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold uppercase tracking-wide transition",
              mode === key ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          register.mutate({
            name: form.name,
            email: form.email,
            password: form.password,
            gymStartDate: form.gymStartDate ? new Date(form.gymStartDate) : undefined,
            group:
              mode === "create"
                ? {
                    mode: "create",
                    name: form.groupName,
                    code: form.groupCode,
                    masterKey: form.masterKey,
                  }
                : { mode: "join", code: form.groupCode },
          });
        }}
        className="space-y-4"
      >
        {mode === "create" ? (
          <>
            <div>
              <Label htmlFor="masterKey">Clave maestra</Label>
              <Input id="masterKey" required inputMode="numeric" placeholder="Solo para crear grupos"
                value={form.masterKey} onChange={set("masterKey")} />
            </div>
            <div>
              <Label htmlFor="groupName">Nombre del grupo</Label>
              <Input id="groupName" required minLength={2} maxLength={40} placeholder="Ej: Los del turno de tarde"
                value={form.groupName} onChange={set("groupName")} />
            </div>
            <div>
              <Label htmlFor="groupCode">Código de invitación</Label>
              <Input id="groupCode" required minLength={4} maxLength={20} placeholder="El que repartirás a tu gente"
                value={form.groupCode}
                onChange={(e) => setForm((f) => ({ ...f, groupCode: e.target.value.toUpperCase() }))} />
              <p className="mt-1 text-xs text-muted">Letras, números y guiones. Tendrás que dárselo a quien quieras dentro.</p>
            </div>
          </>
        ) : (
          <div>
            <Label htmlFor="groupCode">Código del grupo</Label>
            <Input id="groupCode" required placeholder="El código que te han pasado"
              value={form.groupCode}
              onChange={(e) => setForm((f) => ({ ...f, groupCode: e.target.value.toUpperCase() }))} />
          </div>
        )}

        <div className="border-t border-border pt-4">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" required minLength={2} value={form.name} onChange={set("name")} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email"
            value={form.email} onChange={set("email")} />
        </div>
        <div>
          <Label htmlFor="password">Contraseña (mínimo 8 caracteres)</Label>
          <Input id="password" type="password" required minLength={8}
            autoComplete="new-password" value={form.password} onChange={set("password")} />
        </div>
        <div>
          <Label htmlFor="gymStartDate">¿Desde cuándo entrenas? (opcional)</Label>
          <Input id="gymStartDate" type="date" value={form.gymStartDate} onChange={set("gymStartDate")} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={register.isLoading} className="w-full" size="lg">
          {mode === "create" ? "Crear grupo y cuenta" : "Unirme y crear cuenta"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
