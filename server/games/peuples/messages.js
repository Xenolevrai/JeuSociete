/**
 * Les phrases du journal des Sept Peuples, en français et en anglais.
 * Une fonction par clé : la langue ne change que les mots, jamais la règle.
 */
import { peuplesText } from '../../../shared/peuples.js';

const list = (names, locale) => {
  if (names.length < 2) return names.join('');
  const and = locale === 'en' ? ' and ' : ' et ';
  return `${names.slice(0, -1).join(', ')}${and}${names.at(-1)}`;
};

const MESSAGES = {
  fr: {
    starts: ({ name }) => `${name} lance la partie. Cinq cartes chacune, la pioche est posée.`,
    firstPlayer: ({ name }) => `${name} commence.`,
    stopped: ({ name }) => `${name} arrête la partie : on compte les peuples.`,
    draws: ({ name, n }) => `${name} pioche ${n > 1 ? `${n} cartes` : 'une carte'}.`,
    deckEmpty: () => 'La pioche est vide : on joue jusqu’à ce qu’une main se vide.',
    skips: ({ name }) => `${name} n’a plus de carte et passe son tour.`,
    finalRound: ({ name }) => `${name} n’a plus de carte : dernier tour de table !`,
    plays: ({ name, r }) => `${name} pose ${r.article}.`,
    fairyIdle: ({ name }) => `${name} pose une fée : rien à annuler, elle rejoint son peuple.`,
    gnomeDraws: ({ name, n }) => `Le gnome de ${name} pioche ${n > 1 ? `${n} cartes` : 'une carte'}.`,
    gnomeNothing: ({ name }) => `Le gnome de ${name} ne trouve rien à piocher.`,
    elfNothing: ({ name }) => `L’elfe de ${name} n’a aucun pouvoir à réutiliser.`,
    elfCopies: ({ name, r }) => `L’elfe de ${name} réveille le pouvoir ${r.of}.`,
    noTarget: ({ name, r }) => `Le pouvoir ${r.of} de ${name} n’a personne sur qui agir.`,
    targets: ({ name, target, r, cardR }) =>
      cardR ? `${name} vise ${cardR.article} du peuple de ${target}.` : `${name} vise ${target} avec ${r.article}.`,
    targetsFamily: ({ name, target, give, take }) =>
      `${name} propose ses ${give.plural} contre les ${take.plural} de ${target}.`,
    farfadetFamily: ({ name, target, give, take }) =>
      `Le farfadet de ${name} échange ses ${give.plural} contre les ${take.plural} de ${target}.`,
    fairyBlocks: ({ name }) => `${name} joue une fée pour annuler le pouvoir !`,
    fairyCounters: ({ name }) => `${name} contre la fée avec une autre fée !`,
    noFairy: ({ name }) => `${name} ne joue pas de fée.`,
    noCounter: ({ name }) => `${name} ne contre pas.`,
    cancelled: ({ name, r }) => `Le pouvoir ${r.of} de ${name} est annulé.`,
    korriganEmpty: ({ name, target }) => `Le korrigan de ${name} ne trouve rien dans la main de ${target}.`,
    korriganSteals: ({ name, target, n }) =>
      `Le korrigan de ${name} vole ${n > 1 ? `${n} cartes` : 'une carte'} dans la main de ${target}.`,
    korriganStealsSeen: ({ name, target, races }) =>
      `Le korrigan de ${name} vole à ${target} : ${races}.`,
    lutinSwap: ({ name, target }) => `Le lutin de ${name} échange sa main avec celle de ${target}.`,
    farfadetSwap: ({ name, target }) => `Le farfadet de ${name} échange son peuple avec celui de ${target}.`,
    dryadSteals: ({ name, target, r }) => `La dryade de ${name} enlève ${r.article} au peuple de ${target}.`,
    wins: ({ names }) => `${names} l’emporte !`,
    draw: ({ names }) => `Égalité parfaite : ${names} se partagent la victoire.`,
  },
  en: {
    starts: ({ name }) => `${name} starts the game. Five cards each, the draw pile is set.`,
    firstPlayer: ({ name }) => `${name} goes first.`,
    stopped: ({ name }) => `${name} stops the game: folk are counted.`,
    draws: ({ name, n }) => `${name} draws ${n > 1 ? `${n} cards` : 'a card'}.`,
    deckEmpty: () => 'The draw pile is empty: play on until a hand runs out.',
    skips: ({ name }) => `${name} has no card left and passes.`,
    finalRound: ({ name }) => `${name} has no card left: last round!`,
    plays: ({ name, r }) => `${name} plays ${r.article}.`,
    fairyIdle: ({ name }) => `${name} plays a fairy: nothing to cancel, it joins the folk.`,
    gnomeDraws: ({ name, n }) => `${name}'s gnome draws ${n > 1 ? `${n} cards` : 'a card'}.`,
    gnomeNothing: ({ name }) => `${name}'s gnome finds nothing to draw.`,
    elfNothing: ({ name }) => `${name}'s elf has no power to reuse.`,
    elfCopies: ({ name, r }) => `${name}'s elf awakens the ${r.name} power.`,
    noTarget: ({ name, r }) => `${name}'s ${r.name} has no one to act upon.`,
    targets: ({ name, target, r, cardR }) =>
      cardR ? `${name} targets ${cardR.article} in ${target}'s folk.` : `${name} targets ${target} with ${r.article}.`,
    targetsFamily: ({ name, target, give, take }) => `${name} offers their ${give.plural} for ${target}'s ${take.plural}.`,
    farfadetFamily: ({ name, target, give, take }) =>
      `${name}'s sprite swaps their ${give.plural} for ${target}'s ${take.plural}.`,
    fairyBlocks: ({ name }) => `${name} plays a fairy to cancel the power!`,
    fairyCounters: ({ name }) => `${name} counters the fairy with another fairy!`,
    noFairy: ({ name }) => `${name} plays no fairy.`,
    noCounter: ({ name }) => `${name} does not counter.`,
    cancelled: ({ name, r }) => `${name}'s ${r.name} power is cancelled.`,
    korriganEmpty: ({ name, target }) => `${name}'s korrigan finds nothing in ${target}'s hand.`,
    korriganSteals: ({ name, target, n }) =>
      `${name}'s korrigan steals ${n > 1 ? `${n} cards` : 'a card'} from ${target}'s hand.`,
    korriganStealsSeen: ({ name, target, races }) => `${name}'s korrigan steals from ${target}: ${races}.`,
    lutinSwap: ({ name, target }) => `${name}'s imp swaps hands with ${target}.`,
    farfadetSwap: ({ name, target }) => `${name}'s sprite swaps folk with ${target}.`,
    dryadSteals: ({ name, target, r }) => `${name}'s dryad takes ${r.article} from ${target}'s folk.`,
    wins: ({ names }) => `${names} wins!`,
    draw: ({ names }) => `A perfect tie: ${names} share the victory.`,
  },
};

/** Les articles : « un elfe », « une fée », « an elf »… */
const FR_ARTICLE = { elfe: 'un elfe', korrigan: 'un korrigan', fee: 'une fée', lutin: 'un lutin', farfadet: 'un farfadet', gnome: 'un gnome', dryade: 'une dryade' };
const FR_OF = { elfe: 'de l’elfe', korrigan: 'du korrigan', fee: 'de la fée', lutin: 'du lutin', farfadet: 'du farfadet', gnome: 'du gnome', dryade: 'de la dryade' };

function raceWords(locale, race) {
  if (!race) return null;
  const name = peuplesText(locale).race[race];
  const plural = peuplesText(locale).racePlural[race].toLowerCase();
  if (locale === 'en') {
    const lower = name.toLowerCase();
    return { name: lower, plural, article: `${/^[aeiou]/.test(lower) ? 'an' : 'a'} ${lower}`, of: lower };
  }
  return { name: name.toLowerCase(), plural, article: FR_ARTICLE[race], of: FR_OF[race] };
}

export function say(state, key, params = {}) {
  const locale = state.locale === 'en' ? 'en' : 'fr';
  const fn = MESSAGES[locale][key];
  const words = {
    ...params,
    r: raceWords(locale, params.race),
    give: raceWords(locale, params.give),
    take: raceWords(locale, params.take),
    cardR: params.cardId ? raceWords(locale, String(params.cardId).split('-')[0]) : null,
    names: Array.isArray(params.names) ? list(params.names, locale) : params.names,
    races: Array.isArray(params.races)
      ? list(params.races.map((r) => raceWords(locale, r).article), locale)
      : params.races,
  };
  return fn ? fn(words) : key;
}
