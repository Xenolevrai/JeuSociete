/**
 * Le jeu d'une joueuse, disposé comme sur la table : deux rangées, dont la
 * place des cartes ne change jamais. La colonne c porte les emplacements 2c
 * (rangée du fond) et 2c+1 (rangée proche). Les cartes de pénalité ouvrent de
 * nouvelles colonnes à droite.
 *
 * Tous les jeux sont dessinés tels que leur propriétaire les voit : « ta carte
 * en haut à gauche » veut dire la même chose pour tout le monde.
 */
import Card from './Card.jsx';

export default function Grid({ cards, ownerId, onPick, isSelectable, selectedSlot, highlights, gap = '0.22em', expiredAt }) {
  const columns = Math.max(2, Math.ceil(cards.length / 2));
  const cells = [];
  for (let c = 0; c < columns; c++) {
    for (const row of [0, 1]) {
      const slot = 2 * c + row;
      cells.push({ slot, row, col: c });
    }
  }
  return (
    <div
      className="grid w-max"
      style={{ gridTemplateColumns: `repeat(${columns}, auto)`, gridTemplateRows: 'auto auto', gap, gridAutoFlow: 'column' }}
    >
      {cells.map(({ slot }) => {
        let card = slot < cards.length ? cards[slot] : null;
        // Une carte montrée pour quelques secondes se retourne d'elle-même,
        // sans attendre le serveur : l'horloge locale suffit.
        if (card && card.remainingMs != null && expiredAt?.(card.remainingMs)) card = { down: true };
        const canPick = card && isSelectable?.(slot, card);
        const mark = highlights?.[`${ownerId}:${slot}`];
        return (
          <Card
            key={slot}
            card={card}
            selectable={Boolean(canPick)}
            selected={selectedSlot === slot}
            highlight={mark?.kind ?? null}
            onClick={canPick ? () => onPick(slot) : undefined}
            label={`carte ${slot + 1}`}
          />
        );
      })}
    </div>
  );
}
