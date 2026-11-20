/**
 * Les panneaux des Sept Peuples : règles, variantes, journal et discussion,
 * fin de partie.
 */
import { useEffect, useRef, useState } from 'react';
import Card from './Card.jsx';
import { RACE_STYLE } from './CardArt.jsx';
import { RACES, VARIANTS } from '../../../shared/peuples.js';

function Modal({ children, onClose, wide = false }) {
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-[#140d08]/75 p-3" onClick={onClose}>
      <div
        className={`peuples-panel scroll-thin max-h-[92dvh] w-full overflow-y-auto rounded-sm p-5 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Les variantes de la table. `onChange` absent : simple lecture. */
export function VariantsEditor({ t, settings, onChange }) {
  const readOnly = !onChange;
  return (
    <div className="space-y-3">
      {VARIANTS.map((variant) => {
        const text = t.variant[variant.id];
        if (variant.kind === 'toggle') {
          const on = Boolean(settings[variant.id]);
          return (
            <label
              key={variant.id}
              className={`flex gap-3 rounded-sm border p-3 ${on ? 'border-[color:var(--pp-accent)] bg-[#7d2018]/10' : 'border-[color:var(--pp-rule)] bg-[color:var(--pp-well)]'} ${
                readOnly ? '' : 'cursor-pointer hover:border-[color:var(--pp-ink-soft)]'
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={readOnly}
                onChange={() => onChange?.({ [variant.id]: !on })}
                className="mt-1 h-4 w-4 accent-[#d6a23e]"
              />
              <span>
                <span className="block font-semibold">{text.label}</span>
                <span className="block text-sm text-[color:var(--pp-ink)]/70">{text.help}</span>
              </span>
            </label>
          );
        }
        return (
          <div key={variant.id} className="rounded-sm border border-[color:var(--pp-rule)] bg-[color:var(--pp-well)] p-3">
            <p className="font-semibold">{text.label}</p>
            <p className="mb-2 text-sm text-[color:var(--pp-ink)]/70">{text.help}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {variant.options.map((option) => {
                const on = settings[variant.id] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={readOnly && !on}
                    onClick={() => onChange?.({ [variant.id]: option })}
                    className={`rounded-sm border p-2 text-left ${
                      on ? 'border-[color:var(--pp-accent)] bg-[#7d2018]/10' : 'border-[color:var(--pp-rule)] bg-[color:var(--pp-well)] hover:border-[color:var(--pp-ink-soft)]'
                    } ${readOnly ? 'cursor-default' : ''} disabled:opacity-40`}
                  >
                    <span className="block text-sm font-semibold">{text[option]}</span>
                    <span className="block text-xs text-[color:var(--pp-ink)]/65">{text[`${option}Help`]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RulesDialog({ t, settings, onClose }) {
  return (
    <Modal onClose={onClose} wide>
      <h2 className="font-fable gold-text mb-3 text-3xl">{t.rulesTitle}</h2>
      <ol className="mb-5 list-decimal space-y-2 pl-5 text-[15px] leading-snug">
        {t.rules.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RACES.map((race) => (
          <div key={race} className="flex flex-col items-center gap-1">
            <Card race={race} t={t} size="w-full" />
          </div>
        ))}
      </div>
      {settings && (
        <>
          <h3 className="font-fable mb-2 text-xl text-[color:var(--pp-accent)]">{t.variants}</h3>
          <div className="mb-5">
            <VariantsEditor t={t} settings={settings} />
          </div>
        </>
      )}
      <h3 className="font-fable mb-2 text-xl text-[color:var(--pp-accent)]">{t.readings}</h3>
      <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-[color:var(--pp-ink)]/80">
        {t.readings.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button type="button" onClick={onClose} className="btn-gold w-full rounded-sm py-2">
        {t.close}
      </button>
    </Modal>
  );
}

const LOG_ICON = { play: '▪', fairy: '✦', power: '◆', target: '→', end: '♛', draw: '·', skip: '·', setup: '§', pass: '·' };

/** Journal et discussion, dans un même panneau à onglets. */
export function LogPanel({ state, t, me, onChat, className = '' }) {
  const [tab, setTab] = useState('log');
  const [text, setText] = useState('');
  const box = useRef(null);
  const lastLog = state.log.at(-1)?.id;
  const lastChat = state.chat.at(-1)?.id;

  // Défiler son propre conteneur, jamais `scrollIntoView` qui ferait sauter la page.
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lastLog, lastChat, tab]);

  const nameOf = (id) => state.players.find((p) => p.id === id);
  const send = () => {
    if (!text.trim()) return;
    onChat(text);
    setText('');
  };

  return (
    <div className={`peuples-panel flex min-h-0 flex-col rounded-sm ${className}`}>
      <div className="flex border-b border-[color:var(--pp-rule)]">
        {[
          ['log', t.log],
          ['chat', t.chat],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-2 pp-caps text-xs ${
              tab === id ? 'text-[color:var(--pp-accent)]' : 'text-[color:var(--pp-ink)]/50 hover:text-[color:var(--pp-ink)]'
            }`}
          >
            {label}
            {id === 'chat' && state.chat.length > 0 && <span className="ml-1 text-[10px]">({state.chat.length})</span>}
          </button>
        ))}
      </div>
      <div ref={box} className="pp-ruled scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-1 text-[13px] leading-[22px]">
        {tab === 'log' &&
          state.log.slice(-150).map((entry) => {
            const author = nameOf(entry.data?.playerId);
            const strong = ['play', 'fairy', 'power', 'end', 'target'].includes(entry.type);
            return (
              <p key={entry.id} className={strong ? 'text-[color:var(--pp-ink)]' : 'text-[color:var(--pp-ink)]/55'}>
                <span className="mr-1.5 inline-block w-3 text-center" style={{ color: author?.color ?? '#c99335' }}>
                  {LOG_ICON[entry.type] ?? '·'}
                </span>
                {entry.text}
              </p>
            );
          })}
        {tab === 'chat' &&
          state.chat.map((message) => {
            const author = nameOf(message.playerId);
            return (
              <p key={message.id}>
                <span className="font-semibold" style={{ color: author?.color }}>
                  {author?.name ?? '?'}
                </span>{' '}
                <span className="text-[color:var(--pp-ink)]">{message.text}</span>
              </p>
            );
          })}
      </div>
      {tab === 'chat' && me && (
        <div className="flex gap-2 border-t border-[color:var(--pp-rule)] p-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            maxLength={300}
            placeholder={t.say}
            className="peuples-input min-w-0 flex-1 rounded-sm px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={send} className="btn-gold rounded-sm px-3 text-sm">
            {t.send}
          </button>
        </div>
      )}
    </div>
  );
}

/** Le peuple d'une joueuse : toutes les cartes posées, rangées et visibles par famille. */
export function PeopleRow({
  people,
  t,
  size = 'sm',
  scoring = 'people',
  onPick,
  pickable = false,
  emptyText,
}) {
  const groups = RACES.map((race) => ({
    race,
    ids: (people ?? []).filter((id) => id.startsWith(`${race}-`)),
  })).filter((g) => g.ids.length > 0);

  if (scoring === 'families') {
    // Tri par taille de famille décroissante (les plus grandes familles d'abord)
    groups.sort((a, b) => b.ids.length - a.ids.length || RACES.indexOf(a.race) - RACES.indexOf(b.race));
  }

  if (!groups.length) {
    return (
      <div className="flex aspect-[16/3] min-h-[2.75rem] w-full items-center justify-center rounded-sm border border-dashed border-[color:var(--pp-rule)]/40 p-2 text-center text-xs italic text-[color:var(--pp-ink)]/50">
        {emptyText ?? t.empty}
      </div>
    );
  }

  const stackOverlap = size === 'xs' ? '-space-x-5 hover:-space-x-2' : '-space-x-7 hover:-space-x-3';

  return (
    <div className="scroll-thin flex flex-wrap items-start gap-2 overflow-x-auto py-1">
      {groups.map(({ race, ids }) => (
        <div
          key={race}
          className={`flex flex-col items-center rounded-sm border border-[color:var(--pp-rule)]/30 bg-black/15 ${
            size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-1'
          } shadow-sm transition-all hover:bg-black/25`}
        >
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
            <span
              className="h-2 w-2 rounded-full border border-black shadow-xs"
              style={{ background: RACE_STYLE[race].accent }}
            />
            <span className={`${size === 'xs' ? 'text-[10px]' : 'text-[11px]'}`} style={{ color: RACE_STYLE[race].title }}>
              {t.race[race]}
            </span>
            <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] font-bold text-[#f6ecd2]">
              {ids.length}
            </span>
            {ids.length === 8 && (
              <span className="text-[10px] text-[#ffd35a] font-bold" title="Famille complète">
                ★
              </span>
            )}
          </div>
          <div className={`flex items-center ${stackOverlap} px-1 py-0.5 transition-all`}>
            {ids.map((cardId, i) => (
              <div
                key={`${cardId}-${i}`}
                className="transition-transform duration-150 hover:-translate-y-2 hover:z-30"
                style={{ zIndex: i + 1 }}
              >
                <Card
                  cardId={cardId}
                  race={race}
                  t={t}
                  size={size}
                  onClick={pickable ? () => onPick(cardId) : undefined}
                  title={`${t.race[race]} (${cardId})`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameOverDialog({ state, t, onClose, onLeave }) {
  const { result } = state;
  const byId = (id) => state.players.find((p) => p.id === id);
  const winners = result.winnerIds.map((id) => byId(id).name);
  const names = winners.length > 1 ? `${winners.slice(0, -1).join(', ')} ${t.and} ${winners.at(-1)}` : winners[0];
  const max = Math.max(1, ...result.ranking.flatMap((row) => Object.values(row.byRace)));
  return (
    <Modal onClose={onClose} wide>
      <p className="text-center pp-caps text-xs text-[color:var(--pp-ink)]/60">{t.gameOver}</p>
      <h2 className="font-fable gold-text winner-pop my-2 text-center text-3xl sm:text-4xl">
        {winners.length > 1 ? t.tie(names) : t.winner(names)}
      </h2>
      <p className="mb-4 text-center text-sm text-[color:var(--pp-ink)]/70">
        {t.scoring} : {t.variant.scoring[result.scoring]}
      </p>
      <div className="space-y-3">
        {result.ranking.map((row) => {
          const player = byId(row.playerId);
          return (
            <div
              key={row.playerId}
              className={`rounded-sm border p-3 ${row.rank === 1 ? 'border-[color:var(--pp-accent)] bg-[#7d2018]/8' : 'border-[color:var(--pp-rule)] bg-[color:var(--pp-well)]'}`}
            >
              <div className="mb-2 flex items-baseline gap-3">
                <span className="font-fable text-2xl text-[color:var(--pp-accent)]">{row.rank}</span>
                <span className="text-lg font-semibold" style={{ color: player.color }}>
                  {player.name}
                </span>
                <span className="ml-auto text-sm text-[color:var(--pp-ink)]/80">
                  {t.members(row.size)}
                  {row.families > 0 && ` · ${t.families(row.families)}`}
                </span>
              </div>
              {/* Une colonne par peuple : on voit d'un coup d'œil les familles qui se dessinent. */}
              <div className="grid grid-cols-7 items-end gap-1">
                {RACES.map((race) => {
                  const n = row.byRace[race];
                  return (
                    <div key={race} className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] tabular">{n}</span>
                      <div className="flex h-14 w-full items-end rounded bg-[color:var(--pp-well)]">
                        <div
                          className="w-full rounded"
                          style={{ height: `${(n / max) * 100}%`, background: RACE_STYLE[race].accent, outline: n === 8 ? '2px solid #2b1d12' : 'none' }}
                        />
                      </div>
                      <span className="w-full truncate text-center text-[9px] text-[color:var(--pp-ink)]/70">{t.race[race]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="btn-ghost rounded-sm py-2">
          {t.backToTable}
        </button>
        <button type="button" onClick={onLeave} className="btn-gold rounded-sm py-2">
          {t.newGame}
        </button>
      </div>
    </Modal>
  );
}
