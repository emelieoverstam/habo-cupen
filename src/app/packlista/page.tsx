import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import PackingList from "@/components/PackingList";

export const metadata: Metadata = {
  title: "Packlista – Habo-cupen 2026",
  description: "Packlista för BK Zeros cuphelg i Habo 26–28 juni 2026.",
};

export default function PacklistaPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="packlista" live={false} />
      <PackingList />
    </main>
  );
}
