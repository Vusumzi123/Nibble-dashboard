// Wire types for the Nibble dashboard backend (cards 8/9/16). Kept loose where
// the harness may add fields — the UI renders what is present and degrades on
// what is not.

export interface Health {
  ok: boolean;
  directory: string;
  serve_url: string;
  writable_sections: string[];
  auth: string;
}

export interface AutonomyConfig {
  level: number;
  gate_mode: 'shadow' | 'gate';
  gate_scope: 'main' | 'all';
  heartbeat: { frequency: string; in_progress_lock: boolean };
  mission_token_budget: number | 'unlimited';
  [key: string]: unknown;
}

export interface HeartbeatConfig {
  enabled: boolean;
  long_silence_factor: number;
  log: string;
  log_rotate_bytes: number;
  log_keep_generations: number;
  log_retention_days: number;
  log_compress: boolean;
  log_compress_after: number;
  log_compress_level: number;
  log_rotate_by: string;
}

export interface ConfigSnapshot {
  autonomy: AutonomyConfig;
  heartbeat: HeartbeatConfig;
  mood: Record<string, unknown>;
  comms: Record<string, unknown>;
  dashboard: Record<string, unknown>;
}

export type HeartbeatState = 'idle' | 'in-flight';
export type HeartbeatPhase = 'pre-gate' | 'digest' | 'dispatch' | 'mission' | 'post';

export interface HeartbeatCurrent {
  state: HeartbeatState;
  tick: number | null;
  phase: HeartbeatPhase | null;
  mission: string | null;
  mission_title: string | null;
  session: string | null;
  started_at: string | null;
  updated_at: string;
  level: number | null;
}

export interface HeartbeatSnapshot {
  ts: string;
  current: HeartbeatCurrent | null;
  lock: boolean;
  lock_stale: boolean;
}

export interface LedgerInfo {
  name: string;
  bytes: number;
  lines: number;
}

export interface MoodState {
  valence: number;
  arousal: number;
  [key: string]: unknown;
}

export interface Metrics {
  ts: string;
  config: ConfigSnapshot;
  mood: (MoodState & { file: string }) | null;
  backlog: { total: number; by_status: Record<string, number> } | null;
  ledgers: LedgerInfo[];
  heartbeat: { lock: boolean; lock_stale: boolean };
}

export interface HeartbeatError {
  phase: HeartbeatPhase | string;
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
}

// One line of logs/heartbeat.log (the per-tick NDJSON ledger).
export interface HeartbeatTick {
  ts: string;
  event?: string;
  tick?: number | null;
  digest_hash?: string;
  level?: number;
  quiet?: boolean;
  candidates?: string[];
  bias?: { mood: number; dispatch_influence: boolean };
  verdict?: string | null;
  mission?: string | null;
  outcome?: string;
  token_cost?: number;
  duration_ms?: number;
  mood_event?: string | null;
  gate?: string;
  reason?: string;
  idea?: string;
  error?: HeartbeatError;
  [key: string]: unknown;
}

export interface BacklogEntry {
  id: string;
  source?: string;
  kind?: string;
  payload?: { title?: string; detail?: string };
  status?: string;
  result?: { ok?: boolean; summary?: string; token_cost?: number; ts?: string } | null;
  [key: string]: unknown;
}

export interface BacklogSnapshot {
  total: number;
  entries: BacklogEntry[];
}

export interface WriteResult {
  section: string;
  applied: Record<string, unknown>;
}

// Missions widget (backend card 8 extension). The mission list is the
// filesystem (`.opencode/missions/*.md`); the restrict-only overlay
// `autonomy.missions.<id>.*` can disable a mission but never re-enable one the
// file itself disables.
export interface MissionOverlay {
  enabled?: boolean;
  min_level?: number;
  frequency?: string;
  menus?: string[];
  [key: string]: unknown;
}

export interface MissionView {
  id: string;
  title: string;
  frequency: string;
  menus: string[];
  min_level: number;
  approval: string;
  candidacy: string;
  agent: string;
  /** Effective enabled state after the overlay. */
  enabled: boolean;
  /** The mission file's own `enabled` — false means the overlay cannot turn it on. */
  file_enabled: boolean;
  overlay: MissionOverlay | null;
}

export interface MissionsSnapshot {
  missions: MissionView[];
}

export interface MissionToggleResult {
  id: string;
  enabled: boolean;
}

// opencode serve shapes (proxied through /api/serve) — structurally loose.
export interface SessionInfo {
  id: string;
  title?: string;
  time?: { created?: number; updated?: number };
  parentID?: string | null;
  [key: string]: unknown;
}

export interface MessageInfo {
  id?: string;
  role?: string;
  time?: { created?: number; completed?: number };
  [key: string]: unknown;
}

export interface MessagePart {
  type?: string;
  text?: string;
  synthetic?: boolean;
  ignored?: boolean;
  tool?: string;
  callID?: string;
  state?: { status?: string; title?: string; input?: unknown; output?: unknown; error?: unknown };
  [key: string]: unknown;
}

export interface MessageRow {
  info?: MessageInfo;
  parts?: MessagePart[];
  [key: string]: unknown;
}
