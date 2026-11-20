/**
 * L'accueil de la ludothèque : toutes les boîtes sur l'étagère.
 *
 * On y choisit son jeu, on y rejoint une table dont on a reçu le code — le
 * serveur sait à quel jeu appartient chaque code, on n'a donc pas à le
 * deviner — et l'on y retrouve les parties laissées en plan, tous jeux
 * confondus.
 */
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket.js';
import { COVER_IMAGE } from '../peuples/CardArt.jsx';

/** La fiche de chaque boîte. Ajouter un jeu, c'est ajouter une entrée ici. */
const SHELF = [
  {
    id: 'monopoly',
    title: 'Monopoly',
    tagline: 'Achetez, bâtissez, ruinez vos proches — sept éditions, de Paris à Poudlard.',
    players: '2 – 8',
    duration: '60 – 180 min',
    tags: ['Plateau', 'Négociation', 'Bots'],
    accent: '#c62828',
    Art: MonopolyArt,
  },
  {
    id: 'peuples',
    title: 'Fantasy',
    tagline: 'Elfes, korrigans, fées et lutins : le plus grand peuple l’emporte — ou la plus belle famille.',
    players: '2 – 4',
    duration: '15 – 25 min',
    tags: ['Cartes', 'Bluff', 'Bots'],
    accent: '#c99335',
    Art: PeuplesArt,
  },
  {
    id: 'gabo',
    title: 'Gabo',
    tagline: 'Quatre cartes cachées, une mémoire, des réflexes : le plus petit total l’emporte.',
    players: '2 – 8',
    duration: '10 – 20 min',
    tags: ['Cartes', 'Mémoire', 'Bots'],
    accent: '#21402f',
    Art: GaboArt,
    // Le Gabo est une application à part, servie sous /gabo/ : on y va par
    // une vraie navigation, pas par le routeur de la ludothèque.
    href: '/gabo/',
  },
];

const GAME_NAMES = { monopoly: 'Monopoly', peuples: 'Fantasy', gabo: 'Gabo' };

/** Un plateau en miniature : quatre côtés de couleurs, deux dés. */
function MonopolyArt() {
  const colors = ['#8b4b2a', '#7ec8e3', '#d14fa5', '#f08a24', '#e53935', '#fdd835', '#43a047', '#1e3a8a'];
  const side = (i) => colors[Math.floor(i / 2) % colors.length];
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="hub-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b2a20" />
          <stop offset="1" stopColor="#1c1410" />
        </linearGradient>
      </defs>
      <rect width="200" height="140" fill="url(#hub-wood)" />
      <g transform="translate(100 72) rotate(-8) translate(-55 -55)">
        <rect width="110" height="110" fill="#cfe3d3" stroke="#16130f" strokeWidth="1.5" />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <rect x={14 + i * 9.1} y="0" width="9.1" height="14" fill="#f7f4ea" stroke="#16130f" strokeWidth="0.4" />
            <rect x={14 + i * 9.1} y="10" width="9.1" height="4" fill={side(i)} />
            <rect x={14 + i * 9.1} y="96" width="9.1" height="14" fill="#f7f4ea" stroke="#16130f" strokeWidth="0.4" />
            <rect x={14 + i * 9.1} y="96" width="9.1" height="4" fill={side(i + 8)} />
            <rect x="0" y={14 + i * 9.1} width="14" height="9.1" fill="#f7f4ea" stroke="#16130f" strokeWidth="0.4" />
            <rect x="10" y={14 + i * 9.1} width="4" height="9.1" fill={side(i + 4)} />
            <rect x="96" y={14 + i * 9.1} width="14" height="9.1" fill="#f7f4ea" stroke="#16130f" strokeWidth="0.4" />
            <rect x="96" y={14 + i * 9.1} width="4" height="9.1" fill={side(i + 12)} />
          </g>
        ))}
        {[[0, 0], [96, 0], [0, 96], [96, 96]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" fill="#efe6cf" stroke="#16130f" strokeWidth="0.5" />
        ))}
        <rect x="30" y="47" width="50" height="16" fill="#c62828" stroke="#16130f" transform="rotate(-35 55 55)" />
      </g>
      {/* Deux dés qui roulent */}
      {[[150, 100, 12], [172, 88, -18]].map(([x, y, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#fbf8f0" stroke="#16130f" strokeWidth="0.8" />
          {(i ? [[-5, -5], [5, 5], [0, 0]] : [[-5, -5], [5, 5], [-5, 5], [5, -5]]).map(([dx, dy], k) => (
            <circle key={k} cx={dx} cy={dy} r="1.8" fill="#16130f" />
          ))}
        </g>
      ))}
    </svg>
  );
}

function PeuplesArt() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#120a07]">
      <img src={COVER_IMAGE} alt="Fantasy" className="h-full w-full object-cover object-center" />
    </div>
  );
}

/** Quatre cartes posées en carré sur le feutre, dont deux retournées. */
function GaboArt() {
  const card = (x, y, a, face) => (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <rect x="-15" y="-21" width="30" height="42" rx="2.5" fill="#fbf8f1" stroke="#d6ccb6" />
      {face ? (
        <text x="0" y="6" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fill={face.red ? '#b3322a' : '#1d1b17'}>
          {face.label}
        </text>
      ) : (
        <rect x="-12" y="-18" width="24" height="36" rx="1.5" fill="#8f2a24" />
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden="true">
      <rect width="200" height="140" fill="#21402f" />
      {card(78, 48, -4)}
      {card(116, 46, 3)}
      {card(80, 96, -2, { label: 'R', red: true })}
      {card(118, 94, 5, { label: '7' })}
    </svg>
  );
}

function GameTile({ game, onOpen }) {
  const { Art } = game;
  return (
    // Un couvercle de boîte : l'illustration encadrée d'un filet, l'étiquette
    // imprimée dessous, la bande de couleur de la marque sur le côté.
    <article className="peuples-paper flex flex-col rounded-sm p-3 transition-transform hover:-translate-y-0.5">
      <div className="relative aspect-[10/7] overflow-hidden border-2 border-[#2b1d12]">
        <Art />
      </div>
      <div className="flex flex-1 flex-col gap-3 border-l-[6px] px-4 pb-1 pt-4" style={{ borderColor: game.accent }}>
        <h2 className="font-display text-[34px] font-bold leading-none">{game.title}</h2>
        <p className="font-display text-[17px] italic leading-snug text-[color:var(--pp-ink-soft)]">{game.tagline}</p>
        <div className="flex flex-wrap gap-1.5">
          {game.tags.map((tag) => (
            <span key={tag} className="pp-caps border border-[color:var(--pp-rule)] px-1.5 py-0.5 text-[10px] text-[color:var(--pp-ink-soft)]">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-4 border-t border-[color:var(--pp-rule)] pt-3 text-[11px] text-[color:var(--pp-ink-soft)]">
          <span className="pp-caps">{game.players} joueurs</span>
          <span className="pp-caps">{game.duration}</span>
          <button
            type="button"
            onClick={() => (game.href ? window.location.assign(game.href) : onOpen(game.id))}
            className="ml-auto border border-black/60 px-5 py-2 font-condensed text-sm uppercase tracking-wider text-[#f6ecd2] shadow-[0_2px_0_rgba(0,0,0,.6)] active:translate-y-px"
            style={{ background: game.accent }}
          >
            Jouer
          </button>
        </div>
      </div>
    </article>
  );
}

/** Rejoindre une table par son code, quel que soit le jeu. */
function JoinByCode({ onOpen }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const go = () => {
    setError(null);
    // Les tables de Gabo ont un code de cinq caractères et leur propre registre.
    if (code.length === 5) {
      fetch(`/gabo/api/table/${code}`)
        .then((r) => r.json())
        .then((data) => (data.ok ? window.location.assign(`/gabo/?code=${data.code}`) : setError(data.error ?? 'Code inconnu.')))
        .catch(() => setError('Serveur injoignable.'));
      return;
    }
    fetch(`/api/game/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return setError(data.error ?? 'Code inconnu.');
        onOpen(data.game ?? 'monopoly', `?code=${data.code}`);
      })
      .catch(() => setError('Serveur injoignable.'));
  };
  return (
    <div className="peuples-paper rounded-sm p-5">
      <p className="mb-2 pp-caps text-xs text-[color:var(--pp-ink)]/70">On vous a donné un code ?</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && code.length >= 5 && go()}
          maxLength={6}
          placeholder="CODE"
          className="peuples-input tabular w-full rounded-sm px-3 py-2 text-center font-condensed text-xl tracking-[0.4em]"
        />
        <button type="button" disabled={code.length < 5} onClick={go} className="btn-gold shrink-0 rounded-sm px-5 font-condensed uppercase">
          Rejoindre
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[color:var(--pp-danger)]">{error}</p>}
    </div>
  );
}

/** Les parties en cours sur ce serveur, tous jeux confondus. */
function InProgress() {
  const [games, setGames] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then((data) => setGames(data.games ?? []))
      .catch(() => setGames([]));
  }, []);
  if (!games.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="pp-caps text-xs text-[color:var(--pp-ink)]/70">Parties en cours</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {games.slice(0, 8).map((game) => (
          <div key={game.code} className="peuples-paper rounded-sm">
            <button type="button" onClick={() => setOpen(open === game.code ? null : game.code)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
              <span className="tabular font-condensed tracking-[0.2em] text-[color:var(--pp-accent)]">{game.code}</span>
              <span className="text-xs text-[color:var(--pp-ink)]/60">{GAME_NAMES[game.game] ?? game.game}</span>
              <span className="ml-auto truncate text-xs text-[color:var(--pp-ink)]/80">{game.players.map((p) => p.name).join(', ')}</span>
            </button>
            {open === game.code && (
              <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--pp-rule)] p-2">
                {game.players
                  .filter((p) => !p.bot)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => socket.emit('game:rejoin', { code: game.code, playerIds: [p.id] })}
                      className="btn-ghost rounded-sm px-3 py-1 text-xs"
                    >
                      Je suis {p.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Hub({ onOpen }) {
  return (
    <div className="peuples-bg min-h-screen px-4 pb-16 pt-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="pp-plaque mx-auto max-w-2xl space-y-2 px-8 py-7 text-center">
          <p className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)]">Jeux de société · à jouer ensemble</p>
          <h1 className="font-display text-6xl font-bold leading-none text-[color:var(--pp-accent)] sm:text-7xl">Ludothèque</h1>
          <p className="mx-auto max-w-lg font-display text-lg italic text-[color:var(--pp-ink-soft)]">
            Choisissez une boîte sur l’étagère, dressez la table et envoyez le code à la famille — sur le même écran ou chacun chez soi.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SHELF.map((game) => (
            <GameTile key={game.id} game={game} onOpen={onOpen} />
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <JoinByCode onOpen={onOpen} />
          <InProgress />
        </div>

        <p className="text-center font-display text-sm italic text-[color:var(--pp-ink-soft)]">D’autres boîtes viendront garnir l’étagère.</p>
      </div>
    </div>
  );
}
