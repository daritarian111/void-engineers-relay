import { RoomCore } from './core.js';

// One Durable Object per room code. It holds the sockets and runs RoomCore.
export class Room {
  constructor(state, env) { this.core = new RoomCore(); }
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.core.addSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{3,12})$/);
    if (m) {
      const id = env.ROOM.idFromName(m[1].toUpperCase());
      return env.ROOM.get(id).fetch(request);
    }
    return new Response('Void Engineers relay is running.', { headers: { 'content-type': 'text/plain' } });
  },
};
