# Screenshots

El README principal del repo referencia las siguientes imágenes via paths relativos. Cuando subas el repo a GitHub público, las imágenes se mostrarán automáticamente.

## Archivos esperados

| Archivo | Captura |
|---|---|
| `01-home.png` | Página de inicio con sesión cerrada o iniciada |
| `02-sign-in.png` | Página `/sign-in` con botón Google + invitado en dev |
| `03-create-room.png` | Formulario `/dealer/new` configurando una mesa |
| `04-dealer-dashboard.png` | `/dealer` con lista de mesas abiertas y avatares |
| `05-join.png` | `/play` con input de código de posición |
| `06-player-view.png` | `/play/[code]` con balance, mesa, competidores y action buttons |
| `07-waiting-turn.png` | Overlay fullscreen "Esperando turno" con avatar y countdown |
| `08-deal-countdown.png` | Overlay "Repartiendo flop" con cartas animadas y countdown |
| `09-showdown.png` | Picker del dealer en showdown con candidatos |
| `10-win-celebration.png` | Animación de victoria con fichas 3D explotando |
| `11-dealer-room.png` | `/dealer/[code]` con mano activa y vista de jugadores |
| `12-history.png` | Acordeón "Historial · X eventos" abierto |
| `13-accounting.png` | Acordeón "Contabilidad" con tabla y gráfica de evolución |
| `14-closed-summary.png` | Vista de sala cerrada con ranking de balances |

## Recomendaciones

- **Resolución**: capturar en 1280×800 mínimo, escalar para web si supera 200 KB
- **Formato**: PNG (mejor para texto/UI) o WebP (más liviano)
- **Mobile vs desktop**: capturar la vista que mejor representa el feature; alternar según corresponda
- **Privacidad**: blur o tachar emails reales si aparecen, usar nicknames de invitado en el resto

## Cómo capturar

Si tienes la app corriendo localmente:

```bash
pnpm dev
# abre http://localhost:3000 y captura cada vista
```

Para los overlays animados (07, 08, 10), capturar en el momento más representativo de la animación.
