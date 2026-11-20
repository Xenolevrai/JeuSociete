/**
 * Joue une manche entière entre bots, en temps simulé.
 *
 * Sert aux tests et à la mesure : c'est le même enchaînement que celui du
 * serveur (tour, fenêtre de défausse, échéances), sans réseau ni horloge.
 */
import { dispatch, tick, nextDeadline, startRound } from './game.js';
import { botTurnAction, botSnapPlan } from './bot.js';

export function playRound(state, rng, { now = 0, maxSteps = 5000, onStep } = {}) {
  const res = startRound(state, state.hostId, { rng, now });
  if (!res.ok) throw new Error(res.error);
  let steps = 0;
  while (state.phase === 'peek' || state.phase === 'playing') {
    if (++steps > maxSteps) throw new Error('manche bloquée');
    now += 100;
    if (state.phase === 'peek') {
      for (const id of state.round.seats) {
        if (!state.round.ready.includes(id)) dispatch(state, id, { type: 'READY' }, { rng, now });
      }
      continue;
    }
    const round = state.round;
    if (round.snap) {
      // Toutes les décisions de la fenêtre, jouées dans l'ordre de leur délai.
      const plans = round.seats
        .map((id) => ({ id, plan: botSnapPlan(state, id, rng) }))
        .filter((x) => x.plan)
        .sort((a, b) => a.plan.delay - b.plan.delay);
      if (!plans.length) {
        now = Math.max(now, nextDeadline(state) ?? now);
        tick(state, { rng, now });
        continue;
      }
      const { id, plan } = plans[0];
      const at = round.snap.openedAt + plan.delay;
      if (at >= round.snap.until) {
        now = round.snap.until;
        tick(state, { rng, now });
        continue;
      }
      now = Math.max(now, at);
      const r = dispatch(state, id, plan.action, { rng, now });
      onStep?.(id, plan.action, r);
      continue;
    }
    const actor = round.turn.playerId;
    const action = botTurnAction(state, actor, rng);
    if (!action) throw new Error(`bot sans action à l'étape ${round.turn.stage}`);
    const r = dispatch(state, actor, action, { rng, now });
    onStep?.(actor, action, r);
    if (!r.ok) throw new Error(`coup refusé : ${JSON.stringify(action)} → ${r.error}`);
    tick(state, { rng, now });
  }
  return now;
}
