import type { Metadata, Viewport } from "next";
import { Federo, Roboto } from "next/font/google";
import { Suspense } from "react";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${federo.variable} ${roboto.variable}`}>
      <body className="font-sans">
        <Suspense fallback={null}>
          <UserMenuSlot />
        </Suspense>
        <FullscreenButton />
        {children}
      </body>
    </html>
  );
}

// El UserMenu necesita auth, pero NO debe bloquear el render del árbol
// principal. Suspense permite que `children` arranque a renderizar
// mientras esto resuelve. `getCurrentUser` está envuelto en React
// `cache`, así que la página interior reusa el mismo resultado.
async function UserMenuSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <UserMenu
      user={{
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
