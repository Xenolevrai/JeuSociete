/**
 * Une carte à jouer, dessinée à la main en SVG et CSS — aucune image.
 *
 * Elle reprend ce qui fait qu'une carte se reconnaît d'un coup d'œil : les
 * index en coin, la disposition traditionnelle des enseignes de 2 à 10, des
 * figures encadrées et symétriques. Les enseignes sont des tracés SVG et non
 * des caractères ♥ ♠ : sur iPhone, un ♥ s'affiche volontiers en emoji.
 *
 * Toutes les mesures sont en `em` : la taille d'une carte se règle par la
 * seule `font-size` de son conteneur. Sous une certaine largeur, les enseignes
 * deviendraient de la poussière : une requête de conteneur les remplace par un
 * grand index lisible (voir `.pips` / `.bigrank` plus bas).
 */
const RED = new Set(['H', 'D']);
const LETTER = { A: 'A', J: 'V', Q: 'D', K: 'R' };

export function Suit({ suit, size = '1em', style }) {
  const color = RED.has(suit) ? 'var(--color-red)' : 'var(--color-ink)';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', fill: color, ...style }} aria-hidden>
      {suit === 'H' && <path d="M50 90C21 64 5 48 5 29 5 15 15 5 28 5c10 0 17 6 22 15C55 11 62 5 72 5c13 0 23 10 23 24 0 19-16 35-45 61Z" />}
      {suit === 'D' && <path d="M50 3 88 50 50 97 12 50Z" />}
      {suit === 'S' && (
        <path d="M50 4C41 22 7 39 7 61c0 13 10 21 22 21 8 0 14-4 17-9-1 11-6 18-14 23h36c-8-5-13-12-14-23 3 5 9 9 17 9 12 0 22-8 22-21C93 39 59 22 50 4Z" />
      )}
      {suit === 'C' && (
        <>
          <circle cx="50" cy="27" r="20" />
          <circle cx="27" cy="57" r="20" />
          <circle cx="73" cy="57" r="20" />
          <circle cx="50" cy="50" r="10" />
          <path d="M46 55c0 20-6 31-14 41h36c-8-10-14-21-14-41Z" />
        </>
      )}
    </svg>
  );
}

/** Positions des enseignes, en fractions de la carte : [x, y]. */
const L = 0.345;
const C = 0.5;
const R = 0.655;
const PIPS = {
  2: [[C, 0.21], [C, 0.79]],
  3: [[C, 0.21], [C, 0.5], [C, 0.79]],
  4: [[L, 0.2], [R, 0.2], [L, 0.8], [R, 0.8]],
  5: [[L, 0.2], [R, 0.2], [C, 0.5], [L, 0.8], [R, 0.8]],
  6: [[L, 0.2], [R, 0.2], [L, 0.5], [R, 0.5], [L, 0.8], [R, 0.8]],
  7: [[L, 0.2], [R, 0.2], [C, 0.35], [L, 0.5], [R, 0.5], [L, 0.8], [R, 0.8]],
  8: [[L, 0.2], [R, 0.2], [C, 0.35], [L, 0.5], [R, 0.5], [C, 0.65], [L, 0.8], [R, 0.8]],
  9: [[L, 0.2], [R, 0.2], [L, 0.4], [R, 0.4], [C, 0.5], [L, 0.6], [R, 0.6], [L, 0.8], [R, 0.8]],
  10: [[L, 0.2], [R, 0.2], [C, 0.3], [L, 0.4], [R, 0.4], [L, 0.6], [R, 0.6], [C, 0.7], [L, 0.8], [R, 0.8]],
};

function Index({ rank, suit, flipped }) {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        top: flipped ? undefined : '0.1em',
        left: flipped ? undefined : '0.08em',
        bottom: flipped ? '0.1em' : undefined,
        right: flipped ? '0.08em' : undefined,
        transform: flipped ? 'rotate(180deg)' : undefined,
        width: '0.42em',
      }}
    >
      <span
        className="font-display leading-none"
        style={{ fontSize: rank === '10' ? '0.36em' : '0.42em', fontWeight: 600, letterSpacing: rank === '10' ? '-0.08em' : 0 }}
      >
        {LETTER[rank] ?? rank}
      </span>
      <Suit suit={suit} size="0.26em" style={{ marginTop: '0.04em' }} />
    </div>
  );
}

function Court({ rank, suit }) {
  const red = RED.has(suit);
  const tint = red ? 'rgba(179,50,42,0.07)' : 'rgba(29,27,23,0.06)';
  const line = red ? 'rgba(179,50,42,0.55)' : 'rgba(29,27,23,0.5)';
  const half = (flip) => (
    <div
      className="flex flex-1 items-start justify-start gap-[0.04em]"
      style={{ transform: flip ? 'rotate(180deg)' : undefined, padding: '0.06em 0.08em' }}
    >
      <span className="font-display italic leading-none" style={{ fontSize: '0.72em', fontWeight: 500 }}>
        {LETTER[rank]}
      </span>
      <Suit suit={suit} size="0.28em" style={{ marginTop: '0.08em' }} />
    </div>
  );
  return (
    <div
      className="absolute flex flex-col"
      style={{
        inset: '0.42em 0.5em',
        border: `1px solid ${line}`,
        // Le trait part du coin bas-gauche vers le coin haut-droit : il sépare
        // les deux moitiés sans jamais traverser une lettre.
        background: `linear-gradient(to top left, ${tint} 49.6%, ${line} 49.8%, ${line} 50.2%, ${tint} 50.4%)`,
      }}
    >
      {half(false)}
      {half(true)}
    </div>
  );
}

function Face({ card }) {
  const red = RED.has(card.suit);
  const pips = PIPS[card.rank];
  return (
    <div className="card-face overflow-hidden" style={{ color: red ? 'var(--color-red)' : 'var(--color-ink)', containerType: 'size' }}>
      <div className="pips absolute inset-0">
        <Index rank={card.rank} suit={card.suit} />
        <Index rank={card.rank} suit={card.suit} flipped />
        {card.rank === 'A' && (
          <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <Suit suit={card.suit} size="1.05em" />
          </div>
        )}
        {pips &&
          pips.map(([x, y], i) => (
            <div
              key={i}
              className="absolute"
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%,-50%)${y > 0.5 ? ' rotate(180deg)' : ''}` }}
            >
              <Suit suit={card.suit} size="0.36em" />
            </div>
          ))}
        {['J', 'Q', 'K'].includes(card.rank) && <Court rank={card.rank} suit={card.suit} />}
      </div>
      {/* Version miniature : un grand index, rien d'autre. */}
      <div className="bigrank absolute inset-0 hidden flex-col items-center justify-center">
        <span className="font-display leading-none" style={{ fontSize: '1.15em', fontWeight: 600, letterSpacing: card.rank === '10' ? '-0.08em' : 0 }}>
          {LETTER[card.rank] ?? card.rank}
        </span>
        <Suit suit={card.suit} size="0.7em" style={{ marginTop: '0.1em' }} />
      </div>
    </div>
  );
}

function Back() {
  return <div className="card-back" />;
}

/**
 * `card` : `null` (emplacement vide), `{ down: true }` (cachée) ou une carte
 * visible `{ rank, suit, shown?, memo? }`.
 * `mark` : ce qui vient d'arriver à cette place — `'ok'`, `'bad'`, `'shake'`.
 */
export default function Card({ card, onClick, touchable = false, chosen = false, mark = null, label, className = '', tag = null, style }) {
  if (!card) {
    return (
      <div
        className={`rounded-[0.2em] ${className}`}
        style={{ width: '2.5em', height: '3.5em', border: '1px dashed rgba(233,226,207,0.22)', ...style }}
        aria-label="emplacement vide"
      />
    );
  }
  const down = Boolean(card.down);
  const Tag = onClick ? 'button' : 'div';
  const markClass = mark === 'bad' ? 'marked-bad' : mark === 'shake' ? 'shake' : mark ? 'marked' : '';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={[
        'card3d card-shadow relative block shrink-0 rounded-[0.2em] p-0 transition-[transform,box-shadow] duration-150',
        touchable ? 'touchable' : '',
        chosen ? 'chosen' : '',
        markClass,
        className,
      ].join(' ')}
      style={{ width: '2.5em', height: '3.5em', ...style }}
    >
      <div className={`card3d-inner ${down ? 'is-down' : ''}`}>
        {!down ? <Face card={card} /> : <div className="card-face" />}
        <Back />
      </div>
      {card.memo && (
        // Aide-mémoire : une carte seulement rappelée, pas montrée — un voile
        // de feutre la distingue d'une carte réellement retournée.
        <span className="pointer-events-none absolute inset-0 rounded-[0.2em] bg-[var(--color-felt)]/25" />
      )}
      {tag}
    </Tag>
  );
}
