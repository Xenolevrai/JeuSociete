/**
 * Le décompte, sur une feuille de marque : toutes les cartes se retournent,
 * chacune additionne ses points. C'est aussi l'entracte où l'hôte ajuste la
 * table avant la donne suivante.
 */
import { useState } from 'react';
import { socket } from '../lib/socket.js';
import Grid from './Grid.jsx';
import SeatDot from './SeatDot.jsx';
import { PlayerList, AddBots, Settings, ShareCode } from './Lobby.jsx';

export default function RoundEnd({ view, onLeave }) {
  const round = view.round;
  const res = round.results;
  const byId = Object.fromEntries(view.players.map((p) => [p.id, p]));
  const isHost = view.you === view.hostId;
  const [tableOpen, setTableOpen] = useState(false);
  const seats = [...round.seats].sort((a, b) => res.totals[a] - res.totals[b]);
  const names = res.winners.map((id) => (id === view.you ? 'Tu' : byId[id]?.name ?? '?'));
  const headline =
    res.winners.length > 1
      ? `${names.join(' et ')} l'emportent`
      : names[0] === 'Tu'
        ? "Tu l'emportes"
        : `${names[0]} l'emporte`;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-[var(--color-felt-dark)]/85">
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 px-3 py-5">
        <article className="paper rise relative rounded-[3px] px-4 pt-5 pb-3 shadow-[0_2px_0_rgba(0,0,0,0.35),0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <p className="label pt-1 text-[var(--color-ink-soft)]">Manche {round.number}</p>
            {res.announcer && (
              // Le tampon : la seule fantaisie de la feuille, posé de travers comme à la main.
              <span
                className="rotate-[-6deg] rounded-[3px] border-2 px-1.5 font-display text-[13px] font-semibold tracking-wider whitespace-nowrap uppercase"
                style={{ color: res.success ? '#2f6b4a' : 'var(--color-red)', borderColor: 'currentColor', opacity: 0.85 }}
              >
                Gabo {res.success ? 'réussi' : 'raté'}
              </span>
            )}
          </div>
          <h2 className="mt-1 font-display text-3xl leading-tight italic" style={{ fontVariationSettings: '"SOFT" 100' }}>
            {headline}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{res.reason}</p>

          <ol className="mt-4">
            {seats.map((id) => {
              const p = byId[id];
              const won = res.winners.includes(id);
              return (
                <li key={id} className="flex items-center gap-3 border-t border-[var(--color-ink)]/12 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <SeatDot player={p} size={8} />
                      <span className="truncate font-semibold">{p?.name ?? '?'}</span>
                      {res.announcer === id && <span className="text-[var(--color-ink-soft)]">· a annoncé</span>}
                    </div>
                    <div className="mt-1.5" style={{ fontSize: '15px' }}>
                      <Grid cards={round.grids[id]} ownerId={id} gap="0.15em" />
                    </div>
                  </div>
                  <span className="relative flex h-12 w-14 items-center justify-center font-display text-3xl tabular-nums" style={{ fontVariationSettings: '"opsz" 72' }}>
                    {res.totals[id]}
                    {won && (
                      // Le total gagnant, entouré à l'encre.
                      <span className="absolute inset-0 rotate-[-6deg] rounded-[50%] border-2 border-[var(--color-red)]/80" />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </article>

        <article className="paper rounded-[3px] px-4 py-3 shadow-[0_2px_0_rgba(0,0,0,0.3)]">
          <p className="label mb-1 text-[var(--color-ink-soft)]">La soirée</p>
          <Scoreboard view={view} />
        </article>

        <div className="sticky bottom-0 -mx-3 flex flex-col gap-2 bg-[var(--color-felt-dark)] px-3 pt-2 pb-4">
          {isHost ? (
            <>
              <button type="button" disabled={view.players.length < 2} onClick={() => socket.emit('gabo:start')} className="btn btn-red w-full !min-h-[52px] text-base">
                Manche suivante
              </button>
              <button type="button" onClick={() => setTableOpen((v) => !v)} className="text-sm text-[var(--color-chalk-soft)] underline underline-offset-4">
                {tableOpen ? 'masquer' : 'inviter, ajouter un bot, changer les règles'}
              </button>
            </>
          ) : (
            <p className="text-center font-display text-[var(--color-chalk-soft)] italic">L'hôte va redistribuer…</p>
          )}
        </div>
        {(tableOpen || !isHost) && (
          <article className="paper space-y-4 rounded-[3px] px-4 py-3">
            {isHost && (
              <div className="rounded-[3px] bg-[var(--color-felt)] py-3">
                <ShareCode code={view.code} />
              </div>
            )}
            <PlayerList view={view} />
            <AddBots view={view} />
            <Settings view={view} />
          </article>
        )}
        <button type="button" onClick={onLeave} className="pb-4 text-sm text-[var(--color-chalk-soft)] underline underline-offset-4">
          Quitter la table
        </button>
      </div>
    </div>
  );
}

/** Le score de la soirée : manches gagnées d'abord, points cumulés pour départager. */
export function Scoreboard({ view, dark = false }) {
  const rows = [...view.players].sort((a, b) => b.wins - a.wins || a.points - b.points);
  const soft = dark ? 'text-[var(--color-chalk-soft)]' : 'text-[var(--color-ink-soft)]';
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={`label text-left ${soft}`}>
          <th className="pb-1 font-semibold">Joueuse</th>
          <th className="pb-1 text-right font-semibold">Gagnées</th>
          <th className="pb-1 text-right font-semibold">Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className={`border-t ${dark ? 'border-white/10' : 'border-[var(--color-ink)]/10'}`}>
            <td className="py-1.5">
              <span className="flex items-center gap-2">
                <SeatDot player={p} size={8} /> {p.name}
              </span>
            </td>
            <td className="text-right font-display text-lg tabular-nums">{p.wins}</td>
            <td className={`text-right tabular-nums ${soft}`}>
              {p.points}
              <span className="text-[11px]"> / {p.roundsPlayed} m.</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
