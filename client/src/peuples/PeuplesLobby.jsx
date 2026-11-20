/**
 * Le salon d'une table des Sept Peuples : qui joue, quelles règles, et le code
 * à donner aux autres. N'importe qui à la table peut cocher une variante ou
 * lancer la partie — on joue en se parlant, comme au Monopoly.
 */
import { useState } from 'react';
import { socket } from '../lib/socket.js';
import { useText } from './text.js';
import { Banner, Fan } from './PeuplesHome.jsx';
import { RulesDialog, VariantsEditor } from './PeuplesPanels.jsx';
import { PLAYER_COUNT } from '../../../shared/peuples.js';

export default function PeuplesLobby({ state, mine, onLeave }) {
  const t = useText(state.locale, state.settings);
  const [level, setLevel] = useState('moyen');
  const [localName, setLocalName] = useState('');
  const [addingLocal, setAddingLocal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rules, setRules] = useState(false);
  const full = state.players.length >= PLAYER_COUNT.max;
  const mineIds = mine.map((p) => p.id);

  const link = `${window.location.origin}/sept-peuples?code=${state.code}`;
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="peuples-bg min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Banner t={t} small />

        <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-5">
            <div className="peuples-panel rounded-sm p-5 text-center">
              <p className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)]/70">{t.tableCode}</p>
              <p className="tabular font-condensed my-1 text-5xl tracking-[0.3em] text-[color:var(--pp-accent)]">{state.code}</p>
              <button type="button" onClick={copy} className="btn-ghost rounded-sm px-4 py-1 text-xs">
                {copied ? t.copied : t.copyLink}
              </button>
            </div>

            <div className="peuples-panel space-y-3 rounded-sm p-5">
              <p className="pp-caps text-[11px] text-[color:var(--pp-ink-soft)]/70">
                {t.players} · {state.players.length}/{PLAYER_COUNT.max}
              </p>
              <ul className="space-y-2">
                {state.players.map((player) => (
                  <li key={player.id} className="flex items-center gap-2 rounded-sm bg-[color:var(--pp-well)] px-3 py-2">
                    <span className="h-3.5 w-3.5 rounded-full border border-black" style={{ background: player.color }} />
                    <span className="font-semibold">{player.name}</span>
                    {mineIds.includes(player.id) && <span className="text-xs text-[color:var(--pp-ink)]/60">({t.you})</span>}
                    {player.bot && (
                      <span className="rounded bg-[color:var(--pp-well)] px-1.5 text-[10px] uppercase tracking-wide">{t.bot}</span>
                    )}
                    {!player.connected && !player.bot && <span className="text-xs text-[color:var(--pp-danger)]">⏻</span>}
                    {(player.bot || (mineIds.includes(player.id) && mineIds.length > 1)) && (
                      <button
                        type="button"
                        onClick={() =>
                          player.bot
                            ? socket.emit('game:remove-bot', { playerId: player.id })
                            : socket.emit('game:remove-local', { playerId: player.id })
                        }
                        className="ml-auto text-xs text-[color:var(--pp-ink)]/50 hover:text-[color:var(--pp-danger)]"
                      >
                        {t.remove}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {!full && (
                <div className="space-y-2 rounded-sm border border-dashed border-[color:var(--pp-rule)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.entries(t.levels).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLevel(id)}
                        className={`rounded-sm px-3 py-1 text-xs ${level === id ? 'btn-gold' : 'btn-ghost'}`}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => socket.emit('game:add-bot', { difficulty: level })}
                      className="btn-ghost ml-auto rounded-sm px-3 py-1 text-sm"
                    >
                      + {t.addBot}
                    </button>
                  </div>
                  {addingLocal ? (
                    <div className="flex gap-2">
                      <input
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        maxLength={20}
                        placeholder={t.namePlaceholder}
                        className="peuples-input min-w-0 flex-1 rounded-sm px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        disabled={!localName.trim()}
                        onClick={() => {
                          socket.emit('game:add-local', { name: localName });
                          setLocalName('');
                          setAddingLocal(false);
                        }}
                        className="btn-gold rounded-sm px-3 text-sm"
                      >
                        {t.add}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAddingLocal(true)} className="text-xs text-[color:var(--pp-ink)]/60 underline">
                      {t.addLocal}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="peuples-panel space-y-4 rounded-sm p-5">
            <p className="font-fable text-xl text-[color:var(--pp-accent)]">{t.variants}</p>
            <VariantsEditor
              t={t}
              settings={state.settings}
              onChange={(patch) => socket.emit('game:settings', { settings: patch })}
            />
            <button type="button" onClick={() => setRules(true)} className="btn-ghost w-full rounded-sm py-2 text-sm">
              {t.howToPlay}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-md space-y-2">
          <button
            type="button"
            disabled={state.players.length < PLAYER_COUNT.min}
            onClick={() => socket.emit('game:start')}
            className="btn-gold w-full rounded-sm py-3 font-fable text-xl"
          >
            {t.start}
          </button>
          {state.players.length < PLAYER_COUNT.min && <p className="text-center text-sm text-[color:var(--pp-ink)]/60">{t.needTwo}</p>}
          <button type="button" onClick={onLeave} className="w-full py-2 text-sm text-[color:var(--pp-ink)]/60 hover:text-[color:var(--pp-ink)]">
            {t.leave}
          </button>
        </div>

        <Fan t={t} races={['lutin', 'farfadet', 'korrigan', 'dryade']} size="md" />
      </div>
      {rules && <RulesDialog t={t} onClose={() => setRules(false)} />}
    </div>
  );
}
