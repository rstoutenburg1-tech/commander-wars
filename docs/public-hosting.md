# Public hosting

Live game: [commander-wars-online.onrender.com](https://commander-wars-online.onrender.com).

Published October 5, 2026 on the approved address and Free instance type. The website and authoritative match server are hosted together; the home PC and Cloudflare tunnel are not involved.

Service dashboard: [commander-wars-online](https://dashboard.render.com/web/srv-db1tbpbncjis73c9b680). Initial deployed game commit: `1063ef5`.

## Deployment

Use one Render Node web service for both the browser build and the authoritative multiplayer server. The root `render.yaml` selects a single **Free** instance in Oregon, using the locally verified Node version and locked dependency versions. Do not upgrade to a paid instance or purchase a domain without further approval. Free hosting sleeps after 15 minutes without inbound traffic and can take about a minute to wake up. Keep this deployment within the free workspace's bandwidth and build allowances; do not enable paid overages.

The service uses the public repository URL `https://github.com/rstoutenburg1-tech/commander-wars`, branch `main`, without granting additional GitHub integration permissions. Changing repository visibility would require updating its Render source connection. Render supplies HTTPS and forwards `/ws` to the same Node process. The server binds to Render's `PORT` on all interfaces, so no client server-address entry or separate frontend host is needed. Do not create multiple instances: lobby codes and match state currently exist in one process's memory.

Auto-deploys are disabled because restarting or deploying the server ends active lobbies and matches. Deploy a tested commit manually between play sessions. No database, purchased domain, tunnel or running home PC is required.

To update: push the tested game commit to `main`, then use **Manual Deploy → Deploy latest commit** in the service dashboard between play sessions. The cloud build installs locked dependencies, runs the tests and builds the client before starting the server. Changes to `render.yaml` alone do not change this manually created service; keep its dashboard settings in sync when changing deployment commands or runtime settings.

## Players and source access

Players open the approved URL, host a lobby and share its lobby code or invite link. Every friend must open this same public website; a local or old tunnel link points to a different server. Friends need no GitHub account, repository access, download or installation.

The game website serves only `dist/`, its health endpoint and the WebSocket connection. It does not serve server source or repository files. The existing GitHub repository is public, so its source remains accessible there unless its visibility is separately changed. Browser JavaScript and visual assets must be delivered to players and are inspectable, as with any browser game. The Vite production build does not emit source maps.

## Verification after publication

Passed on the public HTTPS service: all 140 tests and the production build in Render; public `/health`; homepage rendering; two independent browser sessions joining one lobby with two humans plus Hard/Easy AI in 2v2; guest seat controls; synchronized upgrades, skills, hotkey casts and movement; dropped-connection and full-page-reload resume; responsive setup; no browser exceptions. The website returns 404 for `/src/game/world.ts`, `/server/index.ts`, `/.git/config` and the client source-map path. These browser sessions reached the real remote server from this PC; a human friend joining from a different network remains a useful final playtest.

1. Confirm public `/health` responds and the homepage loads over HTTPS.
2. Open the public URL in two independent browser sessions. Create a lobby, join by code, ready both human seats and start a mixed human/AI match.
3. Verify each player controls their own section, orders synchronize, and reconnect restores a dropped seat.
4. Confirm `/src/game/world.ts`, `/server/index.ts`, `/.git/config` and source maps are not served.
5. Confirm the public service works without the home tunnel or local server being involved; have a friend join from another network for the real internet check.

The single instance supports the current prototype design, not unlimited concurrent matches. Monitor CPU, memory and outbound bandwidth before expanding playtesting.

References: [Render web services](https://render.com/docs/web-services), [Free instance limitations](https://render.com/docs/free), [Starter compute comparison](https://render.com/articles/render-vs-railway), [Blueprint configuration](https://render.com/docs/blueprint-spec).
