import type { Metadata, Viewport } from "next";
import {
  Graduate,
  Archivo,
  Kalam,
  Itim,
  Patrick_Hand,
} from "next/font/google";
import "./globals.css";

// Graduate för rubriker (collegiate/klubbemblem), Archivo för brödtext.
// Tre handstilsfonter roterar på spelarkorten så att varje spelare får
// en egen "namnteckning" — med riktig handskriven karaktär.
const graduate = Graduate({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-graduate",
});

const kalam = Kalam({
  weight: "700",
  subsets: ["latin", "latin-ext"],
  variable: "--font-autograph-1",
});

const itim = Itim({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-autograph-2",
});

const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-autograph-3",
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Habo-cupen 2026",
  description:
    "Schema för Habo-cupen 2026 – matcher, mat och allt däremellan. Uppdateras live.",
};

export const viewport: Viewport = {
  themeColor: "#1c4a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`${graduate.variable} ${archivo.variable} ${kalam.variable} ${itim.variable} ${patrickHand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
