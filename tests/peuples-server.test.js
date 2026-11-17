/**
 * Les Sept Peuples à travers de vraies connexions Socket.io : chaque poste
 * reçoit sa propre vue, et la main d'une autre ne transite jamais par le
 * réseau — c'est la garantie qu'un client bricolé ne peut pas tricher.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

import { registerSocketHandlers } from '../server/sockets.js';
import { getRoom, resetRooms } from '../server/rooms.js';

async function startServer() {
  resetRooms();
  const server = http.createServer();
  const io = new Server(server);
  registerSocketHandlers(io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      io.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function connect(url) {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true });
  const raw = [];
  socket.onAny((event, payload) => raw.push(JSON.stringify(payload ?? null)));
  return {
    socket,
    raw,
    next(event, predicate = () => true) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout sur ${event}`)), 3000);
        const handler = (payload) => {
          if (!predicate(payload)) return;
          clearTimeout(timer);
          socket.off(event, handler);
          resolve(payload);
        };
        socket.on(event, handler);
      });
    },
  };
}

test('chaque poste ne reçoit que sa propre main', async () => {
  const server = await startServer();
  const ana = connect(server.url);
  const bea = connect(server.url);
  try {
    const joinedA = ana.next('game:joined');
    ana.socket.emit('game:create', { game: 'peuples', name: 'Ana', locale: 'fr' });
    const { code, playerIds: [anaId] } = await joinedA;

    const joinedB = bea.next('game:joined');
    bea.socket.emit('game:join', { code, name: 'Bea' });
    const { playerIds: [beaId] } = await joinedB;

    const startedA = ana.next('game:state', (s) => s.phase === 'playing');
    const startedB = bea.next('game:state', (s) => s.phase === 'playing');
    ana.socket.emit('game:start');
    const [viewA, viewB] = await Promise.all([startedA, startedB]);

    assert.equal(viewA.game, 'peuples');
    const meA = viewA.players.find((p) => p.id === anaId);
    const otherA = viewA.players.find((p) => p.id === beaId);
    assert.ok(Array.isArray(meA.hand) && meA.hand.length >= 5);
    assert.equal(otherA.hand, null);
    assert.equal(viewB.players.find((p) => p.id === anaId).hand, null);

    // Rien de la main de Bea n'a jamais traversé la connexion d'Ana.
    const { state } = getRoom(code);
    const beaHand = state.players.find((p) => p.id === beaId).hand;
    const everything = ana.raw.join('\n');
    for (const cardId of beaHand) assert.ok(!everything.includes(`"${cardId}"`), `${cardId} a fuité`);
    assert.ok(!everything.includes('"deck":['), 'la pioche a fuité');
  } finally {
    ana.socket.close();
    bea.socket.close();
    await server.close();
  }
});

test('une partie lancée des Sept Peuples se reprend après une déconnexion', async () => {
  const server = await startServer();
  const ana = connect(server.url);
  const back = connect(server.url);
  try {
    const joined = ana.next('game:joined');
    ana.socket.emit('game:create', { game: 'peuples', name: 'Ana' });
    const { code, playerIds } = await joined;
    assert.equal(getRoom(code).state.game, 'peuples');
    const withBot = ana.next('game:state', (s) => s.players.length === 2);
    ana.socket.emit('game:add-bot', { difficulty: 'expert' });
    assert.equal((await withBot).players[1].bot, 'expert');
    const started = ana.next('game:state', (s) => s.phase === 'playing');
    ana.socket.emit('game:start');
    await started;

    ana.socket.close();
    const rejoined = back.next('game:state', (s) => s.players.some((p) => p.id === playerIds[0] && Array.isArray(p.hand)));
    back.socket.emit('game:rejoin', { code, playerIds });
    // Revenue, elle retrouve sa main — et elle seule.
    const view = await rejoined;
    assert.equal(view.players.find((p) => p.bot).hand, null);
  } finally {
    ana.socket.close();
    back.socket.close();
    await server.close();
  }
});
