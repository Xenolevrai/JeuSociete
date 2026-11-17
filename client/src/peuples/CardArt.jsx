/**
 * Les illustrations des Sept Peuples, en SVG écrit à la main.
 *
 * Aucune image externe : le jeu tourne hors ligne, comme le Monopoly, et une
 * carte reste nette à toutes les tailles — de la vignette du peuple adverse à
 * la carte posée au centre de la table. Chaque portrait se dessine dans une
 * boîte de 100 × 90 ; la carte le recadre au besoin.
 *
 * Les identifiants de dégradés passent par `useId` : une table montre parfois
 * une vingtaine de cartes à la fois, et deux `<linearGradient id="g">` dans la
 * même page se volent leurs couleurs.
 */
import { useId } from 'react';

/** Les couleurs de chaque peuple : le fond de l'illustration et l'encre du titre. */
export const RACE_STYLE = {
  elfe: { light: '#c79be9', mid: '#3b1d5e', dark: '#12091f', title: '#f4c45a', accent: '#8b55c4' },
  korrigan: { light: '#a8bd6e', mid: '#2e3d17', dark: '#0d1407', title: '#e9d27a', accent: '#6f8a34' },
  fee: { light: '#7d9cf0', mid: '#1c2b5c', dark: '#0a1026', title: '#cfe0ff', accent: '#4f74d6' },
  lutin: { light: '#93d8d0', mid: '#1f5459', dark: '#0a1c1f', title: '#f0e4c0', accent: '#2f8b8f' },
  farfadet: { light: '#ffb46a', mid: '#7a2b12', dark: '#1f0a05', title: '#ffe08a', accent: '#d2662a' },
  gnome: { light: '#e9b58c', mid: '#5c2a1c', dark: '#1c0d08', title: '#ff6b5e', accent: '#b3202b' },
  dryade: { light: '#cfe8a0', mid: '#2f5a2a', dark: '#0c1a0a', title: '#b9f28a', accent: '#4f9a3f' },
};

const SKIN = '#f1d6c4';

/** Le fond commun : un halo de la couleur du peuple, et un vignetage sombre. */
function Backdrop({ id, race }) {
  const s = RACE_STYLE[race];
  return (
    <>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor={s.light} />
          <stop offset="45%" stopColor={s.mid} />
          <stop offset="100%" stopColor={s.dark} />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor="#fff7c8" stopOpacity="1" />
          <stop offset="40%" stopColor="#ffd35a" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffb000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-vignette`} cx="50%" cy="45%" r="70%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="55%" stopColor="#d6a23e" />
          <stop offset="100%" stopColor="#8a5a17" />
        </linearGradient>
      </defs>
      <rect width="100" height="90" fill={`url(#${id}-bg)`} />
    </>
  );
}

const Vignette = ({ id }) => <rect width="100" height="90" fill={`url(#${id}-vignette)`} pointerEvents="none" />;

/** Une lueur : halo flou et cœur clair. */
const Glow = ({ id, x, y, r = 6 }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={`url(#${id}-glow)`} />
    <circle cx={x} cy={y} r={r / 4} fill="#fffbe6" />
  </g>
);

const Stars = ({ points, fill = '#fff8dc' }) => (
  <g fill={fill}>
    {points.map(([x, y, r = 0.6], i) => (
      <circle key={i} cx={x} cy={y} r={r} opacity={0.5 + ((i * 37) % 50) / 100} />
    ))}
  </g>
);

/** Étoile à cinq branches centrée en (x, y). */
function star(x, y, outer, inner = outer * 0.45) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

// — Les sept portraits ——————————————————————————————————————

function Elfe({ id }) {
  return (
    <g>
      <Stars points={[[12, 10], [22, 6, 0.8], [88, 30], [8, 40], [92, 8, 0.5], [70, 6]]} />
      {/* Croissant de lune */}
      <path d="M80 6 a10 10 0 1 0 8 16 a8 8 0 1 1 -8 -16z" fill="#f7e9b5" opacity="0.9" />
      {/* L'arc, porté dans le dos */}
      <path d="M16 14 C4 40 6 66 20 88" fill="none" stroke="#c99a4b" strokeWidth="2.4" />
      <path d="M16 14 L20 88" stroke="#efe2c0" strokeWidth="0.5" />
      {/* Chevelure, derrière la tête */}
      <path d="M31 40 C28 18 72 18 69 40 C73 58 79 78 76 90 L24 90 C21 78 27 58 31 40Z" fill="#ddd2f2" />
      <path d="M33 50 C31 66 30 80 32 90 M67 50 C69 66 70 80 68 90" stroke="#b9a8de" strokeWidth="0.8" fill="none" />
      {/* Robe et col */}
      <path d="M18 90 C22 74 36 67 50 67 C64 67 78 74 82 90Z" fill="#4b2a74" />
      <path d="M38 69 L50 84 L62 69" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.6" />
      <circle cx="50" cy="84" r="2.2" fill="#9be7ff" stroke={`url(#${id}-gold)`} strokeWidth="0.8" />
      <path d="M43 56 L43 68 L57 68 L57 56Z" fill="#e6c6b4" />
      {/* Oreilles en pointe */}
      <path d="M37 42 C29 38 20 28 13 19 C20 31 28 41 37 51Z" fill={SKIN} stroke="#c9a08c" strokeWidth="0.5" />
      <path d="M63 42 C71 38 80 28 87 19 C80 31 72 41 63 51Z" fill={SKIN} stroke="#c9a08c" strokeWidth="0.5" />
      <ellipse cx="50" cy="44" rx="13.5" ry="17" fill={SKIN} />
      {/* Frange et diadème */}
      <path d="M36 39 C37 25 63 25 64 39 C59 32 53 31 50 35 C47 31 41 32 36 39Z" fill="#ece5fa" />
      <path d="M38 33 Q50 27 62 33" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.2" />
      <path d="M48 28.5 a3 3 0 1 0 4 0 a2.4 2.4 0 1 1 -4 0z" fill="#ffe9a8" />
      {/* Regard */}
      <path d="M41.5 44.5 Q45 41.8 48.2 44.5 Q45 46.2 41.5 44.5Z" fill="#6c2fa8" />
      <path d="M51.8 44.5 Q55 41.8 58.5 44.5 Q55 46.2 51.8 44.5Z" fill="#6c2fa8" />
      <circle cx="45.4" cy="44.2" r="0.6" fill="#fff" />
      <circle cx="55.6" cy="44.2" r="0.6" fill="#fff" />
      <path d="M41 41 Q45 39 48.5 40.6 M51.5 40.6 Q55 39 59 41" stroke="#8d7aa6" strokeWidth="0.6" fill="none" />
      <path d="M50 46 L48.8 52 Q50 53 51.2 52" stroke="#c9a08c" strokeWidth="0.6" fill="none" />
      <path d="M46.5 56 Q50 58.2 53.5 56" stroke="#a5546a" strokeWidth="1" fill="none" />
    </g>
  );
}

function Korrigan({ id }) {
  return (
    <g>
      <circle cx="24" cy="17" r="7" fill="#eef0c8" opacity="0.85" />
      <Stars points={[[40, 6], [62, 10], [86, 6, 0.8], [76, 18]]} />
      {/* Les menhirs du cercle de pierres */}
      <path d="M60 90 L63 32 Q68 25 73 33 L77 90Z" fill="#3a4033" />
      <path d="M82 90 L85 46 Q88 41 91 47 L94 90Z" fill="#30352b" />
      <path d="M6 90 L9 54 Q13 49 17 55 L19 90Z" fill="#30352b" />
      <path d="M64 50 L72 50 M65 62 L73 62" stroke="#4b5242" strokeWidth="0.8" />
      {/* Herbe */}
      <path d="M0 90 L0 84 Q50 78 100 84 L100 90Z" fill="#1d2810" />
      {/* Manteau et capuchon */}
      <path d="M21 90 C23 70 34 58 50 58 C66 58 77 70 79 90Z" fill="#5a3d22" />
      <path d="M26 64 C22 38 34 15 53 12 C62 11 70 18 72 24 C78 34 80 50 75 64 C68 54 60 51 50 51 C40 51 32 54 26 64Z" fill="#6b4a2a" />
      <path d="M53 12 C60 6 70 6 76 12 C70 11 66 14 64 18" fill="#6b4a2a" />
      {/* Oreilles qui dépassent */}
      <path d="M37 47 L25 40 L36 54Z" fill="#9c7444" />
      <path d="M63 47 L75 40 L64 54Z" fill="#9c7444" />
      <ellipse cx="50" cy="50" rx="14" ry="13" fill="#a37a4a" />
      {/* Yeux qui luisent dans l'ombre du capuchon */}
      <circle cx="44" cy="46.5" r="5" fill={`url(#${id}-glow)`} />
      <circle cx="56" cy="46.5" r="5" fill={`url(#${id}-glow)`} />
      <circle cx="44" cy="46.5" r="1.8" fill="#fff2a0" />
      <circle cx="56" cy="46.5" r="1.8" fill="#fff2a0" />
      <path d="M39 42 L47 44 M61 42 L53 44" stroke="#3a2410" strokeWidth="1.2" />
      <path d="M50 47 C46.5 53 47.5 58 51 58 C54.5 58 54 53 51 47Z" fill="#87603a" />
      <path d="M42 59 Q50 65 58 59" stroke="#2e1c0c" strokeWidth="1.2" fill="#3a1f0c" />
      <path d="M45 60.5 L46 62.5 L47 60.8 M53 60.8 L54 62.5 L55 60.5" fill="#efe6c8" />
      {/* Barbe hirsute */}
      <path d="M39 60 L43 71 L46 64 L50 74 L54 64 L57 71 L61 60 Q50 67 39 60Z" fill="#4a3a28" />
      {/* La pièce d'or volée */}
      <circle cx="50" cy="81" r="6.5" fill={`url(#${id}-gold)`} stroke="#6b4a12" strokeWidth="0.6" />
      <circle cx="50" cy="81" r="4.2" fill="none" stroke="#8a5a17" strokeWidth="0.6" />
      <path d="M50 77.8 L50 84.2 M47.6 81 L52.4 81" stroke="#8a5a17" strokeWidth="0.7" />
      <ellipse cx="42" cy="82" rx="3.2" ry="2.4" fill="#a37a4a" />
      <ellipse cx="58" cy="82" rx="3.2" ry="2.4" fill="#a37a4a" />
    </g>
  );
}

function Fee({ id }) {
  return (
    <g>
      <Stars
        points={[[8, 8, 0.8], [18, 22], [30, 6], [70, 8], [92, 18, 0.8], [86, 40], [10, 50], [94, 62], [6, 74], [60, 4, 0.5]]}
      />
      {/* Ailes de papillon, translucides */}
      <g opacity="0.75" stroke="#e6f4ff" strokeWidth="0.6">
        <ellipse cx="28" cy="38" rx="17" ry="22" transform="rotate(-28 28 38)" fill="#9fd3ff" fillOpacity="0.45" />
        <ellipse cx="72" cy="38" rx="17" ry="22" transform="rotate(28 72 38)" fill="#9fd3ff" fillOpacity="0.45" />
        <ellipse cx="30" cy="66" rx="10" ry="14" transform="rotate(30 30 66)" fill="#c6b2ff" fillOpacity="0.45" />
        <ellipse cx="70" cy="66" rx="10" ry="14" transform="rotate(-30 70 66)" fill="#c6b2ff" fillOpacity="0.45" />
        <path d="M44 52 C34 40 24 26 18 22 M56 52 C66 40 76 26 82 22" fill="none" />
      </g>
      {/* Chignon et chevelure dorée */}
      <path d="M35 44 C33 28 67 28 65 44 C66 54 64 62 60 66 L40 66 C36 62 34 54 35 44Z" fill="#e3b85a" />
      <circle cx="50" cy="24" r="7.5" fill="#e3b85a" />
      <circle cx="44" cy="22" r="1.6" fill="#ff9fc4" />
      <circle cx="56" cy="21" r="1.6" fill="#ffd3e6" />
      <circle cx="50" cy="17" r="1.6" fill="#ff9fc4" />
      {/* Robe constellée */}
      <path d="M24 90 C28 74 38 67 50 67 C62 67 72 74 76 90Z" fill="#3a5fb8" />
      <path d="M38 70 Q50 78 62 70" fill="none" stroke="#dfe9ff" strokeWidth="1" />
      <Stars points={[[34, 82], [44, 86], [58, 80], [66, 86], [50, 76]]} fill="#e8f0ff" />
      <path d="M44 56 L44 68 L56 68 L56 56Z" fill="#ead0c2" />
      <ellipse cx="50" cy="45" rx="12.5" ry="15.5" fill="#f5e0d3" />
      <path d="M37.5 40 C40 30 60 30 62.5 40 C58 35 54 34 50 36 C46 34 42 35 37.5 40Z" fill="#f0c873" />
      {/* Yeux mi-clos, bienveillants */}
      <path d="M41.5 45 Q45 47.4 48.2 45 M51.8 45 Q55 47.4 58.5 45" stroke="#3a3a6a" strokeWidth="1" fill="none" />
      <path d="M41.2 44.6 l-1 -1 M58.8 44.6 l1 -1" stroke="#3a3a6a" strokeWidth="0.6" />
      <circle cx="42" cy="51" r="2.6" fill="#ff8fa8" opacity="0.35" />
      <circle cx="58" cy="51" r="2.6" fill="#ff8fa8" opacity="0.35" />
      <path d="M50 47 L49.2 51.5" stroke="#d2a894" strokeWidth="0.6" />
      <path d="M46.8 55 Q50 57.6 53.2 55" stroke="#c0506c" strokeWidth="1" fill="none" />
      {/* La baguette et son étoile */}
      <path d="M69 86 L84 30" stroke="#efe2b8" strokeWidth="1.6" />
      <circle cx="69.5" cy="83" r="3" fill="#ead0c2" />
      <circle cx="84" cy="27" r="10" fill={`url(#${id}-glow)`} />
      <polygon points={star(84, 27, 6)} fill="#fff1a8" stroke="#d6a23e" strokeWidth="0.5" />
      <Stars points={[[76, 20, 0.9], [92, 32, 0.8], [79, 38, 0.6], [90, 18, 0.7]]} fill="#fffbe0" />
    </g>
  );
}

function Lutin({ id }) {
  return (
    <g>
      <Stars points={[[12, 14, 0.9], [20, 40, 0.7], [86, 40, 0.9], [90, 70, 0.7], [10, 70, 0.8]]} fill="#d9fff8" />
      {/* Tunique */}
      <path d="M21 90 C25 73 36 67 50 67 C64 67 75 73 79 90Z" fill="#8a3b2a" />
      <path d="M50 67 L50 90" stroke="#5e2418" strokeWidth="0.8" />
      <circle cx="50" cy="75" r="1" fill="#e8c46a" />
      <circle cx="50" cy="82" r="1" fill="#e8c46a" />
      <path d="M44 57 L44 68 L56 68 L56 57Z" fill="#d9b088" />
      {/* Grandes oreilles */}
      <path d="M36 48 C25 39 16 40 13 45 C20 50 27 57 37 57Z" fill="#e9c49c" stroke="#b98a5e" strokeWidth="0.5" />
      <path d="M64 48 C75 39 84 40 87 45 C80 50 73 57 63 57Z" fill="#e9c49c" stroke="#b98a5e" strokeWidth="0.5" />
      <path d="M33 48 C26 44 20 44 18 46 C24 49 29 52 34 53Z" fill="#cf9f78" />
      <path d="M67 48 C74 44 80 44 82 46 C76 49 71 52 66 53Z" fill="#cf9f78" />
      <ellipse cx="50" cy="51" rx="15" ry="14.5" fill="#efcaa2" />
      {/* Bonnet pointu à grelot */}
      <path d="M33 45 C34 30 44 20 56 18 C67 16 77 10 86 5 C79 16 71 30 67 45Z" fill="#c0392b" />
      <path d="M58 22 C64 20 70 16 76 12" stroke="#e05a48" strokeWidth="1" fill="none" />
      <path d="M32 44 Q50 37 68 44 L68 49 Q50 42 32 49Z" fill="#8e2a1f" />
      <circle cx="87" cy="6" r="3.3" fill={`url(#${id}-gold)`} />
      <path d="M85.6 7.4 L88.4 7.4" stroke="#6b4a12" strokeWidth="0.5" />
      {/* Regard en coin : il prépare un tour */}
      <path d="M40 49 Q44 46.5 48 49" stroke="#3d2a1a" strokeWidth="1" fill="#fff" />
      <path d="M52 49 Q56 46.5 60 49" stroke="#3d2a1a" strokeWidth="1" fill="#fff" />
      <circle cx="46.4" cy="48.6" r="1.2" fill="#1f5459" />
      <circle cx="58.4" cy="48.6" r="1.2" fill="#1f5459" />
      <path d="M39 45.5 L47 44 M53 43 L61 45.8" stroke="#6b4a2a" strokeWidth="1" />
      <path d="M50 50 C49 54 50 56 53 55.5" stroke="#b98a5e" strokeWidth="0.9" fill="none" />
      <g fill="#c98e6a">
        <circle cx="42" cy="54" r="0.5" />
        <circle cx="44" cy="55.4" r="0.5" />
        <circle cx="58" cy="54" r="0.5" />
        <circle cx="56" cy="55.4" r="0.5" />
      </g>
      <path d="M41 58.5 Q50 67 60 57.5 Q50 61.5 41 58.5Z" fill="#5a1f14" />
      <path d="M43.5 59.6 Q50 62 57.8 58.8 L57 60 Q50 62.6 44.4 60.6Z" fill="#fff8ec" />
      {/* La clé, qu'il fait tourner */}
      <circle cx="73" cy="76" r="4" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.6" />
      <path d="M76 79 L84 88 M81 85 L83 83 M83 87 L85 85" stroke="#d6a23e" strokeWidth="1.5" />
      <ellipse cx="70" cy="80" rx="3.2" ry="2.6" fill="#efcaa2" />
    </g>
  );
}

function Farfadet({ id }) {
  return (
    <g>
      {/* Roseaux du marais */}
      <g stroke="#2a1208" strokeWidth="1.3" fill="none">
        <path d="M6 90 Q8 66 4 48 M12 90 Q12 70 16 58 M90 90 Q92 62 96 50 M84 90 Q86 72 82 60" />
      </g>
      <g fill="#2a1208">
        <ellipse cx="4" cy="46" rx="1.4" ry="4" />
        <ellipse cx="96" cy="48" rx="1.4" ry="4" />
      </g>
      {/* Feux follets */}
      <Glow id={id} x={20} y={28} r={7} />
      <Glow id={id} x={82} y={20} r={6} />
      <Glow id={id} x={86} y={60} r={5} />
      <Glow id={id} x={14} y={64} r={5} />
      <path d="M0 90 L0 86 Q50 80 100 86 L100 90Z" fill="#140603" />
      {/* Cape sombre */}
      <path d="M25 90 C29 73 40 67 50 67 C60 67 71 73 75 90Z" fill="#3d1f12" />
      <path d="M40 68 L50 78 L60 68" fill="none" stroke="#7a3a1a" strokeWidth="1" />
      <path d="M45 56 L45 68 L55 68 L55 56Z" fill="#d79f70" />
      <path d="M38 46 L30 40 L38 52Z" fill="#e2aa7c" />
      <path d="M62 46 L70 40 L62 52Z" fill="#e2aa7c" />
      <ellipse cx="50" cy="48" rx="12" ry="16" fill="#ebbd8e" />
      {/* Chevelure de flammes */}
      <defs>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff5a1f" />
          <stop offset="60%" stopColor="#ffa23a" />
          <stop offset="100%" stopColor="#fff09a" />
        </linearGradient>
      </defs>
      <path
        d="M37 44 C34 31 40 23 43 13 C45 22 48 24 50 8 C52 22 56 22 60 11 C61 23 67 30 63 44 C58 36 43 36 37 44Z"
        fill={`url(#${id}-flame)`}
      />
      {/* Yeux d'ambre fendus */}
      <ellipse cx="45" cy="47" rx="2.6" ry="1.7" fill="#ffcc33" />
      <ellipse cx="55" cy="47" rx="2.6" ry="1.7" fill="#ffcc33" />
      <ellipse cx="45" cy="47" rx="0.6" ry="1.5" fill="#2a1208" />
      <ellipse cx="55" cy="47" rx="0.6" ry="1.5" fill="#2a1208" />
      <path d="M41 43.5 L48 44.8 M59 43.5 L52 44.8" stroke="#7a2b12" strokeWidth="1" />
      <path d="M50 46 C49 52 52 58 56 58 C53 56 52 52 52 46Z" fill="#cf9566" />
      <path d="M44.5 60 Q51 62.5 56.5 58" stroke="#6b2a12" strokeWidth="1.1" fill="none" />
      {/* La flamme qu'il tient au creux des mains */}
      <circle cx="50" cy="80" r="11" fill={`url(#${id}-glow)`} />
      <path d="M50 70 C55 76 56 80 53 84 C51 86 49 86 47 84 C44 80 46 76 50 70Z" fill={`url(#${id}-flame)`} />
      <ellipse cx="42.5" cy="85" rx="3.5" ry="2.6" fill="#e2aa7c" />
      <ellipse cx="57.5" cy="85" rx="3.5" ry="2.6" fill="#e2aa7c" />
    </g>
  );
}

function Gnome({ id }) {
  return (
    <g>
      {/* Champignons */}
      <path d="M2 80 Q13 62 26 80Z" fill="#c0392b" />
      <rect x="11" y="79" width="6" height="11" rx="2" fill="#efe3c8" />
      <g fill="#fff6e6">
        <circle cx="10" cy="74" r="1.4" />
        <circle cx="17" cy="70" r="1.2" />
        <circle cx="20" cy="76" r="1" />
      </g>
      <path d="M82 84 Q89 74 98 84Z" fill="#d9572b" />
      <rect x="87.5" y="83" width="4" height="7" rx="1.5" fill="#efe3c8" />
      <path d="M0 90 L0 87 Q50 82 100 87 L100 90Z" fill="#2a140c" />
      {/* La pioche sur l'épaule */}
      <path d="M17 88 L36 50" stroke="#7a4a22" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24 46 Q36 40 48 52 Q36 47 30 50Z" fill="#9aa3ad" stroke="#5d646c" strokeWidth="0.6" />
      {/* Manteau bleu, ceinture */}
      <path d="M18 90 C22 72 34 66 50 66 C66 66 78 72 82 90Z" fill="#3f5a8a" />
      <rect x="20" y="84" width="60" height="4" fill="#3a2414" />
      <rect x="47" y="83.4" width="6" height="5.2" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1" />
      {/* Barbe blanche */}
      <path d="M34 50 C32 66 40 82 50 86 C60 82 68 66 66 50 C60 57 40 57 34 50Z" fill="#f4f1ea" />
      <path d="M42 62 Q44 72 48 78 M50 62 L50 80 M58 62 Q56 72 52 78" stroke="#d6d0c4" strokeWidth="0.7" fill="none" />
      <ellipse cx="50" cy="46" rx="14" ry="12" fill="#f0c4a0" />
      {/* Bonnet rouge */}
      <path d="M32 45 C36 30 44 14 53 4 C58 18 64 31 68 45 Q50 38 32 45Z" fill="#b3202b" />
      <path d="M53 4 C57 14 60 22 62 30" stroke="#d64550" strokeWidth="1.1" fill="none" />
      <path d="M31 45 Q50 37 69 45 Q50 42 31 47Z" fill="#7d141d" />
      <path d="M40 43 L47 44.4 M53 44.4 L60 43" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="44" cy="47.5" r="1.3" fill="#2a1a10" />
      <circle cx="56" cy="47.5" r="1.3" fill="#2a1a10" />
      <circle cx="50" cy="51" r="4.6" fill="#e59f84" />
      <circle cx="48.6" cy="49.6" r="1.2" fill="#f7c4b0" />
      <path d="M38 57 Q44 52 50 55.5 Q56 52 62 57 Q56 59 50 57.5 Q44 59 38 57Z" fill="#ffffff" />
      {/* La gemme trouvée */}
      <polygon points="66,74 71,70 76,74 71,82" fill="#5ee1f0" stroke="#1d7f8c" strokeWidth="0.7" />
      <path d="M66 74 L76 74 M71 70 L69 74 L71 82 L73 74 Z" stroke="#bff6ff" strokeWidth="0.4" fill="none" />
      <ellipse cx="66" cy="80" rx="3.6" ry="2.8" fill="#f0c4a0" />
    </g>
  );
}

function Dryade() {
  return (
    <g>
      {/* Tronc en arrière-plan */}
      <path d="M78 90 C80 60 76 30 84 0 L100 0 L100 90Z" fill="#3b2a18" />
      <path d="M86 10 C84 30 88 50 86 80 M92 20 C91 40 94 60 92 88" stroke="#28190c" strokeWidth="0.8" fill="none" />
      {/* Branches-cheveux, déployées */}
      <g stroke="#4a3320" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M42 30 C34 22 26 18 18 12" />
        <path d="M58 30 C66 22 72 16 80 10" />
        <path d="M36 40 C26 38 18 40 10 36" />
        <path d="M64 40 C72 38 80 42 88 38" />
        <path d="M30 18 L26 8" />
        <path d="M70 18 L74 7" />
      </g>
      <g fill="#6bbf4f">
        {[
          [18, 12, -30], [24, 16, 20], [26, 7, -60], [80, 10, 30], [74, 15, -20], [74, 6, 60],
          [10, 36, -10], [16, 40, 30], [88, 38, 10], [82, 42, -30], [33, 25, -40], [67, 24, 40],
        ].map(([x, y, a], i) => (
          <ellipse key={i} cx={x} cy={y} rx="3.4" ry="1.7" transform={`rotate(${a} ${x} ${y})`} fill={i % 3 ? '#6bbf4f' : '#9be06e'} />
        ))}
      </g>
      {/* Longue chevelure verte */}
      <path d="M34 46 C30 26 70 26 66 46 C70 60 72 76 66 90 L34 90 C28 76 30 60 34 46Z" fill="#2f6a2a" />
      <path d="M36 54 C34 66 35 78 38 90 M64 54 C66 66 65 78 62 90" stroke="#225020" strokeWidth="1" fill="none" />
      {/* Robe d'écorce et de feuilles */}
      <path d="M22 90 C26 74 36 68 50 68 C64 68 74 74 78 90Z" fill="#5d7a3a" />
      <path d="M30 86 Q36 78 42 86 M46 82 Q52 74 58 82 M60 88 Q66 80 72 88" stroke="#87a85a" strokeWidth="1" fill="none" />
      <path d="M44 56 L44 69 L56 69 L56 56Z" fill="#cbd6a8" />
      <ellipse cx="50" cy="45" rx="13" ry="16" fill="#dbe5bd" />
      {/* Couronne de fleurs */}
      <path d="M37 37 C40 28 60 28 63 37 C57 33 43 33 37 37Z" fill="#3d8a36" />
      {[[39, 33], [45, 30], [50, 29], [55, 30], [61, 33]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="1.9" fill={i % 2 ? '#fff4f8' : '#ffb3cf'} />
          <circle cx={x} cy={y} r="0.6" fill="#f2c94c" />
        </g>
      ))}
      {/* Regard */}
      <path d="M41.5 45 Q45 42.2 48.3 45 Q45 46.8 41.5 45Z" fill="#2f7d2b" />
      <path d="M51.7 45 Q55 42.2 58.5 45 Q55 46.8 51.7 45Z" fill="#2f7d2b" />
      <circle cx="45.2" cy="44.6" r="0.6" fill="#fff" />
      <circle cx="55.2" cy="44.6" r="0.6" fill="#fff" />
      <path d="M41 44 l-1.4 -1.2 M59 44 l1.4 -1.2" stroke="#2a3a1a" strokeWidth="0.6" />
      <path d="M39.5 51 Q41 49 42.5 51 Q41 52.5 39.5 51Z" fill="#7cbf5a" opacity="0.8" />
      <path d="M50 46.5 L49 51.5 Q50 52.3 51 51.5" stroke="#9fae80" strokeWidth="0.6" fill="none" />
      <path d="M46.5 55.5 Q50 57.8 53.5 55.5 Q50 56.6 46.5 55.5Z" fill="#9a5a4a" stroke="#9a5a4a" strokeWidth="0.6" />
      {/* Une feuille dans la main */}
      <ellipse cx="30" cy="80" rx="3.2" ry="2.6" fill="#cbd6a8" />
      <path d="M30 78 C25 71 28 64 35 61 C36 68 34 74 30 78Z" fill="#9be06e" stroke="#3d8a36" strokeWidth="0.5" />
    </g>
  );
}

const PORTRAITS = { elfe: Elfe, korrigan: Korrigan, fee: Fee, lutin: Lutin, farfadet: Farfadet, gnome: Gnome, dryade: Dryade };

export default function CardArt({ race, className = '' }) {
  const id = useId().replace(/:/g, '');
  const Portrait = PORTRAITS[race];
  return (
    <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <Backdrop id={id} race={race} />
      {Portrait && <Portrait id={id} />}
      <Vignette id={id} />
    </svg>
  );
}

/** Points d'une étoile à sept branches — l'emblème du dos des cartes. */
function heptagram(cx, cy, r) {
  // {7/3} : on relie chaque sommet au troisième suivant.
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return Array.from({ length: 7 }, (_, i) => pts[(i * 3) % 7].map((v) => v.toFixed(2)).join(',')).join(' ');
}

/** Le dos des cartes : cuir sombre, filets d'or, l'étoile des sept peuples. */
export function CardBackArt({ className = '' }) {
  const id = useId().replace(/:/g, '');
  const races = Object.keys(RACE_STYLE);
  return (
    <svg viewBox="0 0 100 140" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-leather`} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#4a2f22" />
          <stop offset="70%" stopColor="#24150f" />
          <stop offset="100%" stopColor="#120a07" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="50%" stopColor="#c99335" />
          <stop offset="100%" stopColor="#7a4c10" />
        </linearGradient>
      </defs>
      <rect width="100" height="140" fill={`url(#${id}-leather)`} />
      <rect x="6" y="6" width="88" height="128" rx="5" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.4" />
      <rect x="9.5" y="9.5" width="81" height="121" rx="3.5" fill="none" stroke="#c99335" strokeWidth="0.4" opacity="0.7" />
      {/* Les sept gemmes, une par peuple, autour de l'emblème */}
      {races.map((race, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
        const x = 50 + 33 * Math.cos(a);
        const y = 70 + 33 * Math.sin(a);
        return <circle key={race} cx={x} cy={y} r="2.6" fill={RACE_STYLE[race].accent} stroke={`url(#${id}-gold)`} strokeWidth="0.7" />;
      })}
      <circle cx="50" cy="70" r="27" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.2" />
      <circle cx="50" cy="70" r="24" fill="#1a0f0a" stroke="#c99335" strokeWidth="0.4" />
      <polygon points={heptagram(50, 70, 21)} fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="50" cy="70" r="5" fill={`url(#${id}-gold)`} />
      {/* Coins ouvragés */}
      {[[14, 14, 0], [86, 14, 90], [86, 126, 180], [14, 126, 270]].map(([x, y, r]) => (
        <path key={r} d="M0 8 Q0 0 8 0 M3 10 Q3 3 10 3" transform={`translate(${x - 5} ${y - 5}) rotate(${r} 5 5)`} stroke="#c99335" strokeWidth="0.8" fill="none" />
      ))}
    </svg>
  );
}
