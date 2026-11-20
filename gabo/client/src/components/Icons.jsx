/**
 * Les pictogrammes du jeu, tracés au trait — une seule épaisseur, une seule
 * famille. Ils remplacent les emojis, qui changent d'allure d'un téléphone à
 * l'autre et donnent à n'importe quelle interface un air de gabarit.
 */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

/** Une feuille de marque. */
export const IconScore = (p) => (
  <svg {...base} {...p}>
    <path d="M6 3h12v18H6z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);
/** Le journal : des lignes de texte. */
export const IconLog = (p) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M4 11h16M4 16h10" />
  </svg>
);
export const IconRules = (p) => (
  <svg {...base} {...p}>
    <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" />
    <path d="M9 9h6M9 13h4" />
  </svg>
);
export const IconSound = (p) => (
  <svg {...base} {...p}>
    <path d="M4 10v4h4l5 4V6L8 10z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
export const IconMute = (p) => (
  <svg {...base} {...p}>
    <path d="M4 10v4h4l5 4V6L8 10z" />
    <path d="M17 10l4 4M21 10l-4 4" />
  </svg>
);
/** Quitter : une porte entrouverte. */
export const IconLeave = (p) => (
  <svg {...base} {...p}>
    <path d="M14 4H6v16h8" />
    <path d="M11 12h9M17 9l3 3-3 3" />
  </svg>
);
/** Dire un mot à la table. */
export const IconTalk = (p) => (
  <svg {...base} {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);
export const IconLink = (p) => (
  <svg {...base} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);
export const IconClose = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
/** Presser : un sablier. */
export const IconHurry = (p) => (
  <svg {...base} {...p}>
    <path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" />
  </svg>
);
