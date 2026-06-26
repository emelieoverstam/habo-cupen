import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import CupmateResults from "@/components/CupmateResults";

export const metadata: Metadata = {
  title: "Resultat & tabeller – Habo-cupen 2026",
  description:
    "Resultat och gruppspelstabeller för BK Zeros i Habo-cupen 2026 (live på Cupmate).",
};

export default function TabellerPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="tabeller" live={false} />
      <CupmateResults />
    </main>
  );
}
