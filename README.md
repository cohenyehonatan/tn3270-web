# tn3270-web

A TypeScript monorepo for a browser-based 3270 terminal emulator with:

- A React client terminal UI
- A Node.js WebSocket proxy to TN3270/TN3270E hosts
- Shared protocol/types/utilities package

The client can run in:

- Demo mode (fully in-browser, no server/mainframe needed)
- Live mode (browser -> WebSocket proxy -> TN3270 host)

## Monorepo Structure

```text
packages/
	client/   React + Vite terminal emulator
	server/   WebSocket TN3270 proxy (Express/ws + TCP/TLS socket)
	shared/   Shared 3270/Telnet constants, types, builders, encoding helpers
```

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run (Development)

Start both client and server:

```bash
npm run dev
```

This launches:

- Client (Vite): http://localhost:8888
- Proxy server: http://localhost:3271
- WebSocket endpoint: ws://localhost:3271/tn3270

In dev, Vite proxies `/tn3270` WebSocket traffic from port 8888 to port 3271.

## Build

```bash
npm run build
```

Build order:

1. `@tn3270/shared`
2. `@tn3270/client`
3. `@tn3270/server`

## Type Check

```bash
npm run typecheck
```

## Test

Run all workspace tests:

```bash
npm test
```

Run package-scoped tests:

```bash
npm run test -w packages/shared
npm run test -w packages/client
npm run test -w packages/server
```

## Using The App

Open the app at `http://localhost:8888`. The connection dialog supports:

- Host, port, TLS toggle
- Terminal type selection
- Optional LU name
- Saved connection profiles (persisted in `localStorage`)
- Demo mode

### Demo Mode

Demo mode uses an in-browser mock host and scripted screens (login, ISPF/CICS-style flows). No server or mainframe connection is required.

### Live Mode

Live mode sends a JSON `connect` control message over WebSocket:

```json
{
	"type": "connect",
	"host": "mainframe.example.com",
	"port": 23,
	"tls": false,
	"terminalType": "IBM-3279-2-E",
	"luName": ""
}
```

After negotiation completes, binary WebSocket frames carry raw 3270 records in both directions.

## Runtime Configuration

### Server

- `TN3270_PROXY_PORT` (default: `3271`)

Example:

```bash
TN3270_PROXY_PORT=4000 npm run dev -w packages/server
```

If you change this port in development, also update the Vite proxy target in `packages/client/vite.config.ts`.

## Architecture Summary

### Client

- `ScreenBuffer` stores 3270 screen cells and field metadata
- `DataStreamParser` parses host write/read commands, WCC, and 3270 orders
- `KeyboardHandler` maps browser keys to 3270 actions/AID keys
- `TerminalScreen` renders the buffer to canvas
- `useTerminalSession` coordinates connection lifecycle, parser, keyboard, and status updates

### Server

- Accepts WebSocket connections at `/tn3270`
- Creates per-client `Session` instances
- Opens TCP/TLS socket to host
- Runs Telnet negotiation (`BINARY`, `EOR`, `TERMINAL-TYPE`, and TN3270E negotiation when available)
- Extracts IAC/EOR-delimited records and relays binary payloads to the browser

## Keyboard Mapping (Default)

- `Enter` -> Enter (AID)
- `Escape` -> Clear
- `F1..F12` -> PF1..PF12
- `Shift+F1..F12` -> PF13..PF24
- `Alt+1/2/3` -> PA1/PA2/PA3
- `Tab` / `Shift+Tab` -> Tab / Backtab
- Arrow keys, `Home`, `Delete`, `Backspace`, `End`, `Insert`
- `Ctrl+A` -> Reset keyboard lock

## Current Scope / Notes

- Negotiation supports both basic TN3270 and TN3270E pathways
- Proxy currently allows self-signed certificates when TLS is enabled (`rejectUnauthorized: false`)
- `WRITE_STRUCTURED_FIELD` is currently treated as a no-op write in the client parser

## Package Scripts

### Root

- `npm run dev` - run client + server concurrently
- `npm run build` - build all packages
- `npm test` - run all tests via Vitest workspace
- `npm run typecheck` - run TypeScript project references build check

### packages/client

- `npm run dev -w packages/client`
- `npm run build -w packages/client`
- `npm run test -w packages/client`

### packages/server

- `npm run dev -w packages/server`
- `npm run build -w packages/server`
- `npm run start -w packages/server`
- `npm run test -w packages/server`

### packages/shared

- `npm run build -w packages/shared`
- `npm run test -w packages/shared`

## Troubleshooting

- If live mode stays on "Connecting...", verify:
	- Server is running on the expected port
	- Client dev proxy target matches server port
	- Host/port/TLS values are valid for your mainframe
- If TLS fails with strict cert validation requirements, adjust server TLS socket options in `packages/server/src/session/session.ts`
- If keyboard appears locked, try `Ctrl+A` (reset)
