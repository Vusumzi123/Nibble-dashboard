import { Component, computed, inject } from '@angular/core';

import { fmtDuration, fmtTime, fmtTokens } from '../../core/format';
import { DashboardStore } from '../../core/store';

// The heartbeat tick budget (heartbeat-hook.ts HEARTBEAT_TICK_TIMEOUT_MS).
const TICK_BUDGET_MS = 15 * 60_000;

@Component({
  selector: 'app-flight-page',
  templateUrl: './flight.html',
  styleUrl: './flight.css',
})
export class FlightPage {
  protected readonly store = inject(DashboardStore);

  protected readonly status = computed(() => {
    const hb = this.store.heartbeat();
    if (!hb) return 'unknown';
    if (hb.current?.state === 'in-flight') return 'in-flight';
    if (hb.lock) return 'in-flight (lock)';
    return 'idle';
  });

  protected readonly elapsedMs = computed(() => {
    const started = this.store.heartbeat()?.current?.started_at;
    if (!started) return null;
    const t = Date.parse(started);
    if (Number.isNaN(t)) return null;
    return Math.max(0, this.store.now() - t);
  });

  protected readonly elapsedPct = computed(() => {
    const e = this.elapsedMs();
    if (e === null) return 0;
    return Math.min(100, Math.round((e / TICK_BUDGET_MS) * 100));
  });

  protected readonly tokenBudget = computed(() => {
    const b = this.store.config()?.autonomy.mission_token_budget;
    if (b === 'unlimited') return 'unlimited';
    if (typeof b === 'number') return fmtTokens(b);
    return '—';
  });

  protected readonly recentTicks = computed(() => [...this.store.ticks()].slice(-20).reverse());

  protected readonly lockLabel = computed(() => {
    const hb = this.store.heartbeat();
    if (!hb?.lock) return 'free';
    return hb.lock_stale ? 'held (stale)' : 'held';
  });

  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtTime = fmtTime;
  protected readonly fmtTokens = fmtTokens;
}
