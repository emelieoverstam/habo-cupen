"use client";

// Diskret uppmaning att lägga appen på hemskärmen. På Android/Chrome används
// beforeinstallprompt (en riktig installationsknapp). På iOS Safari finns ingen
// sådan – då visas en instruktion i stället. Visas inte om appen redan körs
// från hemskärmen, och kan stängas (kommer inte tillbaka).

import { useEffect, useState } from "react";

const DISMISS_KEY = "habocupen-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari ger ingen beforeinstallprompt — visa instruktion efter en stund
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const iosTimer = isIOS
      ? setTimeout(() => setPlatform((p) => p ?? "ios"), 1500)
      : null;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    setPlatform(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!platform) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl bg-white p-3 shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">
            Lägg Habo-cupen på hemskärmen
          </p>
          {platform === "ios" ? (
            <p className="mt-0.5 text-sm text-ink/70">
              Tryck på <span className="font-bold">Dela</span>-ikonen (fyrkanten
              med en pil uppåt) längst ner och välj{" "}
              <span className="font-bold">”Lägg till på hemskärmen”</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink/70">
              Då öppnas den i helskärm som en app.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {platform === "android" && (
              <button
                type="button"
                onClick={install}
                className="rounded-xl bg-grass px-4 py-1.5 font-[family-name:var(--font-display)] font-bold text-sm uppercase shadow-chip transition-transform active:scale-95"
              >
                Lägg till
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-ink/20 bg-paper px-4 py-1.5 text-sm font-bold transition-transform active:scale-95"
            >
              {platform === "ios" ? "Okej" : "Inte nu"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Stäng"
          className="shrink-0 rounded-full px-1.5 text-lg font-bold text-ink/40 transition-transform active:scale-90"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
