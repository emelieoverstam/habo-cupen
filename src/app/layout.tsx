import type { Metadata, Viewport } from "next";
import { Graduate, Archivo, Caveat } from "next/font/google";
import "./globals.css";

// Graduate för rubriker (collegiate/klubbemblem), Archivo för brödtext,
// Caveat för autografer på spelarkorten
const graduate = Graduate({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-graduate",
});

const caveat = Caveat({
  weight: ["600", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-caveat",
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
      className={`${graduate.variable} ${archivo.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
