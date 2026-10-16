import { Routes } from '@angular/router';

import { FlightPage } from './pages/flight/flight';
import { MetricsPage } from './pages/metrics/metrics';
import { OutputPage } from './pages/output/output';
import { SetupPage } from './pages/setup/setup';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'flight' },
  { path: 'flight', component: FlightPage, title: 'Flight — Nibble heartbeat' },
  { path: 'output', component: OutputPage, title: 'Output — Nibble heartbeat' },
  { path: 'metrics', component: MetricsPage, title: 'Metrics — Nibble heartbeat' },
  { path: 'setup', component: SetupPage, title: 'Setup — Nibble heartbeat' },
  { path: '**', redirectTo: 'flight' },
];
