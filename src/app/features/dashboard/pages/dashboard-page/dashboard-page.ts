import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../services/dashboard-service';
import { TodaySalesDto } from '../../dtos/today-sales-dto';
import { LastClosureSummaryDto } from '../../dtos/last-closure-summary-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import { CurrentUserService } from '@features/auth/services/current-user-service';
import { AuthService } from '@features/auth/services/auth-service';
import { BranchContextService } from '@core/services/branch-context-service';

@Component({
  selector: 'app-dashboard-page',
  imports: [MoneyPipe, DatePipe, RouterLink],
  templateUrl: './dashboard-page.html',
})
export default class DashboardPage {
  private dashboardService = inject(DashboardService);
  private permissionService = inject(PermissionService);
  private currentUserService = inject(CurrentUserService);
  private authService = inject(AuthService);
  private branchContext = inject(BranchContextService);

  today = signal<TodaySalesDto | null>(null);
  lastClosure = signal<LastClosureSummaryDto | null>(null);
  loadingToday = signal(true);
  loadingClosure = signal(true);

  readonly username = this.currentUserService.user;

  canSeeToday = computed(() => this.permissionService.canRead('sales', 'sales'));
  canSeeClosure = computed(() => this.permissionService.canRead('sales', 'closures'));
  hasWidgets = computed(() => this.canSeeToday() || this.canSeeClosure());

  menuFeatures = computed(() =>
    this.authService
      .getFeatures()
      .filter((f) => f.isMenu && this.permissionService.hasReadPermission(f)),
  );

  routeSegments(route: string): string[] {
    return ['/', ...route.split('/').filter(Boolean)];
  }

  constructor() {
    // Reacciona al branch activo: cuando cambia, reinicia los widgets y recarga
    effect(() => {
      // Lee el branch activo para establecer dependencia reactiva
      this.branchContext.active();

      this.today.set(null);
      this.lastClosure.set(null);
      this.loadingToday.set(true);
      this.loadingClosure.set(true);

      if (this.canSeeToday()) {
        this.dashboardService.getTodaySales().subscribe({
          next: (d) => this.today.set(d),
          error: () => this.today.set(null),
          complete: () => this.loadingToday.set(false),
        });
      } else {
        this.loadingToday.set(false);
      }

      if (this.canSeeClosure()) {
        this.dashboardService.getLastClosure().subscribe({
          next: (d) => this.lastClosure.set(d),
          error: () => this.lastClosure.set(null),
          complete: () => this.loadingClosure.set(false),
        });
      } else {
        this.loadingClosure.set(false);
      }
    });
  }
}
