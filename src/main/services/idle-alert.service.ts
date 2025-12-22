import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';
import { DatabaseManager } from '../database/schema';
import { TimerService } from './timer.service';

export class IdleAlertService extends EventEmitter {
  private checkIntervalId: NodeJS.Timeout | null = null;
  private lastAlertTime: Date | null = null;
  private alertWindowOpen: boolean = false;
  private enabled: boolean = true;
  private alertIntervalMinutes: number = 15;
  private startHour: number = 8;
  private endHour: number = 18;
  private readonly CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
  private readonly ACTIVITY_THRESHOLD_SECONDS = 60; // User is considered active if idle < 60s

  constructor(
    private db: DatabaseManager,
    private timerService: TimerService
  ) {
    super();
    this.loadConfig();
  }

  private loadConfig(): void {
    const enabled = this.db.getConfig('idle_alert_enabled');
    const interval = this.db.getConfig('idle_alert_interval_minutes');
    const startHour = this.db.getConfig('idle_alert_start_hour');
    const endHour = this.db.getConfig('idle_alert_end_hour');

    this.enabled = enabled !== 'false';
    this.alertIntervalMinutes = interval ? parseInt(interval, 10) : 15;
    this.startHour = startHour ? parseInt(startHour, 10) : 8;
    this.endHour = endHour ? parseInt(endHour, 10) : 18;

    console.log(`[IdleAlertService] Config loaded - enabled: ${this.enabled}, interval: ${this.alertIntervalMinutes}min, hours: ${this.startHour}-${this.endHour}`);
  }

  start(): void {
    if (this.checkIntervalId) {
      return; // Already running
    }

    console.log('[IdleAlertService] Starting idle alert monitoring');
    this.checkIntervalId = setInterval(() => {
      this.checkConditions();
    }, this.CHECK_INTERVAL_MS);

    // Also check immediately
    this.checkConditions();
  }

  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log('[IdleAlertService] Stopped idle alert monitoring');
    }
  }

  private checkConditions(): void {
    // 1. Is the feature enabled?
    if (!this.enabled) {
      return;
    }

    // 2. Is an alert window already open?
    if (this.alertWindowOpen) {
      return;
    }

    // 3. Is a timer already running?
    if (this.timerService.isTimerRunning()) {
      return;
    }

    // 4. Is it a weekday (Monday-Friday)?
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday (0) or Saturday (6)
      return;
    }

    // 5. Is it within working hours?
    const currentHour = now.getHours();
    if (currentHour < this.startHour || currentHour >= this.endHour) {
      return;
    }

    // 6. Is there recent user activity?
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds > this.ACTIVITY_THRESHOLD_SECONDS) {
      // User is inactive, don't bother them
      return;
    }

    // 7. Has enough time passed since the last alert?
    if (this.lastAlertTime) {
      const minutesSinceLastAlert = (now.getTime() - this.lastAlertTime.getTime()) / (1000 * 60);
      if (minutesSinceLastAlert < this.alertIntervalMinutes) {
        return;
      }
    }

    // All conditions met, emit alert
    console.log('[IdleAlertService] All conditions met, emitting idle-alert-required');
    this.lastAlertTime = now;
    this.emit('idle-alert-required');
  }

  setAlertWindowOpen(open: boolean): void {
    this.alertWindowOpen = open;
    console.log(`[IdleAlertService] Alert window open: ${open}`);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.db.setConfig('idle_alert_enabled', enabled ? 'true' : 'false');
    console.log(`[IdleAlertService] Enabled set to: ${enabled}`);
  }

  setAlertInterval(minutes: number): void {
    this.alertIntervalMinutes = minutes;
    this.db.setConfig('idle_alert_interval_minutes', minutes.toString());
    console.log(`[IdleAlertService] Alert interval set to: ${minutes} minutes`);
  }

  setWorkingHours(startHour: number, endHour: number): void {
    this.startHour = startHour;
    this.endHour = endHour;
    this.db.setConfig('idle_alert_start_hour', startHour.toString());
    this.db.setConfig('idle_alert_end_hour', endHour.toString());
    console.log(`[IdleAlertService] Working hours set to: ${startHour}-${endHour}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getAlertInterval(): number {
    return this.alertIntervalMinutes;
  }

  getWorkingHours(): { startHour: number; endHour: number } {
    return { startHour: this.startHour, endHour: this.endHour };
  }

  // Reset the last alert time (e.g., when user dismisses alert)
  resetLastAlertTime(): void {
    this.lastAlertTime = new Date();
  }
}
