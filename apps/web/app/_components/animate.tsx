"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type Preset = "fadeUp" | "scaleIn" | "stagger" | "slideRight";

interface AnimateInProps {
  children: React.ReactNode;
  preset?: Preset;
  delay?: number;
  duration?: number;
  className?: string;
}

// Wrapper que anima sus hijos al montar usando GSAP. Usamos fromTo
// (no from) para que React StrictMode + el doble-mount de dev no dejen
// el elemento atascado en estado oculto.
export function AnimateIn({
  children,
  preset = "fadeUp",
  delay = 0,
  duration,
  className,
}: AnimateInProps) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;

      const common = { delay, ease: "power2.out" as const };

      switch (preset) {
        case "fadeUp":
          gsap.fromTo(
            el,
            { y: 24, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: duration ?? 0.6, ...common },
          );
          break;
        case "scaleIn":
          gsap.fromTo(
            el,
            { scale: 0.94, autoAlpha: 0 },
            { scale: 1, autoAlpha: 1, duration: duration ?? 0.45, ...common },
          );
          break;
        case "slideRight":
          gsap.fromTo(
            el,
            { x: -24, autoAlpha: 0 },
            { x: 0, autoAlpha: 1, duration: duration ?? 0.5, ...common },
          );
          break;
        case "stagger":
          gsap.fromTo(
            el.children,
            { y: 16, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: duration ?? 0.5,
              stagger: 0.07,
              ...common,
            },
          );
          break;
      }
    },
    { scope, dependencies: [preset, delay] },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
