# Commander Wars

A small four-corner fantasy RTS prototype with solo practice and online matches for up to four commanders. TypeScript, Three.js, Vite and a small authoritative Node/WebSocket server; original procedural cartoon art. Defeat the opposing keeps with your team.

## Run

Requires Node.js 20.19+ or 22.12+ and pnpm.

**On this Windows PC:** double-click `Play.cmd` for local play, or `Play Online.cmd` to host friends across the internet. Both can use the Codex bundled runtime. Keep the hosting window open while playing. A running production server is at <http://127.0.0.1:8787>.

```sh
pnpm install
pnpm build
pnpm start
```

Open <http://localhost:8787>. `pnpm build` checks both client and server and creates the browser build in `dist`; `pnpm start` serves that build and the lobby server together. For development, run `pnpm server:dev` and `pnpm dev` in separate terminals; Vite proxies `/ws` to port 8787. `pnpm preview` serves a static preview without a multiplayer server.

## Online matches

1. Run `Play Online.cmd` and share the printed `https://...trycloudflare.com` game URL with your friends. The launcher downloads Cloudflare's helper on first use and exposes the production game server through a temporary HTTPS link. Keep the PC awake and the launcher running. The URL changes on restart; it is a playtest link, not permanent hosting. [Cloudflare Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
2. Open that URL, enter your name and choose **Host a lobby**. Share its six-character lobby code or **Copy invite link**. Friends open the same website and choose **Join lobby**.
3. The host sets each unoccupied section to **Human**, **AI** or **Closed**, assigns teams and picks **Easy**, **Normal** or **Hard** for each AI. **2 vs 2** pairs Blue/Red against Green/Purple; the host can change any team, and guests can choose their own team. You can play two friends against two AI, four friends in 2v2, free for all, or smaller matches with closed sections.
4. Every human must join and click **Ready**. The host starts the match. Setup changes reset guest readiness. Closed sections have no keep or army. **Tab**, **1–9**, the sidebar and other existing controls operate your own section.

Allies cannot damage or target each other, can benefit from nearby support abilities, and win together. An eliminated player can watch while their teammate continues. AI difficulty changes decision speed, opening timing and tactics; it does not grant resource or combat bonuses. Multiplayer runs continuously and has no pause, speed controls or developer grants.

Lost connections automatically reconnect to the same seat and match. After 60 seconds disconnected, AI temporarily takes over; reconnecting restores human control. **Leave match** hands the section to AI immediately. Rooms are kept in memory and expire after everyone has been offline for five minutes. Restarting the server ends its lobbies and matches.

For a permanent internet address, run `pnpm install --frozen-lockfile`, `pnpm build` and `pnpm start` on a Node service that supports persistent WebSockets. `PORT` and `HOST` configure the listener; the default is port 8787 on all interfaces. Serve HTTPS and proxy `/ws` to the same process. No database or account system is required for this prototype.

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
13. Centered, bounded boss arena and typed combat/spell animation events.
14. Colorful village terrain, distinct troop/building models, animated combat and ability effects, and a fantasy game HUD.
15. Centered, footprint-aware vanguard/rear guard formations with stable marching direction.
16. Recurring material costs, earlier army choices, earned hero progression, unit counters, workshop supplies and resource-aware AI.
17. Configurable human/AI/closed sections, alliances, shared team victory and fair AI difficulty.
18. Lobby codes, online authoritative matches, per-player keyboard/sidebar controls, reconnects and an internet play launcher.
19. Separate ranged rear ranks and immediate firing-range stops for combat orders.

Each milestone is committed as a runnable state. This is a mechanics prototype, not a balanced release.

## Play the loop

1. **Tab selects the hero** and opens skills, XP, stats and paid training. **K selects the keep** for keep advancement. Persistent sidebar buttons open Items, Workshop, Gold mine, Quarry, Forest, Barracks and Merchant. The Command, Warfare and Endurance skill branches have prerequisites and ranks; normal slots unlock at levels 1, 5 and 12, with an ultimate at 20. Keep advancement supports levels 1–40.
2. **Select the barracks** to configure future troop waves and upgrade the barracks. Click a troop card to add that class to the wave; use − to reduce it. Wave interval and gold reserve are also in the barracks. Starting production is 2 footmen every 20 seconds. Footmen cost 16g, archers 22g/10w, musketeers 36g/12o, and knights 55g/8w/16o. The sidebar shows planned gold/wood/ore spending against income across all bases and names resource shortages. Unaffordable recruits are skipped without partial payment; army cap is 40 troops.
3. **Select individual buildings/sites** for their own upgrades. Archers are available immediately. Barracks II can be built at Keep I and unlocks musketeers; Barracks III requires Keep II and unlocks knights. This lets you invest in an army before advancing the keep. Develop forest/quarry to sustain your chosen roster or invest in workshop gear. New composition affects future units only.
4. **Tab** selects the commander; **1–9** select regiments; **0** selects all troops. Hold **WASD** to move the crosshair on screen. **Arrow keys** pan the camera beneath it. Press **X** to attack the highlighted enemy or attack-move to that ground point; **Enter** gives a plain move order to the cursor. Moving or releasing WASD leaves unit orders unchanged. Use **Space** to focus the selection and center the cursor, **End** to center just the cursor, and **+/−** to zoom. Mouse selection and right-click orders still work.
5. **Ctrl+1–9** assigns selected troops to a regiment; **Shift+1–9** adds a regiment to the selection. All starting troops are in Regiment 1. Select the barracks to choose the regiment for future waves. Switch formations immediately with **F2: battle line**, **F3: shield wall**, or **F4: cavalry wedge**, or the direct buttons below regiment selection. Changes apply to every selected regiment and preserve their current orders; empty selected regiments retain the setting for future troops. Mixed regiments place footmen/knights in front and archers/musketeers in separate rear ranks, including small groups, reinforcements and hero escorts. Ranged units stop at weapon reach on attack/attack-move orders, stay there during cooldowns, and chase again when the target leaves range. Plain Enter/right-click ground moves reach the destination. Movement, engagement and priority settings remain under **Advanced regiment settings**. **Follow commander** lets you lead the army with your hero.
6. Learned normal abilities initially use **Q/E/R** in unlock order; the ultimate initially uses **V**. In the hero's **Ability hotkeys** options, assign learned abilities to **Q, E, R, Z, C, V or G**. Choosing an occupied key swaps the assignments. Bindings persist locally between matches. Movement, targeting and selection keys are reserved. Ability keys also work while troops are selected, casting from the living commander. Merchant tomes add War Cry / Stand Fast without consuming a normal skill slot. Further ranks spend skill points and obey level/prerequisite gates; the granted rank counts toward the ability cap.
7. Fight for XP and kill bounties. Keep tiers open level caps 10/20/30/40, without granting levels or points. Each earned hero level adds 2.5% of base HP/damage; the next level costs 30 × current level XP. Troops gain 8% of base HP/damage per keep tier, with further army bonuses coming from learned skills and command training. Keeps gain 25% of base HP/damage per tier. Dead commanders respawn, lose two earned levels down to level 1 and retain equipment and learned skills. Re-earning lost levels does not grant duplicate points. Progress toward the next level resets on death; XP banked at the cap is released when the keep advances.
8. The workshop has seven recipes across two levels and repeatable army supplies. **Field resupply** costs 60g/50w/35o: withdraw the hero at least 22 units from enemies, then heal him and troops within 18 units by 20% and restore 20 cohesion, with a 45-second cooldown. Workshop II **Siege ammunition** costs 100g/60w/60o and raises archer/musketeer structure damage to 150% for 35 seconds, with a 75-second cooldown. **Items** shows five equipped slots and inventory; replacement gear does not stack. The merchant opens when the hero enters its safe area and offers 11 equipment items, healing/mana draughts and two permanent skill tomes. Legendary gear costs 2,100–2,800 gold. Select **Melee** or **Ranged** on the hero panel; basic melee deals 135 versus 45 ranged damage before upgrades.
9. Select a regiment and press **F** to join the hero. **Shift+F** gathers all active regiments from any selection; **Tab then F** also gathers the army. Choose **Ring**, **Vanguard**, or **Rear guard**. Front/rear layouts center each row, account for the complete regiment footprint and keep every destination slot on the intended side of the hero where terrain permits. Marching direction follows commands and travel instead of weapon swings. Moving the hero leads its escorts; regiments break ranks to fight. Giving a regiment its own move/attack/hold order detaches it. **Tab then H** stops the hero and its escorts without changing detached regiments. **March at army speed** keeps the hero with nearby escorts; turn it off to travel independently. Command training adds +5% nearby troop damage per rank. Automatic engagement retains moving targets and reacquires after kills. Choose target classes on the hero or regiment panel; an explicit X/right-click attack takes priority. Plain movement avoids combat while traveling and resumes engagement on arrival.
10. Select **Gate & tower**, or click your gate. Gates span each narrow approach, have **12,000 HP**, and block ground movement and fire while closed. Opening or closing costs **20 gold** and requires ownership. Your gate starts open; AI gates start closed and open for departures. Breach enemy gates by attacking them. A **900g / 150w / 120o**, 30-second tower adds **three garrison slots** for archers, musketeers or a hero. Bring them within 14 units and click **Station**. Tower occupants gain +6 ranged reach, +25% ranged damage and 35% protection; melee troops must breach the gate to reach them. Dismount with its button or a movement order. Breaching the gate destroys its tower and dismounts surviving occupants.
11. Destroying a keep eliminates its commander/army and transfers its territory to the attacker. Select its ruined keep or **Captured bases** to build a local barracks, gold mine, forest or quarry. Resource production adds to your treasury. Local barracks uses the home roster/unlocks/interval/reserve, has a separate regiment assignment, and respects the shared 40-troop cap. Captured gates can be rebuilt for 400g / 100w / 100o. Defeat every opposing team to win; your team keeps fighting while any allied keep survives. **Leave match** returns to game setup.

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

## Army and economy decisions

| Unit | Role and tradeoff |
| --- | --- |
| Footman | Gold-only infantry; +40% damage to knights. A frontal shield wall with at least 50 cohesion cancels cavalry charge bonuses. Slow and vulnerable to archers. |
| Archer | Wood-funded ranged support; +30% damage to footmen, 25% less to knights, 55% normal structure damage. Protect with infantry. |
| Musketeer | Ore-funded long-range damage; +35% against knights, +15% against heroes, 15% less against footmen, 80% normal structure damage. Vulnerable to cavalry. |
| Knight | Wood/ore-funded mobile flanker; +35% against ranged troops. Charge bonuses work against flanks and broken walls. |

These modifiers apply to ordinary attacks. Spells keep their own damage rules. Formation protection, tower bonuses and hero buffs still apply separately. Buying siege ammunition removes ranged structure penalties for a short assault window.

One of each troop every 20 seconds spends 387g/54w/84o per minute. Forest I produces 72w/min; Quarry I produces 54o/min and Quarry II produces 90o/min. A mixed force therefore needs ore investment or slower waves. Two of each troop spend 108w/168o per minute, exceeding Quarry III's 150o/min. Captured extraction can support heavier armies, while captured barracks also increase resource spending. The budget shows planned spending while recruiting; production stops paying when the army cap is reached.

AI opponents use distinct infantry, musketeer and cavalry openings, react to nearby troop composition, separate infantry/ranged/cavalry regiments, save materials for construction, improve extraction and use workshop supplies. They receive no extra resource grants or free hero levels.

## Scope and deliberate shortcuts

Implemented: three AI opponents, four troop types, four keep tiers, building selection and contextual actions, barracks and extraction progression, paid production and reserves, nine regiments, keyboard cursor targeting, configurable ability keys, three troop formations, three hero escort layouts, cohesion, target tracking/class priorities, a ten-node skill system, hero training/respawn, five equipment slots with real bonuses, seven workshop recipes, 11 merchant equipment items and two skill tomes, bounded boss combat, destructible gates, tower garrisons, captured territory production, victory/defeat and developer controls.

The map follows the Footmen Wars pattern: four corner base areas, approaches into a large center, a separate merchant safe area and a dedicated boss arena. Width increased from 116 to 250 units (about 4.6× the area). The central battlefield is 100×100 units; the boss arena is 40 units across. Ravines are impassable, and simple waypoint routing sends armies through the center. This is a fixed-layout navigation system, not general RTS pathfinding. Formations use soft slots and break ranks to fight.

New orders replace movement immediately. Troops travel directly to formation slots at the new destination rather than regrouping at an old center first. Recruits inherit the regiment's current destination and attack target; number-key and all-army selections include newly spawned troops. Selecting or assigning a regiment preserves current unit orders. H freezes existing positions; explicit formation changes reform at the held location. Empty selected regiments retain orders for future recruits.

Movement is slower, troops have roughly 50% more HP, attacks have longer intervals and keeps have 6,500 starting HP. AI begins advancing after 2:30 and starts proactive base assaults after 6:00; it still defends threatened bases. Resource income and default production are slower. These are provisional pacing changes.

The boss arena sits at the exact map center, equally distant from all four gated approaches. The boss stays within its marked arena and does not respawn; damage grants XP and the killing player gets the large reward. Merchant healing/mana draughts are consumed immediately. New equipment fills an empty slot automatically; use Items to swap or unequip it. Secondary buildings remain infrastructure sites; the keep and gate are the destructible objectives. Captured sites support one building of each available type and one construction job at a time. Local barracks shares the home roster instead of having a second roster editor. There is no multiplayer, saved campaign or final balance.

The visual pass uses a bright, chunky village style inspired by Clash of Clans, with original procedural models. Shield infantry, bow archers, plumed musketeers, mounted knights, a crowned/caped hero and a stone golem have distinct silhouettes. Production sites, keeps, gates, the merchant and central arena use richer miniature scenery. Walking, weapon attacks, arrows, musket shots and charge impacts animate from simulation events. Rally banners, healing crosses, sweeping strike arcs, offensive war-cry bursts, protective shields and the ultimate each have distinct graphics. Boss smashes include a warning area before impact. These visuals do not delay the simulation's damage timing.

The 10–20 minute match target is **not validated yet**. Test the control, economy and formation decisions before treating the numbers as balance. The full source specification is preserved in [docs/original-specification.md](docs/original-specification.md).

## Validation and development

```sh
pnpm test
pnpm build
```

140 simulation/control/network tests cover production/reserves, construction, troop unlocks, hero progression/respawn, elimination, AI progress, formations, immediate replacement orders, destination arrival, partial selections, home/outpost reinforcement destinations, held positions, future escorts, abilities, merchant safety/prices/tomes, crafting tiers, equipment bonuses/swaps, hero melee/ranged damage, aura/marching, target retention/overrides/reacquisition, escort detachment, boss bounds/rewards/symmetry, ravine routing, skill prerequisites, Tier IV, cursor controls, hotkeys, gate ownership/full-lane collision/fire blocking/breaches, tower costs/capacity/range/damage/protection/dismounting, captured ownership/local income and paid outpost waves with a shared cap. Visual-event integration checks exercise all six spell types and expiry, real melee/arrow/musket attacks and cooldowns, charge impacts, elevated tower origins/targets and timed boss warnings/smashes.

Multiplayer tests cover closed sections, friendly target/damage rejection, allied support and victory, fair AI difficulty, malformed commands, player-scoped orders/production/items/gates, lobby readiness, host permissions, team changes, action sequences, token resumes, AI takeover and static-file boundaries. Real WebSocket clients exercise mixed matches and all four human seats in 2v2. Two separate browser sessions verify mixed human/AI 2v2 setup, code joins, guest controls and upgrades, synchronized orders and Rally casts, dropped-connection recovery and full page reload/resume on both localhost and the public HTTPS tunnel. The setup also fits a narrow mobile viewport; the game itself is designed for desktop keyboard/mouse play.

Balance checks cover recurring wood/ore costs at both barracks, shortage skipping without partial charges, all-base budgets, sustained mixed-wave material demand, earned progression without free promotion points, safe resupply/cooldowns, siege damage and expiry, actual unit counters, frontal/flanking/broken-wall charges, and a cheaper Tier I infantry group defeating Tier III cavalry. A twenty-minute AI economy test simulates steady troop losses and replacements without movement/combat; it validates resource solvency and development, not natural match outcomes. Twelve escort checks cover centered rows, 40-unit formations, unequal footprints, heading changes, physical settling and detached regiments. Browser checks use the real barracks/workshop controls, verify all-resource payments and budgets, promotion without free levels, resupply, timed siege damage, both guard layouts and the existing movement/hero flows without browser errors.

Browser checks also exercised right-click movement, abilities, doctrine controls, both tier upgrades, all roster unlocks, crafting/trading, a combat victory and restart. The victory check used a boosted developer commander to make the check short; it does not establish match balance.

The revised browser check uses actual world clicks to select the barracks, keep and resource sites. It checks context-specific upgrades/production, initial skill choice, keep promotion, passive training, ability hotkeys, movement and the larger map. Accelerated simulation and granted resources shorten that check; they do not establish natural match pacing.

Keyboard browser checks use actual keys for selection, assignment, cursor movement, camera panning and orders. The cursor/formation check verifies that WASD moves the screen cursor without changing unit orders, Enter moves units to it, X targets and damages an enemy, arrow keys pan under it, and F2/F3/F4 and direct buttons change formations while preserving orders. It also checks multiple regiments and empty group presets. Earlier checks cover Regiment 9 production, ability assignment/swapping, casting and persisted bindings after reload. AI and automatic production are disabled for most of these focused checks.

Movement browser checks exercise a recruit spawning after number-key selection, immediate Enter orders, Ctrl assignment without order changes, F attachment, Shift+F/Tab F gathering, Tab H stopping only the hero/escorts, sidebar gather/stop buttons, empty regiment orders and all-army orders. Simulation checks verify first-tick movement direction and arrival in formation.

Ranged checks cover separate rear ranks for all three formations and rotated headings, mixed partial selections, reinforcements, hero-escort footprints, attack-range arrival without overshoot, moving targets, cooldowns, defensive engagement at full reach, formation cohesion, bow heroes, plain-move overrides and closed gates. A two-browser production-server check uses actual number/F2/Enter/X keys to verify mixed ranks and firing-range stops, observes the same command on the guest, and interrupts combat with a plain move. Its stationary durable target shortens functional verification; it does not establish match balance.

Expansion browser checks exercise Tab progression, K keep-only controls, sidebar destinations, crafting/equip/unequip, paid training, merchant arrival/purchases/tomes/hotkeys, hero escort settings, regiment detachment, paid gate toggles, world gate selection, tower construction/garrison/keyboard dismount, combat gate breach and keep capture, all four local buildings, Regiment 9 outpost spawning and captured gate rebuilding. Combat capture uses a temporary damage boost and accelerated simulation; these checks validate functionality, not natural balance or match duration.

Graphics browser checks cover the initial village, centered map overview, actual world selection of all six home buildings, melee/arrow/musket events, all six spell visuals, animated walking and frozen paused effects. They also render a populated 160-troop scene and check layouts at 1440×1000 and 1366×768. Shared primitives and vertex-color merging keep each animated pivot to one opaque draw call; the populated scene fell from about 4,983 to 1,652 draw calls during the visual pass. Frame-rate targets on player hardware have not been established.

Resource costs, extraction rates and ability settings live in `src/game/config.ts`; hero growth is in `hero.ts`, ordinary attack matchups in `combat.ts`. Simulation systems are separate from rendering and UI. Add `?debug=1` to start practice directly and expose `window.commanderWars`, or `?debug=1&setup=1` to use setup with the observation hook. Practice **Match info & developer controls** includes grants, promotion, roster spawning, AI/invulnerability toggles and simulation speed. Those controls are absent from network matches; the server validates player actions.

## Static hosting

`dist/` can still be served on a static host for practice. Online play needs the Node/WebSocket server described above; static hosting alone cannot run shared matches. A separately hosted server can be entered under **Connection settings** on the setup screen.
