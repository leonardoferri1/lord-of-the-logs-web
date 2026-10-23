# Lord of the Logs — browser client

Original isometric pixel-art multiplayer client built with **React, Phaser 3, TypeScript, Vite, Tailwind, Zustand and TanStack Query**. Gather, build, farm, forge, fight goblins and complete quests in a persistent shared world.

![The shared world](https://raw.githubusercontent.com/leonardoferri1/lord-of-the-logs/main/docs/screenshots/world.png)

## Independent repositories

| Repository                                                                  | Responsibility                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Server and deployment](https://github.com/leonardoferri1/lord-of-the-logs) | NestJS authority, Socket.IO, PostgreSQL, Redis, integration tests and full-stack Compose |
| **This client**                                                             | Rendering, input, interpolation, UI and transport                                        |
| [Shared domain](https://github.com/leonardoferri1/lord-of-the-logs-shared)  | Deterministic rules and typed contracts, pinned to a commit                              |

## Run

Start the backend using its README, then in this checkout:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. Vite proxies `/api` and `/socket.io` to port 3001. For the complete container deployment at port 8080, use the server repository's Compose file; it fetches this client at a pinned commit.

By default the production frontend uses same-origin REST/WebSocket endpoints through Nginx. A separately hosted API can be selected with `VITE_API_URL` at build time and the matching server `CLIENT_ORIGIN`. Do not put secrets in Vite environment variables.

## Validate

```sh
pnpm lint
pnpm check
pnpm build
```

Game-rule unit tests belong to the shared repository; authoritative gameplay integration tests belong to the server. This repository's CI checks its own types, lint and production bundle. Browser QA and screenshots are documented in the server's validation record.

## Controls and boundaries

- Click a tree, rock, iron vein or berry bush: the character walks beside it and keeps gathering until it is depleted or energy runs low.
- Click a goblin to attack; click the blacksmith or merchant to walk over and open their dialog; click your own building to collect, plant, harvest or rest.
- **B** construction, **I** inventory, **M** world map, **J** missions, **H** guide, **O** settings, **1–8** hotbar (6 eats), **E** gather/use the selection, **F** centers the camera, **Enter** chats, **N** mutes, **Esc** cancels.
- Arrow keys or right-drag pan; mouse wheel zooms. The camera follows the character until you pan.
- Two new tabs can create independent characters. Refresh restores the active tab session. The entry screen can explicitly resume the browser's last character.

The browser only submits intentions. Inventory, movement, gathering time, damage, loot, quest progress, costs and placement are validated on the server. Disconnection disables gameplay instead of pretending that local changes are persistent.

All art is original pixel art painted in code (`src/game/pixel.ts`, `sprites.ts`, `props.ts`, `ground.ts`): palette-indexed character and icon sprites with automatic outlines, dithered sphere shading for foliage and rocks, isometric buildings with plank walls and shingle roofs, and one baked terrain canvas with organic borders, cliffs, shore foam and bridges. Textures are nearest-filtered at 2×. The HUD icons are rendered from the same sprites. Sound is synthesized the same way (`src/game/audio.ts`): Web Audio oscillators, filtered noise and envelopes produce positional effects, ambience that follows the shared day/night clock and the player's surroundings (birds, wind, crickets, owls, running water, crackling fire), and a generative pentatonic soundtrack with a day and a night mode. Volume, effects, music and ambience have their own sliders in Ajustes; **N** mutes. Audio starts after the first click or key press, as browsers require. The only external asset is the Pixelify Sans font (OFL), bundled through `@fontsource`. The world renders outside React; Zustand carries HUD state and snapshots. A* and placement helpers assist previews but never authorize an economic mutation.

Desktop is the primary target. Panels adapt on smaller screens, but full touch-camera interaction and canvas screen-reader navigation remain future work. The Phaser engine is a separate approximately 340 KB gzip vendor chunk. No client-only offline economy is implemented.
