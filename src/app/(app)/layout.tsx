import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import { Sidebar, BottomNav, MobileHeader } from "@/components/nav";
import { FeedbackButton } from "@/components/feedback-button";
import { PollGate } from "@/components/poll-gate";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";
import { OfflineManager } from "@/components/offline-manager";
import { PageTransition } from "@/components/page-transition";
import { AppSplash } from "@/components/app-splash";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileHeader />
      <main className="px-4 pb-36 pt-[4.5rem] md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl"><PageTransition>{children}</PageTransition></div>
      </main>
      <FeedbackButton />
      <PollGate />
      <OnboardingTutorial />
      <OfflineManager />
      <AppSplash />
      <BottomNav />
    </div>
  );
}
