/** Ce que le client sait des cartes : uniquement de quoi les dessiner et les nommer. */
export const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RED = new Set(['H', 'D']);
export const RANK_SHORT = { A: 'A', J: 'V', Q: 'D', K: 'R', JOKER: '★' };
export const RANK_LONG = { A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi', JOKER: 'Joker' };

export function short(rank) {
  return RANK_SHORT[rank] ?? rank;
}
export function rankLabel(rank) {
  return RANK_LONG[rank] ?? rank;
}
export function cardLabel(card) {
  if (!card) return '';
  if (card.rank === 'JOKER') return 'Joker';
  return `${rankLabel(card.rank)} ${SUIT[card.suit]}`;
}

/** Les teintes des sièges : huit couleurs bien distinctes sur fond vert. */
export const SEAT_COLORS = ['#f59e0b', '#38bdf8', '#f472b6', '#a78bfa', '#fb7185', '#facc15', '#2dd4bf', '#fb923c'];
export function seatColor(player) {
  return SEAT_COLORS[(player?.avatar ?? 0) % SEAT_COLORS.length];
}
export function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export const POWER_TEXT = {
  peekOwn: 'Regarde une de tes cartes',
  peekOther: "Regarde une carte d'une adversaire",
  swap: "Échange à l'aveugle une de tes cartes avec celle d'une adversaire",
};

/** « le 7 ♥ », « la Dame ♦ », « l'As ♠ » — pour des consignes qui se lisent bien. */
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
