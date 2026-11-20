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
import { IconClose } from './components/Icons.jsx';

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
      <div className="flex h-full items-center justify-center font-display text-[var(--color-chalk-soft)] italic">Retour à la table…</div>
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
          marks={highlights}
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
        <div className="fixed top-0 right-0 left-0 z-50 bg-[var(--color-paper)] py-1 text-center text-sm text-[var(--color-red)]">
          Connexion perdue — reconnexion en cours…
        </div>
      )}
      {/* Les messages : des bouts de papier glissés sur la table, jamais une alerte. */}
      <div className="pointer-events-none fixed top-1 right-0 left-0 z-50 flex flex-col items-center gap-1.5 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rise paper max-w-md rounded-[3px] px-3 py-1.5 text-center text-sm shadow-[0_2px_0_rgba(0,0,0,0.3),0_6px_16px_rgba(0,0,0,0.25)] ${
              t.tone === 'error' ? 'border-l-4 border-[var(--color-red)] text-[var(--color-red)]' : t.tone === 'gabo' ? 'font-display italic' : ''
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
      {panel && view && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setPanel(null)}>
          <aside
            className="paper scroll-thin h-full w-full max-w-sm overflow-y-auto p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl italic">{panel === 'log' ? 'Journal' : 'La soirée'}</h2>
              <button type="button" onClick={() => setPanel(null)} className="flex h-10 w-10 items-center justify-center text-[var(--color-ink-soft)]" aria-label="Fermer"><IconClose /></button>
            </div>
            {panel === 'log' ? (
              <ol className="space-y-1.5 text-sm">
                {[...view.log].reverse().map((e) => (
                  <li key={e.id} className={`border-b border-[var(--color-ink)]/8 pb-1.5 ${e.type === 'gabo' || e.type === 'roundEnd' ? 'font-display italic' : e.type === 'snapWrong' ? 'text-[var(--color-red)]' : ''}`}>
                    {e.text}
                  </li>
                ))}
              </ol>
            ) : (
              <>
                <Scoreboard view={view} />
                {view.history.length > 0 && (
                  <>
                    <h3 className="label mt-6 mb-2 text-[var(--color-ink-soft)]">Manches</h3>
                    <ol className="space-y-1 text-sm">
                      {[...view.history].reverse().map((h) => (
                        <li key={h.number} className="border-b border-[var(--color-ink)]/8 pb-1">
                          <span className="text-[var(--color-ink-soft)]">Manche {h.number} · </span>
                          {h.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? '?').join(', ')}
                          {h.announcer && <span className="text-[var(--color-ink-soft)]"> {h.success ? '· Gabo réussi' : '· Gabo raté'}</span>}
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
