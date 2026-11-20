/**
 * Les Sept Peuples vus du serveur : le moteur, la vue par poste, et le rythme
 * des bots. C'est l'interface que `server/games/index.js` présente aux
 * sockets — la même forme que celle du Monopoly.
 */
import * as engine from './engine.js';
import { decide, BOT_LEVELS, BOT_LABELS } from './bots.js';
import { createRng } from '../../engine/rng.js';

export { BOT_LEVELS, BOT_LABELS };

/** Le temps de réflexion affiché. Une fée ne doit pas se trahir par la vitesse de la réponse. */
const DELAYS = { play_card: 1300, elf_copy: 1000, choose_target: 1000, counter: 1400, korrigan_pick: 1100 };

const timers = new Map();
const generators = new Map();

function rngFor(code) {
  if (!generators.has(code)) generators.set(code, createRng(Date.now() ^ code.length * 7919));
  return generators.get(code);
}

function botToPlay(state) {
  const pending = state.pending;
  if (!pending?.kind) return null;
  return pending.playerIds.map((id) => engine.playerById(state, id)).find((p) => p?.bot) ?? null;
}

export function scheduleBots(room, onPlayed) {
  const code = room.state.code;
  clearTimeout(timers.get(code));
  timers.delete(code);
  if (room.state.phase !== 'playing') return;
  const player = botToPlay(room.state);
  if (!player) return;

  const timer = setTimeout(() => {
    timers.delete(code);
    if (room.state.phase !== 'playing' || !room.state.pending.playerIds.includes(player.id)) return;
    // Le bot ne voit que ce que verrait une joueuse assise à sa place.
    const view = engine.viewFor(room.state, [player.id]);
    const action = decide(view, player.id, rngFor(code), player.bot);
    if (action) {
      const result = engine.dispatch(room, player.id, action);
      // Un refus ne doit jamais figer la table : on retombe sur le geste neutre.
      if (!result.ok && room.state.pending.kind === 'counter') engine.dispatch(room, player.id, { type: 'DECLINE_FAIRY' });
      onPlayed?.(room);
    }
    scheduleBots(room, onPlayed);
  }, DELAYS[room.state.pending.kind] ?? 1000);
  timers.set(code, timer);
}

export function stopBots(code) {
  clearTimeout(timers.get(code));
  timers.delete(code);
  generators.delete(code);
}

export const {
  createGame,
  addPlayer,
  removePlayer,
  reconnectPlayer,
  startGame,
  endGame,
  updateSettings,
  dispatch,
  playerById,
  viewFor,
} = engine;
