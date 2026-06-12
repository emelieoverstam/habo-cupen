import type { Metadata } from "next";

// Tillfällig jämförelsesida för val av autograf-typsnitt på spelarkorten.
// Alla fonter nedan har verifierat stöd för å, ä och ö (latin-ext).
// Sidan tas bort när valet är gjort.

export const metadata: Metadata = {
  title: "Fontjämförelse – autografer",
  robots: { index: false },
};

const FONTS = [
  "Ms Madi",
  "Comforter",
  "Caveat",
  "Dancing Script",
  "Kaushan Script",
  "Marck Script",
  "Great Vibes",
  "Allura",
  "Courgette",
  "Pacifico",
  "Style Script",
  "Birthstone",
  "Whisper",
  "Yellowtail",
  "Bad Script",
  "Grand Hotel",
  "Norican",
  "La Belle Aurore",
  "Italianno",
  "Mr Dafoe",
  "Sacramento",
];

const SAMPLE_NAMES = ["Bella Swärm", "Elsa Gustafsson", "Märta Öberg"];

const fontsUrl =
  "https://fonts.googleapis.com/css2?" +
  FONTS.map((f) => `family=${f.replaceAll(" ", "+")}`).join("&") +
  "&display=swap";

export default function FontComparePage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <link rel="stylesheet" href={fontsUrl} />

      <header className="pt-8 pb-6 text-center">
        <h1 className="font-[family-name:var(--font-display)] font-bold text-2xl uppercase text-paper">
          Autograf-typsnitt
        </h1>
        <p className="mt-2 text-sm font-semibold text-paper/80">
          Så här ser namnen ut på spelarkorten — säg vilken som känns rätt!
        </p>
      </header>

      <ul className="space-y-3">
        {FONTS.map((font) => (
          <li key={font} className="rounded-xl bg-paper p-3 shadow-card">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">
              {font}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              {SAMPLE_NAMES.map((name) => (
                <span
                  key={name}
                  className="text-2xl leading-tight text-ink"
                  style={{ fontFamily: `'${font}', cursive` }}
                >
                  {name}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
