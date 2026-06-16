import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Musik – Habo-cupen 2026",
  description: "Lagets gemensamma spellista och BK Zeros AI-låtar.",
};

// Delningslänk till spellistan (öppnas i Spotify-appen för att lägga till låtar)
const PLAYLIST_URL =
  "https://open.spotify.com/playlist/1MX68RTYUwl0VsSYcW5O6e";
const PLAYLIST_EMBED =
  "https://open.spotify.com/embed/playlist/1MX68RTYUwl0VsSYcW5O6e?utm_source=generator";

export default function MusikPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="musik" live={false} />

      {/* Gemensam spellista */}
      <section className="mb-6 rounded-2xl bg-white p-4 shadow-card sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] font-bold text-lg uppercase">
          🎵 Lagets spellista
        </h2>
        <p className="mt-1 mb-3 text-sm font-semibold text-ink/70">
          Lägg till dina favoritlåtar så peppar vi laget tillsammans!
        </p>

        <iframe
          title="BK Zeros spellista på Spotify"
          src={PLAYLIST_EMBED}
          width="100%"
          height={420}
          loading="lazy"
          style={{ borderRadius: 12, border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />

        <a
          href={PLAYLIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-xl bg-grass px-4 py-2.5 text-center font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95"
        >
          Öppna i Spotify – lägg till låtar
        </a>
      </section>

      {/* BK Zeros AI-låtar */}
      <section className="rounded-2xl bg-white p-6 text-center shadow-card sm:p-8">
        <p className="text-4xl" aria-hidden>
          🤖🎶
        </p>
        <p className="mt-3 inline-block -rotate-2 rounded-lg bg-sun px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-ink shadow-chip">
          Snart här
        </p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] font-bold text-2xl uppercase leading-tight">
          BK Zeros AI-låtar
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-base font-semibold text-ink/80">
          Lagets egna AI-låtar landar här snart. 🎤
        </p>
      </section>
    </main>
  );
}
