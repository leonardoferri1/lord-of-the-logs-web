# Lord of the Logs — browser client

Original isometric multiplayer client built with **React, Phaser 3, TypeScript, Vite, Tailwind, Zustand and TanStack Query**. Explore the Vale do Carvalho, gather resources and build a persistent settlement together.

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

- Click the ground to move; click a resource to approach it and press **E** to gather.
- **B** opens construction, **F** centers the camera, **Esc** cancels selection/placement.
- Arrow keys or right-drag pan; mouse wheel zooms.
- Two new tabs can create independent characters. Refresh restores the active tab session. The entry screen can explicitly resume the browser's last character.

The browser only submits intentions. Inventory, movement, harvesting time, costs and placement are validated on the server. Disconnection disables gameplay instead of pretending that local changes are persistent.

Sprites are original procedural drawings baked into Phaser textures. No external game assets are used. The world renders outside React; Zustand carries HUD state and snapshots. A* and placement helpers assist previews but never authorize an economic mutation.

Desktop is the primary target. Panels adapt on smaller screens, but full touch-camera interaction and canvas screen-reader navigation remain future work. The Phaser engine is a separate approximately 340 KB gzip vendor chunk. No client-only offline economy is implemented.
