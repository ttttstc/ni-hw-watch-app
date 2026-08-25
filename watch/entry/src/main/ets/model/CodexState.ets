export type CodexStatus = 'ready' | 'working' | 'waiting_input' | 'done' | 'error' | 'offline';

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
  protocolVersion: number;
  status: CodexStatus;
  model: string;
  reasoningEffort: string | null;
  speed: string | null;
  gauges: CodexGaugeState;
  task: CodexTaskState;
  updatedAt: string;
}

export interface SnapshotEvent {
  type: string;
  eventId: string;
  sentAt: string;
  data?: CodexSnapshot;
}

export function emptySnapshot(): CodexSnapshot {
  return {
    protocolVersion: 1,
    status: 'offline',
    model: 'codex',
    reasoningEffort: null,
    speed: null,
    gauges: {
      contextRemainingPercent: null,
      fiveHourRemainingPercent: null,
      weeklyRemainingPercent: null,
      tokensUsed: null
    },
    task: {
      id: null,
      title: null,
      project: null,
      promptPreview: null,
      startedAt: null
    },
    updatedAt: ''
  };
}
