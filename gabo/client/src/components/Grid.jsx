/**
 * Le jeu d'une joueuse, disposé comme sur la table : deux rangées dont la
 * place des cartes ne change jamais. La colonne c porte les emplacements 2c
 * (rangée du fond) et 2c+1 (rangée proche). Les cartes de pénalité comblent un
 * trou ou ouvrent une colonne à droite.
 *
 * Tous les jeux sont dessinés tels que leur propriétaire les voit : « ta carte
 * en haut à gauche » veut dire la même chose pour tout le monde.
 */
import Card from './Card.jsx';
import { cardLabel } from '../lib/cards.js';

export default function Grid({ cards, ownerId, onPick, isTouchable, chosenSlot, marks, gap = '0.2em', expired }) {
  const columns = Math.max(2, Math.ceil(cards.length / 2));
  const slots = Array.from({ length: columns * 2 }, (_, i) => i);
  return (
    <div className="grid w-max" style={{ gridTemplateRows: 'auto auto', gridAutoFlow: 'column', gap }}>
      {slots.map((slot) => {
        let card = slot < cards.length ? cards[slot] : null;
        // Une carte montrée quelques secondes se retourne d'elle-même, à
        // l'horloge locale, sans attendre le serveur.
        if (card && card.remainingMs != null && expired?.(card.remainingMs)) card = { down: true };
        const canTouch = Boolean(card && isTouchable?.(slot, card));
        const mark = marks?.[`${ownerId}:${slot}`]?.kind ?? null;
        return (
          <Card
            key={slot}
            card={card}
            touchable={canTouch}
            chosen={chosenSlot === slot}
            mark={mark}
            onClick={canTouch ? () => onPick(slot) : undefined}
            label={card?.rank ? `carte ${slot + 1} : ${cardLabel(card)}` : `carte ${slot + 1}`}
            tag={
              mark === 'bad' ? (
                <span
                  className="absolute -top-[0.35em] -right-[0.35em] rounded-sm bg-[var(--color-red)] px-[0.25em] font-mono leading-tight text-white"
                  style={{ fontSize: 'max(9px, 0.32em)' }}
                >
                  +1
                </span>
              ) : null
            }
          />
        );
      })}
    </div>
  );
}
