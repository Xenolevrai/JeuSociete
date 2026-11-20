/**
 * L'état du jeu côté navigateur : la dernière vue reçue du serveur, plus ce
 * qui n'existe que sur cet écran (toasts, réactions, cases à faire clignoter).
 *
 * Le client n'a AUCUNE règle. Il affiche la vue et envoie des intentions ; le
 * serveur décide.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { socket, loadSession, saveSession, clearSession } from './socket.js';
import { play, buzz } from './sound.js';

const HIGHLIGHT_MS = 1800;

export function useGabo() {
  const [view, setView] = useState(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [connected, setConnected] = useState(socket.connected);
  const [toasts, setToasts] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [highlights, setHighlights] = useState({});
  const [restoring, setRestoring] = useState(Boolean(loadSession()));
  const lastLogId = useRef(null);
  const lastTurnKey = useRef(null);
  const lastSnapKey = useRef(null);
  const viewRef = useRef(null);
  viewRef.current = view;

  const toast = useCallback((text, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 3800 : 3000);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const session = loadSession();
      if (session?.code && session?.playerId) socket.emit('gabo:rejoin', session);
      else setRestoring(false);
    };
    const onDisconnect = () => setConnected(false);
    const onJoined = ({ code, playerId }) => {
      saveSession({ code, playerId });
      const url = new URL(window.location.href);
      url.searchParams.set('code', code);
      window.history.replaceState(null, '', url);
      setRestoring(false);
    };
    const onGone = ({ message }) => {
      clearSession();
      setView(null);
      setRestoring(false);
      toast(message, 'error');
    };
    const onError = ({ message }) => {
      toast(message, 'error');
      if (/trop tard/i.test(message)) play('wrong');
    };
    const onState = (next) => {
      setView(next);
      setReceivedAt(Date.now());
    };
    const onReaction = (r) => {
      const id = Math.random().toString(36).slice(2);
      setReactions((list) => [...list.slice(-12), { ...r, id }]);
      setTimeout(() => setReactions((list) => list.filter((x) => x.id !== id)), 2300);
    };

    const onNudged = ({ playerId, from }) => {
      if (viewRef.current?.you !== playerId) return;
      play('turn');
      buzz([150, 80, 150]);
      toast(`⏰ ${from} te presse gentiment !`, 'gabo');
    };

    socket.on('connect', onConnect);
    socket.on('gabo:nudged', onNudged);
    socket.on('disconnect', onDisconnect);
    socket.on('gabo:joined', onJoined);
    socket.on('gabo:gone', onGone);
    socket.on('gabo:error', onError);
    socket.on('gabo:state', onState);
    socket.on('gabo:reaction', onReaction);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gabo:joined', onJoined);
      socket.off('gabo:gone', onGone);
      socket.off('gabo:error', onError);
      socket.off('gabo:state', onState);
      socket.off('gabo:reaction', onReaction);
      socket.off('gabo:nudged', onNudged);
    };
  }, [toast]);

  // Les nouveautés du journal : sons, cases à faire clignoter.
  useEffect(() => {
    if (!view) return;
    const entries = view.log ?? [];
    const lastId = entries.at(-1)?.id ?? 0;
    if (lastLogId.current == null) {
      lastLogId.current = lastId;
      return;
    }
    const fresh = entries.filter((e) => e.id > lastLogId.current);
    lastLogId.current = lastId;
    if (!fresh.length) return;

    const marks = {};
    for (const entry of fresh) {
      for (const s of entry.data?.slots ?? []) {
        marks[`${s.ownerId}:${s.slot}`] = { kind: entry.type, until: Date.now() + HIGHLIGHT_MS };
      }
      const mine = entry.data?.playerId === view.you;
      switch (entry.type) {
        case 'draw':
        case 'takeDiscard':
        case 'swapHeld':
        case 'discardHeld':
        case 'swap':
          play('card');
          break;
        case 'snap':
          play('snap');
          if (!mine) toast(entry.text, 'info');
          break;
        case 'snapWrong':
          play('wrong');
          toast(entry.text, 'error');
          break;
        case 'gabo':
          play('gabo');
          buzz([80, 60, 80]);
          toast(entry.text, 'gabo');
          break;
        case 'roundEnd':
          play(entry.data?.winners?.includes(view.you) ? 'win' : 'card');
          break;
        default:
          break;
      }
    }
    if (Object.keys(marks).length) {
      setHighlights((prev) => ({ ...prev, ...marks }));
      setTimeout(() => {
        const now = Date.now();
        setHighlights((prev) => Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now)));
      }, HIGHLIGHT_MS + 50);
    }
  }, [view, toast]);

  // C'est à moi : un signal sonore et une vibration, une seule fois par tour.
  useEffect(() => {
    const turn = view?.round?.turn;
    if (!turn || view.phase !== 'playing') return;
    if (turn.playerId === view.you && turn.stage === 'start') {
      const turnKey = `${view.round.number}:${turn.playerId}:${view.round.discardCount}:${view.round.drawCount}`;
      if (lastTurnKey.current !== turnKey) {
        lastTurnKey.current = turnKey;
        play('turn');
        buzz(120);
      }
    }
    const snap = view.round.snap;
    if (snap?.canSnap) {
      const snapKey = `${view.round.number}:${snap.discarderId}:${view.round.discardCount}`;
      if (lastSnapKey.current !== snapKey && snap.count === 0) {
        lastSnapKey.current = snapKey;
        play('open');
      }
    }
  }, [view]);

  const leave = useCallback(() => {
    socket.emit('gabo:leave');
    clearSession();
    setView(null);
    lastLogId.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState(null, '', url);
  }, []);

  return { view, receivedAt, connected, toasts, toast, reactions, highlights, leave, restoring };
}

/** Une horloge qui avance tant qu'un compte à rebours est affiché. */
export function useNow(active, interval = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  return now;
}
