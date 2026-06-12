import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import "./globals.css";

// Anton för rubriker (idrottsaffisch), Archivo för brödtext
const anton = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-anton",
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
      className={`${anton.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
