"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label } from "@/components/ui";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // La respuesta nunca dice si la cuenta existe, así que el único caso de
  // error posible aquí es que se caiga el servidor: se trata igual que el
  // éxito para no dar pistas de más.
  const request = api.user.requestReset.useMutation({
    onSettled: () => setSent(true),
  });

  if (sent) {
    return (
      <Card>
        <div className="space-y-3 text-center">
          <BellRing className="mx-auto h-10 w-10 text-accent" />
          <h2 className="text-lg font-bold">Revisa tus notificaciones</h2>
          <p className="text-sm text-muted">
            Si hay una cuenta con ese email y tiene notificaciones activadas, acaba de recibir un
            aviso con el enlace para elegir una contraseña nueva. Caduca en 30 minutos.
          </p>
          <p className="text-sm text-muted">
            ¿No te llega nada? Puede que este móvil no tenga las notificaciones activadas. Pídele a
            un admin del grupo que te genere el enlace a mano.
          </p>
          <Link href="/login" className="inline-block text-sm text-accent hover:underline">
            Volver al inicio de sesión
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
          request.mutate({ email });
        }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold">¿Olvidaste tu contraseña?</h2>
          <p className="mt-1 text-sm text-muted">
            Te enviamos el enlace por notificación a los móviles donde ya tienes la sesión abierta.
          </p>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" loading={request.isLoading} className="w-full" size="lg">
          Enviar enlace
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </Card>
  );
}
