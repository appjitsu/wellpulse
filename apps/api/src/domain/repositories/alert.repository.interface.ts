import { Alert, AlertSeverity, AlertType } from '../alert/alert.entity';

export interface AlertFilters {
  wellId?: string;
  severity?: AlertSeverity;
  alertType?: AlertType;
  acknowledged?: boolean; // true = acknowledged, false = unacknowledged, undefined = all
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedAlerts {
  alerts: Alert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Alert Repository Interface
 *
 * Abstracts data access for alerts (immutable audit trail).
 */
export interface IAlertRepository {
  /**
   * Creates a new alert (alerts are immutable once created).
   */
  create(alert: Alert): Promise<Alert>;

  /**
   * Finds an alert by ID.
   */
  findById(tenantId: string, alertId: string): Promise<Alert | null>;

  /**
   * Finds alerts with filters and pagination.
   */
  findWithFilters(
    tenantId: string,
    filters: AlertFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedAlerts>;

  /**
   * Counts unacknowledged alerts for a tenant.
   */
  countUnacknowledged(
    tenantId: string,
    severity?: AlertSeverity,
  ): Promise<number>;

  /**
   * Counts unacknowledged alerts for a specific well.
   */
  countUnacknowledgedForWell(tenantId: string, wellId: string): Promise<number>;

  /**
   * Gets recent alerts for a tenant (last 24 hours, unacknowledged only).
   */
  getRecentUnacknowledged(tenantId: string, limit: number): Promise<Alert[]>;

  /**
   * Updates an alert's acknowledgement status.
   */
  acknowledge(alert: Alert): Promise<Alert>;

  /**
   * Gets alert statistics for dashboard KPIs.
   */
  getAlertStats(tenantId: string): Promise<{
    total: number;
    unacknowledged: number;
    critical: number;
    warning: number;
    info: number;
  }>;

  /**
   * Gets alert trend data (for charting).
   */
  getAlertTrend(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; count: number; severity: AlertSeverity }>>;
}
