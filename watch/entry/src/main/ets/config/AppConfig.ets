// First LAN spike: replace this host with the IPv4 address printed by bridge/src/server.ts.
// Example: ws://192.168.1.23:8787/v1/stream
export const DEFAULT_BRIDGE_URL: string = 'ws://192.168.1.100:8787/v1/stream';

// Leave empty while CODEX_WATCH_TOKEN is unset on the bridge.
// Do not commit a real token to source control; a pairing flow will replace this in the next milestone.
export const DEV_BRIDGE_TOKEN: string = '';
