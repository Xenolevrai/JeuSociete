/**
 * Une carte des Sept Peuples : cadre sombre, titre gravé à la couleur du
 * peuple, portrait, et le pouvoir écrit en bas.
 *
 * La taille du texte suit la largeur de la carte (unités `cqw`) : la même
 * carte se lit en grand au centre de la table et reste propre en vignette.
 * Sous une certaine taille, le pouvoir disparaît — il serait illisible — et
 * seuls le titre et le portrait restent.
 */
import CardArt, { CardBackArt, RACE_STYLE } from './CardArt.jsx';
import { raceOf } from '../../../shared/peuples.js';

const WIDTHS = {
  xs: 'w-9',
  sm: 'w-14',
  md: 'w-24 sm:w-28',
  lg: 'w-32 sm:w-36',
  xl: 'w-44 sm:w-52',
};

/**
 * La taille du titre : la lettre onciale est large, et « Korrigan » ou
 * « Farfadet » débordaient d'une carte où « Fée » tenait sans peine. On la
 * règle sur la longueur du nom, plafonnée par la taille de base.
 */
function titleSize(name, showPower) {
  const base = showPower ? 13 : 16;
  return `${Math.min(base, 84 / (name.length * 0.72)).toFixed(2)}cqw`;
}

/**
 * Une face imprimée : bord ivoire, filet noir, bandeau de titre en aplat de
 * la couleur du peuple, portrait, puis le pouvoir composé à l'encre sur le
 * papier — comme sur une vraie carte, où rien ne flotte sur l'illustration.
 */
export function CardFace({ race, t, size = 'md', showPower = size !== 'xs' && size !== 'sm' }) {
  const style = RACE_STYLE[race];
  const name = t.race[race];
  const tiny = size === 'xs';
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[5%] border border-[#3b2a1a] bg-[#f1e7cd] p-[4.5%]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#1d140c] bg-[#1d140c]">
        {!tiny && (
          <p
            className="peuples-title border-b border-[#1d140c] py-[2.5%] text-center leading-none text-[#f6ecd2]"
            style={{ background: style.mid, fontSize: titleSize(name, showPower) }}
          >
            {name}
          </p>
        )}
        <div className="relative min-h-0 flex-1">
          <CardArt race={race} className="absolute inset-0 h-full w-full" />
        </div>
        {showPower && (
          <div className="flex min-h-[34%] items-center border-t border-[#1d140c] bg-[#f1e7cd] px-[6%] py-[4%]">
            <p
              className="w-full text-center font-display font-semibold leading-[1.12] text-[#2b1d12]"
              style={{ fontSize: '8.4cqw' }}
            >
              {t.power[race]}
            </p>
          </div>
        )}
      </div>
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
      title={title ?? (faceDown || !race ? undefined : `${t.race[race]} — ${t.power[race]}`)}
      className={`peuples-card relative aspect-[5/7] shrink-0 select-none rounded-[6%] shadow-[0_1px_0_rgba(0,0,0,.45),0_3px_6px_rgba(0,0,0,.35)] transition-all duration-200 ${
        WIDTHS[size] ?? size
      } ${selected ? '-translate-y-3 outline outline-2 outline-offset-2 outline-[#7d2018]' : ''} ${
        onClick ? 'cursor-pointer hover:-translate-y-1.5' : ''
      } ${dim ? 'opacity-45 saturate-50' : ''} ${className}`}
    >
      {faceDown || !race ? (
        <div className="absolute inset-0 overflow-hidden rounded-[6%] border border-black">
          <CardBackArt className="h-full w-full" />
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
          className="relative -ml-3 aspect-[5/7] w-6 overflow-hidden rounded-[3px] border border-black shadow first:ml-0"
          style={{ transform: `rotate(${(i - (shown - 1) / 2) * 5}deg)` }}
        >
          <CardBackArt className="h-full w-full" />
        </div>
      ))}
      {count > max && <span className="ml-1 text-[10px] text-[color:var(--pp-ink-soft)]">+{count - max}</span>}
    </div>
  );
}
