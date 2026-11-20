/**
 * Une carte à jouer, dessinée en CSS — aucune image à charger.
 *
 * Toutes les mesures sont en `em` : la taille d'une carte se règle par la
 * seule taille de police de son conteneur (`text-[22px]`…), si bien qu'une
 * même carte sert dans le jeu d'une adversaire, dans le sien et au centre.
 *
 * Une carte cachée et une carte visible sont le même objet qui pivote : le
 * passage de l'une à l'autre se voit, comme quand on retourne une vraie carte.
 */
import { SUIT, RED, short } from '../lib/cards.js';

const FIGURE_ICON = { J: '⚔', Q: '♛', K: '♚' };

function Face({ card }) {
  const red = card.suit ? RED.has(card.suit) : false;
  const color = card.rank === 'JOKER' ? '#6d28d9' : red ? 'var(--color-suit-red)' : 'var(--color-suit-black)';
  const suit = card.suit ? SUIT[card.suit] : '★';
  const figure = ['J', 'Q', 'K'].includes(card.rank);
  const isJoker = card.rank === 'JOKER';
  const kingValue = card.rank === 'K' ? (red ? 0 : 15) : null;

  return (
    <div
      className="card-face flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #fffef9 0%, #f7f0de 100%)',
        color,
        border: '0.06em solid rgba(0,0,0,0.25)',
        boxShadow: 'inset 0 0 0 0.12em #fff',
      }}
    >
      <Corner rank={card.rank} suit={suit} />
      <Corner rank={card.rank} suit={suit} flipped />
      {isJoker ? (
        <div className="flex flex-col items-center leading-none">
          <span style={{ fontSize: '1.15em' }}>★</span>
          <span className="font-bold tracking-tight" style={{ fontSize: '0.36em' }}>JOKER</span>
        </div>
      ) : figure ? (
        <div
          className="flex flex-col items-center justify-center leading-none"
          style={{
            width: '1.5em',
            height: '2.2em',
            borderRadius: '0.18em',
            border: `0.05em solid ${color}`,
            background: red ? 'rgba(192,38,46,0.07)' : 'rgba(24,24,27,0.06)',
          }}
        >
          <span style={{ fontSize: '0.62em' }}>{FIGURE_ICON[card.rank]}</span>
          <span className="font-display font-bold" style={{ fontSize: '0.95em' }}>{short(card.rank)}</span>
          <span style={{ fontSize: '0.5em' }}>{suit}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center leading-none">
          <span className={`font-bold ${card.rank === 'A' ? 'font-display' : 'tracking-tighter'}`} style={{ fontSize: card.rank === '10' ? '0.95em' : '1.1em' }}>
            {short(card.rank)}
          </span>
          <span style={{ fontSize: '0.8em', marginTop: '-0.05em' }}>{suit}</span>
        </div>
      )}
      {kingValue != null && (
        <span
          className="absolute rounded-full bg-black/75 font-semibold text-white"
          style={{ bottom: '0.12em', left: '50%', transform: 'translateX(-50%)', fontSize: '0.28em', padding: '0.05em 0.45em' }}
        >
          {`${kingValue} pt${kingValue > 1 ? 's' : ''}`}
        </span>
      )}
    </div>
  );
}

function Corner({ rank, suit, flipped }) {
  return (
    <div
      className="absolute flex flex-col items-center font-bold leading-none"
      style={{
        top: flipped ? undefined : '0.12em',
        left: flipped ? undefined : '0.14em',
        bottom: flipped ? '0.12em' : undefined,
        right: flipped ? '0.14em' : undefined,
        transform: flipped ? 'rotate(180deg)' : undefined,
        fontSize: '0.36em',
      }}
    >
      <span>{rank === 'JOKER' ? '★' : short(rank)}</span>
      <span style={{ fontSize: '0.9em' }}>{rank === 'JOKER' ? '' : suit}</span>
    </div>
  );
}

function Back() {
  return (
    <div className="card-back flex items-center justify-center">
      <span
        className="font-display font-bold"
        style={{ fontSize: '0.9em', color: 'var(--color-gold)', textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}
      >
        G
      </span>
    </div>
  );
}

/**
 * `card` : `null` (emplacement vide), `{ down: true }` (cachée) ou une carte
 * visible `{ rank, suit, shown?, memo? }`.
 */
export default function Card({
  card,
  onClick,
  selectable = false,
  selected = false,
  highlight = null,
  dimmed = false,
  label,
  className = '',
  badge = null,
}) {
  if (!card) {
    return (
      <div
        className={`rounded-[0.5em] border border-dashed border-white/15 ${className}`}
        style={{ width: '2.5em', height: '3.5em' }}
        aria-label="emplacement vide"
      />
    );
  }
  const down = Boolean(card.down);
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={[
        'card3d relative block shrink-0 rounded-[0.5em] p-0 transition-transform duration-150',
        selectable ? 'selectable' : '',
        selected ? 'selected' : '',
        highlight ? 'pulse-ring' : '',
        highlight === 'snapWrong' ? 'wiggle' : '',
        dimmed ? 'opacity-40' : '',
        className,
      ].join(' ')}
      style={{
        width: '2.5em',
        height: '3.5em',
        boxShadow: '0 0.08em 0.25em rgba(0,0,0,0.45)',
      }}
    >
      <div className={`card3d-inner ${down ? 'is-down' : ''}`}>
        {!down ? <Face card={card} /> : <div className="card-face" />}
        <Back />
      </div>
      {card.memo && (
        // L'aide-mémoire : une carte déjà vue, rappelée en transparence.
        <span className="absolute inset-0 rounded-[0.5em] ring-2 ring-sky-300/70 ring-inset" />
      )}
      {card.shown && !down && (
        <span className="absolute inset-0 rounded-[0.5em] ring-2 ring-[var(--color-gold)]" />
      )}
      {badge}
    </Tag>
  );
}
