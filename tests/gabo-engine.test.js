/**
 * Le moteur du Gabo : règles, information cachée, défausse rapide, décompte.
 *
 * Chaque test fabrique sa table, puis impose les cartes qu'il veut voir en jeu
 * (`setGrid`) : on vérifie une règle, pas la chance d'un mélange.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame,
  addPlayer,
  startRound,
  dispatch,
  tick,
  viewFor,
  cardValue,
  createRng,
  BOT_LEVELS,
  PEEK_MS,
  MAX_PLAYERS,
} from '../gabo/engine/index.js';
import { playRound } from '../gabo/engine/simulate.js';

const c = (rank, suit = 'S', id = `${rank}${suit}x`) => ({ id, rank, suit });

/** Une table prête à jouer : joueuses p0..pN-1, coup d'œil passé, p0 commence. */
function setup(n = 3, settings = {}) {
  const rng = createRng(7);
  const state = createGame('TEST', null, settings);
  for (let i = 0; i < n; i++) addPlayer(state, { id: `p${i}`, name: `J${i}` });
  // dealerIndex -1 + 1 = 0 → la joueuse après la donneuse commence ; on veut p0.
  state.dealerIndex = n - 2;
  const clock = { now: 1000 };
  const ctx = () => ({ rng, now: clock.now });
  assert.equal(startRound(state, 'p0', ctx()).ok, true);
  for (let i = 0; i < n; i++) dispatch(state, `p${i}`, { type: 'READY' }, ctx());
  assert.equal(state.phase, 'playing');
  assert.equal(state.round.turn.playerId, 'p0');
  return { state, rng, clock, ctx };
}

function setGrid(state, id, cards) {
  state.round.grids[id] = cards;
}

function allCards(state) {
  const r = state.round;
  return [...r.drawPile, ...r.discard, ...Object.values(r.grids).flat().filter(Boolean), ...(r.turn?.held ? [r.turn.held] : [])];
}

/** Ferme la fenêtre de défausse en laissant filer le temps. */
function closeSnap({ state, clock, ctx }) {
  clock.now = state.round.snap.until + 1;
  tick(state, ctx());
}

test('valeurs des cartes : rois rouges à 0, rois noirs à 15, figures à 10', () => {
  assert.equal(cardValue(c('K', 'H')), 0);
  assert.equal(cardValue(c('K', 'D')), 0);
  assert.equal(cardValue(c('K', 'S')), 15);
  assert.equal(cardValue(c('K', 'C')), 15);
  assert.equal(cardValue(c('Q', 'H')), 10);
  assert.equal(cardValue(c('J', 'C')), 10);
  assert.equal(cardValue(c('A', 'D')), 1);
  assert.equal(cardValue(c('10', 'D')), 10);
});

test('la donne : 4 cartes chacune, une défausse, 52 cartes en tout — sans joker', () => {
  const { state } = setup(8);
  for (const id of state.round.seats) assert.equal(state.round.grids[id].length, 4);
  assert.equal(state.round.discard.length, 1);
  const ids = allCards(state).map((x) => x.id);
  assert.equal(ids.length, 52);
  assert.equal(new Set(ids).size, 52);
  assert.ok(allCards(state).every((x) => x.rank !== 'JOKER'));
});

test('huit joueuses au plus', () => {
  const state = createGame('T', null);
  for (let i = 0; i < MAX_PLAYERS; i++) assert.equal(addPlayer(state, { id: `p${i}`, name: `J${i}` }).ok, true);
  assert.equal(addPlayer(state, { id: 'p9', name: 'Neuf' }).ok, false);
});

test('au départ, chacune ne voit que ses deux cartes du bas', () => {
  const rng = createRng(3);
  const state = createGame('T', null);
  for (let i = 0; i < 3; i++) addPlayer(state, { id: `p${i}`, name: `J${i}` });
  startRound(state, 'p0', { rng, now: 0 });
  const view = viewFor(state, 'p1', 0);
  const mine = view.round.grids.p1;
  assert.ok(mine[1].rank && mine[3].rank, 'les cartes 2 et 4 (rangée proche) sont visibles');
  assert.ok(mine[0].down && mine[2].down, 'les cartes du fond restent cachées');
  for (const other of ['p0', 'p2']) assert.ok(view.round.grids[other].every((x) => x.down));
  // Prête : ses cartes se retournent.
  dispatch(state, 'p1', { type: 'READY' }, { rng, now: 0 });
  assert.ok(viewFor(state, 'p1', 0).round.grids.p1.every((x) => x.down));
});

test("la vue d'une joueuse ne contient aucune carte cachée ni aucun identifiant", () => {
  const { state } = setup(4);
  dispatch(state, 'p0', { type: 'DRAW' }, { rng: createRng(1), now: 2000 });
  for (const id of ['p1', 'p2', 'p3']) {
    const json = JSON.stringify(viewFor(state, id, 2000));
    for (const card of allCards(state)) assert.ok(!json.includes(`"${card.id}"`), `fuite de ${card.id}`);
    const view = viewFor(state, id, 2000);
    assert.deepEqual(view.round.turn.held, { down: true }, 'la carte piochée reste secrète');
    for (const seat of view.round.seats) assert.ok(view.round.grids[seat].every((x) => x === null || x.down));
  }
  assert.ok(viewFor(state, 'p0', 2000).round.turn.held.rank, 'celle qui pioche voit sa carte');
});

test('piocher puis garder : la carte remplacée part à la défausse, la fenêtre s’ouvre', () => {
  const t = setup(3);
  const { state, ctx } = t;
  setGrid(state, 'p0', [c('9'), c('8'), c('7'), c('6')]);
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  const held = state.round.turn.held;
  assert.equal(dispatch(state, 'p0', { type: 'SWAP_HELD', slot: 2 }, ctx()).ok, true);
  assert.equal(state.round.grids.p0[2], held);
  assert.equal(state.round.discard.at(-1).rank, '7');
  assert.equal(state.round.turn.stage, 'snap');
  assert.equal(state.round.snap.rank, '7');
  closeSnap(t);
  assert.equal(state.round.turn.playerId, 'p1');
});

test('prendre la défausse : impossible de la rejeter telle quelle, elle remplace une carte', () => {
  const { state, ctx } = setup(3);
  setGrid(state, 'p0', [c('9'), c('8'), c('7'), c('6')]);
  state.round.discard.push(c('2', 'H'));
  assert.equal(dispatch(state, 'p0', { type: 'TAKE_DISCARD' }, ctx()).ok, false, 'il faut désigner une carte');
  assert.equal(dispatch(state, 'p0', { type: 'TAKE_DISCARD', slot: 0 }, ctx()).ok, true);
  assert.equal(state.round.grids.p0[0].rank, '2');
  assert.equal(state.round.discard.at(-1).rank, '9');
});

test("on ne joue pas hors de son tour, ni deux fois la même étape", () => {
  const { state, ctx } = setup(3);
  assert.equal(dispatch(state, 'p1', { type: 'DRAW' }, ctx()).ok, false);
  assert.equal(dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx()).ok, false);
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  assert.equal(dispatch(state, 'p0', { type: 'DRAW' }, ctx()).ok, false);
});

test('7 ou 8 jeté : on regarde une de ses cartes, quelques secondes, et soi seule', () => {
  const t = setup(3);
  const { state, ctx, clock } = t;
  setGrid(state, 'p0', [c('9'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('8', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  assert.equal(state.round.turn.stage, 'power');
  assert.equal(state.round.turn.power, 'peekOwn');
  assert.equal(dispatch(state, 'p0', { type: 'USE_POWER', target: { slot: 0 } }, ctx()).ok, true);
  assert.equal(viewFor(state, 'p0', clock.now).round.grids.p0[0].rank, '9');
  assert.ok(viewFor(state, 'p1', clock.now).round.grids.p0[0].down, 'les autres ne la voient pas');
  assert.ok(viewFor(state, 'p0', clock.now + PEEK_MS + 1).round.grids.p0[0].down, 'elle se retourne ensuite');
  assert.equal(state.round.turn.stage, 'snap');
});

test("9 ou 10 jeté : on regarde une carte d'une adversaire, pas la sienne", () => {
  const { state, ctx, clock } = setup(3);
  setGrid(state, 'p1', [c('K', 'S'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('10', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  assert.equal(dispatch(state, 'p0', { type: 'USE_POWER', target: { ownerId: 'p0', slot: 0 } }, ctx()).ok, false);
  assert.equal(dispatch(state, 'p0', { type: 'USE_POWER', target: { ownerId: 'p1', slot: 0 } }, ctx()).ok, true);
  assert.equal(viewFor(state, 'p0', clock.now).round.grids.p1[0].rank, 'K');
  assert.ok(viewFor(state, 'p1', clock.now).round.grids.p1[0].down, 'la propriétaire ne la voit pas pour autant');
});

test("Valet ou Dame : échange à l'aveugle, on voit la carte prise, l'adversaire non", () => {
  const { state, ctx, clock } = setup(3);
  setGrid(state, 'p0', [c('K', 'C', 'kc'), c('5'), c('4'), c('3')]);
  setGrid(state, 'p2', [c('A', 'H', 'ah'), c('6'), c('7'), c('8')]);
  state.round.drawPile.push(c('J', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  assert.equal(state.round.turn.power, 'swap');
  const res = dispatch(state, 'p0', { type: 'USE_POWER', ownSlot: 0, target: { ownerId: 'p2', slot: 0 } }, ctx());
  assert.equal(res.ok, true);
  assert.equal(state.round.grids.p0[0].id, 'ah');
  assert.equal(state.round.grids.p2[0].id, 'kc');
  assert.equal(viewFor(state, 'p0', clock.now).round.grids.p0[0].rank, 'A');
  assert.ok(viewFor(state, 'p2', clock.now).round.grids.p2[0].down);
});

test('un pouvoir peut être refusé', () => {
  const { state, ctx } = setup(3);
  state.round.drawPile.push(c('Q', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  assert.equal(dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx()).ok, true);
  assert.equal(state.round.turn.stage, 'snap');
});

test("une carte prise dans la défausse n'a pas de pouvoir", () => {
  const { state, ctx } = setup(3);
  state.round.discard.push(c('J', 'D'));
  dispatch(state, 'p0', { type: 'TAKE_DISCARD', slot: 0 }, ctx());
  assert.equal(state.round.turn.stage, 'snap');
  assert.equal(state.round.turn.power, null);
});

test('défausse rapide : poser sa carte de même valeur la retire du jeu', () => {
  const t = setup(3);
  const { state, ctx } = t;
  setGrid(state, 'p1', [c('7', 'H', '7h'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('7', 'D', '7d'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  const res = dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p1', slot: 0 }, ctx());
  assert.equal(res.ok, true);
  assert.equal(state.round.grids.p1[0], null, 'la place reste vide, les autres cartes ne bougent pas');
  assert.equal(state.round.grids.p1[1].rank, '5');
  assert.equal(state.round.discard.at(-1).id, '7h');
});

test('défausse rapide : la plus rapide gagne, la plus lente garde sa carte sans pénalité', () => {
  const { state, ctx } = setup(3);
  setGrid(state, 'p1', [c('7', 'H', '7h'), c('5'), c('4'), c('3')]);
  setGrid(state, 'p2', [c('7', 'C', '7c'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('7', 'D', '7d'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  assert.equal(dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p1', slot: 0 }, ctx()).ok, true);
  const late = dispatch(state, 'p2', { type: 'SNAP', ownerId: 'p2', slot: 0 }, ctx());
  assert.equal(late.ok, false);
  assert.match(late.error, /Trop tard/);
  assert.equal(state.round.grids.p2[0].id, '7c');
  assert.equal(state.round.grids.p2.length, 4);
});

test('défausse rapide : celle qui vient de jeter ne pose pas', () => {
  const { state, ctx } = setup(3);
  setGrid(state, 'p0', [c('7', 'H'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('7', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  assert.equal(dispatch(state, 'p0', { type: 'SNAP', ownerId: 'p0', slot: 0 }, ctx()).ok, false);
});

test('défausse rapide : sa propre carte posée à tort reste au milieu, et coûte deux cartes inconnues', () => {
  const { state, ctx, clock } = setup(3);
  setGrid(state, 'p1', [c('6', 'H', '6h'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('7', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  assert.equal(dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p1', slot: 0 }, ctx()).ok, true);
  assert.equal(state.round.discard.at(-1).id, '6h', 'la carte reste sur la défausse');
  assert.equal(state.round.grids.p1[0], null, 'sa place reste vide : aucune pénalité ne vient s’y glisser');
  assert.equal(state.round.grids.p1.filter(Boolean).length, 5, '4 − 1 + 2');
  const view = viewFor(state, 'p1', clock.now);
  assert.ok(view.round.grids.p1.filter(Boolean).every((x) => x.down), 'les pénalités sont cachées, même à leur propriétaire');
  assert.equal(state.round.snap.claimedBy, null, "une erreur ne ferme pas la défausse aux autres");
});

test("défausse rapide : la carte d'une autre posée à tort lui revient, montrée à toutes", () => {
  const { state, ctx, clock } = setup(3);
  setGrid(state, 'p2', [c('6', 'H', '6h'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('7', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  assert.equal(dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p2', slot: 0 }, ctx()).ok, true);
  assert.equal(state.round.grids.p2[0].id, '6h');
  assert.equal(viewFor(state, 'p0', clock.now).round.grids.p2[0].rank, '6');
  assert.equal(state.round.grids.p1.filter(Boolean).length, 6, 'celle qui s’est trompée pioche deux cartes');
});

test("défausse rapide sur la carte d'une adversaire : elle part, l'adversaire pioche deux cartes", () => {
  const { state, ctx } = setup(3);
  setGrid(state, 'p2', [c('7', 'H', '7h'), c('5'), c('4'), c('3')]);
  state.round.drawPile.push(c('7', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  assert.equal(dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p2', slot: 0 }, ctx()).ok, true);
  const grid = state.round.grids.p2;
  assert.equal(grid.filter(Boolean).length, 5, '4 − 1 + 2');
  assert.equal(state.round.grids.p1.filter(Boolean).length, 4, "celle qui pose ne perd rien");
});

test('défausse rapide : trois cartes au plus', () => {
  const { state, ctx } = setup(3);
  setGrid(state, 'p1', [c('7', 'H'), c('7', 'C'), c('7', 'S'), c('3'), c('4')]);
  state.round.grids.p2[0] = c('7', 'H', 'other7');
  state.round.drawPile.push(c('7', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  for (const slot of [0, 1, 2]) assert.equal(dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p1', slot }, ctx()).ok, true);
  // La troisième ferme la fenêtre et passe la main.
  assert.equal(state.round.snap, null);
  assert.equal(state.round.turn.playerId, 'p1');
});

test("tout le monde passe : la fenêtre se ferme sans attendre l'échéance", () => {
  const { state, ctx } = setup(3);
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'SWAP_HELD', slot: 0 }, ctx());
  dispatch(state, 'p1', { type: 'PASS_SNAP' }, ctx());
  assert.ok(state.round.snap);
  dispatch(state, 'p2', { type: 'PASS_SNAP' }, ctx());
  assert.equal(state.round.snap, null);
  assert.equal(state.round.turn.playerId, 'p1');
});

test("Gabo : un dernier tour pour les autres, puis on compte", () => {
  const t = setup(3);
  const { state, ctx } = t;
  setGrid(state, 'p0', [c('A'), c('2'), c('K', 'H'), c('A', 'D')]); // 4 points
  setGrid(state, 'p1', [c('9'), c('9', 'H'), c('9', 'D'), c('9', 'C')]);
  setGrid(state, 'p2', [c('8'), c('8', 'H'), c('8', 'D'), c('8', 'C')]);
  assert.equal(dispatch(state, 'p0', { type: 'CALL_GABO' }, ctx()).ok, true);
  assert.equal(state.round.turn.playerId, 'p1');
  for (const id of ['p1', 'p2']) {
    dispatch(state, id, { type: 'DRAW' }, ctx());
    state.round.turn.held = c('K', 'S', `ks-${id}`); // une carte qui ne changera rien au classement
    dispatch(state, id, { type: 'DISCARD_HELD' }, ctx());
    closeSnap(t);
  }
  assert.equal(state.phase, 'roundEnd');
  const res = state.round.results;
  assert.equal(res.announcer, 'p0');
  assert.equal(res.success, true);
  assert.deepEqual(res.winners, ['p0']);
  assert.equal(res.totals.p0, 4);
  assert.equal(state.players[0].wins, 1);
});

function scoreWith(p0, p1, p2, threshold = 5) {
  const t = setup(3, { threshold });
  const { state, ctx } = t;
  setGrid(state, 'p0', p0);
  setGrid(state, 'p1', p1);
  setGrid(state, 'p2', p2);
  dispatch(state, 'p0', { type: 'CALL_GABO' }, ctx());
  for (const id of ['p1', 'p2']) {
    dispatch(state, id, { type: 'DRAW' }, ctx());
    state.round.turn.held = c('K', 'S', `ks-${id}`);
    dispatch(state, id, { type: 'DISCARD_HELD' }, ctx());
    closeSnap(t);
  }
  return state.round.results;
}

test("Gabo raté au-dessus de la limite : la plus basse des autres gagne", () => {
  const res = scoreWith([c('3'), c('3', 'H')], [c('9'), c('9', 'H')], [c('8'), c('8', 'H')]);
  assert.equal(res.success, false);
  assert.deepEqual(res.winners, ['p2']);
});

test("Gabo : en cas d'égalité, l'annonceuse perd toujours", () => {
  const res = scoreWith([c('2'), c('2', 'H')], [c('4')], [c('9'), c('9', 'H')]);
  assert.equal(res.success, false);
  assert.deepEqual(res.winners, ['p1']);
});

test('variante à 7 points', () => {
  const res = scoreWith([c('3'), c('4', 'H')], [c('9'), c('9', 'H')], [c('8'), c('8', 'H')], 7);
  assert.equal(res.success, true);
});

test('se débarrasser de toutes ses cartes arrête la manche aussitôt', () => {
  const { state, ctx } = setup(3);
  setGrid(state, 'p1', [null, c('7', 'H'), null, null]);
  state.round.drawPile.push(c('7', 'D'));
  dispatch(state, 'p0', { type: 'DRAW' }, ctx());
  dispatch(state, 'p0', { type: 'DISCARD_HELD' }, ctx());
  dispatch(state, 'p0', { type: 'SKIP_POWER' }, ctx());
  dispatch(state, 'p1', { type: 'SNAP', ownerId: 'p1', slot: 1 }, ctx());
  assert.equal(state.phase, 'roundEnd');
  assert.equal(state.round.results.announcer, 'p1');
  assert.equal(state.round.results.totals.p1, 0);
});

test('pioche vide : on remélange la défausse, sauf sa carte du dessus', () => {
  const { state, ctx } = setup(3);
  const r = state.round;
  r.discard.push(...r.drawPile.splice(0));
  const top = r.discard.at(-1);
  assert.equal(dispatch(state, 'p0', { type: 'DRAW' }, ctx()).ok, true);
  assert.equal(r.discard.length, 1);
  assert.equal(r.discard[0], top);
  assert.equal(allCards(state).length, 52);
});

test("parties complètes entre bots, de 2 à 8 : jamais de coup refusé, jamais de carte perdue", () => {
  const levels = Object.keys(BOT_LEVELS);
  for (let seed = 1; seed <= 60; seed++) {
    const n = 2 + (seed % 7);
    const rng = createRng(seed);
    const state = createGame('SIM', null);
    for (let i = 0; i < n; i++) {
      const level = levels[(seed + i) % levels.length];
      addPlayer(state, { id: `b${i}`, name: `Bot ${i}`, bot: level, memory: BOT_LEVELS[level].memory });
    }
    for (let roundNo = 0; roundNo < 2; roundNo++) {
      playRound(state, rng, {
        onStep: (id, action, res) => {
          if (action.type !== 'SNAP' && action.type !== 'PASS_SNAP') assert.equal(res.ok, true, res.error);
          if (state.round && state.phase !== 'roundEnd') assert.equal(allCards(state).length, 52);
        },
      });
      assert.equal(state.phase, 'roundEnd');
      assert.ok(state.round.results.winners.length >= 1);
    }
  }
});

test('un bot difficile gagne plus souvent qu’un bot facile', () => {
  const wins = { facile: 0, difficile: 0 };
  for (let seed = 1; seed <= 150; seed++) {
    const rng = createRng(seed * 31);
    const state = createGame('SIM', null);
    const seats = seed % 2 ? ['facile', 'difficile'] : ['difficile', 'facile'];
    seats.forEach((level, i) => addPlayer(state, { id: `b${i}`, name: level, bot: level, memory: BOT_LEVELS[level].memory }));
    playRound(state, rng);
    for (const w of state.round.results.winners) wins[state.players.find((p) => p.id === w).bot] += 1;
  }
  assert.ok(wins.difficile > wins.facile * 1.5, JSON.stringify(wins));
});

