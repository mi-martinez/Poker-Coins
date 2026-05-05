# Poker Coins

Texas Hold'em **híbrido físico/digital**. Las cartas y fichas son reales sobre la mesa; las apuestas, turnos y contabilidad ocurren en el celular de cada jugador. Pensado para partidas privadas en pesos colombianos (COP).

![Home](docs/screenshots/01-home.png)

---

## ¿Para qué sirve?

Conserva la experiencia social del poker presencial — barajar, repartir cartas físicas, apilar fichas — y elimina la fricción de:

- **Llevar la cuenta de las apuestas**: el sistema valida cada acción en su turno y mantiene el pozo en tiempo real
- **Manejar varias denominaciones de fichas**: solo importan las cantidades en COP
- **Recordar quién entró cuánto y quién sacó cuánto**: contabilidad automática con historial y gráficas
- **Discusiones sobre turnos o all-ins**: el sistema fuerza el orden correcto y maneja side pots

El **dealer es un operador humano**, no juega. Su rol: repartir cartas físicas, aprobar solicitudes de fichas, declarar ganadores en showdown.

---

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 (App Router) + Tailwind + GSAP
- **Auth**: Firebase (Google + invitado en dev) — vía cookie de sesión HttpOnly
- **DB / Realtime**: Supabase (Postgres + Realtime broadcast)
- **Sonidos**: Web Audio API sintetizado (modal synthesis para fichas)
- **Deploy**: Vercel (frontend) + Supabase (DB + Realtime + Auth bridge)

```
apps/
  web/                Next.js — jugador (/play) + dealer (/dealer) + sign-in
packages/
  db/                 Migraciones SQL + tipos Database de Supabase
  game/               Motor: tipos, denominaciones, fases, room/seat codes, nombres griegos
  ui/                 Componentes compartidos (mesa, fichas, stack)
```

---

## Setup local

### 1. Pre-requisitos
- Node ≥ 20, pnpm ≥ 10
- Cuenta de Supabase con un proyecto creado
- Cuenta de Firebase con un proyecto creado

### 2. Variables de entorno

```bash
cp .env.example apps/web/.env.local
```

Llena `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Migraciones de DB

Aplica los archivos en `packages/db/migrations/` en orden numérico al SQL editor de Supabase, o vía `psql`:

```bash
PGPASSWORD="$DB_PASSWORD" psql "postgresql://postgres.<ref>@aws-1-<region>.pooler.supabase.com:5432/postgres" \
  -f packages/db/migrations/0001_initial_schema.sql \
  -f packages/db/migrations/0002_rls_policies.sql \
  -f packages/db/migrations/0003_firebase_auth.sql \
  -f packages/db/migrations/0004_rls_for_firebase.sql \
  -f packages/db/migrations/0005_game_config.sql \
  -f packages/db/migrations/0006_room_name_avatar.sql \
  -f packages/db/migrations/0007_phase_ready_at.sql \
  -f packages/db/migrations/0008_turn_started_at.sql \
  -f packages/db/migrations/0009_realtime_broadcast.sql
```

### 4. Configurar Firebase

- **Authentication → Sign-in method**: habilita **Google** (y opcionalmente **Anonymous** para el modo invitado de desarrollo)
- **Authorized domains**: añade `localhost` y tu dominio de producción

### 5. Configurar Supabase

- **Authentication → Sign In / Up → Third-Party Auth**: añade provider **Firebase** con tu Project ID
- **Database → Replication**: las migraciones ya añaden las tablas relevantes a la publicación `supabase_realtime`

### 6. Correr en local

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Cómo jugar

### Inicio de sesión

![Sign in](docs/screenshots/02-sign-in.png)

Login con Google es la única vía en producción. En desarrollo aparece también un botón "Continuar como invitado" que crea una sesión anónima en Firebase — útil para probar varios jugadores en distintos navegadores incognito.

### Dealer: crear una sala

![Crear sala](docs/screenshots/03-create-room.png)

El dealer configura:

- **Tipo de juego**:
  - *Mesa libre* (cash): jugadores piden fichas cuando quieran
  - *Torneo*: buy-in fijo, todos empiezan al tiempo, recompra opcional
- **Ciegas pequeña / grande** (múltiplos de 500 COP)
- **Asientos máximos** (2-10)
- **Buy-in mínimo** (cash) o **costo de entrada + recompra** (torneo)
- **Tiempo por turno** (5-300s, opcional)

Al crear la sala se asignan automáticamente:

- Un **nombre temático griego** (filósofo / mitología / concepto)
- Un **código de sala** de 6 caracteres
- **N códigos de posición**, uno por asiento, distintos entre sí — controlan el orden de los turnos

### Dealer: dashboard de mesas

![Dashboard dealer](docs/screenshots/04-dealer-dashboard.png)

- Lista de mesas abiertas con título griego, fecha, blinds, jugadores y avatares ordenados por fichas
- Estado en vivo: "Esperando inicio", "Mesa activa", "Turno: #2 · Carlos"
- Cerrar sala con doble-confirmación
- Acordeón de mesas cerradas recientes

### Jugador: unirse

![Unirse a una mesa](docs/screenshots/05-join.png)

El jugador recibe del dealer un **código de posición** (no el código de sala). Al ingresarlo:

- *Mesa libre*: aparece el formulario para pedir fichas (≥ buy-in mínimo)
- *Torneo*: queda en sala de espera hasta que el dealer inicie

### En la mesa

![Vista del jugador](docs/screenshots/06-player-view.png)

El jugador ve:

- **Su balance** y bet actual
- **Pozo** y fase de la mano (PREFLOP / FLOP / TURN / RIVER / SHOWDOWN)
- **Cartas comunitarias** indicativas (las reales están en la mesa física)
- **Competidores** en orden cíclico desde su asiento, con avatares y posiciones
- **Botones de acción** cuando es su turno: Fold / Check o Call / 2× / 3× / Pot / All-in / cantidad personalizada

### Esperando turno

![Esperando turno](docs/screenshots/07-waiting-turn.png)

Cuando es el turno de otro jugador, todos ven una pantalla completa con:

- Última acción que se hizo (banner ámbar: "Carlos · Sube $3.000")
- Avatar grande del jugador en turno con anillo de progreso
- Contador del tiempo restante (ámbar → rojo en últimos 5s)
- Pozo actual

### Reparto automático con countdown

![Countdown reparto](docs/screenshots/08-deal-countdown.png)

Cuando todos los jugadores en juego igualan, aparece un overlay fullscreen sincronizado en todas las pantallas:

- "Repartiendo flop / turn / river / Showdown"
- Animación de cartas cayendo desde la izquierda
- Anillo de progreso ámbar
- Contador en segundos (10s para flop, 5s para turn/river, 3s para showdown)

Al expirar, el sistema avanza automáticamente la fase. El dealer mientras tanto reparte las cartas físicas.

### Showdown

![Showdown](docs/screenshots/09-showdown.png)

En showdown con múltiples jugadores en juego:

- **Jugadores**: ven "Esperando ganador" mientras el dealer revisa las cartas físicas
- **Dealer**: ve un picker con los candidatos. Puede seleccionar **uno o varios** ganadores (split pot por empate). El reparto se calcula automáticamente.

### Animación de victoria

![Celebración del ganador](docs/screenshots/10-win-celebration.png)

Cuando se cierra una mano:

- **Ganador**: ve `WinCelebration` — fichas 3D explotando desde el centro con rotación en los 3 ejes, anillo de luces giratorio ámbar, monto pulsando, arpegio mayor de victoria + cascada de chip drops
- **Resto de jugadores y dealer**: ven `WinAnnouncement` — overlay sobrio con avatares, nombres y montos

### Vista del dealer en mesa

![Vista dealer](docs/screenshots/11-dealer-room.png)

El dealer ve:

- **Botón del dealer prominente**: píldora "BOTÓN DEL DEALER #N · Nombre" con D-chip
- **Mano activa**: número, fase, pozo, turno actual con nickname
- **Cartas comunitarias** indicativas
- **Vista de jugadores**: grid de cards mostrando lo que cada jugador ve en su pantalla en tiempo real (estado, balance, apuesta, controles del dealer)
- **Códigos de posiciones libres**: para compartir con quien aún no entra
- **Solicitudes de fichas** pendientes con aprobar/rechazar

### Controles del dealer por jugador

En cada card de la "Vista de jugadores" hay dos botones compactos:

- **Fold** (rojo, solo si hay mano activa): foldea por el jugador (útil si está AFK / desconectado). Confirmación simple.
- **Sentar fuera / Volver**: marca al jugador para no jugar la próxima mano (toggle).

### Historial de eventos

![Historial](docs/screenshots/12-history.png)

Acordeón colapsable con las últimas 80 acciones del juego, código de color por tipo:

- Mano #N iniciada / cerrada
- Acciones de jugador (pasa / iguala / sube / se retira / all-in / blinds)
- Solicitudes de fichas (pedido / aprobado / rechazado)
- Pagos (ganador del pozo)

Cada evento con timestamp en formato HH:MM:SS y monto cuando aplica.

### Contabilidad y evolución

![Contabilidad](docs/screenshots/13-accounting.png)

Acordeón colapsable con:

- **Resumen**: fichas totales en juego + movimiento neto
- **Tabla por jugador** ordenada por balance: balance actual / entradas / salidas / neto (verde si ≥0, rojo si <0)
- **Gráfica SVG** con líneas por jugador mostrando la evolución de su balance acumulado a lo largo de la partida. Cada línea con color hash determinista del nickname.

### Cierre de sala

![Cierre](docs/screenshots/14-closed-summary.png)

Al cerrar la sala (botón "Cerrar sala" con doble-confirmación), todos pasan a una vista de solo lectura:

- Total en juego al cierre
- Ranking de jugadores por balance final (el primero con badge ámbar de ganador)
- Sin controles, sin formularios

---

## Reglas implementadas

- **Texas Hold'em estándar**: blinds, posición rotativa del botón cada mano, mín. raise = ciega grande o último raise (lo que sea mayor), call/check/raise/fold/all-in
- **Side-pot awareness**: cuando alguien va all-in con menos fichas, los demás siguen apostando entre ellos en un pozo paralelo. El dealer declara ganadores por pozo manualmente
- **Auto-cierre con un sobreviviente**: si todos foldearon menos uno, la mano cierra automáticamente y se reparte el pozo
- **Heads-up especial**: con 2 jugadores el dealer es la ciega pequeña y actúa primero preflop
- **Sit-out**: jugadores que el dealer marcó como "sentado fuera" no entran en la próxima mano
- **No se evalúan manos automáticamente**: las cartas son físicas; el dealer mira y declara

---

## Arquitectura

### Auth

```
Cliente (Browser) → Firebase Auth (Google sign-in popup)
                  ↓ ID token
                  POST /api/auth/session
                  ↓
                  Firebase Admin verifyIdToken
                  ↓
                  Crea session cookie HttpOnly (5 días)
                  ↓ siguiente request
                  getCurrentUser() lee cookie → verifySessionCookie → public.users.id (uuid)
```

### Realtime

Trigger SQL en cada UPDATE/INSERT relevante → `realtime.send()` al canal `room:{uuid}` → cliente suscrito vía WebSocket → `router.refresh()` → server component re-renderiza con datos frescos.

Latencia esperada: < 300 ms.

Polling de 15 s como red de seguridad si la conexión Realtime se cae.

### Datos

```
rooms ─┬─ seats ─┬─ chip_requests
       │         └─ ledger_entries
       └─ hands ─┬─ hand_participants
                 ├─ actions
                 └─ payouts
```

---

## Comandos útiles

```bash
pnpm dev              # arranca todos los workspaces en modo dev
pnpm build            # build de producción
pnpm typecheck        # tsc --noEmit en todos los packages
pnpm --filter @poker-coins/web dev       # solo la app web
```

---

## Disclaimer legal

Para uso privado/casero entre amigos. Si vas a operar comercialmente esta app en Colombia, necesitas licencia de **Coljuegos**. Esta app no constituye una plataforma de apuestas autorizada.
