// The room logic. It knows nothing about Cloudflare, so it can be tested on its own.
// One room = one game. The first player in is the host and runs the world; everyone else is a guest.
// The relay only passes messages along. It never looks inside the game data.
export const MAX_PLAYERS = 8;
export const MAX_MSG = 900000; // stay under the 1 MiB socket limit

export class RoomCore {
  constructor() { this.players = new Map(); this.next = 1; this.hostId = 0; }

  list() { return [...this.players.values()].map(p => ({ id: p.id, name: p.name })); }

  addSocket(ws) {
    if (this.players.size >= MAX_PLAYERS) { try { ws.send(JSON.stringify({ t: 'full' })); ws.close(1000, 'full'); } catch (e) {} return null; }
    const p = { id: this.next++, name: 'Engineer', ws };
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    this.send(p, { t: 'hello', id: p.id, host: this.hostId, players: this.list() });
    ws.addEventListener('message', ev => this.onMessage(p, ev.data));
    const gone = () => this.remove(p);
    ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    return p;
  }

  send(p, obj) { try { p.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) { this.remove(p); } }

  onMessage(p, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { this.send(p, { t: 'pong' }); return; }
    if (m.t === 'name') {
      p.name = String(m.name || 'Engineer').replace(/[<>]/g, '').slice(0, 18) || 'Engineer';
      this.broadcast({ t: 'joined', id: p.id, name: p.name }, null);
      return;
    }
    m.from = p.id;
    const to = m.to;
    if (to === 'host') { const h = this.players.get(this.hostId); if (h && h !== p) this.send(h, m); return; }
    if (typeof to === 'number') { const q = this.players.get(to); if (q) this.send(q, m); return; }
    this.broadcast(m, p);   // everyone else
  }

  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const q of [...this.players.values()]) if (q !== except) this.send(q, s);
  }

  remove(p) {
    if (!this.players.delete(p.id)) return;
    this.broadcast({ t: 'left', id: p.id }, null);
    if (p.id === this.hostId) {   // the longest-standing player takes over
      const nxt = [...this.players.keys()].sort((a, b) => a - b)[0] || 0;
      this.hostId = nxt;
      if (nxt) this.broadcast({ t: 'host', id: nxt }, null);
    }
  }
}
