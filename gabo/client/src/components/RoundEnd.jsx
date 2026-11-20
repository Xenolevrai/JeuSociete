/**
 * Le décompte : toutes les cartes se retournent, chacune compte ses points.
 * C'est aussi l'entracte où l'hôte ajuste la table avant la donne suivante.
 */
import { socket } from '../lib/socket.js';
import Grid from './Grid.jsx';
import Avatar from './Avatar.jsx';
import { PlayerList, AddBots, Settings, ShareCode } from './Lobby.jsx';
import { useState } from 'react';

export default function RoundEnd({ view, onLeave }) {
  const round = view.round;
  const res = round.results;
  const byId = Object.fromEntries(view.players.map((p) => [p.id, p]));
  const isHost = view.you === view.hostId;
  const [tableOpen, setTableOpen] = useState(false);
  const iWon = res.winners.includes(view.you);
  const seats = [...round.seats].sort((a, b) => res.totals[a] - res.totals[b]);
  const winnerNames = res.winners.map((id) => (id === view.you ? 'toi' : byId[id]?.name ?? '?'));

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="text-center pop-in">
          <p className="text-xs tracking-widest text-white/60 uppercase">Manche {round.number}</p>
          <h2 className="font-display text-4xl font-bold text-[var(--color-gold)]">
            {iWon ? 'Victoire !' : `Victoire de ${winnerNames.join(' et ')}`}
          </h2>
          <p className="mt-1 text-white/85">{res.reason}</p>
        </div>

        <ul className="space-y-2">
          {seats.map((id) => {
            const p = byId[id];
            const won = res.winners.includes(id);
            return (
              <li
                key={id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${won ? 'bg-[var(--color-gold)]/20 ring-2 ring-[var(--color-gold)]' : 'bg-white/5'}`}
              >
                <Avatar player={p} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{p?.name ?? '?'}</span>
                    {res.announcer === id && (
                      <span className={`rounded px-1 text-[10px] font-bold ${res.success ? 'bg-emerald-400 text-zinc-900' : 'bg-red-400 text-zinc-900'}`}>
                        GABO {res.success ? '✓' : '✗'}
                      </span>
                    )}
                    {won && <span>🏆</span>}
                  </div>
                  <div className="mt-1 text-[15px] sm:text-[18px]">
                    <Grid cards={round.grids[id]} ownerId={id} />
                  </div>
                </div>
                <span className="min-w-[2.5rem] text-right text-3xl font-bold tabular-nums">{res.totals[id]}</span>
              </li>
            );
          })}
        </ul>

        <section className="rounded-xl bg-white/5 p-3">
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/60 uppercase">Le score de la soirée</h3>
          <Scoreboard view={view} />
        </section>

        {isHost ? (
          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-6 pb-3">
            <button
              type="button"
              disabled={view.players.length < 2}
              onClick={() => socket.emit('gabo:start')}
              className="rounded-xl bg-[var(--color-gold)] py-4 text-lg font-bold text-zinc-900 shadow-lg disabled:opacity-40"
            >
              Manche suivante
            </button>
            <button type="button" onClick={() => setTableOpen((v) => !v)} className="text-sm text-white/70 underline">
              {tableOpen ? 'Masquer' : 'Inviter, ajouter des bots, changer les règles'}
            </button>
          </div>
        ) : (
          <p className="text-center text-white/70">L'hôte va distribuer la manche suivante…</p>
        )}
        {(tableOpen || !isHost) && (
          <section className="space-y-4 rounded-xl bg-white/5 p-3">
            {isHost && <ShareCode code={view.code} />}
            <PlayerList view={view} compact />
            <AddBots view={view} />
            <Settings view={view} />
          </section>
        )}
        <button type="button" onClick={onLeave} className="pb-4 text-sm text-white/50 hover:text-white">Quitter la table</button>
      </div>
    </div>
  );
}

export function Scoreboard({ view }) {
  const rows = [...view.players].sort((a, b) => b.wins - a.wins || a.points - b.points);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] text-white/50 uppercase">
          <th className="pb-1 font-medium">Joueuse</th>
          <th className="pb-1 text-right font-medium">Victoires</th>
          <th className="pb-1 text-right font-medium">Points cumulés</th>
          <th className="pb-1 text-right font-medium">Manches</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="border-t border-white/5">
            <td className="py-1.5">
              <span className="flex items-center gap-2">
                <Avatar player={p} size={22} /> {p.name}
              </span>
            </td>
            <td className="text-right font-semibold tabular-nums">{p.wins}</td>
            <td className="text-right tabular-nums">{p.points}</td>
            <td className="text-right tabular-nums text-white/60">{p.roundsPlayed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
