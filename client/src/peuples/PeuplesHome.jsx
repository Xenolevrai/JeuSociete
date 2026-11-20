/**
 * L'accueil des Sept Peuples : dresser une table, en rejoindre une, ou
 * reprendre celle de la veille.
 */
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket.js';
import Card from './Card.jsx';
import { useText } from './text.js';
import { RulesDialog } from './PeuplesPanels.jsx';

export function Fan({ t, races = ['fee', 'korrigan', 'dryade'], size = 'lg' }) {
  return (
    <div className="flex justify-center py-2" aria-hidden="true">
      {races.map((race, i) => {
        const angle = (i - (races.length - 1) / 2) * 12;
        return (
          <div
            key={race}
            className="-mx-4 sm:-mx-5"
            style={{ transform: `rotate(${angle}deg) translateY(${Math.abs(angle) * 0.6}px)`, zIndex: i === 1 ? 2 : 1 }}
          >
            <Card race={race} t={t} size={size} />
          </div>
        );
      })}
    </div>
  );
}

export function Banner({ t, small = false }) {
  return (
    // Le titre est imprimé sur une plaque, pas peint en dégradé sur l'écran.
    <div className={`pp-plaque mx-auto text-center ${small ? 'w-fit px-6 py-3' : 'max-w-md px-6 py-6'}`}>
      <h1 className={`font-fable leading-none text-[color:var(--pp-accent)] ${small ? 'text-2xl' : 'text-4xl sm:text-5xl'}`}>{t.title}</h1>
      {!small && (
        <>
          <div className="mx-auto my-3 flex w-40 items-center gap-2 text-[color:var(--pp-ink-soft)]">
            <span className="h-px flex-1 bg-current" />
            <span className="text-xs">✦</span>
            <span className="h-px flex-1 bg-current" />
          </div>
          <p className="font-display text-lg italic text-[color:var(--pp-ink-soft)]">{t.tagline}</p>
        </>
      )}
    </div>
  );
}

function ResumeList({ t }) {
  const [games, setGames] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then((data) => setGames((data.games ?? []).filter((g) => g.game === 'peuples')))
      .catch(() => setGames([]));
  }, []);

  if (!games?.length) return null;
  return (
    <div className="space-y-2">
      <p className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)]/70">{t.resume}</p>
      {games.slice(0, 5).map((game) => (
        <div key={game.code} className="rounded-sm border border-[color:var(--pp-rule)] bg-[color:var(--pp-well)]">
          <button
            type="button"
            onClick={() => setOpen(open === game.code ? null : game.code)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left"
          >
            <span className="tabular font-condensed text-lg tracking-[0.2em] text-[color:var(--pp-accent)]">{game.code}</span>
            <span className="truncate text-sm text-[color:var(--pp-ink)]/80">{game.players.map((p) => p.name).join(', ')}</span>
            <span className="ml-auto text-xs text-[color:var(--pp-ink)]/50">{open === game.code ? '▲' : '▼'}</span>
          </button>
          {open === game.code && (
            <div className="space-y-1 border-t border-[color:var(--pp-rule)] p-2">
              <p className="px-1 text-xs text-[color:var(--pp-ink)]/60">{t.whoResumes}</p>
              {game.players
                .filter((p) => !p.bot)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => socket.emit('game:rejoin', { code: game.code, playerIds: [p.id] })}
                    className="btn-ghost flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm"
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                    {p.name}
                    {p.connected && <span className="ml-auto text-[10px] text-[#9be06e]">●</span>}
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PeuplesHome({ error, onBack }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '');
  const [locale, setLocale] = useState('fr');
  const [rules, setRules] = useState(false);
  const t = useText(locale);

  const create = () => socket.emit('game:create', { game: 'peuples', name, locale });
  const join = () => socket.emit('game:join', { code: code.toUpperCase(), name });

  return (
    <div className="peuples-bg min-h-screen px-4 pb-10 pt-14">
      <button
        type="button"
        onClick={onBack}
        className="fixed left-3 top-3 z-50 peuples-paper rounded-sm px-3 py-1.5 pp-caps text-[11px] hover:brightness-105"
      >
        ← Ludothèque
      </button>

      <div className="mx-auto max-w-md space-y-6">
        <Banner t={t} />
        <Fan t={t} races={['elfe', 'fee', 'gnome']} />

        <div className="peuples-panel space-y-4 rounded-sm p-5">
          <label className="block pp-caps text-[11px] text-[color:var(--pp-ink-soft)]/80">
            {t.yourName}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={t.namePlaceholder}
              className="peuples-input mt-1 w-full rounded-sm px-3 py-2 font-sans text-base normal-case tracking-normal"
            />
          </label>

          <div className="flex items-center gap-2">
            <span className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)]/80">{t.language}</span>
            {[
              ['fr', 'Français'],
              ['en', 'English'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLocale(id)}
                className={`rounded-sm px-3 py-1 text-xs ${locale === id ? 'btn-gold' : 'btn-ghost'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!name.trim()}
            onClick={create}
            className="btn-gold w-full rounded-sm py-3 font-fable text-lg"
          >
            {t.createGame}
          </button>

          <div className="flex items-center gap-2 pp-caps text-[10px] text-[color:var(--pp-ink-soft)]/60">
            <span className="h-px flex-1 bg-[color:var(--pp-rule)]" />
            {t.orJoin}
            <span className="h-px flex-1 bg-[color:var(--pp-rule)]" />
          </div>

          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder={t.code}
              className="peuples-input tabular w-full rounded-sm px-3 py-2 text-center font-condensed text-lg tracking-[0.4em]"
            />
            <button
              type="button"
              disabled={!name.trim() || code.length !== 6}
              onClick={join}
              className="btn-ghost shrink-0 rounded-sm px-4 font-condensed text-sm uppercase tracking-wide"
            >
              {t.join}
            </button>
          </div>

          {error && <p className="text-center text-sm text-[color:var(--pp-danger)]">{error}</p>}

          <ResumeList t={t} />
        </div>

        <button type="button" onClick={() => setRules(true)} className="btn-ghost w-full rounded-sm py-2 text-sm">
          {t.howToPlay}
        </button>
      </div>

      {rules && <RulesDialog t={t} onClose={() => setRules(false)} />}
    </div>
  );
}
