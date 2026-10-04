import { GATES, OUTPOSTS, RULES, TEAMS, type OutpostBuilding } from '../game/config';
import type { World } from '../game/types';
import { distance } from '../game/math';
import { gatePosition, canGarrison, towerReason } from '../game/gates';
import { outpostReason } from '../game/outposts';
import { buildingNames } from '../game/structures';
const text = (id: string, value: string) => { const e = document.getElementById(id); if (e && e.textContent !== value) e.textContent = value; };
export function gatePanel(w: World, site: number) {
  return `<h2>Gate · ${TEAMS[site].name} approach</h2><div class="buttons">${w.gates.filter(g => g.owner === 0).map(g => `<button data-gate-site="${g.site}">${TEAMS[g.site].name} gate</button>`).join('')}</div><p id="gate-status"></p><button data-gate-toggle="${site}"></button><button data-gate-repair="${site}">Rebuild breached gate · 400g / 100w / 100o</button><p>Closed gates stop all ground troops and attacks across the approach. Destroy enemy gates to break through. Only the owner can open or close a gate.</p><h2>Gate tower</h2><button data-gate-tower="${site}">Build tower · 900g / 150w / 120o · 30s</button><p id="tower-status"></p><p>Three slots for archers, musketeers or a hero. Stationed units gain +6 range, +25% ranged damage and 35% protection. Movement orders automatically dismount them.</p><button data-action="travel-gate">Send hero to this gate</button><h3>On tower</h3><div id="garrison-list"></div><h3>Nearby eligible units</h3><div id="garrison-nearby"></div><p>Move ranged troops or your hero within 14 units of this gate to station them.</p>`;
}
export function territoriesPanel(w: World) {
  const owned = w.territories.filter(t => t.captured && t.owner === 0);
  return `<h2>Captured bases</h2><p>Destroy an enemy keep to claim its territory. Build local barracks or resource production using your shared treasury.</p>${owned.map(t => `<button data-territory="${t.site}">${TEAMS[t.site].name} territory · Manage construction</button>`).join('') || '<p>No captured bases yet.</p>'}`;
}
export function outpostPanel(site: number) {
  return `<h2>${TEAMS[site].name} captured territory</h2><p id="outpost-status"></p><div id="outpost-construction"></div>${(Object.keys(OUTPOSTS) as OutpostBuilding[]).map(building => { const s = OUTPOSTS[building]; return `<div class="item-card"><strong>${buildingNames[building]}</strong><small>${s.cost.gold}g / ${s.cost.wood}w / ${s.cost.ore}o · ${s.time}s</small><button data-outpost="${building}" data-site="${site}">Build</button><small id="outpost-reason-${building}"></small></div>`; }).join('')}<p>Gold mine: +4 gold/s · Forest: +1.2 wood/s · Quarry: +0.9 ore/s. Barracks raises additional paid waves using the home barracks roster, interval, unlocks, reserve and shared 40-troop cap.</p><label>Local wave regiment<select id="outpost-regiment">${Array.from({ length: RULES.regimentCount }, (_, i) => `<option value="${i}">Regiment ${i + 1}</option>`).join('')}</select></label><button data-gate-site="${site}">Manage captured gate</button>`;
}
export function updateGatePanel(w: World, site: number) {
  const g = w.gates.find(g => g.site === site && g.owner === 0); if (!g) return;
  const unit = w.units.find(u => u.id === g.id && u.hp > 0), p = w.players[0];
  text('gate-status', unit ? `${g.open ? 'Open' : 'Closed'} · ${Math.ceil(unit.hp)} / ${unit.maxHp} HP` : 'Breached · passage open');
  const toggle = document.querySelector<HTMLButtonElement>('[data-gate-toggle]'); if (toggle) { toggle.textContent = `${g.open ? 'Close' : 'Open'} gate · ${GATES.toggleGold} gold`; toggle.disabled = !unit || p.eliminated || p.gold < GATES.toggleGold; }
  const repair = document.querySelector<HTMLButtonElement>('[data-gate-repair]'); if (repair) repair.disabled = !!unit || p.eliminated || p.gold < GATES.repair.gold || p.wood < GATES.repair.wood || p.ore < GATES.repair.ore;
  const tower = document.querySelector<HTMLButtonElement>('[data-gate-tower]'); if (tower) tower.disabled = !!towerReason(w, site);
  text('tower-status', g.tower ? `Tower ready · ${g.garrison.length} / ${GATES.capacity} occupied` : g.towerRemaining > 0 ? `Construction: ${Math.ceil(g.towerRemaining)}s` : towerReason(w, site) ?? 'Ready to build');
  const mounted = w.units.filter(u => u.hp > 0 && u.garrison === g.id), nearby = w.units.filter(u => u.hp > 0 && u.team === 0 && canGarrison(u) && u.garrison === undefined && distance(u, gatePosition(site)) <= 14);
  for (const [id, units, action] of [['garrison-list', mounted, 'dismount'], ['garrison-nearby', nearby, 'mount']] as const) {
    const node = document.getElementById(id); if (!node) continue;
    const key = `${units.map(u => u.id).join(',')}:${g.tower}:${g.garrison.length}`;
    if (node.dataset.list === key) continue; node.dataset.list = key;
    node.innerHTML = units.map(u => `<button data-${action}="${u.id}" ${action === 'mount' && (!g.tower || g.garrison.length >= GATES.capacity) ? 'disabled' : ''}>${action === 'mount' ? 'Station' : 'Dismount'} ${u.kind} #${u.id}</button>`).join('') || '<p>None</p>';
  }
}
export function updateOutpostPanel(w: World, site: number) {
  const t = w.territories[site];
  text('outpost-status', `Owned by you · ${Object.entries(t.buildings).filter(([, level]) => level).map(([b]) => buildingNames[b as OutpostBuilding]).join(', ') || 'Undeveloped'}${t.buildings.barracks ? ` · next local wave ${Math.ceil(t.spawnTimer)}s` : ''}`);
  text('outpost-construction', t.construction ? `Building ${buildingNames[t.construction.building]} · ${Math.ceil(t.construction.remaining)}s` : 'No construction in progress');
  document.querySelectorAll<HTMLButtonElement>('[data-outpost]').forEach(b => { const building = b.dataset.outpost as OutpostBuilding, reason = outpostReason(w, site, building); b.disabled = !!reason; b.textContent = t.buildings[building] ? 'Built' : 'Build'; text(`outpost-reason-${building}`, reason ?? 'Ready'); });
  const field = document.querySelector<HTMLSelectElement>('#outpost-regiment'); if (field && document.activeElement !== field) field.value = String(t.regiment);
}
