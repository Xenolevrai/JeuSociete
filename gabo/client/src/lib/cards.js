/** Ce que le client sait des cartes : uniquement de quoi les nommer. */
export const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_LONG = { A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi' };

export function rankLabel(rank) {
  return RANK_LONG[rank] ?? rank;
}
export function cardLabel(card) {
  if (!card) return '';
  return `${rankLabel(card.rank)} ${SUIT[card.suit] ?? ''}`.trim();
}

/** « le 7 ♥ », « la Dame ♦ », « l'As ♠ ». */
export function definite(card) {
  if (!card) return '';
  const label = cardLabel(card);
  if (card.rank === 'A') return `l'${label}`;
  return `${card.rank === 'Q' ? 'la' : 'le'} ${label}`;
}

/** « un 7 », « une Dame », « un As ». */
export function indefinite(rank) {
  return `${rank === 'Q' ? 'une' : 'un'} ${rankLabel(rank)}`;
}

/**
 * Les couleurs de siège : des encres sourdes, distinctes entre elles et
 * lisibles sur le papier comme sur le feutre — pas des néons.
 */
export const SEAT_COLORS = ['#c8873a', '#4f7fa8', '#a8483f', '#7d5a94', '#3f8f86', '#8a8a3c', '#b0607e', '#6b7b8c'];
export function seatColor(player) {
  return SEAT_COLORS[(player?.avatar ?? 0) % SEAT_COLORS.length];
}

export const POWER_TEXT = {
  peekOwn: 'Regarde une de tes cartes',
  peekOther: "Regarde une carte d'une adversaire",
  swap: "Échange à l'aveugle une de tes cartes avec celle d'une adversaire",
};

export const BOT_LEVEL = { facile: 'bot facile', moyen: 'bot moyen', difficile: 'bot difficile' };
