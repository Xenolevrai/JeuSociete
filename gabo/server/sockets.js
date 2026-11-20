/**
 * Passerelle Socket.io ↔ moteur du Gabo, sur l'espace de noms `/gabo`.
 *
 * Deux différences avec la passerelle du Monopoly :
 *
 * 1. **Chaque connexion reçoit sa propre vue.** L'état complet contient toutes
 *    les cartes : on ne le diffuse jamais tel quel, on envoie à chaque socket
 *    `viewFor(state, sonJoueur)`.
 * 2. **Le temps compte.** La fenêtre de défausse rapide se ferme d'elle-même,
 *    une carte regardée se retourne après quelques secondes : une minuterie
 *    unique par table appelle `tick` à la prochaine échéance.
 *
 * Les bots — et le pilote automatique qui joue à la place d'une absente pour ne
 * pas bloquer la table — passent par `dispatch` comme tout le monde.
 */
import {
  addPlayer,
  removePlayer,
  setConnected,
  updateSettings,
  startRound,
  dispatch,
  tick,
  nextDeadline,
  viewFor,
  playerById,
  botTurnAction,
  botSnapPlan,
  BOT_LEVELS,
  DEFAULT_BOT_LEVEL,
  MAX_PLAYERS,
} from '../engine/index.js';
import { createRoom, getRoom, newPlayerId, scheduleSave } from './rooms.js';

const DEFAULTS = {
  /** Temps de réflexion d'un bot, par étape de tour. */
  botDelay: [700, 1400],
  /** Délai avant que le pilote automatique ne joue pour une absente. */
  autopilotMs: 10000,
};

const BOT_NAMES = ['Margot', 'Lucien', 'Odette', 'Gaston', 'Simone', 'Marcel', 'Josette', 'Raymond', 'Paulette', 'Fernand', 'Huguette', 'Armand'];

/** Ce qu'on se dit à table : quelques mots, pas des emojis. */
const REACTIONS = ['Bien joué', 'Aïe !', 'Bluff…', 'Vite !', 'Hmm…', 'Merci !', 'Oh non', 'Ha ha'];

export function registerGaboHandlers(nsp, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  /** Envoie à chaque socket de la table la vue qui lui revient. */
  async function broadcast(room) {
    const now = Date.now();
    const sockets = await nsp.in(room.state.code).fetchSockets();
    for (const s of sockets) s.emit('gabo:state', viewFor(room.state, s.data.playerId ?? null, now));
  }

  /** Après tout changement : diffuser, sauvegarder, programmer la suite. */
  function changed(room) {
    room.lastActivity = Date.now();
    broadcast(room).catch(() => {});
    scheduleSave(room);
    scheduleDeadline(room);
    scheduleTurn(room);
    scheduleSnaps(room);
  }

  function scheduleDeadline(room) {
    clearTimeout(room.deadlineTimer);
    room.deadlineTimer = null;
    const at = nextDeadline(room.state);
    if (at == null) return;
    room.deadlineTimer = setTimeout(() => {
      room.deadlineTimer = null;
      if (tick(room.state, { rng: room.rng, now: Date.now() })) changed(room);
      else scheduleDeadline(room);
    }, Math.max(0, at - Date.now()) + 15);
  }

  /** Une humaine au moins doit être là : on ne laisse pas les bots jouer dans une salle vide. */
  function someoneHere(state) {
    return state.players.some((p) => !p.bot && p.connected);
  }

  function scheduleTurn(room) {
    const { state } = room;
    const turn = state.round?.turn;
    const actor = turn ? playerById(state, turn.playerId) : null;
    const active = state.phase === 'playing' && turn && ['start', 'drawn', 'power'].includes(turn.stage);
    const limit = state.settings.turnSeconds * 1000;
    const automatic = actor && (actor.bot || !actor.connected || limit > 0);
    if (!active || !automatic || !someoneHere(state)) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
      room.turnKey = null;
      return;
    }
    const key = `${state.round.number}:${state.round.turnCount}:${turn.stage}:${actor.id}`;
    if (room.turnKey === key) return;
    clearTimeout(room.turnTimer);
    room.turnKey = key;
    const [lo, hi] = opts.botDelay;
    let delay = lo + Math.floor(Math.random() * (hi - lo));
    if (!actor.bot) {
      // Une absente garde un moment pour revenir avant qu'on joue à sa place ;
      // une présente a tout le temps que la table lui accorde.
      const deadline = actor.connected ? turn.startedAt + limit : turn.startedAt + Math.min(opts.autopilotMs, limit || Infinity);
      delay = Math.max(turn.stage === 'start' ? 0 : lo, deadline - Date.now());
    }
    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      room.turnKey = null;
      const current = room.state.round?.turn;
      if (!current || current.playerId !== actor.id) return changed(room);
      const action = botTurnAction(room.state, actor.id, room.rng);
      if (action) {
        const res = dispatch(room.state, actor.id, action, { rng: room.rng, now: Date.now() });
        if (!res.ok) console.error('[gabo] coup automatique refusé :', action, res.error);
      }
      changed(room);
    }, delay);
  }

  function scheduleSnaps(room) {
    const { state } = room;
    const snap = state.round?.snap;
    if (state.phase !== 'playing' || !snap || !someoneHere(state)) {
      for (const t of room.snapTimers.values()) clearTimeout(t);
      room.snapTimers.clear();
      return;
    }
    const prefix = `${state.round.number}:${snap.openedAt}:${snap.count}:`;
    for (const [key, t] of room.snapTimers) {
      if (!key.startsWith(prefix)) {
        clearTimeout(t);
        room.snapTimers.delete(key);
      }
    }
    for (const id of state.round.seats) {
      const p = playerById(state, id);
      if (!p?.bot) continue;
      const key = prefix + id;
      if (room.snapTimers.has(key)) continue;
      const plan = botSnapPlan(state, id, room.rng);
      if (!plan) continue;
      const base = snap.count === 0 ? snap.openedAt : Date.now();
      const wait = Math.max(50, base + plan.delay - Date.now());
      room.snapTimers.set(
        key,
        setTimeout(() => {
          if (!room.state.round?.snap) return;
          const res = dispatch(room.state, id, plan.action, { rng: room.rng, now: Date.now() });
          if (res.ok) changed(room);
        }, wait),
      );
    }
  }

  nsp.on('connection', (socket) => {
    const fail = (message) => socket.emit('gabo:error', { message });
    const ctx = (room) => ({ rng: room.rng, now: Date.now() });
    const currentRoom = () => (socket.data.code ? getRoom(socket.data.code) : null);

    const enter = (room, playerId) => {
      socket.data.code = room.state.code;
      socket.data.playerId = playerId;
      socket.join(room.state.code);
      setConnected(room.state, playerId, true, Date.now());
      socket.emit('gabo:joined', { code: room.state.code, playerId });
      changed(room);
    };

    socket.on('gabo:create', ({ name, settings } = {}) => {
      const id = newPlayerId();
      const room = createRoom(id, settings);
      const res = addPlayer(room.state, { id, name });
      if (!res.ok) return fail(res.error);
      enter(room, id);
    });

    socket.on('gabo:join', ({ code, name } = {}) => {
      const room = getRoom(code);
      if (!room) return fail('Aucune table ne porte ce code.');
      const pseudo = String(name ?? '').trim();
      if (!pseudo) return fail('Choisissez un pseudo.');
      // Revenir sous le même pseudo, c'est reprendre sa place (et ses cartes).
      const same = room.state.players.find((p) => !p.bot && p.name.toLowerCase() === pseudo.toLowerCase());
      if (same) return enter(room, same.id);
      if (room.state.players.length >= MAX_PLAYERS) return fail(`La table est pleine (${MAX_PLAYERS} places).`);
      const id = newPlayerId();
      const res = addPlayer(room.state, { id, name: pseudo });
      if (!res.ok) return fail(res.error);
      enter(room, id);
    });

    socket.on('gabo:rejoin', ({ code, playerId } = {}) => {
      const room = getRoom(code);
      if (!room) return socket.emit('gabo:gone', { message: "Cette table n'existe plus." });
      const player = playerById(room.state, playerId);
      if (!player || player.bot) return socket.emit('gabo:gone', { message: "Votre place à cette table n'existe plus." });
      enter(room, playerId);
    });

    socket.on('gabo:add-bot', ({ level } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes à aucune table.");
      const { state } = room;
      if (socket.data.playerId !== state.hostId) return fail("Seul l'hôte ajoute des bots.");
      if (state.phase === 'peek' || state.phase === 'playing') return fail('Attendez la fin de la manche.');
      const lvl = BOT_LEVELS[level] ? level : DEFAULT_BOT_LEVEL;
      // Un prénom, comme autour d'une vraie table ; la pastille creuse et la
      // liste des joueuses disent qu'il s'agit d'un bot, et de quel niveau.
      const taken = new Set(state.players.map((p) => p.name.toLowerCase()));
      const free = BOT_NAMES.filter((n) => !taken.has(n.toLowerCase()));
      let botName = free.length ? free[Math.floor(Math.random() * free.length)] : BOT_LEVELS[lvl].label;
      for (let n = 2; taken.has(botName.toLowerCase()); n++) botName = `${BOT_LEVELS[lvl].label} ${n}`;
      const res = addPlayer(state, { id: newPlayerId(), name: botName, bot: lvl, memory: BOT_LEVELS[lvl].memory });
      if (!res.ok) return fail(res.error);
      changed(room);
    });

    socket.on('gabo:remove', ({ playerId } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes à aucune table.");
      const { state } = room;
      const self = playerId === socket.data.playerId;
      if (!self && socket.data.playerId !== state.hostId) return fail("Seul l'hôte peut retirer quelqu'un.");
      const target = playerById(state, playerId);
      if (!target) return fail('Joueuse inconnue.');
      if (!self && !target.bot && target.connected) return fail('On ne retire pas une personne présente : elle peut partir elle-même.');
      const res = removePlayer(state, playerId);
      if (!res.ok) return fail(res.error);
      changed(room);
    });

    socket.on('gabo:settings', ({ settings } = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes à aucune table.");
      const res = updateSettings(room.state, socket.data.playerId, settings ?? {});
      if (!res.ok) return fail(res.error);
      changed(room);
    });

    socket.on('gabo:start', () => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes à aucune table.");
      const res = startRound(room.state, socket.data.playerId, ctx(room));
      if (!res.ok) return fail(res.error);
      changed(room);
    });

    socket.on('gabo:action', (action = {}) => {
      const room = currentRoom();
      if (!room) return fail("Vous n'êtes à aucune table.");
      const res = dispatch(room.state, socket.data.playerId, action, ctx(room));
      if (!res.ok) {
        // Le cas le plus fréquent n'est pas une erreur mais une course perdue à
        // la défausse : on le dit, sans renvoyer d'état (rien n'a changé).
        return fail(res.error);
      }
      changed(room);
    });

    socket.on('gabo:react', ({ text } = {}) => {
      const room = currentRoom();
      if (!room || !REACTIONS.includes(text)) return;
      // Éphémère : pas d'état, pas de sauvegarde, juste une bulle au-dessus du siège.
      nsp.to(room.state.code).emit('gabo:reaction', { playerId: socket.data.playerId, text, at: Date.now() });
    });

    // « Presser » : un petit signal envoyé à celle qui tarde, comme on tapote
    // la table. Limité à un toutes les dix secondes pour rester amical.
    socket.on('gabo:nudge', ({ playerId } = {}) => {
      const room = currentRoom();
      if (!room || !playerById(room.state, playerId)) return;
      const now = Date.now();
      if (now - (socket.data.lastNudge ?? 0) < 10000) return fail('Patience : une relance toutes les dix secondes.');
      socket.data.lastNudge = now;
      const from = playerById(room.state, socket.data.playerId)?.name ?? '?';
      nsp.to(room.state.code).emit('gabo:nudged', { playerId, from });
    });

    socket.on('gabo:leave', () => {
      const room = currentRoom();
      if (!room) return;
      const id = socket.data.playerId;
      socket.leave(room.state.code);
      socket.data.code = null;
      socket.data.playerId = null;
      // Partir pour de bon n'est possible qu'hors d'une manche ; sinon on
      // devient simplement absente, et le pilote automatique tient la place.
      if (removePlayer(room.state, id).ok === false) setConnected(room.state, id, false, Date.now());
      changed(room);
    });

    socket.on('disconnect', async () => {
      const room = currentRoom();
      const id = socket.data.playerId;
      if (!room || !id) return;
      // La même personne peut avoir deux onglets ouverts : elle n'est absente
      // que lorsque le dernier se ferme.
      const others = await nsp.in(room.state.code).fetchSockets();
      if (others.some((s) => s.id !== socket.id && s.data.playerId === id)) return;
      if (!playerById(room.state, id)) return;
      setConnected(room.state, id, false, Date.now());
      changed(room);
    });
  });

  return { changed };
}

