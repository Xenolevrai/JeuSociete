/**
 * Aiguillage des écrans du Gabo : accueil → salon → table (et décompte).
 */
import { useState } from 'react';
import { useGabo } from './lib/useGabo.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Table from './components/Table.jsx';
import RoundEnd, { Scoreboard } from './components/RoundEnd.jsx';
import Rules from './components/Rules.jsx';

export default function App() {
  const { view, receivedAt, connected, toasts, reactions, highlights, leave, restoring } = useGabo();
  const [rules, setRules] = useState(false);
  const [panel, setPanel] = useState(null); // 'log' | 'scores'

  const confirmLeave = () => {
    const inRound = view && (view.phase === 'playing' || view.phase === 'peek') && view.round?.seats.includes(view.you);
    const message = inRound
      ? 'Quitter la table ? Tes cartes restent en jeu et ton tour se jouera automatiquement. Tu peux revenir avec le même pseudo et le même code.'
      : 'Quitter la table ?';
    if (window.confirm(message)) leave();
  };

  let screen;
  if (!view) {
    screen = restoring ? (
      <div className="flex h-full items-center justify-center text-white/70">Retour à la table…</div>
    ) : (
      <Home onRules={() => setRules(true)} connected={connected} />
    );
  } else if (view.phase === 'lobby') {
    screen = <Lobby view={view} onRules={() => setRules(true)} onLeave={confirmLeave} />;
  } else {
    screen = (
      <>
        <Table
          view={view}
          receivedAt={receivedAt}
          highlights={highlights}
          reactions={reactions}
          onRules={() => setRules(true)}
          onLeave={confirmLeave}
          onLog={() => setPanel('log')}
          onScores={() => setPanel('scores')}
        />
        {view.phase === 'roundEnd' && <RoundEnd view={view} onLeave={confirmLeave} />}
      </>
    );
  }

  return (
    <div className="relative h-full">
      {screen}
      {view && !connected && (
        <div className="fixed top-0 right-0 left-0 z-50 bg-amber-500 py-1 text-center text-sm font-semibold text-zinc-900">
          Connexion perdue — reconnexion en cours…
        </div>
      )}
      <div className="pointer-events-none fixed top-14 right-0 left-0 z-50 flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pop-in max-w-md rounded-xl px-4 py-2 text-center text-sm font-medium shadow-lg ${
              t.tone === 'error'
                ? 'bg-red-600 text-white'
                : t.tone === 'gabo'
                  ? 'bg-[var(--color-gold)] text-zinc-900'
                  : 'bg-zinc-900/90 text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
      {panel && view && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setPanel(null)}>
          <aside
            className="scrollbar-thin h-full w-full max-w-sm overflow-y-auto bg-[var(--color-felt-deep)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-[var(--color-gold)]">{panel === 'log' ? 'Journal' : 'Scores'}</h2>
              <button type="button" onClick={() => setPanel(null)} className="h-10 w-10 rounded-full hover:bg-white/10" aria-label="Fermer">✕</button>
            </div>
            {panel === 'log' ? (
              <ol className="space-y-1.5 text-sm">
                {[...view.log].reverse().map((e) => (
                  <li key={e.id} className={`rounded-md px-2 py-1 ${e.type === 'gabo' || e.type === 'roundEnd' ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]' : e.type === 'snapWrong' ? 'text-red-300' : 'text-white/85'}`}>
                    {e.text}
                  </li>
                ))}
              </ol>
            ) : (
              <>
                <Scoreboard view={view} />
                {view.history.length > 0 && (
                  <>
                    <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-white/60 uppercase">Manches</h3>
                    <ol className="space-y-1 text-sm">
                      {[...view.history].reverse().map((h) => (
                        <li key={h.number} className="rounded bg-white/5 px-2 py-1">
                          <span className="text-white/60">Manche {h.number} · </span>
                          {h.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? '?').join(', ')}
                          {h.announcer && <span className="text-white/60"> {h.success ? '(Gabo réussi)' : '(Gabo raté)'}</span>}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      )}
      {rules && <Rules onClose={() => setRules(false)} settings={view?.settings} />}
    </div>
  );
}
