"use client";

import { useEffect, useState } from "react";

// Botón flotante que toggle fullscreen via Fullscreen API. Auto-intenta
// entrar al modo cuando el dispositivo rota a landscape (requiere
// gesture reciente del usuario; cae silencioso si el browser bloquea).
// Solo se muestra en dispositivos touch — en desktop F11 ya hace lo mismo.
export function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (typeof document.documentElement.requestFullscreen !== "function") {
      setSupported(false);
      return;
    }

    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    onChange();

    // Auto-fullscreen al rotar a landscape (mobile)
    const mq = window.matchMedia("(orientation: landscape)");
    const isTouch = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    const tryEnter = async () => {
      if (!isTouch) return;
      if (!mq.matches) return;
      if (document.fullscreenElement) return;
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Browser bloqueó por falta de gesture — silencioso
      }
    };
    mq.addEventListener("change", tryEnter);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      mq.removeEventListener("change", tryEnter);
    };
  }, []);

  if (!supported) return null;

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFs ? "Salir de pantalla completa" : "Pantalla completa"}
      className="fixed bottom-4 right-4 z-[8500] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-zinc-100 shadow-lg backdrop-blur-md transition active:scale-95 hover:bg-black/80"
    >
      {isFs ? <ExitIcon /> : <EnterIcon />}
    </button>
  );
}

function EnterIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3v4H3M17 3v4h4M7 21v-4H3M17 21v-4h4" />
    </svg>
  );
}
