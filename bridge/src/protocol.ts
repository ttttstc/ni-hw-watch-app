export const PROTOCOL_VERSION = 1 as const;

export type CodexStatus =
  | 'ready'
  | 'working'
  | 'waiting_input'
  | 'done'
  | 'error'
  | 'offline';

export interface CodexGaugeState {
  contextRemainingPercent: number | null;
  fiveHourRemainingPercent: number | null;
  weeklyRemainingPercent: number | null;
  tokensUsed: number | null;
}

export interface CodexTaskState {
  id: string | null;
  title: string | null;
  project: string | null;
  promptPreview: string | null;
  startedAt: string | null;
}

export interface CodexSnapshot {
  protocolVersion: typeof PROTOCOL_VERSION;
  status: CodexStatus;
  model: string;
  reasoningEffort: string | null;
  speed: string | null;
  gauges: CodexGaugeState;
  task: CodexTaskState;
  updatedAt: string;
}

export interface CodexStatePatch {
  status?: CodexStatus;
  model?: string;
  reasoningEffort?: string | null;
  speed?: string | null;
  gauges?: Partial<CodexGaugeState>;
  task?: Partial<CodexTaskState>;
}

export interface SnapshotEvent {
  type: 'snapshot';
  eventId: string;
  sentAt: string;
  data: CodexSnapshot;
}

export interface HeartbeatEvent {
  type: 'heartbeat';
  eventId: string;
  sentAt: string;
}

export interface PongEvent {
  type: 'pong';
  eventId: string;
  sentAt: string;
}

export type BridgeEvent = SnapshotEvent | HeartbeatEvent | PongEvent;

export interface PingCommand {
  type: 'ping';
}
