/**
 * Les Sept Peuples — les données du jeu de cartes, lues par le serveur ET le
 * client.
 *
 * Rien de ce fichier ne décide d'une règle : il nomme les peuples, dit en mots
 * ce que fait leur pouvoir, et décrit les variantes qu'on peut cocher au salon.
 * Les règles elles-mêmes vivent dans `server/games/peuples/engine.js`.
 */

/** Sept peuples de huit individus : 56 cartes. */
export const RACES = ['elfe', 'korrigan', 'fee', 'lutin', 'farfadet', 'gnome', 'dryade'];
export const PER_RACE = 8;
export const HAND_SIZE = 5;
export const PLAYER_COUNT = { min: 2, max: 4 };

/** Les pouvoirs qui visent une adversaire — et peuvent donc être contrés par une fée. */
export const TARGETED = new Set(['korrigan', 'lutin', 'farfadet', 'dryade']);

/**
 * Les pouvoirs qu'un elfe peut réutiliser. Ni la fée (elle n'a d'effet qu'en
 * réponse à une attaque, jamais à son propre tour), ni un autre elfe : un elfe
 * qui copie un elfe qui copie un elfe ne s'arrêterait jamais.
 */
export const ELF_COPYABLE = new Set(['korrigan', 'lutin', 'farfadet', 'gnome', 'dryade']);

export const raceOf = (cardId) => String(cardId).split('-')[0];

/** Les 56 identifiants, dans l'ordre de la boîte. */
export function fullDeck() {
  return RACES.flatMap((race) => Array.from({ length: PER_RACE }, (_, i) => `${race}-${i + 1}`));
}

/** Les réglages par défaut : les règles de la boîte, sans variante. */
export const DEFAULT_SETTINGS = {
  /** On ne pioche pas en début de tour avec déjà 6 cartes ou plus en main. */
  handCap: false,
  /** On complète sa main à 6 cartes avant de jouer. */
  refill: false,
  /** `people` : le plus grand peuple gagne. `families` : comme au jeu des 7 familles. */
  scoring: 'people',
};

export const VARIANTS = [
  { id: 'handCap', kind: 'toggle' },
  { id: 'refill', kind: 'toggle' },
  { id: 'scoring', kind: 'choice', options: ['people', 'families'] },
];

/** Les couleurs des joueuses : quatre encres lisibles sur la nappe sombre. */
export const SEAT_COLORS = ['#d9a441', '#5fa8d3', '#c0504d', '#7bb661'];

/**
 * Tri des peuples pour le décompte « familles » : la taille de chaque groupe,
 * de la plus grande à la plus petite. Deux peuples se comparent ensuite case
 * par case — c'est exactement « qui a la plus grande famille ; à égalité, qui
 * a la suivante ; et ainsi de suite ».
 */
export function familyProfile(people) {
  const counts = Object.fromEntries(RACES.map((r) => [r, 0]));
  for (const id of people) counts[raceOf(id)] += 1;
  return Object.values(counts).sort((a, b) => b - a);
}

/** > 0 si `a` bat `b`, < 0 s'il perd, 0 à égalité parfaite. */
export function compareFamilies(a, b) {
  const pa = familyProfile(a);
  const pb = familyProfile(b);
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Le nombre de familles complètes (huit individus d'un même peuple). */
export function completeFamilies(people) {
  return familyProfile(people).filter((n) => n === PER_RACE).length;
}

// — Les mots ————————————————————————————————————————————

const TEXT = {
  fr: {
    title: 'Les Sept Peuples',
    tagline: 'Un jeu de cartes de petit peuple, de ruse et de fées.',
    race: {
      elfe: 'Elfe',
      korrigan: 'Korrigan',
      fee: 'Fée',
      lutin: 'Lutin',
      farfadet: 'Farfadet',
      gnome: 'Gnome',
      dryade: 'Dryade',
    },
    racePlural: {
      elfe: 'Elfes',
      korrigan: 'Korrigans',
      fee: 'Fées',
      lutin: 'Lutins',
      farfadet: 'Farfadets',
      gnome: 'Gnomes',
      dryade: 'Dryades',
    },
    power: {
      elfe: "Réutilisez le pouvoir d'une des cartes déjà posées dans votre peuple.",
      korrigan: "Volez deux cartes, prises à l'aveugle, dans la main d'une adversaire.",
      fee: "Annulez le pouvoir d'une carte jouée contre vous. Se joue à tout moment.",
      lutin: "Échangez votre main avec celle d'une adversaire de votre choix.",
      farfadet: "Échangez votre peuple (cartes posées) avec celui d'une adversaire.",
      gnome: 'Piochez deux cartes supplémentaires.',
      dryade: "Volez une carte déjà posée par une adversaire et ajoutez-la à votre peuple.",
    },
    variant: {
      handCap: {
        label: 'Pas plus de 7 cartes',
        help: "On ne pioche pas en début de tour si l'on tient déjà 6 cartes ou plus, et un gnome ne fait jamais dépasser 7.",
      },
      refill: {
        label: 'Compléter sa main à 6',
        help: "Avant de jouer, on pioche jusqu'à tenir 6 cartes : avec 3 en main, on en pioche 3 et l'on finit son tour à 5.",
      },
      scoring: {
        label: 'Décompte',
        help: 'Comment se désigne le vainqueur, une fois le dernier tour de table joué.',
        people: 'Le plus grand peuple',
        peopleHelp: "Le peuple qui compte le plus d'individus l'emporte, quelle que soit leur race.",
        families: 'Les familles',
        familiesHelp:
          "Comme au jeu des 7 familles : on compare la plus grande famille de chacune (8 = famille complète), puis la suivante, et ainsi de suite.",
      },
    },
    rules: [
      '56 cartes : sept peuples de huit individus. Chacune reçoit 5 cartes, le reste forme la pioche.',
      'À son tour, on pioche une carte, puis on pose une carte de sa main devant soi et on applique aussitôt son pouvoir. Si le pouvoir ne peut pas s’appliquer, il ne se passe rien.',
      'Les cartes posées devant soi forment son peuple.',
      "Une fée se joue hors de son tour, pour annuler un pouvoir qui vous vise. L'attaquante peut contrer cette fée par une fée, que vous pouvez contrer à votre tour, et ainsi de suite. Chaque fée jouée rejoint le peuple de celle qui l'a posée.",
      "Quand un pouvoir vous vise, on vous demande toujours si vous jouez une fée — même si vous n'en avez pas : personne ne sait ce que vous tenez.",
      "Quand la pioche est vide, on continue de jouer jusqu'à ce qu'une joueuse pose sa dernière carte. On termine alors le tour de table, puis on compte.",
    ],
    readings: [
      'Le korrigan prend deux cartes à l’aveugle : sa victime peut mélanger ou réordonner sa main jusqu’au moment où il choisit.',
      'Le farfadet fait partie du peuple qu’il échange : posé avant d’agir, il part avec lui.',
      'Un elfe ne réutilise ni une fée ni un autre elfe : la première n’a d’effet qu’en défense, le second tournerait sans fin.',
    ],
  },
  en: {
    title: 'The Seven Folk',
    tagline: 'A card game of little folk, trickery and fairies.',
    race: {
      elfe: 'Elf',
      korrigan: 'Korrigan',
      fee: 'Fairy',
      lutin: 'Imp',
      farfadet: 'Sprite',
      gnome: 'Gnome',
      dryade: 'Dryad',
    },
    racePlural: {
      elfe: 'Elves',
      korrigan: 'Korrigans',
      fee: 'Fairies',
      lutin: 'Imps',
      farfadet: 'Sprites',
      gnome: 'Gnomes',
      dryade: 'Dryads',
    },
    power: {
      elfe: 'Use again the power of one of the cards already in your folk.',
      korrigan: "Steal two cards, picked blind, from an opponent's hand.",
      fee: 'Cancel the power of a card played against you. May be played at any time.',
      lutin: 'Swap your hand with the hand of an opponent of your choice.',
      farfadet: 'Swap your folk (cards already played) with an opponent’s.',
      gnome: 'Draw two extra cards.',
      dryade: 'Steal a card already played by an opponent and add it to your folk.',
    },
    variant: {
      handCap: {
        label: 'No more than 7 cards',
        help: 'You skip your draw when you already hold 6 cards or more, and a gnome never takes you past 7.',
      },
      refill: {
        label: 'Refill to 6',
        help: 'Before playing, draw until you hold 6 cards: holding 3, you draw 3 and end your turn with 5.',
      },
      scoring: {
        label: 'Scoring',
        help: 'How the winner is decided once the last round is over.',
        people: 'Largest folk',
        peopleHelp: 'The folk with the most members wins, whatever their kind.',
        families: 'Families',
        familiesHelp:
          'Like Happy Families: compare everyone’s largest family (8 = complete), then the next one, and so on.',
      },
    },
    rules: [
      '56 cards: seven folk of eight members. Everyone gets 5 cards, the rest makes the draw pile.',
      'On your turn, draw a card, then play one card from your hand in front of you and apply its power at once. If the power cannot apply, nothing happens.',
      'The cards in front of you form your folk.',
      'A fairy is played out of turn, to cancel a power aimed at you. The attacker may counter that fairy with a fairy, which you may counter in turn, and so on. Every fairy played joins its player’s folk.',
      'When a power targets you, you are always asked whether you play a fairy — even if you have none: nobody knows what you hold.',
      'Once the draw pile is empty, play goes on until someone plays their last card. The round is then finished, and folk are counted.',
    ],
    readings: [
      'The korrigan picks two cards blind: the victim may shuffle or reorder their hand until the moment it picks.',
      'The sprite is part of the folk it swaps: played before acting, it goes with it.',
      'An elf copies neither a fairy nor another elf: the first only works in defence, the second would loop forever.',
    ],
  },
};

export function peuplesText(locale = 'fr') {
  return TEXT[locale] ?? TEXT.fr;
}
