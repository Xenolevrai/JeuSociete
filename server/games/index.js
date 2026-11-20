/**
 * Le catalogue des jeux de la ludothèque.
 *
 * Les sockets, le registre des parties et la sauvegarde ne connaissent aucune
 * règle : ils demandent ici le moteur de la partie en cours et lui passent la
 * main. Chaque jeu présente la même forme — créer, accueillir, lancer,
 * dispatcher, et dire **ce que chaque poste a le droit de voir** (`viewFor`).
 * Ajouter un jeu, c'est ajouter une entrée ici, sans toucher aux sockets.
 */
import * as monopoly from '../engine/index.js';
import { scheduleBots as monopolyBots, stopBots as stopMonopolyBots } from '../bots/runner.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, PROFILES } from '../bots/profiles.js';
import { archiveGame } from '../archive.js';
import { DEFAULT_EDITION } from '../../shared/index.js';
import * as peuples from './peuples/index.js';

export const GAMES = {
  monopoly: {
    id: 'monopoly',
    createGame: (code, hostId, { editionId, locale, extensionIds }) =>
      monopoly.createGame(code, hostId, { editionId: editionId ?? DEFAULT_EDITION, locale, extensionIds }),
    addPlayer: monopoly.addPlayer,
    removePlayer: monopoly.removePlayer,
    reconnectPlayer: monopoly.reconnectPlayer,
    startGame: monopoly.startGame,
    endGame: monopoly.endGame,
    updateSettings: monopoly.updateSettings,
    dispatch: monopoly.dispatch,
    playerById: monopoly.playerById,
    // Tout est public au Monopoly : une seule vue pour toute la salle.
    privateViews: false,
    viewFor: (state) => monopoly.publicState(state),
    scheduleBots: monopolyBots,
    stopBots: stopMonopolyBots,
    onFinished: archiveGame,
    botLevel: (level) => (DIFFICULTIES.includes(level) ? level : DEFAULT_DIFFICULTY),
    botLabel: (level) => PROFILES[level].label,
  },
  peuples: {
    id: 'peuples',
    createGame: (code, hostId, { locale, settings }) => peuples.createGame(code, hostId, { locale, settings }),
    addPlayer: peuples.addPlayer,
    removePlayer: peuples.removePlayer,
    reconnectPlayer: peuples.reconnectPlayer,
    startGame: peuples.startGame,
    endGame: peuples.endGame,
    updateSettings: peuples.updateSettings,
    dispatch: peuples.dispatch,
    playerById: peuples.playerById,
    // Les mains sont secrètes : chaque poste reçoit sa propre vue.
    privateViews: true,
    viewFor: peuples.viewFor,
    scheduleBots: peuples.scheduleBots,
    stopBots: peuples.stopBots,
    onFinished: () => {},
    botLevel: (level) => (peuples.BOT_LEVELS.includes(level) ? level : 'moyen'),
    botLabel: (level) => peuples.BOT_LABELS[level],
  },
};

/** Les parties sauvegardées avant la ludothèque n'ont pas de champ `game` : ce sont des Monopoly. */
export function gameIdOf(state) {
  return state?.game && GAMES[state.game] ? state.game : 'monopoly';
}

export function engineOf(state) {
  return GAMES[gameIdOf(state)];
}
