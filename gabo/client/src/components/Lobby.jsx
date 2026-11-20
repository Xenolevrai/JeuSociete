/**
 * Le salon : on partage le code, on attend les autres, on règle la table.
 * Les mêmes réglages et la même liste servent entre deux manches (RoundEnd).
 */
import { useState } from 'react';
import { socket } from '../lib/socket.js';
import Avatar from './Avatar.jsx';

const LEVELS = [
  { id: 'facile', label: 'Facile', hint: 'oublie souvent' },
  { id: 'moyen', label: 'Moyen', hint: 'bonne mémoire' },
  { id: 'difficile', label: 'Difficile', hint: 'redoutable' },
];

export function ShareCode({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/gabo/?code=${code}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Gabo', text: `Rejoins ma table de Gabo : ${code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">Code de la table</span>
      <span className="rounded-xl bg-black/30 px-5 py-2 font-mono text-4xl font-bold tracking-[0.3em] text-[var(--color-gold)]">
        {code}
      </span>
      <button type="button" onClick={share} className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
        {copied ? 'Lien copié ✓' : '🔗 Partager le lien'}
      </button>
    </div>
  );
}

export function PlayerList({ view, compact = false }) {
  const isHost = view.you === view.hostId;
  const remove = (playerId) => socket.emit('gabo:remove', { playerId });
  return (
    <ul className="space-y-1.5">
      {view.players.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-2">
          <Avatar player={p} size={compact ? 28 : 34} />
          <span className="min-w-0 flex-1 truncate font-medium">
            {p.name}
            {p.id === view.you && <span className="ml-1 text-xs text-white/50">(toi)</span>}
          </span>
          {p.id === view.hostId && <span className="rounded bg-[var(--color-gold)]/20 px-1.5 text-[11px] text-[var(--color-gold)]">hôte</span>}
          {!p.connected && !p.bot && <span className="text-[11px] text-white/50">absente</span>}
          {p.wins > 0 && <span className="text-xs text-white/70">🏆 {p.wins}</span>}
          {isHost && p.id !== view.you && (p.bot || !p.connected) && (
            <button
              type="button"
              onClick={() => remove(p.id)}
              className="-my-2 min-h-[36px] min-w-[36px] rounded text-white/50 hover:text-red-300"
              aria-label={`Retirer ${p.name}`}
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AddBots({ view }) {
  if (view.you !== view.hostId || view.players.length >= 8) return null;
  return (
    <div>
      <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">Ajouter un bot</span>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => socket.emit('gabo:add-bot', { level: l.id })}
            className="rounded-lg bg-white/10 px-2 py-2 text-sm hover:bg-white/20"
          >
            🤖 {l.label}
            <span className="block text-[10px] text-white/50">{l.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Choice({ label, value, options, onChange, disabled, format = (v) => v }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-white/85">{label}</span>
      <div className="flex flex-wrap justify-end gap-1">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o)}
            className={`min-w-[2.5rem] rounded-md px-2 py-1 text-sm ${
              value === o ? 'bg-[var(--color-gold)] font-semibold text-zinc-900' : 'bg-white/10 text-white/80'
            } ${disabled ? 'cursor-default' : 'hover:bg-white/20'} ${disabled && value !== o ? 'opacity-40' : ''}`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings({ view }) {
  const s = view.settings;
  const isHost = view.you === view.hostId;
  const set = (patch) => socket.emit('gabo:settings', { settings: patch });
  return (
    <div className="space-y-2.5">
      <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">
        Règles de la table {!isHost && <span className="normal-case">(choisies par l'hôte)</span>}
      </span>
      <Choice label="Gabo réussi jusqu'à" value={s.threshold} options={[5, 7]} onChange={(v) => set({ threshold: v })} disabled={!isHost} format={(v) => `${v} pts`} />
      <Choice label="Temps pour poser une carte" value={s.snapSeconds} options={[3, 5, 8, 10]} onChange={(v) => set({ snapSeconds: v })} disabled={!isHost} format={(v) => `${v} s`} />
      <Choice
        label="Temps par tour (puis jeu automatique)"
        value={s.turnSeconds}
        options={[0, 30, 60, 120]}
        onChange={(v) => set({ turnSeconds: v })}
        disabled={!isHost}
        format={(v) => (v ? `${v} s` : '∞')}
      />
      <Choice label="Valeur du joker" value={s.jokerValue} options={[0, -1]} onChange={(v) => set({ jokerValue: v })} disabled={!isHost} format={(v) => `${v}`} />
      <Choice
        label="Poser la carte d'une autre : elle pioche"
        value={s.opponentSnapPenalty}
        options={[1, 2]}
        onChange={(v) => set({ opponentSnapPenalty: v })}
        disabled={!isHost}
        format={(v) => `${v}`}
      />
      <Choice
        label="Aide-mémoire (cartes vues restent visibles)"
        value={s.memoryAid}
        options={[false, true]}
        onChange={(v) => set({ memoryAid: v })}
        disabled={!isHost}
        format={(v) => (v ? 'oui' : 'non')}
      />
    </div>
  );
}

export default function Lobby({ view, onRules, onLeave }) {
  const isHost = view.you === view.hostId;
  const enough = view.players.length >= 2;
  const host = view.players.find((p) => p.id === view.hostId);
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onLeave} className="text-sm text-white/60 hover:text-white">← Quitter</button>
        <h1 className="font-display text-3xl font-bold text-[var(--color-gold)]">Gabo</h1>
        <button type="button" onClick={onRules} className="text-sm text-white/80 underline underline-offset-4">Règles</button>
      </div>
      <ShareCode code={view.code} />
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">À table</span>
          <span className="text-xs text-white/50">{view.players.length} / 8</span>
        </div>
        <PlayerList view={view} />
        <div className="mt-4">
          <AddBots view={view} />
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <Settings view={view} />
      </section>
      {isHost ? (
        <button
          type="button"
          disabled={!enough}
          onClick={() => socket.emit('gabo:start')}
          className="sticky bottom-3 rounded-xl bg-[var(--color-gold)] py-4 text-lg font-bold text-zinc-900 shadow-lg disabled:opacity-40"
        >
          {enough ? 'Distribuer les cartes' : 'Il faut au moins 2 joueuses'}
        </button>
      ) : (
        <p className="text-center text-white/70">En attente que {host?.name ?? "l'hôte"} distribue les cartes…</p>
      )}
    </div>
  );
}
