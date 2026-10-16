import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { DashboardStore } from './core/store';
import { ThemeService } from './theme';

interface NavItem {
  path: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly store = inject(DashboardStore);
  protected readonly theme = inject(ThemeService);

  protected readonly nav: NavItem[] = [
    { path: '/flight', label: 'flight' },
    { path: '/output', label: 'output & thoughts' },
    { path: '/metrics', label: 'metrics' },
    { path: '/setup', label: 'setup' },
  ];

  ngOnInit(): void {
    void this.store.start();
  }
}
