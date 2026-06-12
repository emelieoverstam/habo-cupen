import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Tjugan – Habo-cupen 2026",
  description:
    "Tjugan är en hemlig lek som pågår under hela Habo-cupen. Bli av med Tjugan innan klockan slår!",
};

/* Återanvändbara byggstenar för lekreglerna */
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rise rounded-xl bg-white p-5 shadow-card">
      <h2 className="mb-3 font-[family-name:var(--font-display)] font-bold text-lg uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function TjuganPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <SiteHeader active="tjugan" live={false} />

      <div className="mb-6 text-center">
        <p className="inline-block -rotate-2 rounded-lg bg-sun px-4 py-2 font-[family-name:var(--font-display)] font-bold text-xl uppercase text-ink shadow-chip">
          🪙 Tjugan – Habo Cup Edition
        </p>
      </div>

      <div className="space-y-4">
        <Card title="Vad är det här?">
          <p className="text-sm leading-relaxed">
            Tjugan är en <strong>hemlig lek</strong> som pågår under hela
            Habo-cupen. Det handlar om EN speciell tjugokronorssedel — den vi
            kallar <strong>Tjugan</strong>.
          </p>
          <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm font-bold">
            ➤ Du vill INTE ha Tjugan när klockan slår 22:00 varje kväll. Då
            förlorar du dagens omgång.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            Deltagare är spelare och ledare i BK Zeros F13 under Habo-cupen
            2026.
          </p>
        </Card>

        <Card title="Målet med leken">
          <ul className="space-y-2 text-sm leading-relaxed">
            <li>
              🎯 Bli av med Tjugan <strong>utan att den andra personen fattar</strong>{" "}
              vad som hänt.
            </li>
            <li>🛡️ Skydda dig själv från att få den.</li>
            <li>
              🤫 Du kan inte bara ge bort den rakt ut — det måste ske i smyg,{" "}
              <strong>gömt i ett föremål</strong>.
            </li>
            <li>
              🚫 Tjugan får bara ges till spelare och tränare i BK Zeros F13
              under Habo-cupen 2026.
            </li>
          </ul>
        </Card>

        <Card title="Så här funkar det – steg för steg">
          <ol className="space-y-3 text-sm leading-relaxed">
            <li>
              <strong>1. Det finns bara EN Tjugan.</strong>
              <br />
              Den är markerad med texten <strong>&quot;HABO 2026&quot;</strong>{" "}
              så vi känner igen den.
            </li>
            <li>
              <strong>2. Spelet är igång hela tiden.</strong>
              <br />
              Från fredag eftermiddag till söndag kl 13:15.
            </li>
            <li>
              <strong>
                3. Den som HAR TJUGAN kl 22:00 varje kväll – FÖRLORAR.
              </strong>
            </li>
            <li>
              <strong>4. Du får INTE ge bort den direkt.</strong>
              <br />❌ Inga &quot;Här, ta den här sedeln.&quot;
              <br />❌ Inga &quot;Varsågod, du får Tjugan.&quot;
              <br />
              Det räknas inte.
            </li>
            <li>
              <strong>5. Du MÅSTE gömma Tjugan i något.</strong>
              <br />✅ Lägg den i en chipspåse, tröja, godispåse, väska, sko,
              vattenflaska, etc.
              <br />✅ Du får ge bort, låna ut eller låta någon &quot;få&quot;
              föremålet.
              <br />
              Om personen tar emot föremålet — då har de tagit emot Tjugan.
            </li>
            <li>
              <strong>6. Den som får något kan skydda sig</strong> genom att
              säga: <em>&quot;Lägg det på golvet först.&quot;</em>
              <br />
              Om någon säger det MÅSTE du lägga ner föremålet. Om Tjugan då
              hittas — du har kvar den.
            </li>
            <li>
              <strong>7. Du får inte ljuga om reglerna.</strong>
              <br />
              Spelet är bara kul om alla följer reglerna rättvist och schysst.
            </li>
          </ol>
        </Card>

        <Card title="⏰ Tider som gäller">
          <ul className="space-y-2 text-sm font-semibold">
            <li className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
              <span>Fredag 22:00</span>
              <span className="text-ink/60">första kontrollen</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
              <span>Lördag 22:00</span>
              <span className="text-ink/60">andra kontrollen</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-sun px-3 py-2">
              <span>Söndag 13:15</span>
              <span>FINALEN 🏁</span>
            </li>
          </ul>
          <p className="mt-3 text-sm font-bold">
            Den som har Tjugan vid dessa tider — förlorar.
          </p>
        </Card>

        <Card title="🏁 Finalen">
          <p className="text-sm leading-relaxed">
            På söndag klockan 13:15 avslutas spelet. Den som har Tjugan då får
            ett extra uppdrag... eller kanske ett hemligt pris! 🎁
          </p>
        </Card>

        <Card title="🕵️‍♀️ Tips">
          <ul className="space-y-2 text-sm leading-relaxed">
            <li>• Var smart. Tänk som en spion.</li>
            <li>• Lita inte på någon. (Inte ens din luftmadrassgranne!)</li>
            <li>• Skicka vidare Tjugan innan det är för sent.</li>
            <li>• Känn igen Tjugan! Den är märkt — ha koll!</li>
          </ul>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <p className="font-[family-name:var(--font-display)] font-bold text-xl uppercase text-paper">
          Är du redo?
        </p>
        <p className="mt-2 text-sm font-semibold text-paper/80">
          Spelet börjar på parkeringen på Z-parken kl 15:00.
        </p>
        <p className="mt-4 inline-block rotate-1 rounded-lg border border-sun/70 bg-paper/10 px-4 py-2 text-sm font-bold text-sun">
          Den som har Tjugan när klockan slår — får ta smällen. 🪙💣
        </p>
      </div>
    </main>
  );
}
