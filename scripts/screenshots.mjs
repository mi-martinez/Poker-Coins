// Captura screenshots de la app para el README usando Playwright headless.
// Asume que `pnpm dev` está corriendo en localhost:3000 y que Anonymous
// Sign-In está habilitado en Firebase (el botón "Continuar como invitado").
//
// Uso:
//   node scripts/screenshots.mjs

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "docs", "screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 900 };

async function ensureOut() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function capture(page, name) {
  const path = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`✓ ${name}.png`);
}

async function fullCapture(page, name) {
  const path = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`✓ ${name}.png (full)`);
}

async function loginAsGuest(page, nickname) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  // Espera a que el form de invitado aparezca (solo en dev mode)
  await page.waitForSelector('input[name="nickname"]', { timeout: 5000 });
  await page.fill('input[name="nickname"]', nickname);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
      timeout: 15000,
    }),
    page.click('button:has-text("Continuar como invitado")'),
  ]);
  // Pequeña pausa para que pinte
  await page.waitForTimeout(800);
}

async function main() {
  await ensureOut();
  const browser = await chromium.launch({ headless: true });
  try {
    // ─── Public routes (sin login) ──────────────────────────────
    {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const page = await ctx.newPage();

      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200); // dejar que terminen las animaciones GSAP
      await capture(page, "01-home");

      await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      await capture(page, "02-sign-in");

      await ctx.close();
    }

    // ─── Dealer (login como invitado, vacío) ─────────────────────
    {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const page = await ctx.newPage();

      await loginAsGuest(page, "Dealer Demo");

      // Home logueado
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      await capture(page, "01b-home-logged");

      // Dashboard vacío
      await page.goto(`${BASE}/dealer`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await capture(page, "04-dealer-dashboard");

      // Nueva sala (form)
      await page.goto(`${BASE}/dealer/new`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await fullCapture(page, "03-create-room");

      // Crear una sala cash para tener algo en el dashboard
      await page.fill('input[name="blind_small"]', "500");
      await page.fill('input[name="blind_big"]', "1000");
      await page.fill('input[name="max_seats"]', "4");
      await page.fill('input[name="min_buy_in"]', "20000");
      await Promise.all([
        page.waitForURL(/\/dealer\/[A-Z0-9]{6}$/, { timeout: 15000 }),
        page.click('button:has-text("Crear sala")'),
      ]);
      await page.waitForTimeout(1500);
      await fullCapture(page, "11-dealer-room");

      // Volver al dashboard ahora que tiene una sala
      await page.goto(`${BASE}/dealer`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await capture(page, "04-dealer-dashboard");

      await ctx.close();
    }

    // ─── Player /play (form de unirse) ──────────────────────────
    {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const page = await ctx.newPage();
      await loginAsGuest(page, "Jugador Demo");
      await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await capture(page, "05-join");
      await ctx.close();
    }

    console.log("\nLas demás capturas (player en mesa, overlays, win, etc.)");
    console.log("requieren estado de juego complejo y se capturan mejor a mano.");
    console.log("Las que necesitas tomar manualmente:");
    [
      "06-player-view",
      "07-waiting-turn",
      "08-deal-countdown",
      "09-showdown",
      "10-win-celebration",
      "12-history",
      "13-accounting",
      "14-closed-summary",
    ].forEach((n) => console.log(`  · ${n}.png`));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
