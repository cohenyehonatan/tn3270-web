/**
 * TN3270 WebSocket Proxy Server
 *
 * Accepts WebSocket connections from the browser client and proxies them
 * to mainframe TN3270 hosts over TCP.
 *
 * Protocol:
 * - Client sends JSON text message: { type: 'connect', host, port, tls, terminalType, luName? }
 * - Server responds with JSON: { type: 'session-ready', ... } or { type: 'error', ... }
 * - After session-ready, binary frames carry raw 3270 data stream records both directions
 * - Client can send JSON: { type: 'disconnect' } to end the session
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './session/session-manager.js';
import type { SessionConfig } from './session/session.js';

const PORT = parseInt(process.env.TN3270_PROXY_PORT || '3271', 10);
const sessionManager = new SessionManager();

// Create HTTP server (could serve static files too)
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`TN3270 WebSocket Proxy\nActive sessions: ${sessionManager.activeCount}\n`);
});

// Create WebSocket server on /tn3270 path
const wss = new WebSocketServer({ server, path: '/tn3270' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[proxy] New WebSocket connection');

  let sessionCreated = false;

  // Wait for the first text message with connection config
  const messageHandler = async (data: Buffer | string, isBinary: boolean) => {
    if (sessionCreated) return; // Already handled

    if (isBinary) {
      // Binary data before session is established — ignore
      return;
    }

    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'connect') {
        sessionCreated = true;
        ws.removeListener('message', messageHandler);

        const config: SessionConfig = {
          host: msg.host,
          port: msg.port ?? 23,
          tls: msg.tls ?? false,
          terminalType: msg.terminalType ?? 'IBM-3279-2-E',
          luName: msg.luName,
        };

        console.log(`[proxy] Connecting to ${config.host}:${config.port} (TLS: ${config.tls})`);

        try {
          const session = await sessionManager.createSession(ws, config);

          ws.on('close', () => {
            console.log(`[proxy] WebSocket closed, cleaning up session ${session.id}`);
            sessionManager.destroySession(session.id);
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[proxy] Connection failed: ${message}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message }));
            ws.close();
          }
        }
      }
    } catch {
      // Invalid JSON — ignore
    }
  };

  ws.on('message', messageHandler);

  ws.on('error', (err) => {
    console.error('[proxy] WebSocket error:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`TN3270 WebSocket Proxy listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/tn3270`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  sessionManager.destroyAll();
  wss.close();
  server.close();
  process.exit(0);
});
