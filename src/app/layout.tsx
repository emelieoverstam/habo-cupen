import type { Metadata, Viewport } from "next";
import { Graduate, Archivo, Ms_Madi } from "next/font/google";
import "./globals.css";
import LeaderChatWidget from "@/components/LeaderChatWidget";

// Graduate för rubriker (collegiate/klubbemblem), Archivo för brödtext,
// Ms Madi för autograferna på spelarkorten.
// (Cedarville Cursive provades men saknar å/ä/ö.)
const graduate = Graduate({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-graduate",
});

const msMadi = Ms_Madi({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-autograph-1",
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
      className={`${graduate.variable} ${archivo.variable} ${msMadi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <LeaderChatWidget />
      </body>
    </html>
  );
}
