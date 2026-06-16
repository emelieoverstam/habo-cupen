"use client";

// Splash som visas när appen körs från hemskärmen (standalone). Synligheten
// styrs av CSS (@media display-mode: standalone) så att vanliga webbläsar-
// besökare aldrig ser den och ingen glimt uppstår. JS tonar bort den efter en
// kort stund.

import { useEffect, useState } from "react";
import Image from "next/image";

export default function AppSplash() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), 1300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`app-splash${hidden ? " app-splash--hidden" : ""}`}
      aria-hidden
    >
      <Image
        src="/bk-zeros.svg"
        alt=""
        width={132}
        height={132}
        className="rise"
        priority
      />
      <p
        className="rise mt-4 font-[family-name:var(--font-display)] font-bold text-2xl uppercase tracking-wide text-sun"
        style={{ animationDelay: "120ms" }}
      >
        Habo-cupen 2026
      </p>
    </div>
  );
}
