/**
 * La couche temps réel du Gabo : de vrais clients Socket.io sur `/gabo`.
 * On vérifie surtout ce qui ne se voit pas dans le moteur seul : chaque poste
 * reçoit SA vue, la fenêtre de défausse se ferme d'elle-même, les bots jouent,
 * et l'on retrouve sa place après une coupure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

import { registerGaboHandlers } from '../gabo/server/sockets.js';
import { resetRooms, setDataDir, getRoom } from '../gabo/server/rooms.js';

async function startServer() {
  resetRooms();
  setDataDir(await fs.mkdtemp(path.join(os.tmpdir(), 'gabo-test-')));
  const server = http.createServer();
  const io = new Server(server);
  const gabo = registerGaboHandlers(io.of('/gabo'), { botDelay: [5, 15], autopilotMs: 50 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/gabo`;
  return {
    url,
    changed: gabo.changed,
    async close() {
      resetRooms();
      io.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function connect(url) {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true });
  const client = { socket, state: null, errors: [], joined: null };
  socket.on('gabo:state', (s) => (client.state = s));
  socket.on('gabo:error', (e) => client.errors.push(e.message));
  socket.on('gabo:joined', (j) => (client.joined = j));
  client.until = async (predicate, timeout = 10000) => {
    const start = Date.now();
    while (!predicate(client.state)) {
      if (Date.now() - start > timeout) throw new Error('délai dépassé');
      await new Promise((r) => setTimeout(r, 10));
    }
    return client.state;
  };
  return client;
}

test('deux postes, deux vues : personne ne reçoit les cartes des autres', async () => {
  const srv = await startServer();
  const a = connect(srv.url);
  const b = connect(srv.url);
  try {
    a.socket.emit('gabo:create', { name: 'Alice' });
    const s = await a.until((x) => x?.players.length === 1);
    b.socket.emit('gabo:join', { code: s.code, name: 'Bob' });
    await a.until((x) => x?.players.length === 2);
    a.socket.emit('gabo:start');
    await a.until((x) => x?.phase === 'peek');
    await b.until((x) => x?.phase === 'peek');

    const aId = a.joined.playerId;
    const bId = b.joined.playerId;
    assert.ok(a.state.round.grids[aId][1].rank, 'Alice voit sa carte proche');
    assert.ok(a.state.round.grids[bId].every((x) => x.down), 'mais aucune de Bob');
    assert.ok(b.state.round.grids[aId].every((x) => x.down));

    // Le serveur garde les vraies cartes ; aucune ne doit figurer dans la vue de Bob.
    const room = getRoom(s.code);
    const json = JSON.stringify(b.state);
    for (const card of room.state.round.grids[aId]) assert.ok(!json.includes(`"${card.id}"`));

    a.socket.emit('gabo:action', { type: 'READY' });
    b.socket.emit('gabo:action', { type: 'READY' });
    await a.until((x) => x?.phase === 'playing');
  } finally {
    a.socket.close();
    b.socket.close();
    await srv.close();
  }
});

test('la fenêtre de défausse se ferme toute seule et le tour passe', async () => {
  const srv = await startServer();
  const a = connect(srv.url);
  const b = connect(srv.url);
  try {
    a.socket.emit('gabo:create', { name: 'Alice', settings: { snapSeconds: 3 } });
    const s = await a.until((x) => x?.players.length === 1);
    b.socket.emit('gabo:join', { code: s.code, name: 'Bob' });
    await a.until((x) => x?.players.length === 2);
    a.socket.emit('gabo:start');
    await a.until((x) => x?.phase === 'peek');
    a.socket.emit('gabo:action', { type: 'READY' });
    b.socket.emit('gabo:action', { type: 'READY' });
    const st = await a.until((x) => x?.phase === 'playing');
    const first = st.round.turn.playerId === a.joined.playerId ? a : b;
    const second = first === a ? b : a;
    first.socket.emit('gabo:action', { type: 'DRAW' });
    await first.until((x) => x.round.turn.stage === 'drawn');
    assert.ok(first.state.round.turn.held.rank, 'celle qui pioche voit sa carte');
    await second.until((x) => x.round.turn.stage === 'drawn');
    assert.deepEqual(second.state.round.turn.held, { down: true });
    first.socket.emit('gabo:action', { type: 'SWAP_HELD', slot: 0 });
    await second.until((x) => x.round.snap);
    // Raccourcir l'attente : on règle l'échéance tout près.
    getRoom(s.code).state.round.snap.until = Date.now() + 50;
    second.socket.emit('gabo:action', { type: 'PASS_SNAP' });
    await second.until((x) => x.round.turn?.playerId === second.joined.playerId && x.round.turn.stage === 'start');
  } finally {
    a.socket.close();
    b.socket.close();
    await srv.close();
  }
});

test('une table de bots joue une manche entière toute seule (avec une humaine présente)', async () => {
  const srv = await startServer();
  const a = connect(srv.url);
  try {
    a.socket.emit('gabo:create', { name: 'Alice', settings: { snapSeconds: 3 } });
    await a.until((x) => x?.players.length === 1);
    for (const level of ['facile', 'moyen', 'difficile']) a.socket.emit('gabo:add-bot', { level });
    await a.until((x) => x?.players.length === 4);
    a.socket.emit('gabo:start');
    await a.until((x) => x?.phase === 'peek' || x?.phase === 'playing');
    a.socket.emit('gabo:action', { type: 'READY' });
    // Accélérer : chaque fenêtre de défausse dure peu.
    const room = getRoom(a.state.code);
    const timer = setInterval(() => {
      const snap = room.state.round?.snap;
      if (snap && snap.until > Date.now() + 60) {
        snap.until = Date.now() + 60;
        srv.changed(room); // reprogramme l'échéance raccourcie
      }
    }, 20);
    // Alice joue comme une bête : pioche et jette.
    const played = setInterval(() => {
      const st = a.state;
      if (st?.phase !== 'playing' || st.round.turn?.playerId !== a.joined.playerId) return;
      if (st.round.turn.stage === 'start') a.socket.emit('gabo:action', { type: 'DRAW' });
      if (st.round.turn.stage === 'drawn') a.socket.emit('gabo:action', { type: 'DISCARD_HELD' });
      if (st.round.turn.stage === 'power') a.socket.emit('gabo:action', { type: 'SKIP_POWER' });
    }, 15);
    try {
      await a.until((x) => x?.phase === 'roundEnd', 30000);
    } finally {
      clearInterval(timer);
      clearInterval(played);
    }
    assert.ok(a.state.round.results.winners.length >= 1);
    // Au décompte, toutes les cartes sont visibles de toutes.
    for (const id of a.state.round.seats) assert.ok(a.state.round.grids[id].every((x) => x === null || x.rank));
  } finally {
    a.socket.close();
    await srv.close();
  }
});

test('on retrouve sa place après une coupure, et un même pseudo reprend son siège', async () => {
  const srv = await startServer();
  const a = connect(srv.url);
  const b = connect(srv.url);
  try {
    a.socket.emit('gabo:create', { name: 'Alice' });
    const s = await a.until((x) => x?.players.length === 1);
    b.socket.emit('gabo:join', { code: s.code, name: 'Bob' });
    await a.until((x) => x?.players.length === 2);
    const bobId = b.joined.playerId;
    b.socket.close();
    await a.until((x) => x.players.find((p) => p.id === bobId)?.connected === false);

    const b2 = connect(srv.url);
    b2.socket.emit('gabo:rejoin', { code: s.code, playerId: bobId });
    await a.until((x) => x.players.find((p) => p.id === bobId)?.connected === true);
    b2.socket.close();
    await a.until((x) => x.players.find((p) => p.id === bobId)?.connected === false);

    const b3 = connect(srv.url);
    b3.socket.emit('gabo:join', { code: s.code.toLowerCase(), name: 'bob' });
    await b3.until((x) => x?.you === bobId);
    assert.equal(a.state.players.length, 2, 'pas de doublon');
    b3.socket.close();
  } finally {
    a.socket.close();
    await srv.close();
  }
});
