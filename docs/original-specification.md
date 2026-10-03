# Commander Wars — Prototype / Vertical Slice Specification

## 1. Project Goal

Build a playable prototype of a small-scale, hero-centric RTS inspired by Warcraft III and classic Footmen Wars.

The game is **not intended to be a Warcraft clone**. Its main differentiators are:

- Commander-centered progression
- Automatically generated but economically costly armies
- Configurable troop composition
- Regiment-based control
- Programmable troop behaviors
- Historically inspired battlefield formations
- Formation cohesion
- Dual progression through hero level and base tier
- Lightweight economy and crafting
- Fast 10–20 minute matches

The first target is a **single-player demo against 3 AI opponents**.

Multiplayer should NOT be implemented yet, but architecture should avoid making future multiplayer unnecessarily difficult.

---

# 2. Prototype Philosophy

Do not attempt to fully implement every future system.

The first prototype should answer:

1. Does commanding the hero feel good?
2. Does commanding groups of troops feel good?
3. Do formations visibly and mechanically matter?
4. Does automatic troop spawning create interesting economic pressure?
5. Does the base progression loop make sense?
6. Can the player understand army composition and spending?
7. Does a 4-corner Footmen Wars-style map create good combat flow?
8. Is the commander meaningfully more important than individual troops?
9. Is the programmable behavior concept understandable?
10. Is the overall concept fun enough to continue developing?

Favor simple placeholder art and working mechanics over polished content.

---

# 3. Technology

Preferred initial stack:

- Browser-based game
- TypeScript
- React / Next.js for menus and UI if helpful
- Three.js or an appropriate browser-friendly 3D game layer for gameplay
- GitHub for version control
- Vercel for deployment

Use simple low-poly placeholder assets.

The project should be modular enough that art, balancing values, abilities, troop stats, formations, and map values can be changed without rewriting core systems.

Use data-driven configuration wherever practical.

---

# 4. Visual Direction

Style:

- Stylized low-poly fantasy
- Heavily inspired by the feel of Warcraft III
- Chunky readable units
- Strong silhouettes
- Strong player/team colors
- Simple terrain
- Exaggerated ability effects for readability

Do not copy copyrighted Warcraft models, textures, sounds, characters, names, or assets.

The inspiration is primarily:

- Camera angle
- RTS readability
- Fantasy battlefield aesthetic
- Unit scale
- Colorful visual clarity

---

# 5. Camera and Controls

Camera should resemble Warcraft III.

Requirements:

- Angled top-down perspective
- Pan via WASD
- Mouse-edge pan optional
- Mouse wheel zoom
- Rotate camera if practical
- Left-click select
- Drag-box selection
- Right-click move
- Right-click attack target
- Attack-move
- Hold position

Hero should be selectable independently.

Regiments should eventually support hotkeys.

Prototype target:

- Commander
- Regiment 1
- Regiment 2
- Regiment 3
- Regiment 4

---

# 6. Match Format

Initial match:

- 4-player free-for-all
- Player 1 = human
- Players 2–4 = AI
- One symmetrical map
- Each player starts in one corner
- Match target length: 10–20 minutes

Victory condition:

> Destroy all opposing main bases.

When a player is eliminated:

- Their territory becomes neutral/capturable.
- Their resource infrastructure does NOT automatically transfer.
- The capturing player must reinvest resources to reactivate production.
- Captured bases should NOT create additional heroes or full duplicate production centers in the prototype.
- Captured territory mainly provides additional economic potential.

---

# 7. Map

Use a larger version of a classic four-corner Footmen Wars layout.

Each corner contains:

- Main Base
- Barracks
- Crafting attachment location
- Extraction infrastructure
- Gold mine
- Forest
- Quarry
- Space for troops to rally
- Entry paths into the central arena

Center contains:

- Large open combat area
- Merchant zone
- Boss arena

Merchant and boss areas should be near each other but distinct.

## Merchant Zone

Neutral safe area.

Rules:

- No attacks
- No damage
- No hostile abilities
- Preferably only heroes may enter the merchant safe zone
- Armies should not be allowed to hide indefinitely inside it

## Boss Area

Not safe.

Players can fight each other during boss attempts.

---

# 8. Resources

There are four economic/combat resources.

## Gold

Primary currency.

Used for:

- Troop generation
- Base upgrades
- Barracks upgrades
- Crafting infrastructure
- Extraction upgrades
- Merchant purchases
- Potential crafting fees

Gold sources:

- Developed gold mine
- Enemy troop kills
- Commander kills
- Pillaging
- Selling crafted goods
- Boss rewards
- Captured enemy resource sites

Enemy troop kill bounty:

> Approximately 50% of the defeated unit's original gold generation cost.

---

## Mana

Combat-only resource.

Used by commander abilities.

Mana:

- Regenerates passively
- Can be improved through items / skills later
- Should not be treated as another economic currency

---

## Wood

Automatically extracted after forest development.

Used for:

- Crafting
- Infrastructure
- Base advancement

---

## Ore / Quarry Material

Automatically extracted after quarry development.

Used for:

- Crafting
- Infrastructure
- Base advancement

Call this resource Ore unless a better thematic name emerges.

---

# 9. Resource Extraction

Resources do NOT deplete.

Each site requires an initial development investment.

After development:

- Production is automatic
- No worker micro
- Sites produce indefinitely
- Upgrades increase production
- Higher upgrades are sizable investments

This must create a tradeoff:

> More army now vs stronger economy later.

Economy upgrades should not pay themselves back so quickly that upgrading is always obvious.

---

# 10. Base Progression

There are four main base tiers.

Hero level range corresponds to each tier.

## Tier I — Levels 1–10

Starting state.

Available:

- Main Base Tier I
- Barracks Lv.1
- Footmen only
- Basic resource production
- No extraction upgrades
- Fixed troop production
- Hero Tier I

Crafting attachment can be built.

Required before first base upgrade:

- Barracks Lv.1
- Crafting Lv.1
- Required gold
- Required wood
- Required ore

---

## Tier II — Levels 11–20

Main Base Tier II unlocks:

- Barracks Lv.2 availability
- Crafting Lv.2 availability
- Extraction Lv.2 availability
- Hero promotion
- Production customization

Barracks Lv.2 unlocks:

- Archers
- Musketeers

Resource extraction upgrades become available.

---

## Tier III — Levels 21–30

Unlocks:

- Barracks Lv.3
- Crafting Lv.3
- Extraction Lv.3
- Hero promotion

Barracks Lv.3 unlocks:

- Knights

Additional extraction upgrades available.

By this point the full four-unit roster is available.

---

## Tier IV — Levels 31–40

Endgame tier.

Main focus:

- Very powerful hero promotion
- Strong hero stat increase
- Final skill tiers
- Highest crafting tier
- Highest extraction tier
- Repeatable/unlimited production upgrades

No additional fundamental troop type is required.

---

# 11. Construction Times

Initial target values:

Main Base upgrades:

- Tier I → II: 30 seconds
- Tier II → III: approximately 45 seconds
- Tier III → IV: approximately 60 seconds

Barracks / Crafting / Extraction:

- First upgrade: 15 seconds
- Next: approximately 25 seconds
- Next: approximately 35 seconds

During an upgrade, the structure should continue functioning at its previous level.

Crafting an individual item:

- Approximately 5 seconds

All values must live in configuration files / constants and be easy to rebalance.

---

# 12. Upgrade Cost Philosophy

Do not lock final balance yet.

Use this balancing rule:

> A major infrastructure upgrade should cost roughly the same total economic value as building a meaningful current-tier army.

Example concept:

If a player's typical current army costs X resources, then:

- Base advancement ≈ X
- Significant Barracks upgrade ≈ X
- Significant Extraction upgrade ≈ X
- Significant Crafting upgrade ≈ X

This forces tradeoffs between:

- Immediate military power
- Technology
- Economy
- Crafting

Player should generally be able to afford:

> Army + one strategic investment

but not:

> Army + all major upgrades simultaneously.

---

# 13. Troop Production

Troops spawn automatically.

Maximum base production cycle:

> Every 10 seconds.

The player can intentionally slow production to save money.

Options should eventually include:

- 10 seconds
- 15 seconds
- 20 seconds
- 30 seconds
- Paused

The player can also reduce units generated per cycle.

Every generated troop immediately costs gold.

If the player cannot afford a scheduled unit:

- Do not create debt
- Skip/pause that production

Add a configurable gold reserve system if practical:

> Do not auto-spend below X gold.

UI should display:

- Units per cycle
- Cost per cycle
- Approximate gold burn per minute

---

# 14. Tier I Production

At the first base tier:

- Footmen only
- Production composition is locked
- Spawn behavior is fixed

Example prototype value:

> 4 Footmen every 10 seconds

Exact number should remain configurable.

Tier II unlocks production customization.

---

# 15. Army Composition

Production configuration changes FUTURE unit generation only.

Existing units never transform.

Example:

Current army:

- 30 Footmen
- 10 Archers

Player changes production to:

- 20% Footmen
- 40% Archers
- 20% Musketeers
- 20% Knights

Existing troops remain unchanged.

New production follows the new composition.

---

# 16. Troop Roster

Prototype requires four troop classes.

## Footman

Characteristics:

- Second-highest HP
- Lowest movement speed
- Lowest XP reward
- Lowest or near-lowest damage
- Melee only
- Low cost

Role:

- Front line
- Formation holding
- Protect ranged troops
- Defensive screen

---

## Archer

Characteristics:

- Third-highest HP
- Third-highest damage
- Second-highest movement speed
- Long range
- Low cost
- Lower range than Musketeer

Role:

- Mobile ranged damage
- Skirmishing
- Flexible support

---

## Musketeer

Characteristics:

- Lowest HP recommended
- Second-highest damage
- Slower than Archer
- Longest troop attack range
- Expensive
- Higher XP reward than Archer

Role:

- Heavy ranged fire
- Concentrated damage
- Must be protected

---

## Knight

Characteristics:

- Highest HP
- Highest damage
- Highest movement speed
- Highest cost
- Highest XP reward
- Melee only

Role:

- Shock unit
- Flanking
- Charges
- Chasing
- Breaking weak formations

Knights should be powerful but economically painful to lose.

---

# 17. Commander / Hero

The commander is the centerpiece of the game.

Commander can fight:

- In melee
- At short range

Hero ranged attack:

> Shorter range than Archer and Musketeer.

Melee should generally be the higher-DPS or riskier option.

---

# 18. Hero Levels

40 total hero levels.

- Tier I: 1–10
- Tier II: 11–20
- Tier III: 21–30
- Tier IV: 31–40

Hero earns XP primarily through combat.

XP sources:

- Troop kills
- Hero kills
- Structure kills
- Boss damage / kill
- Potential assists

Troop kills by the player's army grant XP to that player's commander.

Passive economy does NOT generate XP.

If hero hits current base-tier level cap:

- Continue banking XP if practical
- Apply it after next base promotion

---

# 19. Commander Death

On commander death:

- Respawn timer
- Lose 2 hero levels

Do not allow death to reduce commander below the minimum level associated with current base tier.

Example:

Tier II minimum = Level 11.

If hero is Level 11 and dies:

- Respawn at 11.

If hero is Level 18 and dies:

- Respawn at 16.

Approximate respawn timers:

- Early: 10–15 sec
- Mid: 20–25 sec
- Late: 30–40 sec

Exact balancing later.

---

# 20. Commander Promotions

Base advancement promotes the existing commander instead of replacing them.

Possible ranks:

- Tier I: Captain
- Tier II: Commander
- Tier III: General
- Tier IV: Marshal

Names are placeholders.

Commander keeps:

- Items
- Skill choices
- Identity

Promotion provides:

- Major base-stat increase
- Better army scaling
- Higher level cap
- New skill-tree tier
- New ability opportunities

Important balance principle:

> The newly promoted hero at a higher base tier should be stronger than the fully developed hero of the previous base tier.

Base advancement should therefore create a clear power spike.

---

# 21. Troop Scaling With Hero

Troops become stronger as the commander levels.

Exact scaling TBD.

Prototype starting concept:

Each commander level provides small improvements such as:

- +HP
- +Damage
- Occasional movement / attack-speed improvement

Promotion provides a significantly larger army-wide jump.

Hero levels = gradual scaling.

Base promotions = major scaling event.

---

# 22. Skill System

Hero receives:

> 1 skill point per hero level.

Level 1:

> Player chooses one starting ability.

Skill points can be spent to:

- Unlock abilities
- Upgrade existing abilities
- Modify abilities
- Unlock passive bonuses

Do NOT attempt to build 40 unique active skills.

---

# 23. Skill Tree Philosophy

Three initial branches:

## Command

Focus:

- Troop buffs
- Formation bonuses
- Cohesion
- Movement
- Aura effects
- Army support

## Warfare

Focus:

- Hero damage
- Offensive abilities
- Armor penetration
- Critical hits
- Charge mechanics
- Hero-vs-hero combat

## Endurance

Focus:

- Hero HP
- Armor
- Healing
- Health regeneration
- Mana regeneration
- Defensive abilities

Players can hybridize.

---

# 24. Ability Slots

Initial target:

- 3 normal abilities
- 1 ultimate

Hero begins with one chosen ability.

Potential unlock timing:

- Slot 1: Level 1
- Slot 2: around Level 5
- Slot 3: around Level 12
- Ultimate: around Level 20

Exact levels are configurable.

Abilities can branch.

Example:

Rally I

→ stronger Rally

then potentially:

- Inspirational Rally
- Frenzied Rally

Skill-tree decisions should shape playstyle instead of merely adding linear numerical bonuses.

---

# 25. Prototype Hero Abilities

For first playable demo, implement only a few.

Suggested set:

## Rally

Nearby troops gain temporary:

- Attack speed
- Movement
- Cohesion restoration

## Second Wind

Hero regenerates health.

## War Cry

Nearby troops gain damage.

## Stand Fast

Nearby troops temporarily gain:

- Defensive bonus
- Reduced cohesion loss

Ultimate can be placeholder initially.

All abilities consume Mana.

---

# 26. Regiment System

Player should be able to organize army into up to approximately four regiments.

Example:

1. Commander Guard
2. Main Army
3. Ranged Support
4. Raider Group

Each regiment can eventually have:

- Assigned units
- Formation
- Behavior
- Target priority
- Retreat rules
- Commander-follow behavior

Prototype does not need every option, but architecture should support them.

---

# 27. Two Control Styles

## Commander Mode

Player primarily controls hero.

Assigned troops:

- Follow hero
- Maintain configured formation
- Fight using configured behavior

This is lower-micro play.

## Tactical Mode

Player can independently control:

- Regiments
- Individual selected troops

Use Warcraft-style RTS commands.

Advanced players should be able to split forces and execute multiple attacks.

---

# 28. Formations

Formation and behavior are separate systems.

Example:

Formation:
> Shield Wall

Behavior:
> Advance

or:

Formation:
> Shield Wall

Behavior:
> Hold

Implement a small number first, but design for expansion.

---

# 29. Prototype Formation Set

## Battle Line

General infantry formation.

Strengths:

- Good frontage
- Flexible
- Moderate movement

Weaknesses:

- Thin
- Vulnerable to concentrated cavalry breakthrough

---

## Shield Wall

Primarily Footmen.

Strengths:

- Frontal defense
- Strong cohesion
- Protect ranged troops behind it

Weaknesses:

- Slow
- Poor turning
- Vulnerable to flanks and heavy concentrated fire

---

## Cavalry Wedge

Primarily Knights.

Strengths:

- Charge
- Formation disruption
- Penetrating thin lines
- Attacking exposed ranged units

Weaknesses:

- Poor if charge stalls
- Vulnerable to surrounding
- Weak against prepared defensive blocks

---

## Defensive Block

Footmen surrounding ranged units.

Strengths:

- Strong against cavalry
- Strong all-around defense
- Protects ranged units

Weaknesses:

- Slow
- Dense
- Vulnerable to area-of-effect abilities
- Reduced firing frontage

---

## Protected Ranged Line

Example:

Footmen front
Archers middle
Musketeers rear

Balanced combined-arms formation.

Weakness:

- Flanks
- Breakthrough
- Loss of front screen

---

## Skirmish Formation

Primarily Archers.

Strengths:

- Loose spacing
- Mobility
- Less vulnerable to AOE

Weaknesses:

- Poor in sustained melee
- Vulnerable to fast cavalry

---

## Column

Movement formation.

Strengths:

- Efficient travel
- Narrow paths
- Turning

Weakness:

- Poor combat frontage
- Vulnerable if attacked before deployment

---

# 30. Formation Counter Philosophy

Do NOT make formations hard rock-paper-scissors.

They should provide meaningful advantages.

Examples:

- Shield Wall helps against frontal melee
- Cavalry Wedge punishes exposed ranged units
- Defensive Block resists cavalry
- Skirmish reduces AOE effectiveness
- Long Battle Line can threaten narrow formations
- Wedge loses effectiveness if stopped
- Protected ranged line is strong until flanked

Position, unit composition, behavior, and hero abilities should still matter.

---

# 31. Cohesion System

Each regiment should eventually have:

> Cohesion: 0–100

High cohesion:

- Formation bonuses active
- Better defense
- Better responsiveness
- Better movement organization

Low cohesion:

- Formation deteriorates
- Bonuses decline
- Units spread/disorganize
- Command response worsens

Cohesion decreases from:

- Heavy casualties
- Knight charges
- Flanking
- AOE
- Commander death
- Units colliding / becoming separated

Cohesion recovers through:

- Regrouping
- Remaining stationary
- Commander proximity
- Rally-type abilities

For the prototype, a simplified cohesion system is acceptable.

---

# 32. Programmable Unit Behavior

This is one of the game's core differentiators.

Do not build a full visual programming language yet.

Implement enough to prove the concept.

Separate behavior into:

## Movement

- Follow Commander
- Hold Position
- Advance
- Retreat
- Flank Left
- Flank Right
- Raid

## Engagement

- Aggressive
- Defensive
- Charge
- Skirmish
- Avoid Combat
- Pursue
- Do Not Pursue

## Target Priority

Examples:

- Closest
- Lowest HP
- Hero first
- Ranged first
- Musketeers first
- Archers first
- Buildings first

Eventually support rules like:

IF regiment HP < 35%
THEN retreat

IF enemy ranged troops exposed
THEN flank and charge

IF enemy Knights approach
THEN change formation

Prototype target:

Implement at least:

- Follow Commander
- Hold
- Aggressive
- Defensive
- Charge
- Retreat
- Closest target
- Hero priority
- Ranged priority

---

# 33. Crafting

Crafting requires a base attachment.

Crafting building can be upgraded.

Crafting itself should be quick:

> approximately 5 seconds per item.

Do not create a massive recipe list for prototype.

Implement a few demonstration items.

Example categories:

- Weapon
- Armor
- Banner / army buff
- Consumable

Example items:

## Longsword

Costs:
- Wood
- Ore

Provides:
- Hero melee damage

## Reinforced Armor

Costs:
- Ore
- Gold

Provides:
- Hero armor / HP

## Commander's Banner

Costs:
- Wood
- Ore
- Gold

Provides:
- Nearby troop buff

Items may be:

- Equipped
- Sold to merchant

---

# 34. Merchant

Center merchant:

Player can:

- Buy items
- Sell crafted items

Merchant has limited gold.

Merchant gold increases as match progresses.

Merchant gold should also increase when players purchase from him.

Selling reduces merchant available gold.

Exact economic simulation can be simplified for prototype.

---

# 35. Boss

Boss is present from match start.

Early:

> Practically impossible.

Midgame:

> Potentially killable with strong coordinated army.

Late:

> Important strategic objective.

Boss should have:

- High HP
- AOE attack
- Hero-targeting ability
- Troop-clearing attack
- Strong visual effects

Rewards:

- Huge hero XP
- Large gold reward
- Valuable item or crafting material

Boss can be contested by other players.

Players can attack each other during the fight.

Consider reward distribution based partly on damage contribution, with a killing bonus.

Boss can respawn after several minutes if desired.

---

# 36. AI

Initial demo needs 3 functional AI opponents.

AI does not need sophisticated human-level behavior.

Basic goals:

- Generate troops
- Upgrade base
- Upgrade Barracks
- Develop extraction
- Level hero
- Attack enemies
- Defend base
- Use abilities
- Occasionally attempt boss when strong enough

Different AI personalities are optional.

Possible future styles:

- Aggressive
- Economic
- Defensive
- Tech rush

For first demo, competent generic AI is sufficient.

---

# 37. Prototype Scope — MUST HAVE

The first demo should prioritize these systems:

1. Warcraft-style camera
2. One playable commander
3. Footmen
4. Archers
5. Musketeers
6. Knights
7. Automatic production
8. Gold deduction for troop spawning
9. Four corner map
10. Three AI opponents
11. Basic combat
12. Base destruction victory condition
13. Hero XP / leveling
14. Commander death and respawn
15. At least two base upgrades
16. Barracks progression
17. Basic resource income
18. At least three formations
19. At least three troop behaviors
20. Basic hero abilities
21. Basic center boss
22. Basic merchant placeholder

---

# 38. Prototype Scope — NICE TO HAVE

If time/complexity permits:

- All four base tiers
- Full crafting
- Cohesion
- Captured territory
- Merchant gold simulation
- More formations
- More skill-tree choices
- Boss respawn
- Production reserve
- Advanced conditional AI behaviors

---

# 39. Do NOT Prioritize Yet

Do not spend significant effort yet on:

- Multiplayer
- Accounts
- Authentication
- Persistent progression
- Monetization
- Large number of heroes
- Multiple factions
- Large item database
- Cinematics
- Voice acting
- Highly polished art
- Mobile support
- Advanced matchmaking
- Elaborate menus

We need to prove the core game first.

---

# 40. Data-Driven Architecture

Keep gameplay parameters centralized and easy to modify.

Prefer config/data structures for:

- Troop stats
- Troop costs
- Spawn times
- Hero stats
- XP curves
- Ability costs
- Ability cooldowns
- Building costs
- Building timers
- Extraction rates
- Formation modifiers
- Cohesion modifiers
- AI behavior
- Boss stats

Avoid scattering hard-coded balance numbers throughout gameplay code.

---

# 41. Initial Balance Philosophy

Do not obsess over final balance.

The prototype needs to make roles obvious.

Make differences exaggerated enough to test.

Examples:

- Knight visibly faster and stronger than Footman
- Musketeer visibly outranges Archer
- Footman visibly survives longer than ranged troops
- Knight charge visibly disrupts formations
- Shield Wall visibly survives frontal assault better
- Hero ability buffs should be obvious

We can reduce extremes later.

---

# 42. Debug / Development UI

Include developer-friendly controls.

Useful debug tools:

- Give gold
- Give wood
- Give ore
- Give XP
- Level hero
- Upgrade base instantly
- Spawn each troop type
- Kill selected unit
- Toggle AI
- Toggle invulnerability
- Speed up game
- Display FPS
- Display selected unit stats
- Display regiment cohesion
- Display AI state

This will dramatically speed balancing and iteration.

---

# 43. First Deliverable

Create a playable vertical slice.

Ideal demo flow:

1. Player loads into one corner.
2. Footmen begin automatically spawning.
3. Player moves commander and army.
4. Player fights AI-controlled Footmen.
5. Hero gains XP.
6. Player develops economy.
7. Player builds crafting attachment.
8. Player upgrades main base.
9. Player upgrades Barracks.
10. Archers / Musketeers become available.
11. Player changes troop composition.
12. Player assigns army to formations.
13. Player uses at least two commander abilities.
14. AI players independently progress.
15. Player can eventually unlock Knights.
16. Armies fight in central area.
17. Boss exists and can be attacked.
18. Player can destroy an enemy base.
19. Match ends when one player remains.

The demo does not need perfect balance.

It needs to clearly expose what feels good and what needs redesign.

---

# 44. Code Quality Expectations

Keep the project organized.

Suggested separation:

- game/core
- game/units
- game/hero
- game/combat
- game/formations
- game/ai
- game/economy
- game/buildings
- game/boss
- game/map
- game/input
- game/config
- ui

Document important systems.

Do not build everything into one giant gameplay file.

Favor components/systems that can be independently modified.

---

# 45. First Implementation Order

Recommended:

### Phase 1
- Map
- Camera
- Unit selection
- Movement
- Combat

### Phase 2
- Commander
- Footmen
- XP
- Death / respawn

### Phase 3
- Automatic troop production
- Economy
- Base structures

### Phase 4
- Archer / Musketeer / Knight
- Barracks progression
- Production composition

### Phase 5
- Formations
- Regiment behavior
- Cohesion prototype

### Phase 6
- AI opponents

### Phase 7
- Hero abilities
- Base advancement
- Boss

### Phase 8
- Merchant / crafting placeholders
- UI cleanup
- Deployment

After each phase, keep the game runnable.

---

# 46. Demo Assumptions That Can Be Changed After Playtesting

The following are intentionally provisional:

- Exact gold costs
- XP curve
- Exact troop stats
- Hero stat scaling
- Spawn quantity
- Formation bonuses
- Respawn time
- Resource income
- Upgrade prices
- Upgrade timers beyond the initial targets
- Boss stats
- Merchant economy
- Item stats
- Exact AI strategy

Do not treat these as permanent design decisions.

The prototype exists to determine those values.

---

# 47. Core Design Principle

The player should spend most attention on:

- Commander combat
- Hero abilities
- Regiment positioning
- Formation choice
- Army composition
- Tactical attacks

Medium attention on:

- Base progression
- Skill choices
- Production management

Low attention on:

- Resource harvesting
- Crafting administration
- Infrastructure micromanagement

The game should feel like commanding an army, not operating a spreadsheet.

---

# 48. Product Identity

The central pitch is:

> A fast hero-centric fantasy RTS where players develop a commander, automatically raise an army, configure battlefield doctrine, and win through formations, programmable troop behavior, economic decisions, and tactical positioning.

The formation + doctrine system should be treated as a core feature rather than an optional side mechanic.