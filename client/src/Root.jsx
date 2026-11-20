/**
 * La ludothèque : une seule connexion, plusieurs jeux.
 *
 * Tant qu'on n'est assise à aucune table, l'adresse décide de l'écran —
 * l'accueil (`/`), la boîte de Monopoly (`/monopoly`) ou celle des Sept
 * Peuples (`/sept-peuples`). Dès qu'une partie est en cours, c'est l'état reçu
 * du serveur qui commande : `state.game` dit quelle table dresser, et une page
 * rafraîchie retombe d'elle-même sur la bonne partie.
 */
import { useEffect, useState } from 'react';
import { useGame } from './lib/useGame.js';
import App from './App.jsx';
import { Home as MonopolyHome } from './components/Lobby.jsx';
import Hub from './hub/Hub.jsx';
import PeuplesHome from './peuples/PeuplesHome.jsx';
import PeuplesApp from './peuples/PeuplesApp.jsx';

/** Les routes de la ludothèque, et le jeu qui s'y ouvre. */
export const ROUTES = { '/': 'hub', '/monopoly': 'monopoly', '/sept-peuples': 'peuples' };
export const PATH_OF = { monopoly: '/monopoly', peuples: '/sept-peuples' };

function currentRoute() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return ROUTES[path] ?? 'hub';
}

/** Change d'écran sans recharger la page (et donc sans couper la connexion). */
export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function BackToHub() {
  return (
    <a
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate('/');
      }}
      className="fixed left-3 top-3 z-50 rounded-sm border border-black/40 bg-[#f6f2e7] px-3 py-1.5 font-condensed text-[11px] uppercase tracking-widest text-[#16130f] shadow-[0_2px_0_rgba(0,0,0,.3)] hover:bg-white"
    >
      ← Ludothèque
    </a>
  );
}

export default function Root() {
  const game = useGame();
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const playing = game.state?.game ?? (game.state ? 'monopoly' : null);

  // En entrant dans une partie, l'adresse suit : un lien copié depuis la barre
  // mène à la bonne boîte, et « quitter » ramène à son accueil, pas ailleurs.
  useEffect(() => {
    if (playing && PATH_OF[playing] && window.location.pathname !== PATH_OF[playing]) {
      window.history.replaceState({}, '', PATH_OF[playing]);
      setRoute(playing);
    }
  }, [playing]);

  if (playing === 'peuples') return <PeuplesApp game={game} />;
  if (playing === 'monopoly') return <App game={game} />;

  if (route === 'monopoly')
    return (
      <>
        <BackToHub />
        <MonopolyHome error={game.error} />
      </>
    );
  if (route === 'peuples') return <PeuplesHome error={game.error} onBack={() => navigate('/')} />;
  return <Hub onOpen={(id, query = '') => navigate(`${PATH_OF[id]}${query}`)} />;
}
