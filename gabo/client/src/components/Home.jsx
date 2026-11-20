/**
 * L'accueil : un prénom, puis ouvrir une table ou en rejoindre une avec son
 * code. Un lien partagé (`/gabo/?code=XXXXX`) arrive avec le code déjà rempli.
 */
import { useState } from 'react';
import { socket, loadName, saveName } from '../lib/socket.js';
import Card from './Card.jsx';

export default function Home({ onRules, connected }) {
  const initialCode = new URLSearchParams(window.location.search).get('code') ?? '';
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [busy, setBusy] = useState(false);
  const invited = Boolean(initialCode);

  const ready = name.trim().length > 0 && connected;
  const wait = () => {
    setBusy(true);
    setTimeout(() => setBusy(false), 2000);
  };
  const create = () => {
    if (!ready) return;
    saveName(name.trim());
    wait();
    socket.emit('gabo:create', { name: name.trim() });
  };
  const join = (e) => {
    e?.preventDefault();
    if (!ready || code.trim().length < 4) return;
    saveName(name.trim());
    wait();
    socket.emit('gabo:join', { code: code.trim(), name: name.trim() });
  };

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-7 px-5 py-10">
      <div className="flex flex-col items-center">
        {/* Une main étalée sur le tapis, comme au début d'une partie. */}
        <div className="relative mb-4 h-[4.6em] w-[9em] text-[26px]">
          <Card card={{ rank: 'K', suit: 'H' }} className="!absolute" style={{ left: '0.4em', top: '0.5em', transform: 'rotate(-14deg)' }} />
          <Card card={{ rank: '7', suit: 'S' }} className="!absolute" style={{ left: '2.2em', top: '0.1em', transform: 'rotate(-4deg)' }} />
          <Card card={{ down: true }} className="!absolute" style={{ left: '4em', top: '0.1em', transform: 'rotate(5deg)' }} />
          <Card card={{ rank: 'Q', suit: 'D' }} className="!absolute" style={{ left: '5.8em', top: '0.5em', transform: 'rotate(14deg)' }} />
        </div>
        <h1 className="font-display text-6xl text-[var(--color-chalk)] italic" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144', fontWeight: 500 }}>
          Gabo
        </h1>
        <p className="mt-1 text-sm text-[var(--color-chalk-soft)]">Mémoire, bluff et réflexes · de 2 à 8</p>
      </div>

      <div className="paper rounded-[4px] p-5 shadow-[0_2px_0_rgba(0,0,0,0.3),0_10px_24px_rgba(0,0,0,0.25)]">
        <label className="block">
          <span className="label text-[var(--color-ink-soft)]">Ton prénom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Camille"
            autoComplete="nickname"
            className="mt-1 w-full border-b border-[var(--color-ink)]/40 bg-transparent py-2 font-display text-2xl text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink)]/25 focus:border-[var(--color-ink)]"
          />
        </label>

        <form onSubmit={join} className="mt-5">
          <span className="label text-[var(--color-ink-soft)]">{invited ? 'On t’attend à la table' : 'Rejoindre une table'}</span>
          <div className="mt-1 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="CODE"
              autoCapitalize="characters"
              aria-label="Code de la table"
              className="w-full min-w-0 rounded-[3px] border border-[var(--color-ink)]/25 bg-white/60 px-3 py-2 text-center font-mono text-xl tracking-[0.35em] text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
            />
            <button type="submit" disabled={!ready || code.length < 4 || busy} className="btn btn-ink">
              Entrer
            </button>
          </div>
        </form>

        {!invited && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-[var(--color-ink-soft)]">
              <div className="h-px flex-1 bg-[var(--color-ink)]/15" /> ou <div className="h-px flex-1 bg-[var(--color-ink)]/15" />
            </div>
            <button type="button" onClick={create} disabled={!ready || busy} className="btn btn-red w-full">
              Ouvrir une nouvelle table
            </button>
          </>
        )}
        {!connected && <p className="mt-3 text-center text-sm text-[var(--color-red)]">Connexion au serveur…</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onRules} className="text-[var(--color-chalk)] underline underline-offset-4">
          Les règles
        </button>
        {invited ? (
          <button
            type="button"
            className="text-[var(--color-chalk-soft)] underline underline-offset-4"
            onClick={() => {
              window.history.replaceState(null, '', window.location.pathname);
              window.location.reload();
            }}
          >
            ouvrir ma propre table
          </button>
        ) : (
          <a href="/" className="text-[var(--color-chalk-soft)] hover:text-[var(--color-chalk)]">← Monopoly</a>
        )}
      </div>
    </div>
  );
}
