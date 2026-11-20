/**
 * Ce qu'une joueuse a le droit de voir.
 *
 * C'est la seule porte de sortie de l'état vers un navigateur. Règle d'or :
 * une carte cachée part sous la forme `{ down: true }`, sans rang, sans
 * couleur, sans identifiant. Même un client modifié ne peut donc pas tricher —
 * il n'a littéralement pas l'information.
 *
 * Une carte est montrée à `viewerId` si :
 *  - elle est dans un « dévoilement » qui lui est adressé (coup d'œil, pouvoir)
 *    ou adressé à toute la table (défausse ratée), et pas encore échu ;
 *  - la manche est terminée (tout le monde retourne ses cartes) ;
 *  - l'aide-mémoire est activée et elle l'a déjà vue.
 */
import { cardValue } from './cards.js';
import { playerById, publicCard as toPublic } from './game.js';

export function viewFor(state, viewerId, now) {
  const round = state.round;
  const me = playerById(state, viewerId);
  return {
    code: state.code,
    version: state.version,
    phase: state.phase,
    hostId: state.hostId,
    you: me ? me.id : null,
    settings: state.settings,
    roundNumber: state.roundNumber,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      avatar: p.avatar,
      connected: p.connected,
      wins: p.wins,
      points: p.points,
      roundsPlayed: p.roundsPlayed,
      seated: Boolean(round?.seats.includes(p.id)),
      ready: Boolean(round?.ready.includes(p.id)),
    })),
    round: round ? roundView(state, viewerId, now) : null,
    history: state.history,
    log: state.log.slice(-80),
  };
}

function roundView(state, viewerId, now) {
  const round = state.round;
  const finished = state.phase === 'roundEnd';

  // Les emplacements visibles pour cette joueuse, et pour combien de temps.
  const visible = new Map();
  const reveals = [];
  for (const r of round.reveals) {
    if (r.to !== null && r.to !== viewerId) continue;
    if (r.until != null && r.until <= now) continue;
    const remainingMs = r.until == null ? null : r.until - now;
    for (const { ownerId, slot } of r.items) {
      const key = `${ownerId}:${slot}`;
      visible.set(key, { reason: r.reason, remainingMs });
    }
    reveals.push({ id: r.id, reason: r.reason, public: r.to === null, items: r.items, remainingMs });
  }
  const seen = new Set(state.settings.memoryAid ? round.seen[viewerId] ?? [] : []);

  const grids = {};
  for (const id of round.seats) {
    grids[id] = round.grids[id].map((card, slot) => {
      if (!card) return null;
      const shown = visible.get(`${id}:${slot}`);
      if (finished) return { ...toPublic(card), value: cardValue(card) };
      if (shown) return { ...toPublic(card), shown: shown.reason, remainingMs: shown.remainingMs };
      if (seen.has(card.id)) return { ...toPublic(card), memo: true };
      return { down: true };
    });
  }

  const turn = round.turn;
  const isMyTurn = turn?.playerId === viewerId;
  const top = round.discard.at(-1) ?? null;
  const snap = round.snap;

  return {
    number: round.number,
    seats: round.seats,
    dealerId: round.dealerId,
    grids,
    drawCount: round.drawPile.length,
    discardCount: round.discard.length,
    discardTop: top ? { ...toPublic(top), value: cardValue(top) } : null,
    // La carte en dessous, pour l'effet de pile — elle a été vue de toutes.
    discardUnder: round.discard.length > 1 ? toPublic(round.discard.at(-2)) : null,
    turn: turn
      ? {
          playerId: turn.playerId,
          stage: turn.stage,
          power: turn.power,
          // La carte piochée n'est vue que de celle qui la tient.
          // Le temps qui reste avant que le tour ne se joue tout seul (si la table l'a voulu).
          remainingMs: state.settings.turnSeconds ? Math.max(0, turn.startedAt + state.settings.turnSeconds * 1000 - now) : null,
          held: turn.held ? (isMyTurn ? { ...toPublic(turn.held), value: cardValue(turn.held) } : { down: true }) : null,
        }
      : null,
    snap: snap
      ? {
          card: snap.card,
          discarderId: snap.discarderId,
          claimedBy: snap.claimedBy,
          count: snap.count,
          remainingMs: Math.max(0, snap.until - now),
          totalMs: snap.until - snap.openedAt,
          passed: snap.passed.includes(viewerId),
          canSnap: round.seats.includes(viewerId) && viewerId !== snap.discarderId &&
            (!snap.claimedBy || snap.claimedBy === viewerId),
        }
      : null,
    gabo: round.gabo,
    ready: round.ready,
    reveals,
    results: round.results,
  };
}
