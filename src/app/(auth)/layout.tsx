import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo size={72} className="mx-auto" />
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Gym<span className="text-accent">Bros</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Entrena. Compite. Progresa.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
