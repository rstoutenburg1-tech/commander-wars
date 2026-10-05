# Public hosting proposal

Proposed URL: `https://commander-wars-online.onrender.com`.

This address is pending user approval and Render's availability confirmation. An HTTP 404 check is not a reservation or proof of availability. If Render assigns a different hostname, obtain approval of that exact URL before sharing or completing publication. No hosting service has been created by adding these files.

## Deployment

Use one Render Node web service for both the browser build and the authoritative multiplayer server. The root `render.yaml` prepares a single Starter instance in Oregon, using the locally verified Node version and locked dependency versions. Starter compute currently costs $7/month; taxes and usage beyond the workspace's included bandwidth/build allowances can add costs. A Free instance is an alternative for testing, but sleeps after 15 minutes without inbound traffic and can take about a minute to wake up.

After approval, connect Render to `rstoutenburg1-tech/commander-wars` with access to that repository only. The repository is currently public; changing its visibility is a separate decision, and Render can also deploy it if it is made private. Review the service name, exact assigned public hostname and price before completing deployment. Render supplies HTTPS and forwards `/ws` to the same Node process. The server already binds to Render's `PORT` on all interfaces, so no client server-address entry or separate frontend host is needed. Do not create multiple instances: lobby codes and match state currently exist in one process's memory.

Auto-deploys are disabled because restarting or deploying the server ends active lobbies and matches. Deploy a tested commit manually between play sessions. No database, purchased domain, tunnel or running home PC is required.

## Players and source access

Players open the approved URL, host a lobby and share its lobby code or invite link. Every friend must open this same public website; a local or old tunnel link points to a different server. Friends need no GitHub account, repository access, download or installation.

The game website serves only `dist/`, its health endpoint and the WebSocket connection. It does not serve server source or repository files. The existing GitHub repository is public, so its source remains accessible there unless its visibility is separately changed. Browser JavaScript and visual assets must be delivered to players and are inspectable, as with any browser game. The Vite production build does not emit source maps.

## Verification after publication

1. Confirm public `/health` responds and the homepage loads over HTTPS.
2. Open the public URL in two independent browser sessions. Create a lobby, join by code, ready both human seats and start a mixed human/AI match.
3. Verify each player controls their own section, orders synchronize, and reconnect restores a dropped seat.
4. Confirm `/src/game/world.ts`, `/server/index.ts`, `/.git/config` and source maps are not served.
5. Confirm the public service works without the home tunnel or local server being involved; have a friend join from another network for the real internet check.

The single instance supports the current prototype design, not unlimited concurrent matches. Monitor CPU, memory and outbound bandwidth before expanding playtesting.

References: [Render web services](https://render.com/docs/web-services), [Free instance limitations](https://render.com/docs/free), [Starter compute comparison](https://render.com/articles/render-vs-railway), [Blueprint configuration](https://render.com/docs/blueprint-spec).
