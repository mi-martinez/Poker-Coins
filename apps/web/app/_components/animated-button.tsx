"use client";

import { useRef, type ButtonHTMLAttributes } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  hoverScale?: number;
  pressScale?: number;
}

export function AnimatedButton({
  hoverScale = 1.03,
  pressScale = 0.97,
  ...props
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const enter = () => gsap.to(el, { scale: hoverScale, duration: 0.2, ease: "power2.out" });
      const leave = () => gsap.to(el, { scale: 1, duration: 0.25, ease: "power2.out" });
      const down = () => gsap.to(el, { scale: pressScale, duration: 0.1 });
      const up = () => gsap.to(el, { scale: hoverScale, duration: 0.15 });
      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
      el.addEventListener("mousedown", down);
      el.addEventListener("mouseup", up);
      return () => {
        el.removeEventListener("mouseenter", enter);
        el.removeEventListener("mouseleave", leave);
        el.removeEventListener("mousedown", down);
        el.removeEventListener("mouseup", up);
      };
    },
    { dependencies: [hoverScale, pressScale] },
  );

  return <button ref={ref} {...props} />;
}
