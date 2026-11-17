/**
 * Les Sept Peuples — le moteur.
 *
 * Même contrat que le Monopoly : le serveur appelle `dispatch(game, playerId,
 * action)`, et une action n'est acceptée que si elle répond à `state.pending`
 * et vient d'une joueuse que l'invite désigne. Trois gestes échappent
 * volontairement à cette garde, parce qu'ils ne changent rien à la partie :
 * réordonner sa main, la mélanger, et parler.
 *
 * Ce qui est neuf ici, c'est l'**information cachée** : au Monopoly tout est
 * public, ici chacune ne doit voir que sa propre main. L'état complet ne sort
 * donc jamais du serveur ; `viewFor` en taille une vue par poste.
 *
 * L'état reste du JSON pur (aucune Map, aucun Set) : il part sur le disque à
 * chaque coup et doit se relire tel quel après un redémarrage.
 */
import {
  RACES,
  HAND_SIZE,
  PLAYER_COUNT,
  TARGETED,
  ELF_COPYABLE,
  DEFAULT_SETTINGS,
  SEAT_COLORS,
  raceOf,
  fullDeck,
  familyProfile,
  compareFamilies,
  completeFamilies,
} from '../../../shared/peuples.js';
import { createRng } from '../../engine/rng.js';
import { say } from './messages.js';

export const GAME_ID = 'peuples';

// — Création, salon ————————————————————————————————————————

export function createGame(code, hostId, { seed, locale = 'fr', settings = {} } = {}) {
  const actualSeed = seed ?? Date.now();
  const state = {
    game: GAME_ID,
    code,
    hostId,
    locale: locale === 'en' ? 'en' : 'fr',
    phase: 'lobby',
    version: 0,
    settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...settings }),
    players: [],
    deck: [],
    currentIndex: 0,
    turnCount: 0,
    pending: { kind: null, playerIds: [], payload: null },
    effect: null,
    finalRound: null,
    lastPlayed: null,
    result: null,
    log: [],
    logSeq: 0,
    chat: [],
    chatSeq: 0,
  };
  return { state, rng: createRng(actualSeed), seed: actualSeed };
}

function sanitizeSettings(settings) {
  return {
    handCap: Boolean(settings.handCap),
    refill: Boolean(settings.refill),
    scoring: settings.scoring === 'families' ? 'families' : 'people',
  };
}

export function playerById(state, id) {
  return state.players.find((p) => p.id === id) ?? null;
}

export function addPlayer(game, { id, name, bot = null }) {
  const { state } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
  if (state.players.length >= PLAYER_COUNT.max) return { ok: false, error: 'La table est complète (4 joueuses).' };
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: 'Ce pseudo est déjà pris.' };
  const taken = new Set(state.players.map((p) => p.color));
  state.players.push({
    id,
    name,
    color: SEAT_COLORS.find((c) => !taken.has(c)) ?? SEAT_COLORS[0],
    connected: true,
    bot,
    order: state.players.length,
    hand: [],
    people: [],
  });
  state.version += 1;
  return { ok: true };
}

export function removePlayer(game, playerId) {
  const { state } = game;
  if (state.phase !== 'lobby') {
    const player = playerById(state, playerId);
    if (player) player.connected = false;
    return { ok: true, disconnected: true };
  }
  state.players = state.players.filter((p) => p.id !== playerId);
  state.players.forEach((p, i) => (p.order = i));
  if (state.hostId === playerId && state.players.length) state.hostId = state.players[0].id;
  state.version += 1;
  return { ok: true };
}

export function reconnectPlayer(game, playerId) {
  const player = playerById(game.state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue dans cette partie.' };
  player.connected = true;
  return { ok: true, player };
}

export function updateSettings(game, playerId, settings) {
  const { state } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'Réglages verrouillés une fois la partie lancée.' };
  if (!playerById(state, playerId)) return { ok: false, error: 'Joueuse inconnue.' };
  state.settings = sanitizeSettings({ ...state.settings, ...settings });
  state.version += 1;
  return { ok: true };
}

/**
 * Mélange, distribue cinq cartes à chacune, tire au sort qui commence.
 * L'ordre de la table est celui d'arrivée au salon : c'est « le sens des
 * aiguilles d'une montre », vu par tout le monde de la même façon.
 */
export function startGame(game, playerId) {
  const { state, rng } = game;
  if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
  const starter = playerById(state, playerId);
  if (!starter) return { ok: false, error: 'Joueuse inconnue.' };
  if (state.players.length < PLAYER_COUNT.min)
    return { ok: false, error: `Il faut au moins ${PLAYER_COUNT.min} joueuses.` };

  state.deck = rng.shuffle(fullDeck());
  for (const player of state.players) {
    player.hand = state.deck.splice(0, HAND_SIZE);
    player.people = [];
  }
  state.phase = 'playing';
  state.currentIndex = rng.int(state.players.length);
  log(state, 'setup', say(state, 'starts', { name: starter.name }));
  log(state, 'setup', say(state, 'firstPlayer', { name: state.players[state.currentIndex].name }));
  startTurn(state);
  state.version += 1;
  return { ok: true };
}

/** Arrêter la partie d'un commun accord : on compte les peuples tels qu'ils sont. */
export function endGame(game, playerId) {
  const { state } = game;
  if (state.phase !== 'playing') return { ok: false, error: "La partie n'est pas en cours." };
  const player = playerById(state, playerId);
  if (!player) return { ok: false, error: 'Joueuse inconnue.' };
  log(state, 'setup', say(state, 'stopped', { name: player.name }));
  finish(state);
  state.version += 1;
  return { ok: true };
}

// — Journal ————————————————————————————————————————————

/**
 * Une entrée de journal. `secret` en fait une entrée à deux visages : le texte
 * complet pour les joueuses de `secret.to`, `secret.text` pour toutes les
 * autres. C'est ce qui permet au korrigan et à sa victime de savoir quelles
 * cartes ont changé de main, sans que la table l'apprenne.
 */
function log(state, type, text, data = {}, secret = null) {
  state.logSeq += 1;
  const entry = { id: `e${state.logSeq}`, at: Date.now(), type, text, data };
  if (secret) entry.secret = secret;
  state.log.push(entry);
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

// — Le tour ————————————————————————————————————————————

const current = (state) => state.players[state.currentIndex];

function setPending(state, kind, playerIds, payload = null) {
  state.pending = { kind, playerIds, payload };
}

/** Combien piocher en début de tour, selon les variantes cochées. */
export function turnDrawCount(state, player) {
  const { handCap, refill } = state.settings;
  if (handCap && player.hand.length >= 6) return 0;
  return refill ? Math.max(1, 6 - player.hand.length) : 1;
}

function draw(state, player, count) {
  const drawn = state.deck.splice(0, Math.max(0, count));
  player.hand.push(...drawn);
  return drawn.length;
}

function startTurn(state) {
  // Une table où plus personne ne tient de carte, pioche vide, ne peut plus
  // avancer : on compte tout de suite.
  for (let guard = 0; guard <= state.players.length; guard++) {
    const player = current(state);
    if (state.finalRound && state.finalRound.stopId === player.id) return finish(state);
    if (state.deck.length === 0 && state.players.every((p) => p.hand.length === 0)) return finish(state);

    state.turnCount += 1;
    state.effect = null;
    const want = turnDrawCount(state, player);
    const got = draw(state, player, want);
    if (got) log(state, 'draw', say(state, 'draws', { name: player.name, n: got }), { playerId: player.id });
    else if (want && state.deck.length === 0 && !state.emptyDeckAnnounced) {
      state.emptyDeckAnnounced = true;
      log(state, 'setup', say(state, 'deckEmpty'));
    }

    if (player.hand.length) {
      setPending(state, 'play_card', [player.id]);
      return;
    }
    // Rien en main : la joueuse passe son tour (un lutin l'a dépouillée, ou
    // elle a posé sa dernière carte pendant le tour de table final).
    log(state, 'skip', say(state, 'skips', { name: player.name }), { playerId: player.id });
    checkFinalRound(state);
    state.currentIndex = (state.currentIndex + 1) % state.players.length;
  }
  finish(state);
}

/**
 * La fin de partie : une fois la pioche vide, dès qu'une main se vide, on
 * termine le tour de table. Chacune joue encore une fois, et la partie
 * s'arrête quand le tour reviendrait à celle dont c'était le tour — « jusqu'à
 * celle placée à sa droite », dit la règle, ce qui est la même chose.
 */
function checkFinalRound(state) {
  if (state.finalRound || state.deck.length > 0) return;
  const emptied = state.players.find((p) => p.hand.length === 0);
  if (!emptied) return;
  state.finalRound = { stopId: current(state).id, triggeredBy: emptied.id };
  log(state, 'setup', say(state, 'finalRound', { name: emptied.name }), { playerId: emptied.id });
}

function endTurn(state) {
  state.effect = null;
  checkFinalRound(state);
  state.currentIndex = (state.currentIndex + 1) % state.players.length;
  startTurn(state);
}

// — Jouer une carte ————————————————————————————————————————

function playCard(state, player, cardId) {
  const index = player.hand.indexOf(cardId);
  if (index < 0) return refuse("Cette carte n'est pas dans votre main.");
  player.hand.splice(index, 1);
  player.people.push(cardId);
  state.lastPlayed = { playerId: player.id, cardId, at: state.turnCount };
  const race = raceOf(cardId);
  log(state, 'play', say(state, 'plays', { name: player.name, race }), { playerId: player.id, cardId });
  applyPower(state, player, race, false);
  return { ok: true };
}

/**
 * Au décompte « familles », le farfadet n'échange pas tout le peuple : il
 * troque **une famille contre une famille**. Celle de la carte qui a déclenché
 * le pouvoir ne se cède pas — on ne donne pas le farfadet qu'on vient
 * d'utiliser, ni, si un elfe a réveillé ce pouvoir, la famille des elfes (la
 * famille des farfadets, elle, devient alors échangeable).
 */
export const familySwap = (state) => state.settings.scoring === 'families';

export function givableRaces(player, viaElf) {
  const forbidden = viaElf ? 'elfe' : 'farfadet';
  return [...new Set(player.people.map(raceOf))].filter((race) => race !== forbidden);
}

/** Les cibles possibles d'un pouvoir : celles sur qui il peut réellement agir. */
export function targetsFor(state, player, power, viaElf = false) {
  const others = state.players.filter((p) => p.id !== player.id);
  if (power === 'farfadet' && familySwap(state)) {
    // Rien à donner, ou rien à prendre : l'échange est impossible.
    if (!givableRaces(player, viaElf).length) return [];
    return others.filter((p) => p.people.length > 0);
  }
  switch (power) {
    case 'korrigan':
      return others.filter((p) => p.hand.length > 0);
    case 'dryade':
      return others.filter((p) => p.people.length > 0);
    case 'lutin':
    case 'farfadet':
      return others;
    default:
      return [];
  }
}

function applyPower(state, player, power, viaElf) {
  if (power === 'fee') {
    log(state, 'power', say(state, 'fairyIdle', { name: player.name }), { playerId: player.id });
    return endTurn(state);
  }

  if (power === 'gnome') {
    let want = 2;
    if (state.settings.handCap) want = Math.min(want, Math.max(0, 7 - player.hand.length));
    const got = draw(state, player, want);
    log(state, 'power', say(state, got ? 'gnomeDraws' : 'gnomeNothing', { name: player.name, n: got }), {
      playerId: player.id,
    });
    return endTurn(state);
  }

  if (power === 'elfe') {
    const races = [...new Set(player.people.map(raceOf).filter((r) => ELF_COPYABLE.has(r)))];
    if (!races.length) {
      log(state, 'power', say(state, 'elfNothing', { name: player.name }), { playerId: player.id });
      return endTurn(state);
    }
    return setPending(state, 'elf_copy', [player.id], { races });
  }

  // Un pouvoir qui vise une adversaire.
  const targets = targetsFor(state, player, power, viaElf);
  if (!targets.length) {
    log(state, 'power', say(state, 'noTarget', { name: player.name, race: power }), { playerId: player.id });
    return endTurn(state);
  }
  const swap = power === 'farfadet' && familySwap(state);
  // Une seule adversaire possible : inutile de demander qui viser — sauf pour
  // la dryade, qui doit encore choisir quelle carte prendre, et pour le
  // farfadet des familles, qui choisit encore quoi donner et quoi prendre.
  if (targets.length === 1 && power !== 'dryade' && !swap)
    return aim(state, player, power, viaElf, targets[0].id, null);
  setPending(state, 'choose_target', [player.id], {
    power,
    viaElf,
    targets: targets.map((p) => p.id),
    ...(swap ? { familySwap: true, give: givableRaces(player, viaElf) } : {}),
  });
}

/** La cible est désignée : on ouvre la fenêtre de la fée, toujours. */
function aim(state, player, power, viaElf, targetId, cardId, families = null) {
  const target = playerById(state, targetId);
  state.effect = { power, viaElf, attackerId: player.id, targetId, cardId, fairies: 0, ...(families ?? {}) };
  const words = families
    ? say(state, 'targetsFamily', { name: player.name, target: target.name, give: families.give, take: families.take })
    : say(state, 'targets', { name: player.name, target: target.name, race: power, cardId });
  log(state, 'target', words, { playerId: player.id, targetId });
  askCounter(state, targetId);
}

/**
 * La question de la fée. Elle est posée **à chaque fois**, que la joueuse en
 * tienne une ou non : si on ne la posait qu'aux porteuses de fée, le simple
 * fait d'être interrogée révélerait sa main à toute la table.
 */
function askCounter(state, playerId) {
  const effect = state.effect;
  setPending(state, 'counter', [playerId], {
    power: effect.power,
    attackerId: effect.attackerId,
    targetId: effect.targetId,
    cardId: effect.cardId,
    fairies: effect.fairies,
    // Qui « protège » l'effet en ce moment : la cible tant que le nombre de
    // fées est pair (elle veut l'annuler), l'attaquante sinon.
    role: playerId === effect.targetId ? 'defend' : 'insist',
  });
}

function playFairy(state, player, cardId) {
  const fairy = cardId ?? player.hand.find((id) => raceOf(id) === 'fee');
  if (!fairy || raceOf(fairy) !== 'fee' || !player.hand.includes(fairy))
    return refuse("Vous n'avez pas de fée en main.");
  player.hand.splice(player.hand.indexOf(fairy), 1);
  player.people.push(fairy);
  const effect = state.effect;
  effect.fairies += 1;
  log(state, 'fairy', say(state, effect.fairies % 2 ? 'fairyBlocks' : 'fairyCounters', { name: player.name }), {
    playerId: player.id,
    cardId: fairy,
  });
  // La parole passe à l'autre camp, qui peut contrer à son tour.
  askCounter(state, player.id === effect.targetId ? effect.attackerId : effect.targetId);
  return { ok: true };
}

function declineFairy(state) {
  const effect = state.effect;
  const attacker = playerById(state, effect.attackerId);
  if (effect.fairies % 2 === 1) {
    log(state, 'power', say(state, 'cancelled', { name: attacker.name, race: effect.power }), {
      playerId: attacker.id,
    });
    return endTurn(state);
  }
  return resolveEffect(state);
}

function resolveEffect(state) {
  const { power, attackerId, targetId, cardId } = state.effect;
  const attacker = playerById(state, attackerId);
  const target = playerById(state, targetId);

  switch (power) {
    case 'korrigan': {
      const count = Math.min(2, target.hand.length);
      if (!count) {
        log(state, 'power', say(state, 'korriganEmpty', { name: attacker.name, target: target.name }), {
          playerId: attacker.id,
        });
        return endTurn(state);
      }
      // Les cartes se prennent à l'aveugle, à une position de la main : la
      // victime a pu la mélanger ou la réordonner jusqu'ici.
      return setPending(state, 'korrigan_pick', [attacker.id], {
        targetId,
        handSize: target.hand.length,
        count,
      });
    }
    case 'lutin': {
      [attacker.hand, target.hand] = [target.hand, attacker.hand];
      log(state, 'power', say(state, 'lutinSwap', { name: attacker.name, target: target.name }), {
        playerId: attacker.id,
        targetId,
      });
      return endTurn(state);
    }
    case 'farfadet': {
      if (state.effect.give) {
        // Une famille contre une famille, comptées au moment de l'échange :
        // les fées jouées pendant la chaîne en font partie si l'on troque les fées.
        const { give, take } = state.effect;
        const given = attacker.people.filter((id) => raceOf(id) === give);
        const taken = target.people.filter((id) => raceOf(id) === take);
        attacker.people = [...attacker.people.filter((id) => raceOf(id) !== give), ...taken];
        target.people = [...target.people.filter((id) => raceOf(id) !== take), ...given];
        log(
          state,
          'power',
          say(state, 'farfadetFamily', { name: attacker.name, target: target.name, give, take, n: given.length, m: taken.length }),
          { playerId: attacker.id, targetId },
        );
        return endTurn(state);
      }
      [attacker.people, target.people] = [target.people, attacker.people];
      log(state, 'power', say(state, 'farfadetSwap', { name: attacker.name, target: target.name }), {
        playerId: attacker.id,
        targetId,
      });
      return endTurn(state);
    }
    case 'dryade': {
      const index = target.people.indexOf(cardId);
      // La carte a pu quitter ce peuple entre-temps : rien à prendre.
      if (index < 0) {
        log(state, 'power', say(state, 'noTarget', { name: attacker.name, race: power }), { playerId: attacker.id });
        return endTurn(state);
      }
      target.people.splice(index, 1);
      attacker.people.push(cardId);
      log(state, 'power', say(state, 'dryadSteals', { name: attacker.name, target: target.name, race: raceOf(cardId) }), {
        playerId: attacker.id,
        targetId,
        cardId,
      });
      return endTurn(state);
    }
    default:
      return endTurn(state);
  }
}

function pickBlind(state, attacker, indices) {
  const { targetId, count } = state.pending.payload;
  const target = playerById(state, targetId);
  const picked = [...new Set((indices ?? []).map(Number))];
  if (picked.length !== count || picked.some((i) => !Number.isInteger(i) || i < 0 || i >= target.hand.length))
    return refuse(count > 1 ? `Choisissez ${count} cartes.` : 'Choisissez une carte.');
  const stolen = picked
    .sort((a, b) => b - a)
    .map((i) => target.hand.splice(i, 1)[0])
    .reverse();
  attacker.hand.push(...stolen);
  const races = stolen.map(raceOf);
  log(
    state,
    'power',
    say(state, 'korriganStealsSeen', { name: attacker.name, target: target.name, races }),
    { playerId: attacker.id, targetId },
    {
      to: [attacker.id, targetId],
      text: say(state, 'korriganSteals', { name: attacker.name, target: target.name, n: stolen.length }),
    },
  );
  endTurn(state);
  return { ok: true };
}

// — Fin de partie ————————————————————————————————————————

/**
 * Le classement. Deux décomptes au choix : le plus grand peuple, ou les
 * familles — la plus grande famille d'abord, puis la suivante, et ainsi de
 * suite. Les égalités parfaites partagent la victoire.
 */
export function standings(state) {
  const families = state.settings.scoring === 'families';
  const compare = (a, b) => (families ? compareFamilies(b.people, a.people) : b.people.length - a.people.length);
  const sorted = [...state.players].sort(compare);
  let rank = 0;
  return sorted.map((player, i) => {
    if (i === 0 || compare(sorted[i - 1], player) !== 0) rank = i + 1;
    return {
      playerId: player.id,
      rank,
      size: player.people.length,
      profile: familyProfile(player.people),
      families: completeFamilies(player.people),
      byRace: Object.fromEntries(RACES.map((r) => [r, player.people.filter((id) => raceOf(id) === r).length])),
    };
  });
}

function finish(state) {
  state.phase = 'finished';
  state.effect = null;
  setPending(state, null, []);
  const ranking = standings(state);
  const winnerIds = ranking.filter((s) => s.rank === 1).map((s) => s.playerId);
  state.result = { scoring: state.settings.scoring, ranking, winnerIds };
  const names = winnerIds.map((id) => playerById(state, id).name);
  log(state, 'end', say(state, names.length > 1 ? 'draw' : 'wins', { names }));
}

// — Dispatch ————————————————————————————————————————————

function refuse(error) {
  return { ok: false, error };
}

export function sendChat(state, playerId, text) {
  const clean = String(text ?? '').trim().slice(0, 300);
  if (!clean) return refuse('Message vide.');
  state.chatSeq += 1;
  state.chat.push({ id: `c${state.chatSeq}`, playerId, text: clean, at: Date.now() });
  if (state.chat.length > 200) state.chat.splice(0, state.chat.length - 200);
  return { ok: true };
}

/** Une permutation exacte de sa main — rien d'ajouté, rien de perdu. */
function isPermutation(order, hand) {
  if (!Array.isArray(order) || order.length !== hand.length) return false;
  const a = [...order].sort();
  const b = [...hand].sort();
  return a.every((id, i) => id === b[i]);
}

export function dispatch(game, playerId, action = {}) {
  const { state, rng } = game;
  const player = playerById(state, playerId);
  if (!player) return refuse('Joueuse inconnue.');

  const result = applyAction(state, rng, player, action);
  if (result.ok) state.version += 1;
  return result;
}

function applyAction(state, rng, player, action) {
  if (action.type === 'CHAT') return sendChat(state, player.id, action.text);
  if (state.phase !== 'playing') return refuse("La partie n'est pas en cours.");

  // Sa main se range et se mélange à tout moment, sauf pendant que le korrigan
  // y plonge la main : le choix doit porter sur la main qu'il avait devant lui.
  if (action.type === 'REORDER_HAND' || action.type === 'SHUFFLE_HAND') {
    const pending = state.pending;
    if (pending.kind === 'korrigan_pick' && pending.payload.targetId === player.id)
      return refuse('Trop tard : le korrigan choisit déjà.');
    if (action.type === 'SHUFFLE_HAND') {
      player.hand = rng.shuffle(player.hand);
      return { ok: true };
    }
    if (!isPermutation(action.order, player.hand)) return refuse('Ordre de main invalide.');
    player.hand = [...action.order];
    return { ok: true };
  }

  const { pending } = state;
  if (!pending.kind || !pending.playerIds.includes(player.id)) return refuse("Ce n'est pas à vous de jouer.");

  switch (pending.kind) {
    case 'play_card':
      if (action.type !== 'PLAY_CARD') break;
      return playCard(state, player, action.cardId);

    case 'elf_copy': {
      if (action.type !== 'ELF_COPY') break;
      if (!pending.payload.races.includes(action.race)) return refuse('Ce pouvoir ne peut pas être réutilisé.');
      log(state, 'power', say(state, 'elfCopies', { name: player.name, race: action.race }), { playerId: player.id });
      applyPower(state, player, action.race, true);
      return { ok: true };
    }

    case 'choose_target': {
      if (action.type !== 'CHOOSE_TARGET') break;
      const { power, viaElf, targets } = pending.payload;
      if (!targets.includes(action.targetId)) return refuse('Cible impossible.');
      let cardId = null;
      let families = null;
      if (power === 'dryade') {
        cardId = action.cardId;
        if (!playerById(state, action.targetId).people.includes(cardId))
          return refuse('Choisissez une carte de son peuple.');
      }
      if (pending.payload.familySwap) {
        const { give, take } = action;
        if (!pending.payload.give.includes(give)) return refuse('Choisissez une famille de votre peuple à céder.');
        if (!playerById(state, action.targetId).people.some((id) => raceOf(id) === take))
          return refuse('Choisissez une famille de son peuple à prendre.');
        families = { give, take };
      }
      aim(state, player, power, viaElf, action.targetId, cardId, families);
      return { ok: true };
    }

    case 'counter':
      if (action.type === 'PLAY_FAIRY') return playFairy(state, player, action.cardId);
      if (action.type === 'DECLINE_FAIRY') {
        log(state, 'pass', say(state, pending.payload.role === 'defend' ? 'noFairy' : 'noCounter', { name: player.name }), {
          playerId: player.id,
        });
        declineFairy(state);
        return { ok: true };
      }
      break;

    case 'korrigan_pick':
      if (action.type !== 'PICK_BLIND') break;
      return pickBlind(state, player, action.indices);

    default:
      break;
  }
  return refuse('Action inattendue à ce moment de la partie.');
}

// — Ce que chaque poste a le droit de voir ————————————————————————

/**
 * La vue d'un poste : sa propre main en clair (toutes celles du poste en mode
 * « même écran »), celles des autres réduites à un nombre, la pioche réduite à
 * sa taille, et les entrées secrètes du journal remplacées par leur version
 * publique. Rien d'autre ne sort du serveur.
 */
export function viewFor(state, viewerIds = []) {
  const sees = (ids) => ids.some((id) => viewerIds.includes(id));
  return {
    ...state,
    deck: undefined,
    deckCount: state.deck.length,
    players: state.players.map((p) => ({
      ...p,
      hand: viewerIds.includes(p.id) ? [...p.hand] : null,
      handCount: p.hand.length,
    })),
    log: state.log.map((entry) => {
      if (!entry.secret) return entry;
      const { secret, ...rest } = entry;
      return sees(secret.to) ? rest : { ...rest, text: secret.text };
    }),
    remaining: state.players.length,
  };
}

export { TARGETED };
