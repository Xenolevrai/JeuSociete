/**
 * Les Sept Peuples : distribution, pouvoirs, chaîne de fées, fin de partie,
 * variantes, et surtout l'information cachée — la seule vraie nouveauté par
 * rapport au Monopoly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame,
  addPlayer,
  startGame,
  dispatch,
  viewFor,
  playerById,
  standings,
  turnDrawCount,
} from '../server/games/peuples/engine.js';
import { decide } from '../server/games/peuples/bots.js';
import { createRng } from '../server/engine/rng.js';
import { fullDeck, raceOf, compareFamilies, RACES } from '../shared/peuples.js';

/** Une table lancée, puis remise dans un état choisi carte par carte. */
function table(names = ['Ana', 'Bea'], { seed = 7, settings = {}, hands, people, deck, first = 0 } = {}) {
  const game = createGame('PEUPLE', 'p0', { seed, settings });
  names.forEach((name, i) => addPlayer(game, { id: `p${i}`, name }));
  assert.equal(startGame(game, 'p0').ok, true);
  const { state } = game;
  if (hands || people || deck) {
    state.players.forEach((p, i) => {
      if (hands) p.hand = [...(hands[i] ?? [])];
      if (people) p.people = [...(people[i] ?? [])];
    });
    if (deck) state.deck = [...deck];
    state.currentIndex = first;
    state.pending = { kind: 'play_card', playerIds: [`p${first}`], payload: null };
  }
  return game;
}

const ok = (game, playerId, action) => {
  const result = dispatch(game, playerId, action);
  assert.equal(result.ok, true, result.error);
};

test('56 cartes : sept peuples de huit', () => {
  const deck = fullDeck();
  assert.equal(deck.length, 56);
  assert.equal(new Set(deck).size, 56);
  for (const race of RACES) assert.equal(deck.filter((id) => raceOf(id) === race).length, 8);
});

test('la distribution donne 5 cartes chacune, la première joueuse pioche', () => {
  const game = table(['Ana', 'Bea', 'Cal']);
  const { state } = game;
  const first = state.players[state.currentIndex];
  for (const p of state.players) assert.equal(p.hand.length, p === first ? 6 : 5);
  assert.equal(state.deck.length, 56 - 15 - 1);
  assert.equal(state.pending.kind, 'play_card');
  // Rien ne se perd ni ne se crée.
  const all = [...state.deck, ...state.players.flatMap((p) => p.hand)];
  assert.deepEqual([...all].sort(), fullDeck().sort());
});

test('la vue d’un poste cache les mains des autres et la pioche', () => {
  const game = table(['Ana', 'Bea']);
  const view = viewFor(game.state, ['p0']);
  assert.ok(Array.isArray(view.players[0].hand));
  assert.equal(view.players[1].hand, null);
  assert.equal(view.players[1].handCount, game.state.players[1].hand.length);
  assert.equal(view.deck, undefined);
  assert.equal(view.deckCount, game.state.deck.length);
  const json = JSON.stringify(view);
  for (const id of game.state.players[1].hand) assert.ok(!json.includes(`"${id}"`), `${id} fuit dans la vue`);
});

test('poser une carte la met dans son peuple et passe la main', () => {
  const game = table(['Ana', 'Bea'], { hands: [['fee-1', 'gnome-1'], ['elfe-1']], deck: ['lutin-1', 'lutin-2'] });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'fee-1' });
  const [ana, bea] = game.state.players;
  assert.deepEqual(ana.people, ['fee-1']);
  assert.deepEqual(ana.hand, ['gnome-1']);
  assert.equal(game.state.pending.playerIds[0], 'p1');
  assert.deepEqual(bea.hand, ['elfe-1', 'lutin-1']);
});

test('on ne joue pas hors de son tour', () => {
  const game = table(['Ana', 'Bea'], { hands: [['fee-1'], ['gnome-1']], deck: [] });
  assert.equal(dispatch(game, 'p1', { type: 'PLAY_CARD', cardId: 'gnome-1' }).ok, false);
});

test('le gnome pioche deux cartes', () => {
  const game = table(['Ana', 'Bea'], { hands: [['gnome-1'], ['fee-1']], deck: ['elfe-1', 'elfe-2', 'elfe-3'] });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'gnome-1' });
  assert.deepEqual(game.state.players[0].hand, ['elfe-1', 'elfe-2']);
});

test('korrigan : la cible est TOUJOURS interrogée, même sans fée', () => {
  const game = table(['Ana', 'Bea'], { hands: [['korrigan-1'], ['gnome-1', 'gnome-2', 'lutin-1']], deck: ['x-1'] });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'korrigan-1' });
  assert.equal(game.state.pending.kind, 'counter');
  assert.deepEqual(game.state.pending.playerIds, ['p1']);
  ok(game, 'p1', { type: 'DECLINE_FAIRY' });
  assert.equal(game.state.pending.kind, 'korrigan_pick');
  // La victime ne peut plus réordonner pendant que le korrigan choisit.
  assert.equal(dispatch(game, 'p1', { type: 'SHUFFLE_HAND' }).ok, false);
  ok(game, 'p0', { type: 'PICK_BLIND', indices: [0, 2] });
  assert.deepEqual(game.state.players[0].hand.sort(), ['gnome-1', 'lutin-1'].sort());
  assert.deepEqual(game.state.players[1].hand.slice(0, 1), ['gnome-2']);
});

test('korrigan : seuls la voleuse et la victime voient les cartes volées', () => {
  const game = table(['Ana', 'Bea', 'Cal'], {
    hands: [['korrigan-1'], ['dryade-1', 'dryade-2'], ['gnome-1']],
    deck: ['x-1', 'x-2'],
  });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'korrigan-1' });
  ok(game, 'p0', { type: 'CHOOSE_TARGET', targetId: 'p1' });
  ok(game, 'p1', { type: 'DECLINE_FAIRY' });
  ok(game, 'p0', { type: 'PICK_BLIND', indices: [0, 1] });
  const last = (ids) => viewFor(game.state, ids).log.filter((e) => e.type === 'power').at(-1).text;
  assert.match(last(['p0']), /dryade/);
  assert.match(last(['p1']), /dryade/);
  assert.doesNotMatch(last(['p2']), /dryade/);
  assert.equal(JSON.stringify(viewFor(game.state, ['p2'])).includes('secret'), false);
});

test('on peut réordonner et mélanger sa main à tout moment', () => {
  const game = table(['Ana', 'Bea'], { hands: [['fee-1'], ['gnome-1', 'lutin-1', 'elfe-1']], deck: [] });
  ok(game, 'p1', { type: 'REORDER_HAND', order: ['elfe-1', 'gnome-1', 'lutin-1'] });
  assert.deepEqual(game.state.players[1].hand, ['elfe-1', 'gnome-1', 'lutin-1']);
  assert.equal(dispatch(game, 'p1', { type: 'REORDER_HAND', order: ['elfe-1', 'gnome-1', 'fee-1'] }).ok, false);
  ok(game, 'p1', { type: 'SHUFFLE_HAND' });
  assert.deepEqual([...game.state.players[1].hand].sort(), ['elfe-1', 'gnome-1', 'lutin-1']);
});

test('la fée annule ; une fée contre la fée rétablit ; une troisième annule encore', () => {
  const setup = () =>
    table(['Ana', 'Bea'], {
      hands: [['dryade-1', 'fee-1'], ['fee-2', 'fee-3']],
      people: [[], ['gnome-1']],
      deck: ['x-1', 'x-2'],
    });

  // Une fée : annulé.
  let game = setup();
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'dryade-1' });
  ok(game, 'p0', { type: 'CHOOSE_TARGET', targetId: 'p1', cardId: 'gnome-1' });
  ok(game, 'p1', { type: 'PLAY_FAIRY' });
  assert.deepEqual(game.state.pending.playerIds, ['p0'], "l'attaquante peut contrer");
  ok(game, 'p0', { type: 'DECLINE_FAIRY' });
  assert.deepEqual(game.state.players[1].people.sort(), ['fee-2', 'gnome-1']);
  assert.deepEqual(game.state.players[0].people, ['dryade-1']);

  // Deux fées : l'effet passe.
  game = setup();
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'dryade-1' });
  ok(game, 'p0', { type: 'CHOOSE_TARGET', targetId: 'p1', cardId: 'gnome-1' });
  ok(game, 'p1', { type: 'PLAY_FAIRY' });
  ok(game, 'p0', { type: 'PLAY_FAIRY' });
  ok(game, 'p1', { type: 'DECLINE_FAIRY' });
  assert.ok(game.state.players[0].people.includes('gnome-1'));
  assert.ok(game.state.players[0].people.includes('fee-1'), 'la fée jouée rejoint le peuple');

  // Trois fées : annulé de nouveau.
  game = setup();
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'dryade-1' });
  ok(game, 'p0', { type: 'CHOOSE_TARGET', targetId: 'p1', cardId: 'gnome-1' });
  ok(game, 'p1', { type: 'PLAY_FAIRY' });
  ok(game, 'p0', { type: 'PLAY_FAIRY' });
  ok(game, 'p1', { type: 'PLAY_FAIRY' });
  ok(game, 'p0', { type: 'DECLINE_FAIRY' });
  assert.ok(game.state.players[1].people.includes('gnome-1'));
});

test('jouer une fée sans en avoir est refusé', () => {
  const game = table(['Ana', 'Bea'], { hands: [['lutin-1'], ['gnome-1']], deck: ['x-1'] });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'lutin-1' });
  assert.equal(dispatch(game, 'p1', { type: 'PLAY_FAIRY' }).ok, false);
});

test('lutin échange les mains, farfadet échange les peuples (lui compris)', () => {
  let game = table(['Ana', 'Bea'], { hands: [['lutin-1', 'elfe-1'], ['gnome-1', 'gnome-2', 'gnome-3']], deck: ['x-1'] });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'lutin-1' });
  ok(game, 'p1', { type: 'DECLINE_FAIRY' });
  assert.deepEqual(game.state.players[0].hand, ['gnome-1', 'gnome-2', 'gnome-3']);

  game = table(['Ana', 'Bea'], {
    hands: [['farfadet-1'], ['fee-1']],
    people: [['elfe-1'], ['gnome-1', 'gnome-2', 'gnome-3']],
    deck: ['x-1'],
  });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'farfadet-1' });
  ok(game, 'p1', { type: 'DECLINE_FAIRY' });
  assert.deepEqual(game.state.players[0].people, ['gnome-1', 'gnome-2', 'gnome-3']);
  assert.deepEqual(game.state.players[1].people, ['elfe-1', 'farfadet-1']);
});

test('l’elfe réutilise un pouvoir de son peuple, jamais une fée ni un elfe', () => {
  const game = table(['Ana', 'Bea'], {
    hands: [['elfe-1'], ['fee-1']],
    people: [['gnome-1', 'fee-2', 'elfe-2'], []],
    deck: ['x-1', 'x-2', 'x-3'],
  });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'elfe-1' });
  assert.equal(game.state.pending.kind, 'elf_copy');
  assert.deepEqual(game.state.pending.payload.races, ['gnome']);
  assert.equal(dispatch(game, 'p0', { type: 'ELF_COPY', race: 'fee' }).ok, false);
  ok(game, 'p0', { type: 'ELF_COPY', race: 'gnome' });
  assert.deepEqual(game.state.players[0].hand, ['x-1', 'x-2']);
});

test('un pouvoir impossible ne fait rien', () => {
  const game = table(['Ana', 'Bea'], { hands: [['dryade-1'], ['fee-1']], people: [[], []], deck: ['x-1'] });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'dryade-1' });
  assert.equal(game.state.pending.kind, 'play_card');
  assert.deepEqual(game.state.pending.playerIds, ['p1']);
});

test('fin de partie : pioche vide, une main se vide, on finit le tour de table', () => {
  const game = table(['Ana', 'Bea', 'Cal'], {
    hands: [['gnome-1'], ['gnome-2', 'gnome-3'], ['gnome-4', 'gnome-5']],
    deck: [],
    first: 0,
  });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'gnome-1' });
  assert.ok(game.state.finalRound, 'Ana a posé sa dernière carte');
  ok(game, 'p1', { type: 'PLAY_CARD', cardId: 'gnome-2' });
  ok(game, 'p2', { type: 'PLAY_CARD', cardId: 'gnome-4' });
  assert.equal(game.state.phase, 'finished', 'Cal, à la droite d’Ana, a fini le tour');
  // Chacune a posé une carte : égalité parfaite.
  assert.deepEqual(game.state.result.winnerIds.sort(), ['p0', 'p1', 'p2']);
});

test('décompte : le plus grand peuple, ou les familles', () => {
  const families = ['fee-1', 'fee-2', 'fee-3', 'fee-4', 'fee-5', 'fee-6', 'fee-7', 'fee-8', 'gnome-1'];
  const many = ['elfe-1', 'elfe-2', 'gnome-2', 'gnome-3', 'lutin-1', 'lutin-2', 'dryade-1', 'dryade-2', 'korrigan-1', 'korrigan-2'];
  const make = (scoring) => {
    const game = table(['Ana', 'Bea'], { settings: { scoring }, people: [families, many], hands: [[], []], deck: [] });
    return standings(game.state);
  };
  assert.equal(make('people')[0].playerId, 'p1', '10 individus battent 9');
  assert.equal(make('families')[0].playerId, 'p0', 'une famille complète bat cinq paires');
  // Égalité sur la plus grande famille : on regarde la suivante.
  assert.ok(compareFamilies(['fee-1', 'fee-2', 'gnome-1', 'gnome-2'], ['fee-3', 'fee-4', 'gnome-3', 'elfe-1']) > 0);
  assert.equal(compareFamilies(['fee-1', 'gnome-1'], ['elfe-1', 'lutin-1']), 0);
});

test('variantes : main plafonnée et main complétée à 6', () => {
  const game = table(['Ana', 'Bea'], { settings: { handCap: true, refill: true } });
  const player = game.state.players[0];
  player.hand = ['a', 'b', 'c'];
  assert.equal(turnDrawCount(game.state, player), 3);
  player.hand = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(turnDrawCount(game.state, player), 0);
  game.state.settings = { handCap: false, refill: false, scoring: 'people' };
  assert.equal(turnDrawCount(game.state, player), 1);
});

test('le gnome ne fait pas dépasser 7 cartes avec la main plafonnée', () => {
  const game = table(['Ana', 'Bea'], {
    settings: { handCap: true },
    hands: [['gnome-1', 'a-1', 'a-2', 'a-3', 'a-4', 'a-5', 'a-6'], ['fee-1']],
    deck: ['x-1', 'x-2', 'x-3'],
  });
  ok(game, 'p0', { type: 'PLAY_CARD', cardId: 'gnome-1' });
  assert.equal(game.state.players[0].hand.length, 7);
});

test('des parties entières entre bots se terminent, sans tricher et sans perdre de carte', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const names = ['A', 'B', 'C', 'D'].slice(0, 2 + (seed % 3));
    const levels = ['facile', 'moyen', 'expert'];
    const game = createGame('BOTS', 'p0', {
      seed,
      settings: { scoring: seed % 2 ? 'families' : 'people', handCap: seed % 4 === 0, refill: seed % 5 === 0 },
    });
    names.forEach((name, i) => addPlayer(game, { id: `p${i}`, name, bot: levels[i % 3] }));
    startGame(game, 'p0');
    const rng = createRng(seed);
    let steps = 0;
    while (game.state.phase === 'playing') {
      assert.ok(++steps < 2000, `partie ${seed} interminable`);
      const id = game.state.pending.playerIds[0];
      const view = viewFor(game.state, [id]);
      // Le bot ne reçoit que sa vue : la main des autres y est absente.
      assert.ok(view.players.every((p) => p.id === id || p.hand === null));
      const action = decide(view, id, rng, playerById(game.state, id).bot);
      const result = dispatch(game, id, action);
      assert.equal(result.ok, true, `${seed}: ${result.error} (${JSON.stringify(action)})`);
      const cards = [...game.state.deck, ...game.state.players.flatMap((p) => [...p.hand, ...p.people])];
      assert.equal(cards.length, 56);
    }
    assert.ok(game.state.result.winnerIds.length >= 1);
  }
});

test('l’expert bat le bot facile plus souvent qu’à son tour', () => {
  let wins = 0;
  const N = 120;
  for (let seed = 1; seed <= N; seed++) {
    const game = createGame('DUEL', 'p0', { seed });
    // On alterne les sièges : commencer ne doit pas fausser la mesure.
    const seats = seed % 2 ? ['expert', 'facile'] : ['facile', 'expert'];
    seats.forEach((level, i) => addPlayer(game, { id: `p${i}`, name: level, bot: level }));
    startGame(game, 'p0');
    const rng = createRng(seed * 13);
    while (game.state.phase === 'playing') {
      const id = game.state.pending.playerIds[0];
      dispatch(game, id, decide(viewFor(game.state, [id]), id, rng, playerById(game.state, id).bot));
    }
    const expertId = `p${seats.indexOf('expert')}`;
    if (game.state.result.winnerIds.length === 1 && game.state.result.winnerIds[0] === expertId) wins += 1;
  }
  assert.ok(wins / N > 0.55, `expert : ${wins}/${N}`);
});
