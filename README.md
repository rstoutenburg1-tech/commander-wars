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
9. Stable automatic target tracking, unit-class priorities, independent hero escorts and bounded boss combat.
10. Paid destructible gates, ranged tower garrisons and captured-base construction/production.
11. Middle mouse map panning.
12. Immediate regiment orders, destination formations, reinforcement selection and simple hero escort commands.

Each milestone is committed as a runnable state. This is a mechanics prototype, not a balanced release.

## Play the loop

1. **Tab selects the hero** and opens skills, XP, stats and paid training. **K selects the keep** for keep advancement. Persistent sidebar buttons open Items, Workshop, Gold mine, Quarry, Forest, Barracks and Merchant. The Command, Warfare and Endurance skill branches have prerequisites and ranks; normal slots unlock at levels 1, 5 and 12, with an ultimate at 20. Keep advancement supports levels 1–40.
2. **Select the barracks** to configure future troop waves and upgrade the barracks. Click a troop card to add that class to the wave; use − to reduce it. Wave interval and gold reserve are also in the barracks. Starting production is 2 footmen every 20 seconds. Every generated unit spends gold; army cap is 40 troops.
3. **Select individual buildings/sites** for their own upgrades. Develop forest and quarry and construct the workshop. Select the keep to advance your base, then select the barracks to upgrade it. Barracks II unlocks archers and musketeers; Barracks III unlocks knights. New composition affects future units only.
4. **Tab** selects the commander; **1–9** select regiments; **0** selects all troops. Hold **WASD** to move the crosshair on screen. **Arrow keys** pan the camera beneath it. Press **X** to attack the highlighted enemy or attack-move to that ground point; **Enter** gives a plain move order to the cursor. Moving or releasing WASD leaves unit orders unchanged. Use **Space** to focus the selection and center the cursor, **End** to center just the cursor, and **+/−** to zoom. Mouse selection and right-click orders still work.
5. **Ctrl+1–9** assigns selected troops to a regiment; **Shift+1–9** adds a regiment to the selection. All starting troops are in Regiment 1. Select the barracks to choose the regiment for future waves. Switch formations immediately with **F2: battle line**, **F3: shield wall**, or **F4: cavalry wedge**, or the direct buttons below regiment selection. Changes apply to every selected regiment and preserve their current orders; empty selected regiments retain the setting for future troops. Movement, engagement and priority settings remain under **Advanced regiment settings**. **Follow commander** lets you lead the army with your hero.
6. Learned normal abilities initially use **Q/E/R** in unlock order; the ultimate initially uses **V**. In the hero's **Ability hotkeys** options, assign learned abilities to **Q, E, R, Z, C, V or G**. Choosing an occupied key swaps the assignments. Bindings persist locally between matches. Movement, targeting and selection keys are reserved. Ability keys also work while troops are selected, casting from the living commander. Merchant tomes add War Cry / Stand Fast without consuming a normal skill slot. Further ranks spend skill points and obey level/prerequisite gates; the granted rank counts toward the ability cap.
7. Fight for XP and kill bounties. Levels gradually improve stats; base promotions provide a larger jump. Dead commanders respawn, lose two levels down to their tier minimum and retain equipment and learned skills. Re-earning lost levels does not grant duplicate points. Progress toward the next level resets on death; XP banked at the cap stays banked until promotion.
8. The workshop has seven recipes across two levels. **Items** shows the five equipped slots and inventory; replacement gear does not stack. The merchant opens when the hero enters its safe area and offers 11 equipment items, healing/mana draughts and two permanent skill tomes. Legendary gear costs 2,100–2,800 gold. Select **Melee** or **Ranged** on the hero panel; basic melee deals 135 versus 45 ranged damage before upgrades.
9. Select a regiment and press **F** to join the hero. **Shift+F** gathers all active regiments from any selection; **Tab then F** also gathers the army. Choose **Ring**, **Vanguard**, or **Rear guard**; each regiment has a separate formation position. Moving the hero leads its escorts. Giving a regiment its own move/attack/hold order detaches it. **Tab then H** stops the hero and its escorts without changing detached regiments. **March at army speed** keeps the hero with nearby escorts; turn it off to travel independently. Command training adds +5% nearby troop damage per rank. Automatic engagement retains moving targets and reacquires after kills. Choose target classes on the hero or regiment panel; an explicit X/right-click attack takes priority. Plain movement avoids combat while traveling and resumes engagement on arrival.
10. Select **Gate & tower**, or click your gate. Gates span each narrow approach, have **12,000 HP**, and block ground movement and fire while closed. Opening or closing costs **20 gold** and requires ownership. Your gate starts open; AI gates start closed and open for departures. Breach enemy gates by attacking them. A **900g / 150w / 120o**, 30-second tower adds **three garrison slots** for archers, musketeers or a hero. Bring them within 14 units and click **Station**. Tower occupants gain +6 ranged reach, +25% ranged damage and 35% protection; melee troops must breach the gate to reach them. Dismount with its button or a movement order. Breaching the gate destroys its tower and dismounts surviving occupants.
11. Destroying a keep eliminates its commander/army and transfers its territory to the attacker. Select its ruined keep or **Captured bases** to build a local barracks, gold mine, forest or quarry. Resource production adds to your shared treasury. Local barracks uses the home roster/unlocks/interval/reserve, has a separate regiment assignment, and respects the shared 40-troop cap. Captured gates can be rebuilt for 400g / 100w / 100o. Destroy all three enemy keeps to win; losing your own keep ends the run. **New match** restarts immediately.

## Controls

| Input | Action |
| --- | --- |
| Left-click / drag | Select / box-select |
| Shift + selection | Add to selection |
| Right-click | Move or attack the clicked enemy |
| Hold middle mouse button (scroll wheel) + drag | Grab and pan the map; release to stop |
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
| H | Stop selected troops where they stand; with hero selected, stop hero and escorts |
| F / Shift+F | Attach selected regiments to hero (hero selected: gather army) / gather entire army |
| T | Retreat selection |
| K / B | Select keep / barracks |
| Q / E / R / V (defaults) | Learned normal abilities / ultimate; rebind on hero panel |
| P | Pause / resume |
| Escape | Clear selection; when editing a field, leave the field |
| Click minimap | Pan to that location |

## Scope and deliberate shortcuts

Implemented: three AI opponents, four troop types, four keep tiers, building selection and contextual actions, barracks and extraction progression, paid production and reserves, nine regiments, keyboard cursor targeting, configurable ability keys, three troop formations, three hero escort layouts, cohesion, target tracking/class priorities, a ten-node skill system, hero training/respawn, five equipment slots with real bonuses, seven workshop recipes, 11 merchant equipment items and two skill tomes, bounded boss combat, destructible gates, tower garrisons, captured territory production, victory/defeat and developer controls.

The map follows the Footmen Wars pattern: four corner base areas, approaches into a large center, a separate merchant safe area and a dedicated boss arena. Width increased from 116 to 250 units (about 4.6× the area). The central battlefield is 100×100 units; the boss arena is 40 units across. Ravines are impassable, and simple waypoint routing sends armies through the center. This is a fixed-layout navigation system, not general RTS pathfinding. Formations use soft slots and break ranks to fight.

New orders replace movement immediately. Troops travel directly to formation slots at the new destination rather than regrouping at an old center first. Recruits inherit the regiment's current destination and attack target; number-key and all-army selections include newly spawned troops. Selecting or assigning a regiment preserves current unit orders. H freezes existing positions; explicit formation changes reform at the held location. Empty selected regiments retain orders for future recruits.

Movement is slower, troops have roughly 50% more HP, attacks have longer intervals and keeps have 6,500 starting HP. AI begins advancing after 2:30 and starts proactive base assaults after 6:00; it still defends threatened bases. Resource income and default production are slower. These are provisional pacing changes.

The boss stays within its marked arena and does not respawn; damage grants XP and the killing player gets the large reward. Merchant healing/mana draughts are consumed immediately. New equipment fills an empty slot automatically; use Items to swap or unequip it. Secondary buildings remain infrastructure sites; the keep and gate are the destructible objectives. Captured sites support one building of each available type and one construction job at a time. Local barracks shares the home roster instead of having a second roster editor. There is no multiplayer, saved campaign or final balance.

The 10–20 minute match target is **not validated yet**. Test the control, economy and formation decisions before treating the numbers as balance. The full source specification is preserved in [docs/original-specification.md](docs/original-specification.md).

## Validation and development

```sh
pnpm test
pnpm build
```

53 simulation/control tests cover production/reserves, construction, troop unlocks, hero progression/respawn, elimination, AI progress, formations, immediate replacement orders, destination arrival, partial selections, home/outpost reinforcement destinations, held positions, future escorts, abilities, merchant safety/prices/tomes, crafting tiers, equipment bonuses/swaps, hero melee/ranged damage, aura/marching, target retention/overrides/reacquisition, escort detachment, boss bounds/rewards, ravine routing, skill prerequisites, Tier IV, cursor controls, hotkeys, gate ownership/full-lane collision/fire blocking/breaches, tower costs/capacity/range/damage/protection/dismounting, captured ownership/local income and paid outpost waves with a shared cap.

Browser checks also exercised right-click movement, abilities, doctrine controls, both tier upgrades, all roster unlocks, crafting/trading, a combat victory and restart. The victory check used a boosted developer commander to make the check short; it does not establish match balance.

The revised browser check uses actual world clicks to select the barracks, keep and resource sites. It checks context-specific upgrades/production, initial skill choice, keep promotion, passive training, ability hotkeys, movement and the larger map. Accelerated simulation and granted resources shorten that check; they do not establish natural match pacing.

Keyboard browser checks use actual keys for selection, assignment, cursor movement, camera panning and orders. The cursor/formation check verifies that WASD moves the screen cursor without changing unit orders, Enter moves units to it, X targets and damages an enemy, arrow keys pan under it, and F2/F3/F4 and direct buttons change formations while preserving orders. It also checks multiple regiments and empty group presets. Earlier checks cover Regiment 9 production, ability assignment/swapping, casting and persisted bindings after reload. AI and automatic production are disabled for most of these focused checks.

Movement browser checks exercise a recruit spawning after number-key selection, immediate Enter orders, Ctrl assignment without order changes, F attachment, Shift+F/Tab F gathering, Tab H stopping only the hero/escorts, sidebar gather/stop buttons, empty regiment orders and all-army orders. Simulation checks verify first-tick movement direction and arrival in formation.

Expansion browser checks exercise Tab progression, K keep-only controls, sidebar destinations, crafting/equip/unequip, paid training, merchant arrival/purchases/tomes/hotkeys, hero escort settings, regiment detachment, paid gate toggles, world gate selection, tower construction/garrison/keyboard dismount, combat gate breach and keep capture, all four local buildings, Regiment 9 outpost spawning and captured gate rebuilding. Combat capture uses a temporary damage boost and accelerated simulation; these checks validate functionality, not natural balance or match duration.

Balance lives in `src/game/config.ts`. Simulation systems are separate from rendering and UI. Add `?debug=1` to the URL to expose `window.commanderWars`. The **Match info & developer controls** section includes grants, promotion, roster spawning, AI/invulnerability toggles and simulation speed.

## Static hosting

`pnpm build` produces `dist/`, which can be served on any static host. For Vercel, use the Vite preset, build command `pnpm build`, and output directory `dist`. No environment variables or external services are required.
