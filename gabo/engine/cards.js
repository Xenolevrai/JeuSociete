/**
 * Le paquet de 54 cartes et ce que chacune vaut.
 *
 * Une carte est un petit objet JSON `{ id, rank, suit }` : l'identifiant ne
 * quitte JAMAIS le serveur pour une carte cachée (voir view.js) — sinon un
 * client bricolé pourrait suivre une carte du regard mieux qu'une mémoire
 * humaine, ou la reconnaître après un mélange.
 */

export const SUITS = ['S', 'H', 'D', 'C']; // ♠ ♥ ♦ ♣
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_LABEL = {
  A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi', JOKER: 'Joker',
};

/** Le paquet neuf, dans l'ordre : 52 cartes et deux jokers. */
export function freshDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ id: `${rank}${suit}`, rank, suit });
  }
  deck.push({ id: 'JK1', rank: 'JOKER', suit: null });
  deck.push({ id: 'JK2', rank: 'JOKER', suit: null });
  return deck;
}

/**
 * Points d'une carte en fin de manche.
 * Les rois rouges valent zéro, les rois noirs quinze : c'est tout l'enjeu
 * d'un échange à l'aveugle avec un Valet ou une Dame.
 */
export function cardValue(card, settings = {}) {
  if (!card) return 0;
  switch (card.rank) {
    case 'A':
      return 1;
    case 'J':
    case 'Q':
      return 10;
    case 'K':
      return card.suit === 'H' || card.suit === 'D' ? 0 : 15;
    case 'JOKER':
      return settings.jokerValue ?? 0;
    default:
      return Number(card.rank);
  }
}

/**
 * Le pouvoir d'une carte piochée puis jetée directement.
 * Une carte prise dans la défausse, ou remplacée dans son jeu, n'en a aucun.
 */
export function cardPower(card) {
  switch (card?.rank) {
    case '7':
    case '8':
      return 'peekOwn';
    case '9':
    case '10':
      return 'peekOther';
    case 'J':
    case 'Q':
      return 'swap';
    default:
      return null;
  }
}

/**
 * Deux cartes « de la même valeur » au sens de la défausse rapide : même
 * figure ou même chiffre, comme à la table. Un Valet ne se pose pas sur une
 * Dame (bien qu'ils valent tous deux dix points), mais n'importe quel roi se
 * pose sur n'importe quel roi.
 */
export function sameRank(a, b) {
  return Boolean(a && b && a.rank === b.rank);
}

/** Nom d'une carte pour le journal : « 7 ♥ », « Roi ♠ », « Joker ». */
export function cardName(card) {
  if (!card) return '?';
  if (card.rank === 'JOKER') return 'Joker';
  const label = RANK_LABEL[card.rank] ?? card.rank;
  return `${label} ${SUIT_SYMBOL[card.suit]}`;
}

/** Nom d'un rang seul, pour « posez un 7 ». */
export function rankName(card) {
  if (!card) return '?';
  return RANK_LABEL[card.rank] ?? card.rank;
}

/** « le 7 ♥ », « la Dame ♦ », « l'As ♠ », « le Joker ». */
export function cardTheName(card) {
  const n = cardName(card);
  if (card?.rank === 'A') return `l'${n}`;
  return `${card?.rank === 'Q' ? 'la' : 'le'} ${n}`;
}

/** « un 7 », « une Dame ». */
export function aRank(card) {
  return `${card?.rank === 'Q' ? 'une' : 'un'} ${rankName(card)}`;
}
