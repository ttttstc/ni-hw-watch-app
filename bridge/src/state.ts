import { PROTOCOL_VERSION, type CodexSnapshot, type CodexStatePatch, type CodexStatus } from './protocol.js';

const VALID_STATUSES: ReadonlySet<CodexStatus> = new Set([
  'ready',
  'working',
  'waiting_input',
  'done',
  'error',
  'offline'
]);

function clampPercent(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (!Number.isFinite(value)) {
    throw new Error('Gauge percentage must be a finite number.');
  }
  return Math.max(0, Math.min(100, value));
}

function validatePatch(patch: CodexStatePatch): CodexStatePatch {
  if (patch.status !== undefined && !VALID_STATUSES.has(patch.status)) {
    throw new Error(`Unsupported status: ${String(patch.status)}`);
  }

  if (patch.model !== undefined && patch.model.trim().length === 0) {
    throw new Error('model cannot be empty.');
  }

  if (patch.gauges?.tokensUsed !== undefined && patch.gauges.tokensUsed !== null) {
    if (!Number.isFinite(patch.gauges.tokensUsed) || patch.gauges.tokensUsed < 0) {
      throw new Error('tokensUsed must be a non-negative finite number.');
    }
  }

  return {
    ...patch,
    model: patch.model?.trim(),
    gauges: patch.gauges ? {
      ...patch.gauges,
      contextRemainingPercent: clampPercent(patch.gauges.contextRemainingPercent),
      fiveHourRemainingPercent: clampPercent(patch.gauges.fiveHourRemainingPercent),
      weeklyRemainingPercent: clampPercent(patch.gauges.weeklyRemainingPercent)
    } : undefined
  };
}

export class StateStore {
  private snapshot: CodexSnapshot = {
    protocolVersion: PROTOCOL_VERSION,
    status: 'ready',
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
    updatedAt: new Date().toISOString()
  };

  get(): CodexSnapshot {
    return structuredClone(this.snapshot);
  }

  patch(rawPatch: CodexStatePatch): CodexSnapshot {
    const patch = validatePatch(rawPatch);
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      gauges: {
        ...this.snapshot.gauges,
        ...(patch.gauges ?? {})
      },
      task: {
        ...this.snapshot.task,
        ...(patch.task ?? {})
      },
      protocolVersion: PROTOCOL_VERSION,
      updatedAt: new Date().toISOString()
    };
    return this.get();
  }
}
