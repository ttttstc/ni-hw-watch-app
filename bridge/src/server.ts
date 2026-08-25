import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces, hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { StateStore } from './state.js';
import type {
  BridgeEvent,
  CodexStatePatch,
  HeartbeatEvent,
  PingCommand,
  PongEvent,
  SnapshotEvent
} from './protocol.js';

const HOST = process.env.CODEX_WATCH_HOST ?? '0.0.0.0';
const PORT = Number.parseInt(process.env.CODEX_WATCH_PORT ?? '8787', 10);
const TOKEN = process.env.CODEX_WATCH_TOKEN?.trim() || null;
const MAX_BODY_BYTES = 64 * 1024;

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`Invalid CODEX_WATCH_PORT: ${process.env.CODEX_WATCH_PORT}`);
}

const stateStore = new StateStore();
const wss = new WebSocketServer({ noServer: true });

function json(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store'
  });
  res.end(payload);
}

function getUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
}

function isAuthorized(req: IncomingMessage, url = getUrl(req)): boolean {
  if (!TOKEN) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${TOKEN}`) {
    return true;
  }
  // Kept only for the first WATCH 4 Pro connectivity spike. Replace this with
  // one-time pairing before prompt/task data is used outside a trusted LAN.
  return url.searchParams.get('token') === TOKEN;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function snapshotEvent(): SnapshotEvent {
  return {
    type: 'snapshot',
    eventId: randomUUID(),
    sentAt: new Date().toISOString(),
    data: stateStore.get()
  };
}

function heartbeatEvent(): HeartbeatEvent {
  return {
    type: 'heartbeat',
    eventId: randomUUID(),
    sentAt: new Date().toISOString()
  };
}

function pongEvent(): PongEvent {
  return {
    type: 'pong',
    eventId: randomUUID(),
    sentAt: new Date().toISOString()
  };
}

function send(ws: WebSocket, message: BridgeEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastSnapshot(): void {
  const message = snapshotEvent();
  for (const client of wss.clients) {
    send(client, message);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = getUrl(req);

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, {
        ok: true,
        service: 'ni-codex-watch-bridge',
        hostname: hostname(),
        websocketClients: wss.clients.size,
        authEnabled: TOKEN !== null
      });
      return;
    }

    if (!isAuthorized(req, url)) {
      json(res, 401, { error: 'unauthorized' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/state') {
      json(res, 200, stateStore.get());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/state') {
      const rawBody = await readJsonBody(req);
      if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
        json(res, 400, { error: 'State patch must be a JSON object.' });
        return;
      }
      const snapshot = stateStore.patch(rawBody as CodexStatePatch);
      broadcastSnapshot();
      json(res, 200, snapshot);
      return;
    }

    json(res, 404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    json(res, 400, { error: message });
  }
});

wss.on('connection', (ws) => {
  send(ws, snapshotEvent());

  ws.on('message', (raw) => {
    try {
      const command = JSON.parse(raw.toString()) as PingCommand;
      if (command.type === 'ping') {
        send(ws, pongEvent());
      }
    } catch {
      // Protocol v1 is read-only except for ping/pong. Ignore unknown commands.
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  const url = getUrl(req);
  if (url.pathname !== '/v1/stream' || !isAuthorized(req, url)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

const heartbeatTimer = setInterval(() => {
  const message = heartbeatEvent();
  for (const client of wss.clients) {
    send(client, message);
  }
}, 15_000);
heartbeatTimer.unref();

function getLanAddresses(): string[] {
  const addresses: string[] = [];
  for (const network of Object.values(networkInterfaces())) {
    for (const address of network ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return [...new Set(addresses)];
}

server.listen(PORT, HOST, () => {
  console.log(`ni-codex-watch-bridge listening on ${HOST}:${PORT}`);
  for (const address of getLanAddresses()) {
    console.log(`  health: http://${address}:${PORT}/health`);
    console.log(`  watch : ws://${address}:${PORT}/v1/stream${TOKEN ? '?token=<CODEX_WATCH_TOKEN>' : ''}`);
  }
  if (!TOKEN) {
    console.warn('WARNING: CODEX_WATCH_TOKEN is not set. LAN endpoints are unauthenticated.');
  }
});

function shutdown(): void {
  for (const client of wss.clients) {
    client.close(1001, 'bridge shutting down');
  }
  wss.close();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
