# LAN protocol v1

## Design goals

The first protocol version is intentionally small and read-only from the watch's point of view. The PC owns Codex state; the watch observes snapshots.

Transport:

- HTTP for health checks and producer-to-bridge updates.
- WebSocket for bridge-to-watch real-time state propagation.
- TCP port 8787 by default.
- JSON UTF-8 payloads.

## Snapshot

```json
{
  "protocolVersion": 1,
  "status": "working",
  "model": "gpt-5.5",
  "reasoningEffort": "medium",
  "speed": "fast",
  "gauges": {
    "contextRemainingPercent": 77,
    "fiveHourRemainingPercent": 97,
    "weeklyRemainingPercent": 62,
    "tokensUsed": 2390000
  },
  "task": {
    "id": "demo-1",
    "title": "Protocol refactor",
    "project": "ni-hw-watch-app",
    "promptPreview": "Refactor the protocol and wait for the next instruction.",
    "startedAt": "2026-08-25T10:00:00.000Z"
  },
  "updatedAt": "2026-08-25T10:03:00.000Z"
}
```

`status` is one of:

```text
ready | working | waiting_input | done | error | offline
```

Gauge percentages are defined as **remaining percentage**, not consumed percentage. A null value means the bridge does not currently know that metric.

## WebSocket server events

### snapshot

Sent immediately after connection and after each state mutation.

```json
{
  "type": "snapshot",
  "eventId": "uuid",
  "sentAt": "2026-08-25T10:03:00.000Z",
  "data": { "protocolVersion": 1 }
}
```

### heartbeat

Sent every 15 seconds so the wearable can distinguish an idle Codex task from a dead LAN connection.

```json
{
  "type": "heartbeat",
  "eventId": "uuid",
  "sentAt": "2026-08-25T10:03:15.000Z"
}
```

### pong

The watch may send `{"type":"ping"}` and the bridge responds with a pong event.

## Producer API

`POST /v1/state` accepts a partial state patch. Nested `gauges` and `task` objects are merged with the previous snapshot.

Example:

```json
{
  "status": "waiting_input",
  "task": {
    "promptPreview": "Need user confirmation before editing the release workflow."
  }
}
```

The bridge then broadcasts a complete snapshot to every connected watch client.

## Security scope

If `CODEX_WATCH_TOKEN` is set, state endpoints require a bearer token. The WebSocket endpoint also temporarily supports the token as a URL query parameter for compatibility testing on older WATCH 4 Pro/HarmonyOS networking APIs.

This is a development protocol. Before exposing real prompt text or any control action, replace query-string authentication with one-time pairing and a persisted per-device credential.

## Non-goals in v1

- The watch cannot submit Codex prompts or approve actions.
- The bridge does not expose shell execution.
- There is no cloud relay.
- There is no background-delivery guarantee when the wearable app is suspended.
- LAN service discovery is not part of v1; the bridge address is configured manually.
