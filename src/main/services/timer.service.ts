import { EventEmitter } from 'events';
import { DatabaseManager, WorkSession } from '../database/schema';

export interface TimerState {
  isRunning: boolean;
  currentSession: WorkSession | null;
  elapsedSeconds: number;
  startTime: Date | null;
}

export class TimerService extends EventEmitter {
  private isRunning: boolean = false;
  private currentSessionId: number | null = null;
  private startTime: Date | null = null;
  private elapsedSeconds: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private notificationIntervalId: NodeJS.Timeout | null = null;
  private db: DatabaseManager;
  private notificationInterval: number; // in minutes

  constructor(db: DatabaseManager, notificationInterval: number = 60) {
    super();
    this.db = db;
    this.notificationInterval = notificationInterval;
    this.recoverActiveSession();
  }

  private recoverActiveSession() {
    const activeSession = this.db.getActiveWorkSession();
    if (activeSession) {
      // Mark as needs verification
      this.db.updateWorkSession(activeSession.id, {
        comment: (activeSession.comment || '') + ' [À vérifier - récupéré après crash]',
      });
      console.log('Recovered active session:', activeSession.issue_key);
    }
  }

  startTimer(issueKey: string, issueTitle: string, issueType: string, activityId?: number, activityName?: string, activityValue?: string): number {
    // Stop current timer if running
    if (this.isRunning) {
      this.stopTimer();
    }

    this.startTime = new Date();
    this.elapsedSeconds = 0;
    this.isRunning = true;

    // Create work session in database
    this.currentSessionId = this.db.createWorkSession({
      issue_key: issueKey,
      issue_title: issueTitle,
      issue_type: issueType,
      start_time: this.startTime.toISOString(),
      end_time: null,
      duration_seconds: 0,
      comment: null,
      status: 'draft',
      tempo_worklog_id: null,
      activity_id: activityId || null,
      activity_name: activityName || null,
      activity_value: activityValue || null,
    });

    // Update recent issues
    this.db.addRecentIssue({
      issue_key: issueKey,
      issue_title: issueTitle,
      issue_type: issueType,
      epic_key: null,
    });

    // Start interval to update elapsed time
    this.intervalId = setInterval(() => {
      this.elapsedSeconds++;
      this.emit('tick', this.elapsedSeconds);

      // Update database every 10 seconds
      if (this.elapsedSeconds % 10 === 0 && this.currentSessionId) {
        this.db.updateWorkSession(this.currentSessionId, {
          duration_seconds: this.elapsedSeconds,
        });
      }
    }, 1000);

    // Start notification interval
    this.startNotificationTimer();

    this.emit('started', {
      issueKey,
      issueTitle,
      issueType,
      sessionId: this.currentSessionId,
    });

    return this.currentSessionId;
  }

  stopTimer(): void {
    if (!this.isRunning || !this.currentSessionId) {
      return;
    }

    this.isRunning = false;
    const endTime = new Date();

    // Clear intervals
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.notificationIntervalId) {
      clearInterval(this.notificationIntervalId);
      this.notificationIntervalId = null;
    }

    // Update work session in database
    this.db.updateWorkSession(this.currentSessionId, {
      end_time: endTime.toISOString(),
      duration_seconds: this.elapsedSeconds,
    });

    this.emit('stopped', {
      sessionId: this.currentSessionId,
      duration: this.elapsedSeconds,
    });

    this.currentSessionId = null;
    this.startTime = null;
    this.elapsedSeconds = 0;
  }

  pauseTimer(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.notificationIntervalId) {
      clearInterval(this.notificationIntervalId);
      this.notificationIntervalId = null;
    }

    this.emit('paused', { elapsedSeconds: this.elapsedSeconds });
  }

  resumeTimer(): void {
    if (this.isRunning && this.intervalId === null) {
      this.intervalId = setInterval(() => {
        this.elapsedSeconds++;
        this.emit('tick', this.elapsedSeconds);

        if (this.elapsedSeconds % 10 === 0 && this.currentSessionId) {
          this.db.updateWorkSession(this.currentSessionId, {
            duration_seconds: this.elapsedSeconds,
          });
        }
      }, 1000);

      this.startNotificationTimer();
      this.emit('resumed', { elapsedSeconds: this.elapsedSeconds });
    }
  }

  private startNotificationTimer(): void {
    // Clear existing notification timer
    if (this.notificationIntervalId) {
      clearInterval(this.notificationIntervalId);
    }

    // Set notification timer
    this.notificationIntervalId = setInterval(() => {
      this.emit('notification-required');
    }, this.notificationInterval * 60 * 1000);
  }

  getState(): TimerState {
    const currentSession = this.currentSessionId
      ? this.db.getActiveWorkSession()
      : null;

    return {
      isRunning: this.isRunning,
      currentSession,
      elapsedSeconds: this.elapsedSeconds,
      startTime: this.startTime,
    };
  }

  getElapsedTime(): number {
    return this.elapsedSeconds;
  }

  isTimerRunning(): boolean {
    return this.isRunning;
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  setNotificationInterval(minutes: number): void {
    this.notificationInterval = minutes;
    console.log(`[TimerService] Notification interval updated to ${minutes} minutes`);

    // Restart notification timer if running
    if (this.isRunning && this.notificationIntervalId) {
      this.startNotificationTimer();
    }
  }

  getNotificationInterval(): number {
    return this.notificationInterval;
  }
}
