/**
 * Le moteur du Gabo.
 *
 * Même contrat que le moteur du Monopoly :
 *  - le serveur fait foi, le client n'envoie que des intentions ;
 *  - l'état est du JSON pur (sauvegarde disque, reprise après redémarrage) ;
 *  - le moteur ne lit jamais l'horloge ni `Math.random` : `now` et `rng` lui
 *    sont passés, ce qui rend chaque partie rejouable dans les tests.
 *
 * La différence avec le Monopoly tient en un mot : l'information cachée.
 * L'état complet contient toutes les cartes ; ce qu'une joueuse a le droit de
 * voir est calculé à part, par `viewFor` (view.js). Rien de cet état ne doit
 * partir tel quel vers un navigateur.
 *
 * Disposition d'un jeu : les cartes vivent dans des emplacements numérotés qui
 * ne bougent jamais. La colonne c contient les emplacements 2c (rangée du fond)
 * et 2c+1 (rangée proche). On regarde au départ les deux cartes proches, 1 et 3.
 * Un emplacement vidé par une défausse rapide reste vide (`null`) : la place
 * des autres cartes ne change pas, c'est ce qui rend la mémoire possible.
 */
import { freshDeck, cardValue, cardPower, sameRank, cardTheName, aRank } from './cards.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const HAND_SIZE = 4;
export const INITIAL_PEEK_SLOTS = [1, 3];

/** Combien de temps une carte regardée reste retournée sous les yeux. */
export const PEEK_MS = 4000;
/** Combien de temps une carte posée à tort reste visible de toute la table. */
export const WRONG_SNAP_MS = 3500;
/** Ce qu'une défausse rapide réussie rallonge la fenêtre, pour en poser une deuxième. */
export const SNAP_EXTEND_MS = 2000;
/** Garde-fou : une manche qui n'en finit pas (pioche vide, personne n'annonce). */
export const MAX_TURNS_PER_ROUND = 400;
const LOG_CAP = 300;

export const DEFAULT_SETTINGS = {
  /** Total maximal pour un Gabo réussi (5 au Tamalou, 7 dans la variante). */
  threshold: 5,
  /** Durée de la fenêtre de défausse rapide, en secondes. */
  snapSeconds: 5,
  /** Aide-mémoire : les cartes déjà vues restent affichées pour soi. */
  memoryAid: false,
  /** Cartes reçues par celle dont on a posé une carte avec succès. */
  opponentSnapPenalty: 2,
  /** Cartes piochées par qui pose une mauvaise carte. */
  wrongSnapPenalty: 2,
  /** Cartes posées au plus sur une même défausse. */
  maxSnapCards: 3,
  /** Temps de réflexion par tour, en secondes (0 : illimité). Au-delà, le tour se joue tout seul. */
  turnSeconds: 0,
};

const ALLOWED = {
  threshold: [3, 4, 5, 6, 7, 8, 10],
  snapSeconds: [3, 4, 5, 6, 8, 10, 15],
  memoryAid: [true, false],
  opponentSnapPenalty: [1, 2],
  wrongSnapPenalty: [1, 2],
  maxSnapCards: [1, 2, 3],
  turnSeconds: [0, 30, 60, 120],
};

// — Création et salon ——————————————————————————————————————————

export function createGame(code, hostId, settings = {}) {
  return {
    code,
    version: 0,
    hostId,
    phase: 'lobby',
    settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...settings }),
    players: [],
    round: null,
    roundNumber: 0,
    dealerIndex: -1,
    history: [],
    log: [],
    logSeq: 0,
  };
}

function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  for (const [key, values] of Object.entries(ALLOWED)) {
    if (values.includes(raw[key])) out[key] = raw[key];
  }
  return out;
}

export function playerById(state, id) {
  return state.players.find((p) => p.id === id) ?? null;
}

/**
 * Ajoute une joueuse. Possible au salon, et entre deux manches : celle qui
 * arrive en retard s'assoit et reçoit ses cartes à la donne suivante.
 * `memory` (0 à 1) est la probabilité de retenir une carte vue : 1 pour une
 * humaine (sa mémoire est la sienne, le serveur ne l'abîme pas), moins pour un
 * bot d'un niveau modeste.
 */
export function addPlayer(state, { id, name, bot = null, memory = 1, avatar = null }) {
  if (state.players.length >= MAX_PLAYERS) return fail(`La table est pleine (${MAX_PLAYERS} places).`);
  if (playerById(state, id)) return fail('Joueuse déjà assise.');
  const clean = String(name ?? '').trim().slice(0, 20);
  if (!clean) return fail('Choisissez un pseudo.');
  if (state.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
    return fail('Ce pseudo est déjà pris à cette table.');
  }
  state.players.push({
    id,
    name: clean,
    bot,
    memory,
    avatar: avatar ?? state.players.length,
    connected: true,
    wins: 0,
    points: 0,
    roundsPlayed: 0,
  });
  if (!state.hostId || !playerById(state, state.hostId)) state.hostId = id;
  log(state, 'join', `${clean} s'installe à la table.`, { playerId: id });
  bump(state);
  return ok();
}

/** Retire une joueuse — seulement si elle n'a pas de cartes en main. */
export function removePlayer(state, id) {
  const player = playerById(state, id);
  if (!player) return fail('Joueuse inconnue.');
  if (isSeated(state, id) && state.phase !== 'roundEnd') {
    return fail('Impossible de quitter une manche en cours : vos cartes restent sur la table.');
  }
  state.players = state.players.filter((p) => p.id !== id);
  if (state.round) state.round.seats = state.round.seats.filter((s) => s !== id);
  if (state.hostId === id) {
    state.hostId = (state.players.find((p) => !p.bot && p.connected) ?? state.players.find((p) => !p.bot))?.id ?? null;
  }
  log(state, 'leave', `${player.name} quitte la table.`, { playerId: id });
  bump(state);
  return ok();
}

export function setConnected(state, id, connected, now = 0) {
  const player = playerById(state, id);
  if (!player) return fail('Joueuse inconnue.');
  player.connected = connected;
  // L'hôte qui s'en va ne doit pas bloquer la table : la main passe à une
  // personne présente, et lui revient si elle était seule.
  const host = playerById(state, state.hostId);
  if (!host || (!host.connected && !host.bot)) {
    const next = state.players.find((p) => !p.bot && p.connected);
    if (next) state.hostId = next.id;
  }
  // Une absente compte comme prête : on ne fait pas attendre la table.
  if (state.phase === 'peek') maybeEndPeek(state, now);
  bump(state);
  return ok();
}

export function updateSettings(state, actorId, patch) {
  if (actorId !== state.hostId) return fail("Seul l'hôte règle la table.");
  if (state.phase === 'peek' || state.phase === 'playing') return fail('On ne change pas les règles en pleine manche.');
  state.settings = sanitizeSettings({ ...state.settings, ...patch });
  bump(state);
  return ok();
}

export function isSeated(state, id) {
  return Boolean(state.round?.seats.includes(id));
}

// — Donne ——————————————————————————————————————————————————

/** Lance la première manche (au salon) ou la suivante (après un décompte). */
export function startRound(state, actorId, { rng, now }) {
  if (actorId !== state.hostId) return fail("Seul l'hôte distribue.");
  if (state.phase !== 'lobby' && state.phase !== 'roundEnd') return fail('Une manche est déjà en cours.');
  if (state.players.length < MIN_PLAYERS) return fail(`Il faut au moins ${MIN_PLAYERS} joueuses.`);

  state.roundNumber += 1;
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  // La donne tourne : la joueuse à gauche de la donneuse commence.
  const order = [];
  for (let i = 1; i <= state.players.length; i++) {
    order.push(state.players[(state.dealerIndex + i) % state.players.length].id);
  }

  const deck = rng.shuffle(freshDeck());
  const grids = {};
  const seen = {};
  for (const id of order) {
    grids[id] = deck.splice(0, HAND_SIZE);
    seen[id] = [];
  }
  const discard = [deck.pop()];

  state.round = {
    number: state.roundNumber,
    seats: order,
    dealerId: state.players[state.dealerIndex].id,
    drawPile: deck,
    discard,
    grids,
    seen,
    ready: [],
    reveals: [],
    turn: null,
    snap: null,
    gabo: null,
    turnCount: 0,
    results: null,
  };
  state.phase = 'peek';

  // Chacune regarde ses deux cartes proches, et elles seules.
  for (const id of order) {
    const items = INITIAL_PEEK_SLOTS.map((slot) => ({ ownerId: id, slot }));
    reveal(state, id, items, null, 'initial', rng);
  }
  log(state, 'round', `Manche ${state.roundNumber} : ${playerById(state, state.round.dealerId).name} distribue. Chacune regarde ses deux cartes du bas.`, {});
  maybeEndPeek(state, now);
  bump(state);
  return ok();
}

/** Fin du coup d'œil initial : quand tout le monde est prêt. */
function maybeEndPeek(state, now = 0) {
  const round = state.round;
  if (state.phase !== 'peek' || !round) return;
  const waiting = round.seats.filter((id) => {
    const p = playerById(state, id);
    return p && !p.bot && p.connected && !round.ready.includes(id);
  });
  if (waiting.length) return;
  round.reveals = round.reveals.filter((r) => r.reason !== 'initial');
  state.phase = 'playing';
  beginTurn(state, round.seats[0], now);
}

// — Actions ————————————————————————————————————————————————

/**
 * Point d'entrée unique de toutes les actions de jeu.
 * `ctx = { rng, now }`. Renvoie `{ ok, error? }`.
 */
export function dispatch(state, actorId, action, ctx) {
  const result = handle(state, actorId, action ?? {}, ctx);
  if (result.ok) {
    purgeReveals(state, ctx.now);
    bump(state);
  }
  return result;
}

function handle(state, actorId, action, ctx) {
  const player = playerById(state, actorId);
  if (!player) return fail('Joueuse inconnue.');

  switch (action.type) {
    case 'READY':
      return actReady(state, actorId, ctx);
    case 'FORCE_START':
      if (actorId !== state.hostId) return fail("Seul l'hôte peut lancer sans attendre.");
      if (state.phase !== 'peek') return fail('Rien à lancer.');
      state.round.ready = [...state.round.seats];
      maybeEndPeek(state, ctx.now);
      return ok();
    case 'DRAW':
      return actDraw(state, actorId, ctx);
    case 'TAKE_DISCARD':
      return actTakeDiscard(state, actorId, action, ctx);
    case 'SWAP_HELD':
      return actSwapHeld(state, actorId, action, ctx);
    case 'DISCARD_HELD':
      return actDiscardHeld(state, actorId, ctx);
    case 'USE_POWER':
      return actUsePower(state, actorId, action, ctx);
    case 'SKIP_POWER':
      return actSkipPower(state, actorId, ctx);
    case 'CALL_GABO':
      return actCallGabo(state, actorId, ctx);
    case 'SNAP':
      return actSnap(state, actorId, action, ctx);
    case 'PASS_SNAP':
      return actPassSnap(state, actorId, ctx);
    case 'NEXT_ROUND':
      return startRound(state, actorId, ctx);
    default:
      return fail('Action inconnue.');
  }
}

function actReady(state, actorId, ctx) {
  if (state.phase !== 'peek') return fail("Ce n'est pas le moment.");
  if (!isSeated(state, actorId)) return fail("Vous n'avez pas de cartes cette manche.");
  if (!state.round.ready.includes(actorId)) state.round.ready.push(actorId);
  // Ses deux cartes se retournent dès qu'on est prête — la mémoire commence.
  state.round.reveals = state.round.reveals.filter((r) => !(r.reason === 'initial' && r.to === actorId));
  maybeEndPeek(state, ctx.now);
  return ok();
}

/** Garde commune : c'est bien à elle de jouer, à cette étape-là. */
function requireTurn(state, actorId, stage) {
  if (state.phase !== 'playing') return "Aucune manche en cours.";
  const turn = state.round.turn;
  if (!turn || turn.playerId !== actorId) return "Ce n'est pas votre tour.";
  if (stage && turn.stage !== stage) {
    return {
      start: 'Vous avez déjà pioché ce tour-ci.',
      drawn: "Piochez d'abord une carte.",
      power: "Il n'y a pas de pouvoir à utiliser.",
    }[stage] ?? "Ce n'est pas le moment.";
  }
  return null;
}

function actDraw(state, actorId, ctx) {
  const err = requireTurn(state, actorId, 'start');
  if (err) return fail(err);
  const card = drawCard(state, ctx.rng);
  if (!card) return fail('La pioche est vide : prenez la défausse ou annoncez Gabo.');
  const round = state.round;
  round.turn.held = card;
  round.turn.stage = 'drawn';
  remember(state, actorId, card.id, ctx.rng);
  log(state, 'draw', `${name(state, actorId)} pioche une carte.`, { playerId: actorId });
  return ok();
}

function actTakeDiscard(state, actorId, action, ctx) {
  const err = requireTurn(state, actorId, 'start');
  if (err) return fail(err);
  const round = state.round;
  const slot = ownSlot(state, actorId, action.slot);
  if (slot == null) return fail('Choisissez une de vos cartes à remplacer.');
  const taken = round.discard.pop();
  if (!taken) return fail('La défausse est vide.');
  const replaced = round.grids[actorId][slot];
  round.grids[actorId][slot] = taken;
  round.discard.push(replaced);
  // La carte prise était face visible : toute la table l'a vue entrer à cette place.
  for (const id of round.seats) remember(state, id, taken.id, ctx.rng);
  log(
    state,
    'takeDiscard',
    `${name(state, actorId)} prend ${cardTheName(taken)} dans la défausse et jette ${cardTheName(replaced)}.`,
    { playerId: actorId, slots: [{ ownerId: actorId, slot }], card: publicCard(replaced) },
  );
  openSnap(state, actorId, replaced, ctx);
  return ok();
}

function actSwapHeld(state, actorId, action, ctx) {
  const err = requireTurn(state, actorId, 'drawn');
  if (err) return fail(err);
  const round = state.round;
  const slot = ownSlot(state, actorId, action.slot);
  if (slot == null) return fail('Choisissez une de vos cartes à remplacer.');
  const held = round.turn.held;
  const replaced = round.grids[actorId][slot];
  round.grids[actorId][slot] = held;
  round.turn.held = null;
  round.discard.push(replaced);
  log(
    state,
    'swapHeld',
    `${name(state, actorId)} garde la carte piochée et jette ${cardTheName(replaced)}.`,
    { playerId: actorId, slots: [{ ownerId: actorId, slot }], card: publicCard(replaced) },
  );
  openSnap(state, actorId, replaced, ctx);
  return ok();
}

function actDiscardHeld(state, actorId, ctx) {
  const err = requireTurn(state, actorId, 'drawn');
  if (err) return fail(err);
  const round = state.round;
  const held = round.turn.held;
  round.turn.held = null;
  round.discard.push(held);
  const power = cardPower(held);
  const powerText = {
    peekOwn: ' — elle peut regarder une de ses cartes',
    peekOther: " — elle peut regarder une carte d'une adversaire",
    swap: ' — elle peut échanger une carte à l’aveugle',
  }[power] ?? '';
  log(state, 'discardHeld', `${name(state, actorId)} jette ${cardTheName(held)}${powerText}.`, {
    playerId: actorId,
    card: publicCard(held),
  });
  if (power && canUsePower(state, actorId, power)) {
    round.turn.stage = 'power';
    round.turn.power = power;
    round.turn.discarded = held;
    return ok();
  }
  openSnap(state, actorId, held, ctx);
  return ok();
}

/** Un pouvoir sans cible possible (plus aucune carte en face) est sauté d'office. */
function canUsePower(state, actorId, power) {
  const round = state.round;
  const mine = round.grids[actorId].some(Boolean);
  const theirs = round.seats.some((id) => id !== actorId && round.grids[id].some(Boolean));
  if (power === 'peekOwn') return mine;
  if (power === 'peekOther') return theirs;
  return mine && theirs;
}

function actUsePower(state, actorId, action, ctx) {
  const err = requireTurn(state, actorId, 'power');
  if (err) return fail(err);
  const round = state.round;
  const power = round.turn.power;
  const target = action.target ?? {};

  if (power === 'peekOwn') {
    const slot = ownSlot(state, actorId, target.slot);
    if (slot == null) return fail('Choisissez une de vos cartes.');
    reveal(state, actorId, [{ ownerId: actorId, slot }], ctx.now + PEEK_MS, 'peek', ctx.rng);
    log(state, 'peekOwn', `${name(state, actorId)} regarde une de ses cartes.`, {
      playerId: actorId,
      slots: [{ ownerId: actorId, slot }],
    });
  } else if (power === 'peekOther') {
    const slot = otherSlot(state, actorId, target.ownerId, target.slot);
    if (slot == null) return fail("Choisissez une carte d'une adversaire.");
    reveal(state, actorId, [{ ownerId: target.ownerId, slot }], ctx.now + PEEK_MS, 'peek', ctx.rng);
    log(state, 'peekOther', `${name(state, actorId)} regarde une carte de ${name(state, target.ownerId)}.`, {
      playerId: actorId,
      slots: [{ ownerId: target.ownerId, slot }],
    });
  } else if (power === 'swap') {
    const mySlot = ownSlot(state, actorId, action.ownSlot);
    if (mySlot == null) return fail('Choisissez la carte que vous donnez.');
    const slot = otherSlot(state, actorId, target.ownerId, target.slot);
    if (slot == null) return fail("Choisissez la carte que vous prenez à une adversaire.");
    const mine = round.grids[actorId][mySlot];
    const theirs = round.grids[target.ownerId][slot];
    round.grids[actorId][mySlot] = theirs;
    round.grids[target.ownerId][slot] = mine;
    // Elle peut regarder la carte qu'elle a prise ; l'adversaire, non.
    reveal(state, actorId, [{ ownerId: actorId, slot: mySlot }], ctx.now + PEEK_MS, 'peek', ctx.rng);
    log(
      state,
      'swap',
      `${name(state, actorId)} échange une de ses cartes avec une carte de ${name(state, target.ownerId)}.`,
      {
        playerId: actorId,
        targetId: target.ownerId,
        slots: [
          { ownerId: actorId, slot: mySlot },
          { ownerId: target.ownerId, slot },
        ],
      },
    );
  } else {
    return fail("Il n'y a pas de pouvoir à utiliser.");
  }
  const discarded = round.turn.discarded;
  openSnap(state, actorId, discarded, ctx);
  return ok();
}

function actSkipPower(state, actorId, ctx) {
  const err = requireTurn(state, actorId, 'power');
  if (err) return fail(err);
  const discarded = state.round.turn.discarded;
  openSnap(state, actorId, discarded, ctx);
  return ok();
}

function actCallGabo(state, actorId, ctx) {
  const err = requireTurn(state, actorId, 'start');
  if (err) return fail(err);
  const round = state.round;
  if (round.gabo) return fail(`${name(state, round.gabo.by)} a déjà annoncé Gabo.`);
  round.gabo = { by: actorId };
  log(state, 'gabo', `${name(state, actorId)} annonce GABO ! Dernier tour pour les autres.`, { playerId: actorId });
  endTurn(state, ctx);
  return ok();
}

// — La défausse rapide ———————————————————————————————————————

/**
 * Ouvre la fenêtre pendant laquelle les autres peuvent poser une carte de même
 * valeur. À la table, cela se joue au réflexe ; en ligne, il faut un délai
 * visible par toutes, sinon la plus proche du serveur gagnerait toujours.
 */
function openSnap(state, discarderId, card, ctx) {
  const round = state.round;
  round.turn.stage = 'snap';
  round.turn.power = null;
  round.turn.discarded = null;
  round.snap = {
    rank: card.rank,
    card: publicCard(card),
    discarderId,
    openedAt: ctx.now,
    until: ctx.now + state.settings.snapSeconds * 1000,
    claimedBy: null,
    count: 0,
    passed: [],
  };
}

/** Qui peut poser sur cette défausse : toutes celles qui ont des cartes, sauf celle qui vient de jeter. */
function snapEligible(state) {
  const round = state.round;
  return round.seats.filter((id) => id !== round.snap.discarderId);
}

function actSnap(state, actorId, action, ctx) {
  const round = state.round;
  if (state.phase !== 'playing' || !round?.snap) return fail("Il n'y a rien sur quoi poser en ce moment.");
  if (ctx.now > round.snap.until) return fail('Trop tard : la défausse est fermée.');
  if (!isSeated(state, actorId)) return fail("Vous n'avez pas de cartes cette manche.");
  if (actorId === round.snap.discarderId) return fail('Vous venez de jeter : ce sont les autres qui posent.');
  const snap = round.snap;
  if (snap.claimedBy && snap.claimedBy !== actorId) {
    return fail(`Trop tard : ${name(state, snap.claimedBy)} a été plus rapide. Votre carte reste en place.`);
  }
  if (snap.count >= state.settings.maxSnapCards) return fail(`On ne pose pas plus de ${state.settings.maxSnapCards} cartes.`);
  const ownerId = action.ownerId ?? actorId;
  if (!isSeated(state, ownerId)) return fail('Cette joueuse ne joue pas cette manche.');
  const grid = round.grids[ownerId];
  const slot = Number(action.slot);
  if (!Number.isInteger(slot) || !grid[slot]) return fail("Il n'y a pas de carte à cet endroit.");

  const card = grid[slot];
  const mine = ownerId === actorId;
  const where = mine ? 'une de ses cartes' : `une carte de ${name(state, ownerId)}`;

  if (!sameRank(card, snap.card)) {
    // Erreur. Sa propre carte, une fois posée, reste sur la défausse — comme à
    // la table, on ne la reprend pas — et l'étourdie pioche deux cartes
    // qu'elle ne connaît pas. La carte d'une autre, elle, est montrée à tous
    // et lui revient : on ne lui ferait pas cadeau d'une carte en moins.
    // Les pénalités tombent AVANT de vider la place : elles ne doivent pas
    // venir s'y glisser, on croirait la carte revenue.
    const penalty = givePenalty(state, actorId, state.settings.wrongSnapPenalty, ctx.rng);
    if (mine) {
      grid[slot] = null;
      round.discard.push(card);
    } else {
      reveal(state, null, [{ ownerId, slot }], ctx.now + WRONG_SNAP_MS, 'wrong', ctx.rng);
      for (const id of round.seats) remember(state, id, card.id, ctx.rng);
    }
    const what = mine
      ? `${cardTheName(card)} reste sur la défausse`
      : `la carte retourne chez ${name(state, ownerId)}`;
    log(
      state,
      'snapWrong',
      `${name(state, actorId)} pose ${where} : ${cardTheName(card)}, ce n'est pas ${aRank(snap.card)} ! ${what[0].toUpperCase()}${what.slice(1)} et ${name(state, actorId)} pioche ${plural(penalty.length, 'carte')} de pénalité.`,
      { playerId: actorId, slots: [{ ownerId, slot }, ...penalty], card: publicCard(card), wrong: true },
    );
    return ok();
  }

  grid[slot] = null;
  round.discard.push(card);
  snap.claimedBy = actorId;
  snap.count += 1;
  snap.until = Math.max(snap.until, ctx.now + SNAP_EXTEND_MS);
  let penaltySlots = [];
  if (!mine) penaltySlots = givePenalty(state, ownerId, state.settings.opponentSnapPenalty, ctx.rng);
  log(
    state,
    'snap',
    mine
      ? `${name(state, actorId)} pose ${cardTheName(card)} sur la défausse !`
      : `${name(state, actorId)} pose ${cardTheName(card)} de ${name(state, ownerId)} ! ${name(state, ownerId)} pioche ${plural(state.settings.opponentSnapPenalty, 'carte')}.`,
    { playerId: actorId, targetId: mine ? null : ownerId, slots: [{ ownerId, slot }, ...penaltySlots], card: publicCard(card) },
  );

  // Se débarrasser de toutes ses cartes arrête la manche sur-le-champ.
  if (!round.grids[actorId].some(Boolean)) {
    if (!round.gabo) round.gabo = { by: actorId, auto: true };
    log(state, 'gabo', `${name(state, actorId)} n'a plus aucune carte : GABO !`, { playerId: actorId });
    endRound(state);
    return ok();
  }
  if (snap.count >= state.settings.maxSnapCards) closeSnap(state, ctx);
  return ok();
}

function actPassSnap(state, actorId, ctx) {
  const round = state.round;
  if (state.phase !== 'playing' || !round?.snap) return ok(); // inoffensif : la fenêtre s'est déjà fermée
  if (!round.snap.passed.includes(actorId)) round.snap.passed.push(actorId);
  const snap = round.snap;
  const done = snap.claimedBy
    ? snap.passed.includes(snap.claimedBy)
    : snapEligible(state).every((id) => {
        const p = playerById(state, id);
        // Une absente ne posera rien : on ne l'attend pas.
        return snap.passed.includes(id) || (p && !p.bot && !p.connected);
      });
  if (done) closeSnap(state, ctx);
  return ok();
}

function closeSnap(state, ctx) {
  state.round.snap = null;
  endTurn(state, ctx);
}

/**
 * Le temps qui passe : ferme la fenêtre de défausse quand son délai est
 * écoulé. Appelé par le serveur à l'échéance donnée par `nextDeadline`.
 */
export function tick(state, ctx) {
  let changed = false;
  if (state.phase === 'playing' && state.round?.snap && ctx.now >= state.round.snap.until) {
    closeSnap(state, ctx);
    changed = true;
  }
  if (purgeReveals(state, ctx.now)) changed = true;
  if (changed) bump(state);
  return changed;
}

/** La prochaine échéance à laquelle `tick` aura quelque chose à faire. */
export function nextDeadline(state) {
  const times = [];
  if (state.phase === 'playing' && state.round?.snap) times.push(state.round.snap.until);
  for (const r of state.round?.reveals ?? []) if (r.until) times.push(r.until);
  return times.length ? Math.min(...times) : null;
}

// — Enchaînement des tours ——————————————————————————————————————

function beginTurn(state, playerId, now) {
  state.round.turn = { playerId, stage: 'start', held: null, power: null, discarded: null, startedAt: now };
}

function endTurn(state, ctx) {
  const round = state.round;
  round.turnCount += 1;
  if (round.turnCount >= MAX_TURNS_PER_ROUND) {
    log(state, 'stuck', 'La manche traîne trop : on compte les points.', {});
    endRound(state);
    return;
  }
  const index = round.seats.indexOf(round.turn.playerId);
  const next = round.seats[(index + 1) % round.seats.length];
  // Le dernier tour s'arrête quand on revient à l'annonceuse.
  if (round.gabo && next === round.gabo.by) {
    endRound(state);
    return;
  }
  beginTurn(state, next, ctx.now);
}

/** Retourne toutes les cartes et désigne la gagnante de la manche. */
function endRound(state) {
  const round = state.round;
  const totals = {};
  for (const id of round.seats) {
    totals[id] = round.grids[id].reduce((sum, card) => sum + (card ? cardValue(card) : 0), 0);
  }
  const announcer = round.gabo?.by ?? null;
  const others = round.seats.filter((id) => id !== announcer);
  const bestOther = others.length ? Math.min(...others.map((id) => totals[id])) : Infinity;

  let winners;
  let success = false;
  let reason;
  if (announcer) {
    const mine = totals[announcer];
    const underLimit = mine <= state.settings.threshold;
    const lowest = mine < bestOther;
    success = underLimit && lowest;
    if (success) {
      winners = [announcer];
      reason = `${name(state, announcer)} réussit son Gabo avec ${plural(mine, 'point')}.`;
    } else {
      winners = others.filter((id) => totals[id] === bestOther);
      if (!underLimit) reason = `Gabo raté : ${plural(mine, 'point')}, au-dessus de la limite de ${state.settings.threshold}.`;
      else if (mine === bestOther) reason = `Gabo raté : égalité à ${plural(mine, 'point')}, et l'annonceuse perd toujours les égalités.`;
      else reason = `Gabo raté : quelqu'un a fait moins que ${plural(mine, 'point')}.`;
    }
  } else {
    const best = Math.min(...round.seats.map((id) => totals[id]));
    winners = round.seats.filter((id) => totals[id] === best);
    reason = 'Personne n’a annoncé : le plus petit total l’emporte.';
  }

  for (const id of round.seats) {
    const p = playerById(state, id);
    if (!p) continue;
    p.points += totals[id];
    p.roundsPlayed += 1;
    if (winners.includes(id)) p.wins += 1;
  }

  round.results = { totals, announcer, success, winners, reason };
  round.snap = null;
  round.turn = null;
  round.reveals = [];
  state.phase = 'roundEnd';
  state.history.push({ number: round.number, totals, announcer, success, winners });
  if (state.history.length > 50) state.history.shift();
  const names = winners.map((id) => name(state, id)).join(' et ');
  log(state, 'roundEnd', `${reason} Victoire : ${names}.`, { winners });
}

// — Outils internes ——————————————————————————————————————————

/**
 * Pioche une carte. Pioche vide : on remélange la défausse, sauf sa carte du
 * dessus. Les cartes remélangées sont oubliées de toutes — une fois dans le
 * paquet, plus personne ne sait où elles sont.
 */
function drawCard(state, rng) {
  const round = state.round;
  if (!round.drawPile.length && round.discard.length > 1) {
    const top = round.discard.pop();
    const back = round.discard;
    const ids = new Set(back.map((c) => c.id));
    for (const id of Object.keys(round.seen)) round.seen[id] = round.seen[id].filter((c) => !ids.has(c));
    round.drawPile = rng.shuffle(back);
    round.discard = [top];
    log(state, 'reshuffle', 'La pioche est vide : on remélange la défausse.', {});
  }
  return round.drawPile.pop() ?? null;
}

/** Donne des cartes de pénalité, face cachée, que personne n'a vues. */
function givePenalty(state, playerId, count, rng) {
  const grid = state.round.grids[playerId];
  const slots = [];
  for (let i = 0; i < count; i++) {
    const card = drawCard(state, rng);
    if (!card) break;
    // On comble d'abord un trou laissé par une défausse, sinon on ouvre une
    // nouvelle place : les cartes déjà posées ne bougent jamais.
    let slot = grid.indexOf(null);
    if (slot === -1) {
      grid.push(card);
      slot = grid.length - 1;
    } else grid[slot] = card;
    slots.push({ ownerId: playerId, slot, penalty: true });
  }
  return slots;
}

function ownSlot(state, actorId, raw) {
  const slot = Number(raw);
  const grid = state.round.grids[actorId];
  return Number.isInteger(slot) && grid?.[slot] ? slot : null;
}

function otherSlot(state, actorId, ownerId, raw) {
  if (!ownerId || ownerId === actorId || !isSeated(state, ownerId)) return null;
  const slot = Number(raw);
  return Number.isInteger(slot) && state.round.grids[ownerId][slot] ? slot : null;
}

/**
 * Montre des cartes. `to` : une joueuse, ou `null` pour toute la table.
 * `until` : échéance, ou `null` pour « jusqu'à nouvel ordre » (coup d'œil initial).
 * La carte est aussi inscrite dans ce que la (ou les) joueuse(s) ont vu.
 */
function reveal(state, to, items, until, reason, rng) {
  const round = state.round;
  state.revealSeq = (state.revealSeq ?? 0) + 1;
  round.reveals.push({ id: state.revealSeq, to, items, until, reason });
  if (to) {
    for (const { ownerId, slot } of items) {
      const card = round.grids[ownerId][slot];
      if (card) remember(state, to, card.id, rng);
    }
  }
}

function purgeReveals(state, now) {
  const round = state.round;
  if (!round) return false;
  const before = round.reveals.length;
  round.reveals = round.reveals.filter((r) => r.until == null || r.until > now);
  return round.reveals.length !== before;
}

/**
 * Une joueuse a vu une carte. Les bots oublient parfois (selon leur niveau) ;
 * une humaine, jamais aux yeux du serveur — sa mémoire, c'est la sienne, et
 * `seen` ne sert à l'afficher que si l'aide-mémoire est activée.
 */
function remember(state, playerId, cardId, rng) {
  const round = state.round;
  const seen = round.seen[playerId];
  if (!seen || seen.includes(cardId)) return;
  const memory = playerById(state, playerId)?.memory ?? 1;
  if (memory >= 1 || rng.next() < memory) seen.push(cardId);
}

/** Une carte face visible, sans son identifiant interne. */
export function publicCard(card) {
  return card ? { rank: card.rank, suit: card.suit } : null;
}

/** « 1 point », « 0 point », « 7 points » — l'usage français : pluriel à partir de deux. */
function plural(n, word) {
  return `${n} ${word}${Math.abs(n) >= 2 ? 's' : ''}`;
}

function name(state, id) {
  return playerById(state, id)?.name ?? '?';
}

function log(state, type, text, data) {
  state.logSeq += 1;
  state.log.push({ id: state.logSeq, type, text, data });
  if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP);
}

function bump(state) {
  state.version += 1;
}

function ok() {
  return { ok: true };
}

function fail(error) {
  return { ok: false, error };
}
