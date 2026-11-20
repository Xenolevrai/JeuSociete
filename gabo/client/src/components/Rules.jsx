/** Les règles, telles qu'on les joue ici — y compris ce que le jeu en ligne a dû préciser. */
import Card from './Card.jsx';
import { IconClose } from './Icons.jsx';

export default function Rules({ onClose, settings }) {
  const limit = settings?.threshold ?? 5;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[var(--color-felt-dark)]/85" onClick={onClose}>
      <article
        className="paper mx-auto my-4 max-w-2xl rounded-[3px] px-5 py-6 text-[15px] leading-relaxed shadow-[0_16px_40px_rgba(0,0,0,0.4)] sm:my-8 sm:px-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-4xl italic" style={{ fontVariationSettings: '"SOFT" 100' }}>Le Gabo</h2>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center text-[var(--color-ink-soft)]" aria-label="Fermer"><IconClose /></button>
        </div>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Un jeu de 52 cartes (sans les jokers), de 2 à 8 joueuses. Le but : finir la manche avec le moins de points possible.</p>

        <H>Mise en place</H>
        <p>Chacune reçoit 4 cartes, posées face cachée en carré devant elle. <b>Leur place ne change jamais.</b> Au début, on regarde en secret ses <b>deux cartes du bas</b>, puis elles se retournent : à toi de t'en souvenir.</p>

        <H>À ton tour, au choix</H>
        <ol className="ml-5 list-decimal space-y-1">
          <li><b>Prendre la défausse</b> : la carte visible remplace une de tes cartes, qui part à la défausse.</li>
          <li><b>Piocher et garder</b> : la carte piochée remplace une de tes cartes, qui part à la défausse.</li>
          <li><b>Piocher et jeter</b> : la carte piochée part à la défausse — et si c'est une carte à pouvoir, tu peux l'utiliser :</li>
        </ol>
        <ul className="mt-2 space-y-2">
          <Power cards={['7', '8']} text="Regarde une de tes cartes." />
          <Power cards={['9', '10']} text="Regarde une carte d'une adversaire." />
          <Power cards={['J', 'Q']} text="Échange à l'aveugle une de tes cartes avec une carte d'une adversaire. Tu regardes celle que tu as prise ; elle, non." />
        </ul>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Une carte prise dans la défausse, ou remplacée dans ton jeu, n'a pas de pouvoir.</p>

        <H>Poser sur la défausse</H>
        <p>Dès qu'une joueuse jette une carte pendant son tour, <b>les autres</b> peuvent poser dessus une, deux ou trois cartes <b>de la même valeur</b> prises dans leur jeu (un 7 sur un 7, un roi sur un roi…).</p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>La plus rapide l'emporte : une fois qu'une joueuse a posé, les autres gardent leur carte.</li>
          <li>Tu te trompes ? La carte est montrée à toute la table, reprend sa place, et tu <b>pioches une carte de pénalité</b>.</li>
          <li>Tu peux aussi poser une carte <b>d'une adversaire</b> si tu sais qu'elle correspond : elle part à la défausse et cette adversaire <b>pioche {settings?.opponentSnapPenalty ?? 2} cartes</b> face cachée.</li>
          <li>En ligne, la défausse reste ouverte quelques secondes ({settings?.snapSeconds ?? 5} s) — un trait se consume sous la défausse. Pendant ce temps, <b>toucher une carte, c'est la poser</b> : la tienne, ou celle d'une autre.</li>
          <li>Pour poser la carte d'une autre, il faut la connaître : c'est à ça que servent les 9 et les 10.</li>
        </ul>

        <H>Annoncer Gabo</H>
        <p>Quand tu penses avoir <b>{limit} points ou moins</b>, annonce « Gabo » au début de ton tour, à la place de jouer. Les autres jouent chacune un dernier tour, puis on retourne tout.</p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>L'annonceuse gagne si elle a au plus {limit} points <b>et</b> strictement moins que toutes les autres.</li>
          <li>Sinon, c'est l'adversaire avec le moins de points qui gagne. <b>En cas d'égalité, l'annonceuse perd toujours.</b></li>
          <li>Celle qui se débarrasse de toutes ses cartes arrête la manche aussitôt : c'est un Gabo automatique.</li>
        </ul>

        <H>Valeur des cartes</H>
        <div className="grid grid-cols-7 gap-x-1.5 gap-y-3 text-[22px] sm:text-[26px]">
          {DECK.map(([rank, suit, v]) => (
            <Value key={rank + suit} card={{ rank, suit }} v={v} />
          ))}
        </div>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Le Valet et la Dame valent 10. Les rois noirs (♠ ♣) valent 15, les rois rouges (♥ ♦) ne valent rien : un roi rouge est la meilleure carte du jeu.</p>

        <H>Astuces pour jouer en ligne</H>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>Les jeux de toutes sont affichés comme leur propriétaire les voit : « en haut à gauche » veut dire la même chose pour tout le monde.</li>
          <li>Quand quelqu'un regarde ou échange une carte, la place concernée se souligne pour toute la table — comme quand on la voit faire en vrai.</li>
          <li>Une absente n'arrête pas la partie : au bout de quelques secondes, son tour se joue automatiquement, et elle reprend la main en revenant (même pseudo, même code).</li>
          <li>Variante : l'hôte peut monter la limite du Gabo à 7 points, ou activer l'aide-mémoire pour les plus jeunes.</li>
        </ul>
        <button type="button" onClick={onClose} className="btn btn-ink mt-6 w-full">
          J'ai compris
        </button>
      </article>
    </div>
  );
}

function H({ children }) {
  return <h3 className="mt-6 mb-1.5 font-display text-xl font-semibold">{children}</h3>;
}

function Power({ cards, text }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex gap-1 text-[20px]">
        {cards.map((r) => (
          <Card key={r} card={{ rank: r, suit: r === 'Q' || r === '8' || r === '10' ? 'H' : 'S' }} />
        ))}
      </span>
      <span>{text}</span>
    </li>
  );
}

/** Toute une couleur, de l'As au Roi, pour voir d'un coup d'œil ce que vaut chaque carte. */
const DECK = [
  ['A', 'S', '1'], ['2', 'H', '2'], ['3', 'C', '3'], ['4', 'D', '4'], ['5', 'S', '5'], ['6', 'H', '6'], ['7', 'C', '7'],
  ['8', 'D', '8'], ['9', 'S', '9'], ['10', 'H', '10'], ['J', 'C', '10'], ['Q', 'D', '10'], ['K', 'S', '15'], ['K', 'H', '0'],
];

function Value({ card, v }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Card card={card} />
      <span className="font-display text-sm leading-none">{v}</span>
    </span>
  );
}
