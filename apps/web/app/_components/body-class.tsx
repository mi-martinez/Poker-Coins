"use client";

import { useEffect } from "react";

// Toggle declarativo de una clase en <body>. Útil para estados de
// página (ej. esperando turno) que necesitan cambiar el fondo global.
// Soporta una sola clase activa o múltiples (siempre limpia al cambiar).
export function BodyClass({
  className,
  active,
}: {
  /** Clase única o lista; sólo se aplica la que coincida con `active`. */
  className: string;
  active: boolean;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (active) {
      body.classList.add(className);
      return () => body.classList.remove(className);
    }
    return undefined;
  }, [className, active]);
  return null;
}
