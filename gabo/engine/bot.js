/**
 * Les joueuses artificielles du Gabo.
 *
 * Un bot est une fonction pure `(state, botId, rng) => action` : son coup passe
 * par `dispatch` comme celui d'une humaine, il ne peut donc rien faire
 * d'illégal. Il lit l'état complet, mais ne s'autorise à connaître que les
 * cartes inscrites dans `round.seen[botId]` — ce qu'il a réellement vu, moins
 * ce que sa mémoire a laissé filer (voir `remember`, dans game.js).
 *
 * Trois niveaux, un seul cerveau : ils diffèrent par la mémoire, le réflexe à
 * la défausse rapide et la prudence au moment d'annoncer.
 */
import { cardValue, cardPower, sameRank } from './cards.js';

export const BOT_LEVELS = {
  facile: { label: 'Bot facile', memory: 0.55, snapChance: 0.45, snapDelay: [2200, 3800], greed: 2, caution: -1, stealFromOthers: false },
  moyen: { label: 'Bot moyen', memory: 0.82, snapChance: 0.8, snapDelay: [1300, 2600], greed: 1, caution: 0, stealFromOthers: false },
  difficile: { label: 'Bot difficile', memory: 0.97, snapChance: 1, snapDelay: [700, 1600], greed: 0, caution: 1, stealFromOthers: true },
};
export const DEFAULT_BOT_LEVEL = 'moyen';

/** Valeur moyenne d'une carte inconnue (330 points pour 54 cartes). */
const UNKNOWN = 6;

function profileOf(state, botId) {
  const p = state.players.find((x) => x.id === botId);
  return BOT_LEVELS[p?.bot] ?? BOT_LEVELS[DEFAULT_BOT_LEVEL];
}

/** Ce que le bot sait de ses propres cartes : `{ slot, known, value }`. */
function myCards(state, botId) {
  const round = state.round;
  const seen = new Set(round.seen[botId] ?? []);
  return round.grids[botId]
    .map((card, slot) => (card ? { slot, known: seen.has(card.id), value: seen.has(card.id) ? cardValue(card, state.settings) : null } : null))
    .filter(Boolean);
}

/** Les cartes adverses dont le bot connaît la valeur. */
function knownOpponentCards(state, botId) {
  const round = state.round;
  const seen = new Set(round.seen[botId] ?? []);
  const out = [];
  for (const id of round.seats) {
    if (id === botId) continue;
    round.grids[id].forEach((card, slot) => {
      if (card && seen.has(card.id)) out.push({ ownerId: id, slot, card, value: cardValue(card, state.settings) });
    });
  }
  return out;
}

function estimate(cards) {
  return cards.reduce((s, c) => s + (c.known ? c.value : UNKNOWN), 0);
}

function pick(list, rng) {
  return list.length ? list[rng.int(list.length)] : null;
}

/** L'action du bot pour l'étape de tour en cours, ou `null` s'il n'a rien à faire. */
export function botTurnAction(state, botId, rng) {
  if (state.phase === 'peek') {
    return state.round.ready.includes(botId) ? null : { type: 'READY' };
  }
  const round = state.round;
  if (state.phase !== 'playing' || round?.turn?.playerId !== botId) return null;
  const profile = profileOf(state, botId);
  const mine = myCards(state, botId);
  const unknown = mine.filter((c) => !c.known);
  const known = mine.filter((c) => c.known).sort((a, b) => b.value - a.value);
  const worst = known[0] ?? null;

  switch (round.turn.stage) {
    case 'start': {
      if (shouldCallGabo(state, botId, profile, mine)) return { type: 'CALL_GABO' };
      const top = round.discard.at(-1);
      const t = top ? cardValue(top, state.settings) : 99;
      const canDraw = round.drawPile.length > 0 || round.discard.length > 1;
      // Une très petite carte visible : on la prend, à la place de la pire connue
      // ou, à défaut, d'une inconnue (qui vaut six en moyenne).
      if (top && t <= 2) {
        if (worst && worst.value > t + 1) return { type: 'TAKE_DISCARD', slot: worst.slot };
        if (unknown.length) return { type: 'TAKE_DISCARD', slot: pick(unknown, rng).slot };
      }
      if (top && worst && worst.value - t >= 5) return { type: 'TAKE_DISCARD', slot: worst.slot };
      if (canDraw) return { type: 'DRAW' };
      if (top) {
        const slot = worst && worst.value > t ? worst.slot : (unknown[0] ?? mine[0]).slot;
        return { type: 'TAKE_DISCARD', slot };
      }
      return { type: 'CALL_GABO' };
    }
    case 'drawn': {
      const h = cardValue(round.turn.held, state.settings);
      if (worst && worst.value >= h + 2 - Math.min(profile.greed, 1)) return { type: 'SWAP_HELD', slot: worst.slot };
      if (h <= 3 && unknown.length) return { type: 'SWAP_HELD', slot: pick(unknown, rng).slot };
      if (h <= 4 && unknown.length && !cardPower(round.turn.held)) return { type: 'SWAP_HELD', slot: pick(unknown, rng).slot };
      return { type: 'DISCARD_HELD' };
    }
    case 'power':
      return powerAction(state, botId, rng, profile, mine, worst);
    default:
      return null;
  }
}

function shouldCallGabo(state, botId, profile, mine) {
  const round = state.round;
  if (round.gabo) return false;
  const threshold = state.settings.threshold;
  const unknownCount = mine.filter((c) => !c.known).length;
  const total = estimate(mine);
  // Le facile se lance avec une carte inconnue ; les autres veulent tout savoir.
  if (unknownCount > (profile.caution < 0 ? 1 : 0)) return false;
  if (total > threshold + (profile.caution < 0 ? 1 : 0)) return false;
  if (profile.caution > 0) {
    // Le difficile regarde aussi la table : une adversaire réduite à une carte
    // ou deux peut très bien avoir moins.
    const seen = new Set(round.seen[botId] ?? []);
    for (const id of round.seats) {
      if (id === botId) continue;
      const cards = round.grids[id].filter(Boolean);
      const guess = cards.reduce((s, c) => s + (seen.has(c.id) ? cardValue(c, state.settings) : Math.min(UNKNOWN, 4)), 0);
      if (guess <= total) return false;
    }
  }
  return true;
}

function powerAction(state, botId, rng, profile, mine, worst) {
  const round = state.round;
  const power = round.turn.power;
  const opponents = round.seats.filter((id) => id !== botId && round.grids[id].some(Boolean));
  const seen = new Set(round.seen[botId] ?? []);

  if (power === 'peekOwn') {
    const target = pick(mine.filter((c) => !c.known), rng);
    return target ? { type: 'USE_POWER', target: { slot: target.slot } } : { type: 'SKIP_POWER' };
  }

  // Les adversaires les plus menaçantes : l'annonceuse, puis celles qui ont le moins de cartes.
  const threat = [...opponents].sort((a, b) => {
    if (round.gabo?.by === a) return -1;
    if (round.gabo?.by === b) return 1;
    return round.grids[a].filter(Boolean).length - round.grids[b].filter(Boolean).length;
  });

  if (power === 'peekOther') {
    for (const id of threat) {
      const slots = round.grids[id].map((c, slot) => (c && !seen.has(c.id) ? slot : null)).filter((s) => s != null);
      if (slots.length) return { type: 'USE_POWER', target: { ownerId: id, slot: pick(slots, rng) } };
    }
    return { type: 'SKIP_POWER' };
  }

  if (power === 'swap') {
    if (!worst) {
      // Rien de connu à donner : on n'échange à l'aveugle que si l'on n'a rien à perdre.
      return { type: 'SKIP_POWER' };
    }
    const known = knownOpponentCards(state, botId).sort((a, b) => a.value - b.value);
    const best = known[0];
    if (best && best.value <= worst.value - 3) {
      return { type: 'USE_POWER', ownSlot: worst.slot, target: { ownerId: best.ownerId, slot: best.slot } };
    }
    if (worst.value >= 9) {
      // Donner un dix contre une inconnue (six en moyenne), de préférence à l'annonceuse.
      for (const id of threat) {
        const slots = round.grids[id].map((c, slot) => (c ? slot : null)).filter((s) => s != null);
        if (slots.length) return { type: 'USE_POWER', ownSlot: worst.slot, target: { ownerId: id, slot: pick(slots, rng) } };
      }
    }
    return { type: 'SKIP_POWER' };
  }
  return { type: 'SKIP_POWER' };
}

/**
 * Ce que le bot fait pendant une fenêtre de défausse rapide : poser une carte
 * qu'il sait être de la bonne valeur, ou passer. Renvoie `{ action, delay }`,
 * le délai figurant son temps de réaction.
 */
export function botSnapPlan(state, botId, rng) {
  const round = state.round;
  const snap = round?.snap;
  if (state.phase !== 'playing' || !snap) return null;
  if (botId === snap.discarderId || !round.seats.includes(botId)) return null;
  if (snap.claimedBy && snap.claimedBy !== botId) return null;
  if (snap.passed.includes(botId)) return null;
  const profile = profileOf(state, botId);
  const [lo, hi] = profile.snapDelay;
  const delay = lo + rng.int(hi - lo);
  const seen = new Set(round.seen[botId] ?? []);

  const ownMatch = round.grids[botId]
    .map((card, slot) => (card && seen.has(card.id) && sameRank(card, snap.card) ? slot : null))
    .filter((s) => s != null);
  // Une carte retournée par une autre défausse rapide ne compte pas pour le
  // réflexe : on vise celle-là en premier, c'est la plus sûre.
  if (ownMatch.length && rng.next() < profile.snapChance) {
    return { action: { type: 'SNAP', ownerId: botId, slot: ownMatch[0] }, delay };
  }
  if (profile.stealFromOthers && snap.count < state.settings.maxSnapCards) {
    const theirs = knownOpponentCards(state, botId).filter((c) => sameRank(c.card, snap.card));
    // Ne pas tendre deux cartes à une adversaire déjà pleine de cartes : on vise celle qui en a le moins.
    theirs.sort((a, b) => round.grids[a.ownerId].filter(Boolean).length - round.grids[b.ownerId].filter(Boolean).length);
    if (theirs.length && rng.next() < 0.8) {
      return { action: { type: 'SNAP', ownerId: theirs[0].ownerId, slot: theirs[0].slot }, delay: delay + 300 };
    }
  }
  return { action: { type: 'PASS_SNAP' }, delay: Math.min(delay, 1200) };
}
