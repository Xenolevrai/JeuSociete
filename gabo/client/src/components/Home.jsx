/**
 * L'accueil : un pseudo, puis créer une table ou en rejoindre une avec son
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

  const ready = name.trim().length > 0 && connected;

  const create = () => {
    if (!ready) return;
    saveName(name.trim());
    setBusy(true);
    socket.emit('gabo:create', { name: name.trim() });
    setTimeout(() => setBusy(false), 2000);
  };
  const join = (e) => {
    e?.preventDefault();
    if (!ready || code.trim().length < 4) return;
    saveName(name.trim());
    setBusy(true);
    socket.emit('gabo:join', { code: code.trim(), name: name.trim() });
    setTimeout(() => setBusy(false), 2000);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-5 py-10">
      <div className="flex items-end gap-1 text-[30px]">
        <Card card={{ rank: 'K', suit: 'H' }} className="-rotate-12 translate-y-2" />
        <Card card={{ rank: '7', suit: 'S' }} className="-rotate-3" />
        <Card card={{ down: true }} className="rotate-6" />
        <Card card={{ rank: 'Q', suit: 'D' }} className="rotate-12 translate-y-2" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold tracking-wide text-[var(--color-gold)] drop-shadow">Gabo</h1>
        <p className="mt-1 text-sm text-white/75">Mémoire, bluff et réflexes — de 2 à 8 joueuses.</p>
      </div>

      <div className="w-full space-y-4 rounded-2xl border border-white/10 bg-black/25 p-5 shadow-xl backdrop-blur">
        <label className="block">
          <span className="text-xs font-semibold tracking-wider text-white/70 uppercase">Ton pseudo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Ex. : Camille"
            autoComplete="nickname"
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/95 px-3 py-3 text-lg text-zinc-900 outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
          />
        </label>

        <form onSubmit={join} className="space-y-2">
          <span className="text-xs font-semibold tracking-wider text-white/70 uppercase">Rejoindre une table</span>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="CODE"
              inputMode="text"
              autoCapitalize="characters"
              className="w-full min-w-0 rounded-lg border border-white/15 bg-white/95 px-3 py-3 text-center font-mono text-xl tracking-[0.3em] text-zinc-900 outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            />
            <button
              type="submit"
              disabled={!ready || code.length < 4 || busy}
              className="rounded-lg bg-[var(--color-gold)] px-5 font-semibold text-zinc-900 shadow disabled:opacity-40"
            >
              Entrer
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3 text-xs text-white/50">
          <div className="h-px flex-1 bg-white/15" /> ou <div className="h-px flex-1 bg-white/15" />
        </div>

        <button
          type="button"
          onClick={create}
          disabled={!ready || busy}
          className="w-full rounded-lg border-2 border-[var(--color-gold)] py-3 text-lg font-semibold text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 disabled:opacity-40"
        >
          Créer une nouvelle table
        </button>
        {!connected && <p className="text-center text-sm text-amber-200">Connexion au serveur…</p>}
      </div>

      <button type="button" onClick={onRules} className="text-sm text-white/80 underline underline-offset-4">
        Lire les règles du jeu
      </button>
      <a href="/" className="text-xs text-white/40 hover:text-white/70">← Retour au Monopoly</a>
    </div>
  );
}
