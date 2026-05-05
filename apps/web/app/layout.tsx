import type { Metadata, Viewport } from "next";
import { Federo, Roboto } from "next/font/google";
import "./globals.css";
import { FullscreenButton } from "./_components/fullscreen-button";
import { UserMenu } from "./_components/user-menu";
import { getCurrentUser } from "@/lib/auth-server";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const userForMenu = user
    ? {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      }
    : null;

  return (
    <html lang="es" className={`${federo.variable} ${roboto.variable}`}>
      <body className="font-sans">
        <UserMenu user={userForMenu} />
        <FullscreenButton />
        {children}
      </body>
    </html>
  );
}
