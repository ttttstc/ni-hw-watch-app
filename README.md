# Ni Codex Watch

A HarmonyOS wearable companion for Codex status monitoring and task reminders. The target device is HUAWEI WATCH 4 Pro.

## Milestone 0.1: direct LAN vertical slice

The first milestone deliberately avoids cloud infrastructure and phone relays:

```text
Codex / test producer
        |
        | POST /v1/state
        v
PC: codex-watch-bridge :8787
        |
        | WebSocket /v1/stream
        | local Wi-Fi / LAN
        v
HUAWEI WATCH 4 Pro
        |
        +-- status + gauges
```

Repository layout:

```text
bridge/   Node.js + TypeScript LAN bridge
watch/    HarmonyOS ArkTS wearable application
```

The bridge already supports a mock/status producer, so LAN connectivity can be validated before Codex event collection is implemented.

## 1. Start the PC bridge

Requirements: Node.js 20+.

```bash
cd bridge
npm install
npm run start
```

The bridge binds to `0.0.0.0:8787` and prints every detected LAN IPv4 address, for example:

```text
watch : ws://192.168.1.23:8787/v1/stream
```

For the very first connectivity test, leave `CODEX_WATCH_TOKEN` unset. This is intentionally development-only. Once connectivity works, enable a token or use the pairing flow planned for the next milestone.

If Windows Defender Firewall asks for network access, allow Node.js on your private network, or create an inbound rule for TCP 8787.

## 2. Point the watch app at the PC

Edit:

```text
watch/entry/src/main/ets/config/AppConfig.ets
```

Set `DEFAULT_BRIDGE_URL` to the address printed by the bridge, for example:

```ts
export const DEFAULT_BRIDGE_URL: string = 'ws://192.168.1.23:8787/v1/stream';
```

Keep `DEV_BRIDGE_TOKEN` empty while the bridge runs without authentication.

The watch and PC must be on networks that can route to each other. For the first test, putting both devices on the same Wi-Fi is the simplest setup.

## 3. Run on HUAWEI WATCH 4 Pro

Open the `watch/` directory as a HarmonyOS project in DevEco Studio, configure debug signing, connect the watch, and run the `entry` module.

The project uses `deviceTypes: ["wearable"]` and requests `ohos.permission.INTERNET`. It currently targets HarmonyOS 4.0 / API 10 to remain compatible with the WATCH 4 Pro generation while using only APIs required by this connectivity spike.

## 4. Inject a fake Codex state

### PowerShell

```powershell
$body = @{
  status = "working"
  model = "gpt-5.5"
  reasoningEffort = "medium"
  speed = "fast"
  gauges = @{
    contextRemainingPercent = 77
    fiveHourRemainingPercent = 97
    weeklyRemainingPercent = 62
    tokensUsed = 2390000
  }
  task = @{
    id = "demo-1"
    title = "Protocol refactor"
    project = "ni-hw-watch-app"
    promptPreview = "Refactor the protocol and wait for the next instruction."
    startedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8787/v1/state `
  -ContentType "application/json" `
  -Body $body
```

Change `status` to `waiting_input`, `done`, or `error` and the watch should update immediately over the existing WebSocket connection.

## HTTP / WebSocket endpoints

- `GET /health` — bridge health and connected-watch count.
- `GET /v1/state` — current snapshot.
- `POST /v1/state` — patch the current snapshot and broadcast it.
- `WS /v1/stream` — initial snapshot plus subsequent state broadcasts and heartbeats.

Set `CODEX_WATCH_TOKEN` to require authentication. HTTP supports `Authorization: Bearer <token>`. The first wearable spike also accepts `?token=<token>` on the WebSocket URL because header behavior varies across older HarmonyOS SDKs. Query-token support should be removed after the pairing flow lands.

## Current scope and next steps

Milestone 0.1 proves the direct PC-to-watch LAN data path and renders a first gauge-style screen. It does **not** yet attempt to keep a WebSocket alive after the watch app is backgrounded.

Next milestones are:

1. add automatic LAN discovery (mDNS) and one-time pairing instead of a hard-coded IP/token;
2. connect the bridge to real Codex events and usage/context data;
3. add local vibration/notification behavior for `waiting_input`, `done`, and `error`;
4. solve background delivery separately, because wearable background scheduling and notification semantics should not be conflated with foreground WebSocket connectivity.
