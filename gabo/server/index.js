/**
 * Branche le Gabo sur le serveur existant : même processus, même port, même
 * lien à partager. Le jeu vit sous `/gabo/` (client compilé) et sur l'espace
 * de noms Socket.io `/gabo` — il ne touche à rien de ce qu'utilise le Monopoly.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { registerGaboHandlers } from './sockets.js';
import { restoreRooms, purgeStaleRooms, allRooms, getRoom } from './rooms.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(ROOT, '..', 'client', 'dist');

export async function attachGabo(app, io) {
  app.get('/gabo/api/health', (req, res) => res.json({ ok: true, tables: allRooms().length }));
  /** L'accueil de la ludothèque vérifie un code avant d'y envoyer quelqu'un. */
  app.get('/gabo/api/table/:code', (req, res) => {
    const room = getRoom(req.params.code);
    if (!room) return res.status(404).json({ ok: false, error: 'Aucune table de Gabo ne porte ce code.' });
    res.json({ ok: true, code: room.state.code, players: room.state.players.length });
  });
  app.use('/gabo', express.static(CLIENT_DIST));
  app.get(/^\/gabo(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
      if (err) res.status(503).send('Client du Gabo non compilé : lancez `npm run build`.');
    });
  });

  registerGaboHandlers(io.of('/gabo'));
  const restored = await restoreRooms();
  if (restored) console.log(`[gabo] ${restored} table(s) restaurée(s) depuis le disque.`);
  setInterval(purgeStaleRooms, 60 * 60 * 1000).unref();
}
