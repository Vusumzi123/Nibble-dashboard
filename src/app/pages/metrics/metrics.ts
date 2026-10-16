import { Component, computed, inject } from '@angular/core';

import { fmtDuration, fmtNumber, fmtTime, fmtTokens } from '../../core/format';
import { HeartbeatTick } from '../../core/models';
import { DashboardStore } from '../../core/store';

interface MissionStat {
  mission: string;
  count: number;
  tokens: number;
  completed: number;
  failed: number;
}

interface Cadence {
  avg: number;
  min: number;
  max: number;
  n: number;
}

@Component({
  selector: 'app-metrics-page',
  templateUrl: './metrics.html',
  styleUrl: './metrics.css',
})
export class MetricsPage {
  protected readonly store = inject(DashboardStore);

  protected readonly fmtTime = fmtTime;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtNumber = fmtNumber;
  protected readonly fmtTokens = fmtTokens;

  private readonly ticks = computed<HeartbeatTick[]>(() => this.store.ticks());

  protected readonly totalTokens = computed(() =>
    this.ticks().reduce((sum, t) => sum + (typeof t.token_cost === 'number' ? t.token_cost : 0), 0),
  );

  protected readonly completed = computed(() => this.ticks().filter((t) => t.outcome === 'completed').length);
  protected readonly errors = computed(() => this.ticks().filter((t) => t.outcome === 'error').length);
  protected readonly timeouts = computed(() => this.ticks().filter((t) => t.outcome === 'timeout').length);
  protected readonly silent = computed(() => this.ticks().filter((t) => t.outcome === 'silent').length);
  protected readonly runs = computed(
    () => this.ticks().filter((t) => typeof t.mission === 'string' && t.mission !== '').length,
  );

  protected readonly avgDuration = computed<number | null>(() => {
    const d = this.ticks()
      .map((t) => t.duration_ms)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (d.length === 0) return null;
    return d.reduce((a, b) => a + b, 0) / d.length;
  });

  protected readonly cadence = computed<Cadence | null>(() => {
    const times = this.ticks()
      .map((t) => Date.parse(t.ts))
      .filter((n) => Number.isFinite(n));
    if (times.length < 2) return null;
    const deltas: number[] = [];
    for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
    return {
      avg: deltas.reduce((a, b) => a + b, 0) / deltas.length,
      min: Math.min(...deltas),
      max: Math.max(...deltas),
      n: deltas.length,
    };
  });

  protected readonly missions = computed<MissionStat[]>(() => {
    const map = new Map<string, MissionStat>();
    for (const t of this.ticks()) {
      if (typeof t.mission !== 'string' || t.mission === '') continue;
      const stat = map.get(t.mission) ?? { mission: t.mission, count: 0, tokens: 0, completed: 0, failed: 0 };
      stat.count += 1;
      if (typeof t.token_cost === 'number') stat.tokens += t.token_cost;
      if (t.outcome === 'completed') stat.completed += 1;
      if (t.outcome === 'error' || t.outcome === 'timeout') stat.failed += 1;
      map.set(t.mission, stat);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  });

  protected readonly errorRows = computed(() => this.ticks().filter((t) => !!t.error).reverse());

  protected readonly mood = computed(() => this.store.metrics()?.mood ?? null);
  protected readonly backlog = computed(() => this.store.metrics()?.backlog ?? null);

  protected readonly statusEntries = computed<Array<[string, number]>>(() =>
    Object.entries(this.backlog()?.by_status ?? {}),
  );
}
