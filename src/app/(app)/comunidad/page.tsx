"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RankingView } from "@/components/views/ranking-view";
import { GroupView } from "@/components/views/group-view";
import { ChatView } from "@/components/views/chat-view";

const TABS = [
  { key: "ranking", label: "Ranking", icon: Trophy },
  { key: "grupo", label: "Grupo", icon: Users },
  { key: "chat", label: "Chat", icon: MessageCircle },
] as const;

function CommunityContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "ranking";

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-2xl bg-surface p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => router.replace(`/comunidad?tab=${key}`, { scroll: false })}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition",
              tab === key ? "bg-accent font-medium text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "ranking" && <RankingView />}
      {tab === "grupo" && <GroupView />}
      {tab === "chat" && <ChatView />}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityContent />
    </Suspense>
  );
}
