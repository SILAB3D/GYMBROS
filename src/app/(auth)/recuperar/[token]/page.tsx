"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = String(useParams().token ?? "");
  const [form, setForm] = useState({ password: "", repeat: "" });
  const [error, setError] = useState<string | null>(null);

  // Se comprueba antes de enseñar el formulario para no hacer escribir una
  // contraseña dos veces y soltar el "ha caducado" al final.
  const { data: valid, isLoading } = api.user.checkResetToken.useQuery({ token });

  const reset = api.user.resetPassword.useMutation({
    onSuccess: async ({ email }) => {
      // Ya sabemos la contraseña nueva: se entra directamente en vez de
      // devolver al login a reescribirla.
      const res = await signIn("credentials", { email, password: form.password, redirect: false });
      router.push(res?.error ? "/login" : "/panel");
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (!valid) {
    return (
      <Card>
        <div className="space-y-3 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="text-lg font-bold">Este enlace ya no sirve</h2>
          <p className="text-sm text-muted">
            Los enlaces caducan a los 30 minutos y solo se pueden usar una vez. Pide uno nuevo.
          </p>
          <Link href="/recuperar" className="inline-block text-sm text-accent hover:underline">
            Pedir otro enlace
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (form.password !== form.repeat) {
            setError("Las contraseñas no coinciden");
            return;
          }
          reset.mutate({ token, password: form.password });
        }}
        className="space-y-4"
      >
        <h2 className="text-lg font-bold">Elige una contraseña nueva</h2>
        <div>
          <Label htmlFor="password">Contraseña (mínimo 8 caracteres)</Label>
          <Input
            id="password" type="password" required minLength={8} autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="repeat">Repite la contraseña</Label>
          <Input
            id="repeat" type="password" required minLength={8} autoComplete="new-password"
            value={form.repeat}
            onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={reset.isLoading} className="w-full" size="lg">
          Guardar y entrar
        </Button>
      </form>
    </Card>
  );
}
