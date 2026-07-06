"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", password: "", inviteCode: "", gymStartDate: "",
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          register.mutate({
            name: form.name,
            email: form.email,
            password: form.password,
            inviteCode: form.inviteCode,
            gymStartDate: form.gymStartDate ? new Date(form.gymStartDate) : undefined,
          });
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="inviteCode">Código de invitación</Label>
          <Input id="inviteCode" required placeholder="El código del grupo"
            value={form.inviteCode} onChange={set("inviteCode")} />
        </div>
        <div>
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
          Crear cuenta
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
