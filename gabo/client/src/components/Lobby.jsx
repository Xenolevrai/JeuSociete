/**
 * Le salon : on donne le code, on attend les autres, on règle la table.
 * La liste, les bots et les réglages resservent entre deux manches (RoundEnd).
 */
import { useState } from 'react';
import { socket } from '../lib/socket.js';
import SeatDot from './Avatar.jsx';
import { IconLink, IconClose, IconRules, IconLeave } from './Icons.jsx';
import { BOT_LEVEL } from '../lib/cards.js';

const LEVELS = [
  { id: 'facile', label: 'Facile', hint: 'oublie souvent' },
  { id: 'moyen', label: 'Moyen', hint: 'bonne mémoire' },
  { id: 'difficile', label: 'Difficile', hint: 'ne rate rien' },
];

export function ShareCode({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/gabo/?code=${code}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Gabo', text: `Une partie de Gabo ? Code : ${code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="label text-[var(--color-chalk-soft)]">Code de la table</span>
      <span className="font-mono text-4xl tracking-[0.35em] text-[var(--color-chalk)]">{code}</span>
      <button type="button" onClick={share} className="btn btn-line">
        <IconLink width={16} height={16} />
        {copied ? 'Lien copié' : 'Envoyer le lien'}
      </button>
    </div>
  );
}

export function PlayerList({ view }) {
  const isHost = view.you === view.hostId;
  return (
    <ol>
      {view.players.map((p, i) => (
        <li key={p.id} className="flex min-h-[2.4rem] items-center gap-3 border-b border-[var(--color-ink)]/10 last:border-0">
          <span className="w-4 text-right font-mono text-xs text-[var(--color-ink-soft)]">{i + 1}</span>
          <SeatDot player={p} size={10} />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{p.name}</span>
            {p.id === view.you && <span className="text-[var(--color-ink-soft)]"> · toi</span>}
            {p.bot && <span className="text-[var(--color-ink-soft)]"> · {BOT_LEVEL[p.bot]}</span>}
            {!p.connected && !p.bot && <span className="text-[var(--color-ink-soft)]"> · absente</span>}
          </span>
          {p.id === view.hostId && <span className="label text-[var(--color-ink-soft)]">hôte</span>}
          {isHost && p.id !== view.you && (p.bot || !p.connected) && (
            <button
              type="button"
              onClick={() => socket.emit('gabo:remove', { playerId: p.id })}
              className="-my-1 flex h-9 w-9 items-center justify-center text-[var(--color-ink-soft)] hover:text-[var(--color-red)]"
              aria-label={`Retirer ${p.name}`}
            >
              <IconClose width={16} height={16} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

export function AddBots({ view }) {
  if (view.you !== view.hostId || view.players.length >= 8) return null;
  return (
    <div>
      <span className="label text-[var(--color-ink-soft)]">Compléter avec un bot</span>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => socket.emit('gabo:add-bot', { level: l.id })}
            className="rounded-[3px] border border-[var(--color-ink)]/20 px-2 py-1.5 text-left hover:border-[var(--color-ink)]"
          >
            <span className="block text-sm font-semibold">+ {l.label}</span>
            <span className="block text-[11px] text-[var(--color-ink-soft)]">{l.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Choice({ label, hint, value, options, onChange, disabled, format = (v) => v }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-ink)]/10 py-2 last:border-0">
      <span className="text-sm">
        {label}
        {hint && <span className="block text-[11px] text-[var(--color-ink-soft)]">{hint}</span>}
      </span>
      <div className="flex shrink-0 overflow-hidden rounded-[3px] border border-[var(--color-ink)]/25">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o)}
            className={`min-h-[34px] min-w-[2.6rem] px-2 text-sm ${
              value === o ? 'bg-[var(--color-ink)] font-semibold text-[var(--color-paper)]' : 'text-[var(--color-ink-soft)]'
            } ${disabled ? 'cursor-default' : ''}`}
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
    <div>
      <span className="label text-[var(--color-ink-soft)]">Règles de la table{!isHost && ' · choisies par l’hôte'}</span>
      <div className="mt-1">
        <Choice label="Gabo réussi jusqu'à" value={s.threshold} options={[5, 7]} onChange={(v) => set({ threshold: v })} disabled={!isHost} format={(v) => `${v} pts`} />
        <Choice label="Temps pour poser une carte" value={s.snapSeconds} options={[3, 5, 8, 10]} onChange={(v) => set({ snapSeconds: v })} disabled={!isHost} format={(v) => `${v} s`} />
        <Choice
          label="Poser la carte d'une autre"
          hint="cartes qu'elle pioche en pénalité"
          value={s.opponentSnapPenalty}
          options={[1, 2]}
          onChange={(v) => set({ opponentSnapPenalty: v })}
          disabled={!isHost}
        />
        <Choice
          label="Temps par tour"
          hint="ensuite, le tour se joue tout seul"
          value={s.turnSeconds}
          options={[0, 30, 60, 120]}
          onChange={(v) => set({ turnSeconds: v })}
          disabled={!isHost}
          format={(v) => (v ? `${v}s` : '∞')}
        />
        <Choice
          label="Aide-mémoire"
          hint="les cartes vues restent visibles pour soi"
          value={s.memoryAid}
          options={[false, true]}
          onChange={(v) => set({ memoryAid: v })}
          disabled={!isHost}
          format={(v) => (v ? 'oui' : 'non')}
        />
      </div>
    </div>
  );
}

export default function Lobby({ view, onRules, onLeave }) {
  const isHost = view.you === view.hostId;
  const enough = view.players.length >= 2;
  const host = view.players.find((p) => p.id === view.hostId);
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onLeave} className="flex h-10 w-10 items-center justify-center text-[var(--color-chalk-soft)]" aria-label="Quitter">
          <IconLeave />
        </button>
        <span className="font-display text-3xl text-[var(--color-chalk)] italic" style={{ fontVariationSettings: '"SOFT" 100' }}>Gabo</span>
        <button type="button" onClick={onRules} className="flex h-10 w-10 items-center justify-center text-[var(--color-chalk-soft)]" aria-label="Règles">
          <IconRules />
        </button>
      </div>
      <ShareCode code={view.code} />
      <section className="paper rounded-[4px] px-4 py-3 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
        <div className="flex items-baseline justify-between">
          <span className="label text-[var(--color-ink-soft)]">À table</span>
          <span className="font-mono text-xs text-[var(--color-ink-soft)]">{view.players.length}/8</span>
        </div>
        <PlayerList view={view} />
        <div className="mt-4">
          <AddBots view={view} />
        </div>
      </section>
      <section className="paper rounded-[4px] px-4 py-3 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
        <Settings view={view} />
      </section>
      <div className="sticky bottom-0 -mx-4 bg-[var(--color-felt)] px-4 pt-2 pb-4">
        {isHost ? (
          <button type="button" disabled={!enough} onClick={() => socket.emit('gabo:start')} className="btn btn-red w-full !min-h-[52px] text-base">
            {enough ? 'Distribuer' : 'Il faut au moins deux joueuses'}
          </button>
        ) : (
          <p className="text-center font-display text-[var(--color-chalk-soft)] italic">{host?.name ?? "L'hôte"} va distribuer…</p>
        )}
      </div>
    </div>
  );
}
