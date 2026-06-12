"use client";

// Gemensam header med titel och hamburgermeny för alla publika sidor

import { useEffect, useState } from "react";
import Link from "next/link";

const TABS = [
  { href: "/", label: "Hem", key: "hem" },
  { href: "/schema", label: "Schema", key: "schema" },
  { href: "/tabeller", label: "Tabeller", key: "tabeller" },
  { href: "/trupperna", label: "Trupperna", key: "trupperna" },
  { href: "/packlista", label: "Packlista", key: "packlista" },
  { href: "/tjugan", label: "Tjugan", key: "tjugan" },
] as const;

export type SiteTab = (typeof TABS)[number]["key"];

export default function SiteHeader({
  active,
  live = true,
}: {
  active: SiteTab;
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Lås bakgrundsscrollen när menyn är öppen
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="pt-8 pb-5 text-center">
      {/* Hamburgaren ligger alltid uppe till höger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Öppna menyn"
        aria-expanded={open}
        className="fixed right-4 top-4 z-40 flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-paper/30 bg-pine/90 backdrop-blur transition-transform active:scale-95"
      >
        <span className="h-0.5 w-5 rounded-full bg-paper" aria-hidden />
        <span className="h-0.5 w-5 rounded-full bg-paper" aria-hidden />
        <span className="h-0.5 w-5 rounded-full bg-paper" aria-hidden />
      </button>

      {/* Helskärmsmeny */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-pine">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Stäng menyn"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl border border-paper/30 text-2xl text-paper transition-transform active:scale-95"
          >
            ×
          </button>
          <nav
            aria-label="Sidor"
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            {TABS.map((tab, index) => (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setOpen(false)}
                aria-current={tab.key === active ? "page" : undefined}
                className={`rise font-[family-name:var(--font-display)] font-bold text-2xl uppercase tracking-wide transition-transform active:scale-95 ${
                  tab.key === active
                    ? "border-b-2 border-sun text-sun"
                    : "text-paper hover:text-sun"
                }`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {tab.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="rise mt-6 text-sm font-semibold text-paper/50 hover:text-paper"
              style={{ animationDelay: "300ms" }}
            >
              Ledarinloggning
            </Link>
          </nav>
        </div>
      )}

      <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-sun">
        26–28 juni
      </p>
      <h1 className="font-[family-name:var(--font-display)] font-bold text-4xl uppercase leading-tight text-paper sm:text-5xl">
        Habo-cupen
        <span className="ml-3 inline-block -rotate-6 rounded-lg bg-sun px-2 py-1 align-middle text-lg text-ink shadow-chip sm:text-xl">
          2026
        </span>
      </h1>
      {live && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-paper">
          <span
            className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-mint"
            aria-hidden
          />
          Uppdateras live
        </p>
      )}
    </header>
  );
}
