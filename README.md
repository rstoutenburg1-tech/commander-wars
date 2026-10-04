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
4. Larger Footmen Wars layout, separated approaches, routing through the arena and slower pacing.
5. Building-selected production/upgrades, keep hero progression, skill branches and Tier IV.
6. Keyboard steering, nine regiments, camera cursor targeting and configurable ability hotkeys.
7. WASD screen cursor and direct formation buttons/shortcuts.
8. Hero-selected progression/training, equipment slots, expanded workshop recipes and merchant relics/tomes.

Each milestone is committed as a runnable state. This is a mechanics prototype, not a balanced release.

## Play the loop

1. **Tab selects the hero** and opens skills, XP, stats and paid training. **K selects the keep** for keep advancement. Persistent sidebar buttons open Items, Workshop, Gold mine, Quarry, Forest, Barracks and Merchant. The Command, Warfare and Endurance skill branches have prerequisites and ranks; normal slots unlock at levels 1, 5 and 12, with an ultimate at 20. Keep advancement supports levels 1–40.
2. **Select the barracks** to configure future troop waves and upgrade the barracks. Click a troop card to add that class to the wave; use − to reduce it. Wave interval and gold reserve are also in the barracks. Starting production is 2 footmen every 20 seconds. Every generated unit spends gold; army cap is 40 troops.
3. **Select individual buildings/sites** for their own upgrades. Develop forest and quarry and construct the workshop. Select the keep's **Keep upgrade** tab to advance your base, then select the barracks to upgrade it. Barracks II unlocks archers and musketeers; Barracks III unlocks knights. New composition affects future units only.
4. **Tab** selects the commander; **1–9** select regiments; **0** selects all troops. Hold **WASD** to move the crosshair on screen. **Arrow keys** pan the camera beneath it. Press **X** to attack the highlighted enemy or attack-move to that ground point; **Enter** gives a plain move order to the cursor. Moving or releasing WASD leaves unit orders unchanged. Use **Space** to focus the selection and center the cursor, **End** to center just the cursor, and **+/−** to zoom. Mouse selection and right-click orders still work.
5. **Ctrl+1–9** assigns selected troops to a regiment; **Shift+1–9** adds a regiment to the selection. All starting troops are in Regiment 1. Select the barracks to choose the regiment for future waves. Switch formations immediately with **F2: battle line**, **F3: shield wall**, or **F4: cavalry wedge**, or the direct buttons below regiment selection. Changes apply to every selected regiment and preserve their current orders; empty selected regiments retain the setting for future troops. Movement, engagement and priority settings remain under **Advanced regiment settings**. **Follow commander** lets you lead the army with your hero.
6. Learned normal abilities initially use **Q/E/R** in unlock order; the ultimate initially uses **V**. In the keep's **Ability hotkeys** options, assign learned abilities to **Q, E, R, Z, C, V or G**. Choosing an occupied key swaps the assignments. Bindings persist locally between matches. Movement, targeting and selection keys are reserved. Ability keys also work while troops are selected, casting from the living commander.
7. Fight for XP and kill bounties. Levels gradually improve stats; base promotions provide a larger jump. Dead commanders respawn, lose two levels down to their tier minimum and retain equipment and learned skills. Re-earning lost levels does not grant duplicate points. Progress toward the next level resets on death; XP banked at the cap stays banked until promotion.
8. The workshop has seven recipes across two levels. **Items** shows the five equipped slots and inventory; replacement gear does not stack. The merchant opens when the hero enters its safe area and offers 11 equipment items, healing/mana draughts and two permanent skill tomes. Legendary gear costs 2,100–2,800 gold. Select **Melee** or **Ranged** on the hero panel; basic melee deals 135 versus 45 ranged damage before upgrades.
9. Destroy enemy keeps. Losing your own keep ends your run. **New match** restarts immediately.

## Controls

| Input | Action |
| --- | --- |
| Left-click / drag | Select / box-select |
| Shift + selection | Add to selection |
| Right-click | Move or attack the clicked enemy |
| WASD (hold) | Move targeting cursor within the battlefield view |
| Arrow keys (hold) | Pan camera beneath the cursor |
| Tab / F1 | Select hero |
| 1–9 / Ctrl+1–9 | Select regiment / assign selected troops |
| Shift+1–9 / 0 | Add regiment to selection / select all troops |
| X | Attack highlighted enemy at cursor; otherwise attack-move to cursor |
| Enter | Move selection to cursor |
| Space / Home | Focus selection / map overview |
| End | Recenter targeting cursor |
| F2 / F3 / F4 | Set selected regiments to battle line / shield wall / cavalry wedge |
| + or = / − or wheel | Zoom in / zoom out |
| H / F / T | Hold / follow commander / retreat |
| K / B | Select keep / barracks |
| Q / E / R / V (defaults) | Learned normal abilities / ultimate; rebind in keep |
| P | Pause / resume |
| Escape | Clear selection; when editing a field, leave the field |
| Click minimap | Pan to that location |

## Scope and deliberate shortcuts

Implemented: three AI opponents, four troop types, four keep tiers, building selection and contextual actions, barracks and extraction progression, paid production and reserves, nine regiments, keyboard cursor movement and targeting, configurable ability hotkeys, three formations with direct buttons/shortcuts, cohesion, doctrine, a ten-node skill system with five normal abilities and an ultimate, hero progression/respawn, a boss with AOE warning, crafting, merchant trading, victory/defeat and developer controls.

The map follows the Footmen Wars pattern: four corner base areas, approaches into a large center, a separate merchant safe area and a dedicated boss arena. Width increased from 116 to 250 units (about 4.6× the area). The central battlefield is 100×100 units; the boss arena is 40 units across. Ravines are impassable, and simple waypoint routing sends armies through the center. This is a fixed-layout navigation system, not general RTS pathfinding. Formations use soft slots and break ranks to fight.

Movement is slower, troops have roughly 50% more HP, attacks have longer intervals and keeps have 6,500 starting HP. AI begins advancing after 2:30 and starts proactive base assaults after 6:00; it still defends threatened bases. Resource income and default production are slower. These are provisional pacing changes.

The boss does not respawn; damage grants XP and the killing player gets the large reward. Merchant healing is consumed immediately. Equipment is automatically equipped. Secondary buildings are selectable infrastructure sites; the keep remains the destructible elimination objective. Eliminated territory stays inert. There is no multiplayer, persistence, captured territory or final balance.

The 10–20 minute match target is **not validated yet**. Test the control, economy and formation decisions before treating the numbers as balance. The full source specification is preserved in [docs/original-specification.md](docs/original-specification.md).

## Validation and development

```sh
pnpm test
pnpm build
```

28 simulation/control tests cover paid spawning/reserves, construction, troop unlocks, XP banking, death/respawn, elimination, AI progress, formations, doctrine, abilities, merchant safety, crafting, boss rewards, ravine routing, slower opening, skill choices/prerequisites/passives, point retention, building selection, Tier IV/level 40, area/ultimate effects, normalized cursor movement/bounds/resizing, formation changes that retain orders, multi-regiment changes, empty regiment presets and hotkey collisions.

Browser checks also exercised right-click movement, abilities, doctrine controls, both tier upgrades, all roster unlocks, crafting/trading, a combat victory and restart. The victory check used a boosted developer commander to make the check short; it does not establish match balance.

The revised browser check uses actual world clicks to select the barracks, keep and resource sites. It checks context-specific upgrades/production, initial skill choice, keep promotion, passive training, ability hotkeys, movement and the larger map. Accelerated simulation and granted resources shorten that check; they do not establish natural match pacing.

Keyboard browser checks use actual keys for selection, assignment, cursor movement, camera panning and orders. The cursor/formation check verifies that WASD moves the screen cursor without changing unit orders, Enter moves units to it, X targets and damages an enemy, arrow keys pan under it, and F2/F3/F4 and direct buttons change formations while preserving orders. It also checks multiple regiments and empty group presets. Earlier checks cover Regiment 9 production, ability assignment/swapping, casting and persisted bindings after reload. AI and automatic production are disabled for most of these focused checks.

Balance lives in `src/game/config.ts`. Simulation systems are separate from rendering and UI. Add `?debug=1` to the URL to expose `window.commanderWars`. The **Match info & developer controls** section includes grants, promotion, roster spawning, AI/invulnerability toggles and simulation speed.

## Static hosting

`pnpm build` produces `dist/`, which can be served on any static host. For Vercel, use the Vite preset, build command `pnpm build`, and output directory `dist`. No environment variables or external services are required.
