import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { Sidebar, BottomNav, MobileHeader } from "@/components/nav";
import { FeedbackButton } from "@/components/feedback-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileHeader />
      <main className="px-4 pb-24 pt-4 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <FeedbackButton />
      <BottomNav />
    </div>
  );
}
