"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Spinner } from "@/components/ui";
import { InvestmentView } from "@/components/views/investment-view";

export default function InvestmentPage() {
  const { data: me, isLoading } = api.user.me.useQuery();

  if (isLoading) return <Spinner />;

  if (me && !me.investmentEnabled) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        El apartado de inversión está desactivado.{" "}
        <Link href="/ajustes" className="text-accent hover:underline">
          Actívalo en Ajustes
        </Link>
        .
      </p>
    );
  }

  return <InvestmentView />;
}
