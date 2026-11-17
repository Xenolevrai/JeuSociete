/**
 * Les joueuses artificielles des Sept Peuples.
 *
 * Même contrat que les bots du Monopoly : une fonction pure qui rend une
 * action, et cette action passe par `dispatch` comme celle d'une humaine.
 * Une règle de plus, propre à un jeu à information cachée : **un bot ne lit
 * que la vue de son poste** (`viewFor`). Il ignore donc la main des autres et
 * l'ordre de la pioche — il ne triche pas, et un test le vérifie.
 *
 * Le jugement est une petite simulation : on applique le pouvoir à un modèle
 * public de la table (peuples visibles, nombre de cartes en main) et l'on
 * regarde si l'écart avec la meneuse s'améliore.
 */
import { ELF_COPYABLE, RACES, raceOf } from '../../../shared/peuples.js';

export const BOT_LEVELS = ['facile', 'moyen', 'expert'];
export const BOT_LABELS = { facile: 'Bot facile', moyen: 'Bot moyen', expert: 'Bot expert' };

/** `noise` : bruit de jugement ; `random` : part de coups joués au hasard. */
const PROFILES = {
  facile: { noise: 1.5, random: 0.45 },
  moyen: { noise: 0.5, random: 0.12 },
  expert: { noise: 0, random: 0 },
};

/** Une carte en main vaut un peu moins qu'une carte posée : elle peut encore être volée. */
const HAND_WORTH = 0.55;
/** La part d'un pouvoir ciblé qui survit en moyenne à une fée adverse. */
const LANDS = 0.8;

function peopleValue(people, scoring) {
  if (scoring !== 'families') return people.length;
  const counts = RACES.map((r) => people.filter((id) => raceOf(id) === r).length);
  // Une famille se construit : le cinquième elfe vaut plus que le premier.
  return counts.reduce((sum, c) => sum + (c * c) / 4, 0) + people.length * 0.25;
}

function model(view) {
  return Object.fromEntries(
    view.players.map((p) => [p.id, { people: [...p.people], hand: p.handCount }]),
  );
}

/** Mon avance sur la meilleure adversaire, sur un modèle de table. */
function standing(table, meId, scoring) {
  const total = (s) => peopleValue(s.people, scoring) + s.hand * HAND_WORTH;
  const mine = total(table[meId]);
  const best = Math.max(...Object.entries(table).filter(([id]) => id !== meId).map(([, s]) => total(s)));
  return mine - best;
}

/** Ce qu'un pouvoir rapporterait, contre une cible donnée (et une carte, pour la dryade). */
function powerGain(view, meId, power, targetId, cardId) {
  const scoring = view.settings.scoring;
  const table = model(view);
  const before = standing(table, meId, scoring);
  const me = table[meId];
  const them = targetId ? table[targetId] : null;
  switch (power) {
    case 'gnome':
      me.hand += Math.min(2, view.deckCount);
      return standing(table, meId, scoring) - before;
    case 'korrigan': {
      const k = Math.min(2, them.hand);
      me.hand += k;
      them.hand -= k;
      break;
    }
    case 'lutin':
      [me.hand, them.hand] = [them.hand, me.hand];
      break;
    case 'farfadet':
      [me.people, them.people] = [them.people, me.people];
      break;
    case 'dryade':
      them.people.splice(them.people.indexOf(cardId), 1);
      me.people.push(cardId);
      break;
    default:
      return 0;
  }
  return (standing(table, meId, scoring) - before) * LANDS;
}

/** Le meilleur usage d'un pouvoir : sa valeur et la cible qui la donne. */
function bestUse(view, meId, power) {
  const others = view.players.filter((p) => p.id !== meId);
  let best = { value: power === 'gnome' ? powerGain(view, meId, 'gnome') : 0, targetId: null, cardId: null };
  if (power === 'gnome') return best;
  best = { value: -Infinity, targetId: null, cardId: null };
  for (const other of others) {
    if (power === 'korrigan' && !other.handCount) continue;
    if (power === 'dryade') {
      for (const race of new Set(other.people.map(raceOf))) {
        const cardId = other.people.find((id) => raceOf(id) === race);
        const value = powerGain(view, meId, power, other.id, cardId);
        if (value > best.value) best = { value, targetId: other.id, cardId };
      }
      continue;
    }
    const value = powerGain(view, meId, power, other.id);
    if (value > best.value) best = { value, targetId: other.id, cardId: null };
  }
  return best.targetId ? best : { value: 0, targetId: null, cardId: null };
}

/** Ce que rapporte de poser cette carte, pouvoir compris, vu d'avant la pose. */
function playValue(view, me, race) {
  // Le peuple après la pose : c'est sur lui qu'agissent farfadet et elfe.
  const posed = { ...view, players: view.players.map((p) => (p.id === me.id ? { ...p, people: [...p.people, `${race}-x`], handCount: p.handCount - 1 } : p)) };
  if (race === 'fee') {
    // Une fée posée à son tour ne fait rien ; gardée, elle protège.
    return -0.9;
  }
  if (race === 'elfe') {
    const races = [...new Set(me.people.map(raceOf).filter((r) => ELF_COPYABLE.has(r)))];
    return races.reduce((best, r) => Math.max(best, bestUse(posed, me.id, r).value), 0);
  }
  return bestUse(posed, me.id, race).value;
}

function jitter(rng, value, profile) {
  return value + (profile.noise ? (rng.next() - 0.5) * 2 * profile.noise : 0);
}

const pickRandom = (rng, list) => list[rng.int(list.length)];

/**
 * Le coup du bot pour l'invite en cours. `view` est la vue de SON poste.
 * Rend `null` si l'invite ne le concerne pas.
 */
export function decide(view, meId, rng, level = 'moyen') {
  const profile = PROFILES[level] ?? PROFILES.moyen;
  const pending = view.pending;
  if (!pending?.kind || !pending.playerIds.includes(meId)) return null;
  const me = view.players.find((p) => p.id === meId);
  const wild = rng.next() < profile.random;

  switch (pending.kind) {
    case 'play_card': {
      const races = [...new Set(me.hand.map(raceOf))];
      let race;
      if (wild) race = pickRandom(rng, races);
      else {
        let best = -Infinity;
        for (const r of races) {
          const value = jitter(rng, playValue(view, me, r), profile);
          if (value > best) [best, race] = [value, r];
        }
      }
      return { type: 'PLAY_CARD', cardId: me.hand.find((id) => raceOf(id) === race) };
    }

    case 'elf_copy': {
      const { races } = pending.payload;
      if (wild) return { type: 'ELF_COPY', race: pickRandom(rng, races) };
      let best = -Infinity;
      let race = races[0];
      for (const r of races) {
        const value = jitter(rng, bestUse(view, meId, r).value, profile);
        if (value > best) [best, race] = [value, r];
      }
      return { type: 'ELF_COPY', race };
    }

    case 'choose_target': {
      const { power, targets } = pending.payload;
      const use = bestUse(view, meId, power);
      if (!wild && use.targetId && targets.includes(use.targetId))
        return { type: 'CHOOSE_TARGET', targetId: use.targetId, cardId: use.cardId };
      const targetId = pickRandom(rng, targets);
      const target = view.players.find((p) => p.id === targetId);
      return { type: 'CHOOSE_TARGET', targetId, cardId: target.people.length ? pickRandom(rng, target.people) : null };
    }

    case 'counter': {
      const fairy = me.hand.find((id) => raceOf(id) === 'fee');
      if (!fairy) return { type: 'DECLINE_FAIRY' };
      const { power, attackerId, targetId, cardId, role } = pending.payload;
      // Le poids de l'effet pour moi : ce qu'il me coûte si je suis visée, ce
      // qu'il me rapporte si c'est moi qui l'ai lancé.
      const stakes =
        role === 'defend' ? -powerGain(view, attackerId, power, targetId, cardId) : powerGain(view, meId, power, targetId, cardId);
      // Une fée jouée hors tour grossit aussi son peuple : elle n'est jamais
      // tout à fait perdue. Le seuil reflète ce qu'on garde en la gardant.
      const play = wild ? rng.next() < 0.5 : jitter(rng, Math.abs(stakes), profile) > 0.6;
      return play ? { type: 'PLAY_FAIRY', cardId: fairy } : { type: 'DECLINE_FAIRY' };
    }

    case 'korrigan_pick': {
      const { handSize, count } = pending.payload;
      const positions = rng.shuffle(Array.from({ length: handSize }, (_, i) => i));
      return { type: 'PICK_BLIND', indices: positions.slice(0, count) };
    }

    default:
      return null;
  }
}
