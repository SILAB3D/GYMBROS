"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy, Users, MessageCircle } from "lucide-react";
import { api } from "@/trpc/react";
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
  const utils = api.useUtils();
  const tab = params.get("tab") ?? "ranking";
  const [visited, setVisited] = useState<Set<string>>(() => new Set([tab]));

  // Precarga de ranking y grupo. El chat NO se precarga: abrirlo marca los
  // mensajes como leídos, y eso solo debe pasar cuando el usuario lo ve.
  useEffect(() => {
    void utils.ranking.get.prefetch({ period: "week" });
    void utils.user.list.prefetch();
  }, [utils]);

  useEffect(() => {
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

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
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden min-[460px]:inline">{label}</span>
          </button>
        ))}
      </div>

      {visited.has("ranking") && <div className={tab === "ranking" ? "" : "hidden"}><RankingView /></div>}
      {visited.has("grupo") && <div className={tab === "grupo" ? "" : "hidden"}><GroupView /></div>}
      {/* El chat se monta solo cuando está activo (su sondeo marca mensajes como leídos) */}
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
