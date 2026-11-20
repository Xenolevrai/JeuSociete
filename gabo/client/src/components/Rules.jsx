/** Les règles, telles qu'on les joue ici — y compris ce que le jeu en ligne a dû préciser. */
import Card from './Card.jsx';

export default function Rules({ onClose, settings }) {
  const limit = settings?.threshold ?? 5;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <article
        className="mx-auto my-6 max-w-2xl rounded-2xl bg-[var(--color-paper)] px-5 py-6 text-zinc-800 shadow-2xl sm:px-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-4xl font-bold text-[var(--color-back)]">Règles du Gabo</h2>
          <button type="button" onClick={onClose} className="h-10 w-10 rounded-full text-xl hover:bg-black/5" aria-label="Fermer">✕</button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">Un jeu de 54 cartes, de 2 à 8 joueuses. Le but : finir la manche avec le moins de points possible.</p>

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
        <p className="mt-2 text-sm text-zinc-600">Une carte prise dans la défausse, ou remplacée dans ton jeu, n'a pas de pouvoir.</p>

        <H>Poser sur la défausse</H>
        <p>Dès qu'une joueuse jette une carte pendant son tour, <b>les autres</b> peuvent poser dessus une, deux ou trois cartes <b>de la même valeur</b> prises dans leur jeu (un 7 sur un 7, un roi sur un roi…).</p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>La plus rapide l'emporte : une fois qu'une joueuse a posé, les autres gardent leur carte.</li>
          <li>Tu te trompes ? La carte est montrée à toute la table, reprend sa place, et tu <b>pioches une carte de pénalité</b>.</li>
          <li>Tu peux aussi poser une carte <b>d'une adversaire</b> si tu sais qu'elle correspond : elle part à la défausse et cette adversaire <b>pioche {settings?.opponentSnapPenalty ?? 2} cartes</b> face cachée.</li>
          <li>En ligne, la défausse reste ouverte quelques secondes ({settings?.snapSeconds ?? 5} s), avec un compte à rebours visible de toutes. Touche « Poser », puis la carte.</li>
        </ul>

        <H>Annoncer Gabo</H>
        <p>Quand tu penses avoir <b>{limit} points ou moins</b>, annonce « Gabo » au début de ton tour, à la place de jouer. Les autres jouent chacune un dernier tour, puis on retourne tout.</p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>L'annonceuse gagne si elle a au plus {limit} points <b>et</b> strictement moins que toutes les autres.</li>
          <li>Sinon, c'est l'adversaire avec le moins de points qui gagne. <b>En cas d'égalité, l'annonceuse perd toujours.</b></li>
          <li>Celle qui se débarrasse de toutes ses cartes arrête la manche aussitôt : c'est un Gabo automatique.</li>
        </ul>

        <H>Valeur des cartes</H>
        <div className="flex flex-wrap items-end gap-3 text-[26px]">
          <Value card={{ rank: 'A', suit: 'S' }} v="1" />
          <Value card={{ rank: '5', suit: 'H' }} v="2 à 10 : leur chiffre" />
          <Value card={{ rank: 'J', suit: 'C' }} v="Valet : 10" />
          <Value card={{ rank: 'Q', suit: 'D' }} v="Dame : 10" />
          <Value card={{ rank: 'K', suit: 'S' }} v="Roi ♠ ♣ : 15" />
          <Value card={{ rank: 'K', suit: 'H' }} v="Roi ♥ ♦ : 0" />
          <Value card={{ rank: 'JOKER', suit: null }} v={`Joker : ${settings?.jokerValue ?? 0}`} />
        </div>

        <H>Astuces pour jouer en ligne</H>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          <li>Les jeux de toutes sont affichés comme leur propriétaire les voit : « en haut à gauche » veut dire la même chose pour tout le monde.</li>
          <li>Quand quelqu'un regarde ou échange une carte, la place concernée clignote pour toute la table — comme quand on la voit faire en vrai.</li>
          <li>Une absente n'arrête pas la partie : au bout de quelques secondes, son tour se joue automatiquement, et elle reprend la main en revenant (même pseudo, même code).</li>
          <li>Variante : l'hôte peut monter la limite du Gabo à 7 points, ou activer l'aide-mémoire pour les plus jeunes.</li>
        </ul>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-[var(--color-back)] py-3 font-semibold text-white">
          J'ai compris
        </button>
      </article>
    </div>
  );
}

function H({ children }) {
  return <h3 className="mt-5 mb-1.5 font-display text-2xl font-bold text-zinc-900">{children}</h3>;
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

function Value({ card, v }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Card card={card} />
      <span className="max-w-[5.5rem] text-center text-[11px] leading-tight text-zinc-600">{v}</span>
    </span>
  );
}
