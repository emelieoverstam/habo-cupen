import type { MetadataRoute } from "next";

// Webbmanifest: gör appen installerbar på hemskärmen och ger Android en
// splash (namn + ikon + bakgrundsfärg). Klubbgrön genomgående.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habo-cupen 2026 – BK Zeros",
    short_name: "Habo-cupen",
    description:
      "Schema, matcher, trupper och matchgenomgångar för BK Zeros under Habo-cupen 2026.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1c4a2e",
    theme_color: "#1c4a2e",
    lang: "sv",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
