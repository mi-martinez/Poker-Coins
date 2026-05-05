"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatCop } from "@poker-coins/game";
import { PokerChip3D } from "./poker-chip-3d";

const SEEN_KEY = "pc:seen-wins";
const VISIBLE_MS = 5000;
const CHIP_COUNT = 60;

const CHIP_COLORS = [
  { bg: "#f5f5f5", ring: "#a3a3a3" },
  { bg: "#d33232", ring: "#7f1d1d" },
  { bg: "#2d6cdf", ring: "#1e3a8a" },
  { bg: "#1f8a3f", ring: "#14532d" },
  { bg: "#1a1a1a", ring: "#525252" },
  { bg: "#7c3aed", ring: "#4c1d95" },
  { bg: "#f59e0b", ring: "#92400e" }, // gold
];

export interface Winner {
  handId: string;
  nickname: string;
  amount: number;
  isMe: boolean;
  avatarUrl?: string | null;
}

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(handId: string) {
  if (typeof window === "undefined") return;
  const set = readSeen();
  set.add(handId);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
}

// Overlay fullscreen que celebra el cierre de mano. Las fichas explotan
// desde el centro (como si reventara el pozo) y caen con gravedad. El
// título pulsa con resplandor dorado.
export function WinCelebration({ winners }: { winners: Winner[] | null }) {
  const [active, setActive] = useState<Winner[] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);

  // Solo dispara si el usuario actual es ganador. Los demás reciben
  // el WinAnnouncement (overlay tradicional) en lugar de esta celebración.
  useEffect(() => {
    if (!winners || winners.length === 0) return;
    if (!winners.some((w) => w.isMe)) return;
    const handId = winners[0]!.handId;
    const seen = readSeen();
    if (seen.has(handId)) return;
    setActive(winners);
    markSeen(handId);
    const timer = setTimeout(() => setActive(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [winners]);

  useGSAP(
    () => {
      if (!active) return;

      const tl = gsap.timeline();

      if (root.current) {
        tl.fromTo(
          root.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.25, ease: "power2.out" },
        );
      }

      // Beam giratorio (rayos detrás del texto)
      if (beamRef.current) {
        gsap.to(beamRef.current, {
          rotation: 360,
          duration: 8,
          ease: "none",
          repeat: -1,
        });
      }

      // Burst de fichas 3D desde el centro
      if (chipsRef.current) {
        const chips =
          chipsRef.current.querySelectorAll<HTMLDivElement>("[data-chip]");
        const w = window.innerWidth;
        const h = window.innerHeight;
        chips.forEach((chip) => {
          // Dirección 3D: ángulo en el plano + variación en Z
          const angle = Math.random() * Math.PI * 2;
          const speed = 250 + Math.random() * 500;
          const tx = Math.cos(angle) * speed;
          const ty = Math.sin(angle) * speed;
          const tz = -150 + Math.random() * 300;
          // Rotaciones en los 3 ejes para un giro realista
          const rotX = (Math.random() - 0.5) * 1440;
          const rotY = (Math.random() - 0.5) * 1440;
          const rotZ = (Math.random() - 0.5) * 720;
          const fallDistance = h * 0.6 + Math.random() * h * 0.4;

          gsap.set(chip, {
            left: w / 2,
            top: h / 2,
            xPercent: -50,
            yPercent: -50,
            z: 0,
            autoAlpha: 0,
            scale: 0.3,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
          });
          gsap
            .timeline({ delay: Math.random() * 0.4 })
            // Burst hacia afuera + Z + comienza a girar
            .to(chip, {
              x: tx,
              y: ty,
              z: tz,
              rotationX: rotX * 0.3,
              rotationY: rotY * 0.3,
              rotationZ: rotZ * 0.3,
              autoAlpha: 1,
              scale: 1,
              duration: 0.55 + Math.random() * 0.3,
              ease: "power2.out",
            })
            // Caída con gravedad + giros completos en X/Y
            .to(chip, {
              y: ty + fallDistance,
              z: 0,
              rotationX: rotX,
              rotationY: rotY,
              rotationZ: rotZ,
              duration: 1.4 + Math.random() * 0.6,
              ease: "power1.in",
            })
            .to(
              chip,
              {
                autoAlpha: 0,
                duration: 0.4,
                ease: "power2.in",
              },
              "-=0.4",
            );
        });
      }

      // Título — burst desde pequeño con glow
      if (titleRef.current) {
        tl.fromTo(
          titleRef.current,
          { scale: 0.3, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.7,
            ease: "back.out(2)",
          },
          "+=0.15",
        );
      }

      // Monto — pulse continuo
      if (amountRef.current) {
        tl.fromTo(
          amountRef.current,
          { y: 30, autoAlpha: 0, scale: 0.8 },
          {
            y: 0,
            autoAlpha: 1,
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.5)",
          },
          "-=0.4",
        );
        gsap.to(amountRef.current, {
          scale: 1.05,
          duration: 0.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    },
    { dependencies: [active] },
  );

  if (!active) return null;

  // Soporte para 1 o más ganadores (split pot)
  const isSplit = active.length > 1;
  const totalAmount = active.reduce((s, w) => s + w.amount, 0);
  const anyMe = active.some((w) => w.isMe);

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      className="pointer-events-none fixed inset-0 z-[9700] overflow-hidden bg-black/85 backdrop-blur-md"
    >
      {/* Beam giratorio detrás del texto */}
      <div
        ref={beamRef}
        className="absolute left-1/2 top-1/2 h-[200vmax] w-[200vmax] -translate-x-1/2 -translate-y-1/2 opacity-25"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(245,158,11,0.5) 30deg, transparent 60deg, transparent 180deg, rgba(245,158,11,0.5) 210deg, transparent 240deg)",
        }}
        aria-hidden="true"
      />

      {/* Capa de fichas 3D que explotan (perspective en el container) */}
      <div
        ref={chipsRef}
        className="pointer-events-none absolute inset-0"
        style={{
          perspective: "1200px",
          transformStyle: "preserve-3d",
        }}
      >
        {Array.from({ length: CHIP_COUNT }).map((_, i) => {
          const c = CHIP_COLORS[i % CHIP_COLORS.length]!;
          const size = 36 + Math.floor(Math.random() * 28);
          return (
            <div
              key={i}
              data-chip
              className="absolute"
              style={{
                width: size,
                height: size,
                left: 0,
                top: 0,
                visibility: "hidden",
                transformStyle: "preserve-3d",
              }}
            >
              <PokerChip3D bg={c.bg} ring={c.ring} size={size} />
            </div>
          );
        })}
      </div>

      {/* Texto central */}
      <div className="relative flex h-full flex-col items-center justify-center gap-4 text-center">
        <div ref={titleRef} className="flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-[0.5em] text-amber-300/90">
            {isSplit ? "Empate" : anyMe ? "¡Ganaste!" : "Gana"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4">
            {active.map((w, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-2xl text-amber-400">+</span>}
                <h2
                  className={`font-display text-6xl font-bold tracking-wider drop-shadow-[0_4px_28px_rgba(245,158,11,0.6)] sm:text-7xl ${
                    w.isMe ? "text-amber-200" : "text-white"
                  }`}
                >
                  {w.nickname}
                </h2>
              </span>
            ))}
          </div>
        </div>

        <div
          ref={amountRef}
          className="font-display text-7xl font-bold tabular-nums text-amber-300 drop-shadow-[0_8px_32px_rgba(245,158,11,0.8)] sm:text-8xl"
        >
          {formatCop(totalAmount)}
        </div>

        {isSplit && (
          <p className="text-sm text-zinc-300/80">
            {active.map((w) => formatCop(w.amount)).join(" + ")}
          </p>
        )}
      </div>
    </div>
  );
}
