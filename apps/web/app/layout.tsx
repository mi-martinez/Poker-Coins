import type { Metadata, Viewport } from "next";
import { Federo, Roboto } from "next/font/google";
import "./globals.css";
import { FullscreenButton } from "./_components/fullscreen-button";

// Federo — display elegante con un toque clásico para títulos.
const federo = Federo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

// Roboto — sustituto open-source de Google Sans (que es propietaria
// y no está en el catálogo público de Google Fonts).
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Poker Coins",
  description: "Texas Hold'em híbrido físico/digital",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${federo.variable} ${roboto.variable}`}>
      <body className="font-sans">
        <FullscreenButton />
        {children}
      </body>
    </html>
  );
}
