// Länkar till de officiella resultaten och tabellerna på Cupmate.
// Cupmate fungerar i telefonen men blockerar vår server, så resultat/tabeller
// länkar vi till källan i stället för att synka in dem.

const GROUP_LINKS = [
  {
    label: "Vit – Grupp A",
    dot: "#FFFFFF",
    href: "https://www.cupmate.nu/matcher.php?iCupID=15637&iClassID=21644&iGroupID=107010",
  },
  {
    label: "Grön – Grupp C",
    dot: "#29A166",
    href: "https://www.cupmate.nu/matcher.php?iCupID=15637&iClassID=21644&iGroupID=107012",
  },
];

const ALL_RESULTS_URL = "https://www.cupmate.nu/malservice.php?iCupID=15637";

export default function CupmateResults() {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <h2 className="font-[family-name:var(--font-display)] font-bold text-lg uppercase">
        📊 Resultat & tabeller
      </h2>
      <p className="mt-1 mb-3 text-sm font-semibold text-ink/70">
        Resultaten och tabellerna uppdateras live på Cupmate – tryck för att se
        ställningen i era grupper.
      </p>

      <div className="space-y-2">
        {GROUP_LINKS.map((g) => (
          <a
            key={g.href}
            href={g.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-grass px-4 py-3 font-[family-name:var(--font-display)] font-bold text-base uppercase shadow-chip transition-transform active:scale-95"
          >
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-ink/40"
              style={{ backgroundColor: g.dot }}
              aria-hidden
            />
            {g.label}
            <span className="ml-auto" aria-hidden>
              →
            </span>
          </a>
        ))}
      </div>

      <a
        href={ALL_RESULTS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-xl border border-ink/15 bg-paper px-4 py-2.5 text-center text-sm font-bold transition-transform active:scale-95"
      >
        Alla resultat live →
      </a>
    </section>
  );
}
