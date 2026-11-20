/**
 * Connexion temps réel au Gabo (espace de noms `/gabo`) et mémoire locale.
 *
 * Le navigateur garde `code` et `playerId` : rafraîchir la page, verrouiller
 * son téléphone ou changer de réseau ne fait pas perdre sa place à la table.
 */
import { io } from 'socket.io-client';

const STORAGE_KEY = 'gabo:session';
const NAME_KEY = 'gabo:name';

export const socket = io('/gabo', { transports: ['websocket', 'polling'] });

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* navigation privée : on continue sans reprise automatique */
  }
}

export const loadSession = () => read(STORAGE_KEY);
export const saveSession = (s) => write(STORAGE_KEY, s);
export const clearSession = () => write(STORAGE_KEY, null);
export const loadName = () => read(NAME_KEY) ?? '';
export const saveName = (n) => write(NAME_KEY, n);

export function act(action) {
  socket.emit('gabo:action', action);
}
