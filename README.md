# Commander Wars

A small single-player, four-corner fantasy RTS prototype. TypeScript, Three.js, Vite; geometric placeholder assets and no backend. Destroy the three AI keeps to win.

## Run

Requires Node.js 20.19+ or 22.12+ and pnpm.

**On this Windows PC:** double-click `Play.cmd`. It can use the Codex bundled runtime. Keep its terminal open while playing. If a server is already running, open <http://127.0.0.1:5173> directly.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. `pnpm build` creates a static site in `dist`; `pnpm preview` serves that build.

## Milestones

1. Angled battlefield, selection, movement, commander and basic combat.
2. Paid automatic production, resources, upgrades, army roster and AI match loop.
3. Regiments, formations, doctrine, abilities, central objectives and gameplay verification.

Each milestone is committed as a runnable state. This is a mechanics prototype, not a balanced release.

## Play the loop

1. Select the commander, right-click to move, and use **Q** for Rally or **E** for Second Wind. **Tab** selects the whole army; **X**, then left-click, issues attack-move.
2. In **Army**, choose a regiment, formation, movement, engagement and target priority. **Follow commander** lets you lead an army with the hero. Independent troop selections receive individual orders.
3. In **Supply**, slow or pause spawning to save gold. Every new unit is paid for; the reserve prevents spending below your chosen amount. There is a 40-troop cap per player.
4. In **Base**, develop forest and quarry and build the workshop. Upgrade the keep, then the barracks. Tier II unlocks archers and musketeers; Tier III unlocks knights. New composition affects future spawns only.
5. Fight for XP and kill bounties. Levels gradually improve your army; base promotions provide a larger jump. Dead commanders respawn, lose two levels down to their tier minimum, and retain equipment. Progress toward the next level resets on death; XP banked at the tier cap stays banked until promotion.
6. In **Center**, craft a sword or armor, attack the boss with selected units, or send the commander into the merchant's safe circle to heal or sell equipment.
7. Destroy enemy keeps. Losing your own keep ends your run. **New match** restarts immediately.

## Controls

| Input | Action |
| --- | --- |
| Left-click / drag | Select / box-select |
| Shift + selection | Add to selection |
| Right-click | Move or attack the clicked enemy |
| WASD / wheel | Pan / zoom |
| F1 / Space / Home | Select hero / focus hero / map overview |
| Tab | Select hero and army |
| 1–4 / Ctrl+1–4 | Select regiment / assign selected troops |
| X, then left-click | Attack-move; X avoids conflicting with WASD |
| H / F / T | Hold / follow commander / retreat |
| Q / E | Rally / Second Wind |
| Escape | Cancel attack-move and clear selection |
| Click minimap | Pan to that location |

## Scope and deliberate shortcuts

Implemented: three AI opponents, four troop types, three base tiers, barracks and extraction progression, paid automatic production and reserves, four regiments, three formations, cohesion, behavior/target priority, two mana abilities, hero progression/respawn, a boss with AOE warning, two crafted items, safe-zone merchant trading, victory/defeat and developer controls.

This is an open battlefield with simple local collision separation, not full RTS pathfinding. Formations are soft slots: troops break ranks to fight. The boss does not respawn; damage grants XP and the killing player gets the large reward. Merchant healing is consumed immediately. Crafted equipment is automatically equipped and limited to one sword and one armor. Eliminated territory remains inert. There is no Tier IV, skill tree, multiplayer, persistence, captured territory system or final balance.

The 10–20 minute match target is **not validated yet**. Test the control, economy and formation decisions before treating the numbers as balance. The full source specification is preserved in [docs/original-specification.md](docs/original-specification.md).

## Validation and development

```sh
pnpm test
pnpm build
```

Simulation tests cover paid spawning/reserves, construction timing, troop unlocks, XP banking, death and respawn, elimination, AI progress, frontal formation protection, independent orders, target priority, abilities, merchant safety, crafting and boss damage/rewards.

Browser checks also exercised right-click movement, abilities, doctrine controls, both tier upgrades, all roster unlocks, crafting/trading, a combat victory and restart. The victory check used a boosted developer commander to make the check short; it does not establish match balance.

Balance lives in `src/game/config.ts`. Simulation systems are separate from Three.js rendering and HTML UI. Add `?debug=1` to the URL to expose `window.commanderWars` for inspection. The **Intel** panel includes resource/XP grants, instant promotion, roster spawning, AI and invulnerability toggles, and simulation speed.

## Static hosting

`pnpm build` produces `dist/`, which can be served on any static host. For Vercel, use the Vite preset, build command `pnpm build`, and output directory `dist`. No environment variables or external services are required.
