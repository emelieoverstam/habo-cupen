import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Poängjakt – Habo-cupen 2026",
  description: "Poängjakten under Habo-cupen 2026 – mer info släpps snart.",
};

export default function PoangjaktPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="poangjakt" live={false} />

      <section className="rounded-2xl bg-white p-6 text-center shadow-card sm:p-8">
        <p className="text-5xl" aria-hidden>
          🎯
        </p>
        <p className="mt-3 inline-block -rotate-2 rounded-lg bg-sun px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-ink shadow-chip">
          Snart släpps allt
        </p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] font-bold text-2xl uppercase leading-tight sm:text-3xl">
          Poängjakten närmar sig
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-base font-semibold text-ink/80">
          Lördag kväll smäller det. 🔥 Håll utkik här – snart avslöjar vi allt du
          behöver veta för att kamma hem segern!
        </p>
      </section>
    </main>
  );
}
