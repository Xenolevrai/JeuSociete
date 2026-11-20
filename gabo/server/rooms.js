/**
 * Registre des tables de Gabo.
 *
 * Même principe que pour le Monopoly : la mémoire fait foi, le disque n'en est
 * qu'une copie, réécrite avec un léger délai après chaque changement. Un
 * redémarrage du serveur au milieu d'une manche ne fait perdre la main à
 * personne.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createGame, createRng } from '../engine/index.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const SAVE_DEBOUNCE_MS = 400;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Ancré sur ce fichier, jamais sur le dossier de lancement (voir CLAUDE.md §10).
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MONOPOLY_DATA_DIR
  ? path.join(process.env.MONOPOLY_DATA_DIR, 'gabo')
  : path.join(MODULE_DIR, 'data');

/** @type {Map<string, object>} */
const rooms = new Map();
let dataDir = DATA_DIR;

/** Les tests écrivent ailleurs que dans le vrai dossier de sauvegarde. */
export function setDataDir(dir) {
  dataDir = dir;
}

function generateCode() {
  let code;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function newPlayerId() {
  return randomUUID();
}

function wrap(state) {
  return {
    state,
    rng: createRng((Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0),
    saveTimer: null,
    deadlineTimer: null,
    turnTimer: null,
    turnKey: null,
    snapTimers: new Map(),
  };
}

export function createRoom(hostId, settings) {
  const code = generateCode();
  const room = wrap(createGame(code, hostId, settings));
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(String(code ?? '').trim().toUpperCase()) ?? null;
}

export function allRooms() {
  return [...rooms.values()];
}

export function scheduleSave(room) {
  if (room.saveTimer) return;
  room.saveTimer = setTimeout(() => {
    room.saveTimer = null;
    save(room).catch((err) => console.error('[gabo] sauvegarde impossible :', err.message));
  }, SAVE_DEBOUNCE_MS);
}

async function save(room) {
  await fs.mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, `${room.state.code}.json`);
  await fs.writeFile(file, JSON.stringify({ savedAt: Date.now(), state: room.state }), 'utf8');
}

export async function restoreRooms() {
  let files;
  try {
    files = await fs.readdir(dataDir);
  } catch {
    return 0;
  }
  let restored = 0;
  for (const file of files.filter((f) => f.endsWith('.json'))) {
    const full = path.join(dataDir, file);
    try {
      const raw = JSON.parse(await fs.readFile(full, 'utf8'));
      if (!raw?.state?.code) continue;
      if (Date.now() - (raw.savedAt ?? 0) > MAX_AGE_MS) {
        await fs.rm(full, { force: true });
        continue;
      }
      // Au redémarrage, tout le monde est parti ; les bots, eux, n'ont pas de
      // navigateur à rouvrir.
      for (const p of raw.state.players) p.connected = Boolean(p.bot);
      const room = wrap(raw.state);
      // Les échéances (fenêtre de défausse, coup d'œil) ont été écrites avec
      // l'horloge d'avant : elles tomberont au premier passage du serveur.
      room.savedAt = raw.savedAt;
      rooms.set(raw.state.code, room);
      restored += 1;
    } catch (err) {
      console.error(`[gabo] table illisible (${file}) :`, err.message);
    }
  }
  return restored;
}

export function clearTimers(room) {
  clearTimeout(room.saveTimer);
  clearTimeout(room.deadlineTimer);
  clearTimeout(room.turnTimer);
  for (const t of room.snapTimers.values()) clearTimeout(t);
  room.snapTimers.clear();
  room.saveTimer = room.deadlineTimer = room.turnTimer = null;
  room.turnKey = null;
}

export function deleteRoom(code) {
  const room = rooms.get(code);
  if (room) clearTimers(room);
  rooms.delete(code);
  return fs.rm(path.join(dataDir, `${code}.json`), { force: true }).catch(() => {});
}

export async function purgeStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - (room.lastActivity ?? room.savedAt ?? now) > MAX_AGE_MS) await deleteRoom(code);
  }
}

/** Vide le registre (tests). */
export function resetRooms() {
  for (const room of rooms.values()) clearTimers(room);
  rooms.clear();
}
