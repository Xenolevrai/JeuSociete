/**
 * Les illustrations des Sept Peuples : les vraies cartes illustrées du jeu.
 */
import dryadeImg from './assets/dryade.jpg';
import elfeImg from './assets/elfe.jpg';
import farfadetImg from './assets/farfadet.jpg';
import feeImg from './assets/fee.jpg';
import gnomeImg from './assets/gnome.jpg';
import korriganImg from './assets/korrigan.jpg';
import lutinImg from './assets/lutin.jpg';
import backImg from './assets/back.jpg';
import coverImg from './assets/cover.jpg';

/** Les couleurs de chaque peuple : pour les badges, bandeaux et compteurs. */
export const RACE_STYLE = {
  elfe: { light: '#c79be9', mid: '#3b1d5e', dark: '#12091f', title: '#f4c45a', accent: '#8b55c4' },
  korrigan: { light: '#a8bd6e', mid: '#2e3d17', dark: '#0d1407', title: '#e9d27a', accent: '#6f8a34' },
  fee: { light: '#7d9cf0', mid: '#1c2b5c', dark: '#0a1026', title: '#cfe0ff', accent: '#4f74d6' },
  lutin: { light: '#93d8d0', mid: '#1f5459', dark: '#0a1c1f', title: '#f0e4c0', accent: '#2f8b8f' },
  farfadet: { light: '#ffb46a', mid: '#7a2b12', dark: '#1f0a05', title: '#ffe08a', accent: '#d2662a' },
  gnome: { light: '#e9b58c', mid: '#5c2a1c', dark: '#1c0d08', title: '#ff6b5e', accent: '#b3202b' },
  dryade: { light: '#cfe8a0', mid: '#2f5a2a', dark: '#0c1a0a', title: '#b9f28a', accent: '#4f9a3f' },
};

export const CARD_IMAGES = {
  dryade: dryadeImg,
  elfe: elfeImg,
  farfadet: farfadetImg,
  fee: feeImg,
  gnome: gnomeImg,
  korrigan: korriganImg,
  lutin: lutinImg,
};

export const CARD_BACK_IMAGE = backImg;
export const COVER_IMAGE = coverImg;

/**
 * Illustration d'une carte : l'image complète authentique du peuple.
 */
export default function CardArt({ race, className = '', alt = '' }) {
  const src = CARD_IMAGES[race];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt || race}
      className={`h-full w-full object-cover select-none pointer-events-none ${className}`}
      draggable={false}
      loading="lazy"
    />
  );
}

/** Le dos officiel des cartes Fantasy. */
export function CardBackArt({ className = '', alt = 'Fantasy' }) {
  return (
    <img
      src={CARD_BACK_IMAGE}
      alt={alt}
      className={`h-full w-full object-cover select-none pointer-events-none ${className}`}
      draggable={false}
      loading="lazy"
    />
  );
}
