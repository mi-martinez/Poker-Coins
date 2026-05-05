// Captura screenshots con estado de juego completo: 2 jugadores en
// mesa, mano activa, overlays, etc.
//
// Orquesta 3 contextos de Playwright (dealer + 2 jugadores) y los
// dirige paso a paso por el flujo del juego.
//
// Requisitos: dev server corriendo + Anonymous Sign-In habilitado en
// Firebase + DB lista.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "docs", "screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const VIEWPORT = { width: 1280, height: 900 };
const MOBILE = { width: 430, height: 932 };

async function ensureOut() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function capture(page, name, opts = {}) {
  const path = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: opts.full ?? false });
  console.log(`✓ ${name}.png`);
}

async function loginAsGuest(page, nickname) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  await page.waitForSelector('input[name="nickname"]', { timeout: 10000 });
  await page.fill('input[name="nickname"]', nickname);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
      timeout: 20000,
    }),
    page.click('button:has-text("Continuar como invitado")'),
  ]);
  await page.waitForTimeout(800);
}

async function main() {
  await ensureOut();
  const browser = await chromium.launch({ headless: true });
  try {
    // 3 contextos completamente aislados (cookies separadas = "usuarios" distintos)
    const dealerCtx = await browser.newContext({ viewport: VIEWPORT });
    const p1Ctx = await browser.newContext({ viewport: MOBILE });
    const p2Ctx = await browser.newContext({ viewport: MOBILE });

    const dealer = await dealerCtx.newPage();
    const p1 = await p1Ctx.newPage();
    const p2 = await p2Ctx.newPage();

    // ─── Dealer: login + crear sala ──────────────────────────────
    console.log("→ Dealer: login + crear sala");
    await loginAsGuest(dealer, "Dealer");
    await dealer.goto(`${BASE}/dealer/new`, { waitUntil: "networkidle" });
    await dealer.fill('input[name="blind_small"]', "500");
    await dealer.fill('input[name="blind_big"]', "1000");
    await dealer.fill('input[name="max_seats"]', "4");
    await dealer.fill('input[name="min_buy_in"]', "20000");
    await Promise.all([
      dealer.waitForURL(/\/dealer\/[A-Z0-9]{6}$/, { timeout: 15000 }),
      dealer.click('button:has-text("Crear sala")'),
    ]);
    await dealer.waitForTimeout(1500);

    // Leer códigos de posiciones libres (botones con format AAAAAA)
    const seatCodes = await dealer.evaluate(() => {
      const buttons = document.querySelectorAll(
        "button[aria-label^='Copiar ']",
      );
      return Array.from(buttons).map((b) =>
        b.getAttribute("aria-label").replace("Copiar ", ""),
      );
    });
    console.log(`  códigos: ${seatCodes.slice(0, 4).join(", ")}`);
    if (seatCodes.length < 2) throw new Error("No hay seat codes");
    const [code1, code2] = seatCodes;

    // ─── Player 1: login + entrar ────────────────────────────────
    console.log("→ Player 1: join");
    await loginAsGuest(p1, "Sócrates");
    await p1.goto(`${BASE}/play`, { waitUntil: "networkidle" });
    await p1.fill('input[name="seat_code"]', code1);
    await Promise.all([
      p1.waitForURL(/\/play\/[A-Z0-9]{6}$/, { timeout: 15000 }),
      p1.click('button:has-text("Tomar mi posición")'),
    ]);
    await p1.waitForTimeout(1500);
    await capture(p1, "05-join", { full: false }); // re-captura del lobby tras entrar
    await capture(p1, "06-player-view", { full: true });

    // ─── Player 2: login + entrar ────────────────────────────────
    console.log("→ Player 2: join");
    await loginAsGuest(p2, "Atenea");
    await p2.goto(`${BASE}/play`, { waitUntil: "networkidle" });
    await p2.fill('input[name="seat_code"]', code2);
    await Promise.all([
      p2.waitForURL(/\/play\/[A-Z0-9]{6}$/, { timeout: 15000 }),
      p2.click('button:has-text("Tomar mi posición")'),
    ]);
    await p2.waitForTimeout(1500);

    // ─── Player 1: pedir fichas ──────────────────────────────────
    console.log("→ Player 1: pedir fichas");
    await p1.fill('input[name="amount_cop"]', "25000");
    await p1.click('button:has-text("Solicitar fichas")');
    await p1.waitForTimeout(1500);

    // ─── Dealer: aprobar ─────────────────────────────────────────
    console.log("→ Dealer: aprobar fichas P1");
    await dealer.waitForTimeout(2000);
    await dealer.click('button:has-text("Aprobar")');
    await dealer.waitForTimeout(2000);

    // Player 2 también pide y aprueba
    console.log("→ Player 2: pedir + dealer aprueba");
    await p2.fill('input[name="amount_cop"]', "25000");
    await p2.click('button:has-text("Solicitar fichas")');
    await p2.waitForTimeout(2000);
    await dealer.click('button:has-text("Aprobar")');
    await dealer.waitForTimeout(2500);

    // Dealer dashboard con la sala llena (+sus 2 jugadores)
    await dealer.goto(`${BASE}/dealer`, { waitUntil: "networkidle" });
    await dealer.waitForTimeout(1500);
    await capture(dealer, "04-dealer-dashboard");

    // Volver a la sala del dealer
    await dealer.goBack();
    await dealer.waitForTimeout(1500);
    await capture(dealer, "11-dealer-room", { full: true });

    // ─── Iniciar mano ────────────────────────────────────────────
    console.log("→ Dealer: iniciar mano");
    await dealer.click('button:has-text("Iniciar mano")');
    await dealer.waitForTimeout(2500);

    // Capture dealer en mano activa
    await capture(dealer, "11-dealer-room", { full: true });

    // P1 en mano (uno de los dos tendrá el turno; P1 es small blind si
    // dealer button es seat 0 y P1 está en seat 1, en heads-up dealer
    // es small blind, así que P1 con seat 0 actúa primero)
    await p1.waitForTimeout(2000);
    await capture(p1, "06-player-view", { full: true });

    // P2 (sin turno o con turno, capturamos cualquiera de los dos
    // que NO tenga turno para ver el waiting overlay)
    await p2.waitForTimeout(2000);

    // Detectar quién tiene el turno y capturar el otro
    const p1HasTurn = await p1.locator("text=Tu turno").count();
    if (p1HasTurn > 0) {
      // P2 está esperando turno → captura del waiting overlay
      await capture(p2, "07-waiting-turn");
    } else {
      // P1 espera turno
      await capture(p1, "07-waiting-turn");
    }

    // ─── Hacer una acción para registrar en el historial ─────────
    console.log("→ Acción: jugador llama");
    const actor = p1HasTurn > 0 ? p1 : p2;
    const otherPlayer = p1HasTurn > 0 ? p2 : p1;
    const callBtn = actor.locator('button:has-text("Call")').first();
    if (await callBtn.count()) {
      await callBtn.click();
    } else {
      const checkBtn = actor.locator('button:has-text("Check")').first();
      if (await checkBtn.count()) await checkBtn.click();
    }
    await actor.waitForTimeout(2000);

    // El otro hace check para cerrar la ronda
    const otherCheck = otherPlayer.locator('button:has-text("Check")').first();
    const otherCall = otherPlayer.locator('button:has-text("Call")').first();
    if (await otherCheck.count()) {
      await otherCheck.click();
    } else if (await otherCall.count()) {
      await otherCall.click();
    }
    await otherPlayer.waitForTimeout(1500);

    // ─── Capturar el countdown de reparto ────────────────────────
    // El servidor seteó phase_ready_at. Esperamos el render del overlay
    await p1.waitForTimeout(1200);
    const dealOverlay = p1.locator("text=Repartiendo");
    if (await dealOverlay.count()) {
      await capture(p1, "08-deal-countdown");
    } else {
      // Si nos perdimos el momento, ignorar
      console.log("  (overlay de reparto no visible)");
    }

    // Esperar a que pase el countdown completo + la próxima ronda
    await dealer.waitForTimeout(11000);

    // Captura de mesa con flop visible
    await capture(dealer, "11-dealer-room", { full: true });

    // ─── Foldeear para terminar la mano ──────────────────────────
    console.log("→ Acción: fold para cerrar mano");
    // Quien tenga turno foldea
    const p1Turn = await p1.locator("text=Tu turno").count();
    const folder = p1Turn > 0 ? p1 : p2;
    const winner = p1Turn > 0 ? p2 : p1;
    const foldBtn = folder.locator('button:has-text("Fold")').first();
    if (await foldBtn.count()) {
      await foldBtn.click();
    }
    await winner.waitForTimeout(1500);

    // Win celebration en el ganador
    await capture(winner, "10-win-celebration");

    // Win announcement en el otro
    await capture(folder, "10b-win-announcement");

    // Esperar a que la animación termine
    await winner.waitForTimeout(5500);

    // ─── Historial + contabilidad ────────────────────────────────
    console.log("→ Capturas de historial + contabilidad");
    await dealer.waitForTimeout(1500);

    // Expandir historial
    const historySummary = dealer.locator("summary:has-text('Historial')");
    if (await historySummary.count()) {
      await historySummary.click();
      await dealer.waitForTimeout(800);
      await capture(dealer, "12-history", { full: true });
      await historySummary.click(); // cerrar
    }

    // Expandir contabilidad
    const accSummary = dealer.locator("summary:has-text('Contabilidad')");
    if (await accSummary.count()) {
      await accSummary.click();
      await dealer.waitForTimeout(800);
      await capture(dealer, "13-accounting", { full: true });
      await accSummary.click();
    }

    // ─── Cerrar sala → captura del closed summary ────────────────
    console.log("→ Cerrar sala");
    const closeBtn = dealer.locator('button:has-text("Cerrar sala")').first();
    if (await closeBtn.count()) {
      await closeBtn.click();
      await dealer.waitForTimeout(500);
      await closeBtn.click(); // confirma
      await dealer.waitForTimeout(2000);
      await capture(dealer, "14-closed-summary", { full: true });
    }

    // 09-showdown se queda pendiente — requiere llegar a SHOWDOWN
    // sin folds (los 2 jugadores sobreviven 4 fases). Posible
    // pero costoso. Nota:
    console.log(
      "\n[nota] 09-showdown requiere ambos jugadores llegar a river sin foldear. Capturar a mano si se quiere.",
    );

    await dealerCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
