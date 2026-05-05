"use client";

import { useState } from "react";

export function CopySeatCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-felt-light/40 bg-felt-dark/40 px-3 py-1 font-mono text-base tracking-widest hover:bg-felt-dark/70"
      aria-label={`Copiar ${code}`}
    >
      {copied ? "✓ copiado" : code}
    </button>
  );
}
