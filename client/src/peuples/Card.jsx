/**
 * Une carte des Sept Peuples : les vraies cartes illustrées du jeu,
 * avec leur illustration originale, titre et pouvoir.
 */
import CardArt, { CardBackArt, RACE_STYLE, CARD_IMAGES, CARD_BACK_IMAGE } from './CardArt.jsx';
import { raceOf } from '../../../shared/peuples.js';

const WIDTHS = {
  xs: 'w-9',
  sm: 'w-14',
  md: 'w-24 sm:w-28',
  lg: 'w-32 sm:w-36',
  xl: 'w-44 sm:w-52',
};

/**
 * Une face de carte : l'illustration complète authentique.
 */
export function CardFace({ race, t, _size = 'md' }) {
  const name = t?.race?.[race] ?? race;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[5%] bg-[#120a07]">
      <CardArt race={race} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} [props.cardId]  identifiant (« fee-3 ») — ou `race` directement
 * @param {boolean} [props.faceDown]
 */
export default function Card({
  cardId,
  race: raceProp,
  t,
  size = 'md',
  faceDown = false,
  selected = false,
  dim = false,
  onClick,
  className = '',
  title,
  showPower,
}) {
  const race = raceProp ?? (cardId ? raceOf(cardId) : null);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title ?? (faceDown || !race ? undefined : `${t?.race?.[race] ?? race} — ${t?.power?.[race] ?? ''}`)}
      className={`peuples-card relative aspect-[2/3] shrink-0 select-none rounded-[5%] shadow-[0_2px_4px_rgba(0,0,0,.45),0_6px_12px_rgba(0,0,0,.35)] transition-all duration-200 ${
        WIDTHS[size] ?? size
      } ${selected ? '-translate-y-3 ring-2 ring-offset-2 ring-[#e3b964] shadow-[0_0_12px_rgba(227,185,100,0.5)]' : ''} ${
        onClick ? 'cursor-pointer hover:-translate-y-1.5' : ''
      } ${dim ? 'opacity-45 saturate-50' : ''} ${className}`}
    >
      {faceDown || !race ? (
        <div className="absolute inset-0 overflow-hidden rounded-[5%] bg-[#120a07]">
          <CardBackArt className="h-full w-full object-cover" />
        </div>
      ) : (
        <CardFace race={race} t={t} size={size} showPower={showPower} />
      )}
    </Tag>
  );
}

/** Un petit éventail de dos de cartes : ce qu'on sait de la main d'une autre. */
export function HandBacks({ count, max = 8 }) {
  const shown = Math.min(count, max);
  return (
    <div className="flex items-end" aria-label={`${count}`}>
      {Array.from({ length: shown }, (_, i) => (
        <div
          key={i}
          className="relative -ml-3 aspect-[2/3] w-6 overflow-hidden rounded-[3px] border border-black shadow first:ml-0"
          style={{ transform: `rotate(${(i - (shown - 1) / 2) * 5}deg)` }}
        >
          <CardBackArt className="h-full w-full object-cover" />
        </div>
      ))}
      {count > max && <span className="ml-1 text-[10px] text-[color:var(--pp-ink-soft)]">+{count - max}</span>}
    </div>
  );
}

export { CARD_IMAGES, CARD_BACK_IMAGE, RACE_STYLE };
