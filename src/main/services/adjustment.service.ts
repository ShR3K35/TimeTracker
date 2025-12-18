import { DatabaseManager, WorkSession, DailySummary } from '../database/schema';

export interface AdjustedSession {
  original: WorkSession;
  adjusted: WorkSession;
  wasAdjusted: boolean;
}

export interface TaskGroup {
  issueKey: string;
  issueTitle: string;
  issueType: string;
  activityId: number | null;
  activityName: string | null;
  activityValue: string | null;
  sessions: WorkSession[];
  originalTotalSeconds: number;
  adjustedTotalSeconds: number;
  wasAdjusted: boolean;
}

export interface DailyAdjustment {
  date: string;
  originalTotalMinutes: number;
  adjustedTotalMinutes: number;
  sessions: AdjustedSession[];
  taskGroups: TaskGroup[];
  needsAdjustment: boolean;
}

export class AdjustmentService {
  private db: DatabaseManager;
  private maxDailyMinutes: number;

  constructor(db: DatabaseManager, maxDailyHours: number = 7.5) {
    this.db = db;
    this.maxDailyMinutes = maxDailyHours * 60;
  }

  setMaxDailyHours(hours: number): void {
    this.maxDailyMinutes = hours * 60;
    console.log(`[AdjustmentService] Max daily hours updated to ${hours} hours (${this.maxDailyMinutes} minutes)`);
  }

  getMaxDailyHours(): number {
    return this.maxDailyMinutes / 60;
  }

  /**
   * Group sessions by issue key AND activity
   */
  private groupSessionsByTask(sessions: WorkSession[]): TaskGroup[] {
    const groupMap = new Map<string, TaskGroup>();

    for (const session of sessions) {
      // Group key includes both issue_key and activity_id
      const groupKey = `${session.issue_key}|${session.activity_id || 'none'}`;
      const existing = groupMap.get(groupKey);

      if (existing) {
        existing.sessions.push(session);
        existing.originalTotalSeconds += session.duration_seconds;
        existing.adjustedTotalSeconds += session.duration_seconds;
      } else {
        groupMap.set(groupKey, {
          issueKey: session.issue_key,
          issueTitle: session.issue_title,
          issueType: session.issue_type,
          activityId: session.activity_id,
          activityName: session.activity_name,
          activityValue: session.activity_value,
          sessions: [session],
          originalTotalSeconds: session.duration_seconds,
          adjustedTotalSeconds: session.duration_seconds,
          wasAdjusted: false,
        });
      }
    }

    return Array.from(groupMap.values());
  }

  /**
   * Analyze pending days and calculate adjustments if needed
   */
  analyzePendingDays(): DailyAdjustment[] {
    const pendingSummaries = this.db.getPendingSummaries();
    const adjustments: DailyAdjustment[] = [];

    for (const summary of pendingSummaries) {
      const sessions = this.db.getWorkSessionsByDate(summary.date);
      const totalMinutes = this.calculateTotalMinutes(sessions);
      const taskGroups = this.groupSessionsByTask(sessions);

      if (totalMinutes > this.maxDailyMinutes) {
        const adjusted = this.adjustDaySessions(summary.date, sessions, totalMinutes, taskGroups);
        adjustments.push(adjusted);
      } else {
        adjustments.push({
          date: summary.date,
          originalTotalMinutes: totalMinutes,
          adjustedTotalMinutes: totalMinutes,
          sessions: sessions.map(s => ({
            original: s,
            adjusted: s,
            wasAdjusted: false,
          })),
          taskGroups,
          needsAdjustment: false,
        });
      }
    }

    return adjustments;
  }

  /**
   * Analyze a specific day and calculate adjustment to reach max daily time
   */
  analyzeDay(date: string): DailyAdjustment {
    const sessions = this.db.getWorkSessionsByDate(date);
    const totalMinutes = this.calculateTotalMinutes(sessions);
    const taskGroups = this.groupSessionsByTask(sessions);

    return this.adjustDaySessions(date, sessions, totalMinutes, taskGroups);
  }

  /**
   * Apply adjustment for a single day
   */
  applyDayAdjustment(adjustment: DailyAdjustment): void {
    if (!adjustment.needsAdjustment) {
      return;
    }

    // Update work sessions
    for (const sessionAdj of adjustment.sessions) {
      if (sessionAdj.wasAdjusted) {
        this.db.updateWorkSession(sessionAdj.original.id, {
          duration_seconds: sessionAdj.adjusted.duration_seconds,
          status: 'adjusted',
        });
      }
    }

    // Update daily summary
    this.db.createOrUpdateDailySummary({
      date: adjustment.date,
      total_minutes: adjustment.originalTotalMinutes,
      adjusted_minutes: adjustment.adjustedTotalMinutes,
      status: 'ready',
      sent_at: null,
    });
  }

  /**
   * Adjust sessions for a specific day to reach exactly max daily time
   * Adjustments are applied at the task group level
   * Can both increase or decrease durations to match the target
   */
  adjustDaySessions(date: string, sessions: WorkSession[], totalMinutes: number, taskGroups: TaskGroup[]): DailyAdjustment {
    // If already at target, no adjustment needed
    if (Math.abs(totalMinutes - this.maxDailyMinutes) < 1) {
      return {
        date,
        originalTotalMinutes: totalMinutes,
        adjustedTotalMinutes: totalMinutes,
        sessions: sessions.map(s => ({
          original: s,
          adjusted: s,
          wasAdjusted: false,
        })),
        taskGroups,
        needsAdjustment: false,
      };
    }

    const coefficient = this.maxDailyMinutes / totalMinutes;
    const adjustedGroups: TaskGroup[] = [];
    let adjustedTotal = 0;

    // First pass: apply coefficient to task groups and round to nearest 15 minutes
    for (const group of taskGroups) {
      const originalMinutes = group.originalTotalSeconds / 60;
      const adjustedMinutes = this.roundToQuarterHour(originalMinutes * coefficient);

      adjustedTotal += adjustedMinutes;

      adjustedGroups.push({
        ...group,
        adjustedTotalSeconds: adjustedMinutes * 60,
        wasAdjusted: adjustedMinutes !== originalMinutes,
      });
    }

    // Second pass: adjust if total doesn't equal max daily minutes exactly
    const difference = this.maxDailyMinutes - adjustedTotal;
    if (difference !== 0) {
      this.distributeRemainderToGroups(adjustedGroups, difference);
    }

    // Create adjusted sessions based on group adjustments
    // Distribute the group's adjusted time proportionally among its sessions
    const adjustedSessions: AdjustedSession[] = [];
    for (const group of adjustedGroups) {
      const groupCoefficient = group.adjustedTotalSeconds / group.originalTotalSeconds;

      for (const session of group.sessions) {
        const adjustedDuration = Math.round(session.duration_seconds * groupCoefficient);
        const adjustedSession: WorkSession = {
          ...session,
          duration_seconds: adjustedDuration,
        };

        adjustedSessions.push({
          original: session,
          adjusted: adjustedSession,
          wasAdjusted: adjustedDuration !== session.duration_seconds,
        });
      }
    }

    return {
      date,
      originalTotalMinutes: totalMinutes,
      adjustedTotalMinutes: this.maxDailyMinutes,
      sessions: adjustedSessions,
      taskGroups: adjustedGroups,
      needsAdjustment: true,
    };
  }

  /**
   * Apply adjustments to database
   */
  applyAdjustments(adjustments: DailyAdjustment[]): void {
    for (const dayAdjustment of adjustments) {
      if (!dayAdjustment.needsAdjustment) {
        continue;
      }

      // Update work sessions
      for (const sessionAdj of dayAdjustment.sessions) {
        if (sessionAdj.wasAdjusted) {
          this.db.updateWorkSession(sessionAdj.original.id, {
            duration_seconds: sessionAdj.adjusted.duration_seconds,
            status: 'adjusted',
          });
        }
      }

      // Update daily summary
      this.db.createOrUpdateDailySummary({
        date: dayAdjustment.date,
        total_minutes: dayAdjustment.originalTotalMinutes,
        adjusted_minutes: dayAdjustment.adjustedTotalMinutes,
        status: 'ready',
        sent_at: null,
      });
    }
  }

  /**
   * Calculate total minutes from work sessions
   */
  private calculateTotalMinutes(sessions: WorkSession[]): number {
    return sessions.reduce((total, session) => {
      return total + (session.duration_seconds / 60);
    }, 0);
  }

  /**
   * Round minutes to nearest quarter hour (15 minutes)
   */
  private roundToQuarterHour(minutes: number): number {
    return Math.round(minutes / 15) * 15;
  }

  /**
   * Distribute remainder minutes to task groups
   */
  private distributeRemainderToGroups(groups: TaskGroup[], remainderMinutes: number): void {
    if (remainderMinutes === 0 || groups.length === 0) {
      return;
    }

    // Sort groups by duration (largest first)
    const sortedGroups = [...groups].sort((a, b) => {
      return b.adjustedTotalSeconds - a.adjustedTotalSeconds;
    });

    // Distribute in 15-minute increments
    let remaining = remainderMinutes;
    let index = 0;

    while (remaining !== 0 && index < sortedGroups.length) {
      const group = sortedGroups[index];
      const increment = remaining > 0 ? 15 : -15;

      // Only adjust if it won't make the duration negative
      if (remaining < 0 && group.adjustedTotalSeconds < 15 * 60) {
        index++;
        continue;
      }

      group.adjustedTotalSeconds += increment * 60;
      remaining -= increment;
      group.wasAdjusted = true;

      if (Math.abs(remaining) < 15) {
        break;
      }

      index++;

      // Reset to beginning if we've gone through all groups
      if (index >= sortedGroups.length) {
        index = 0;
      }
    }
  }

  /**
   * Get adjustment summary for display
   */
  getAdjustmentSummary(adjustment: DailyAdjustment): string {
    const originalHours = (adjustment.originalTotalMinutes / 60).toFixed(2);
    const adjustedHours = (adjustment.adjustedTotalMinutes / 60).toFixed(2);

    if (!adjustment.needsAdjustment) {
      return `${adjustment.date} - ${originalHours}h (pas d'ajustement nécessaire)`;
    }

    return `${adjustment.date} - ${originalHours}h → ${adjustedHours}h (ajusté)`;
  }

  /**
   * Format minutes as hours:minutes
   */
  formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Reopen a sent day - reset status to allow editing
   * Note: This only resets local status, does not delete worklogs from Tempo
   */
  reopenDay(date: string): void {
    const sessions = this.db.getWorkSessionsByDate(date);

    // Reset all sessions to 'draft' status
    for (const session of sessions) {
      if (session.status === 'sent') {
        this.db.updateWorkSession(session.id, {
          status: 'draft',
          tempo_worklog_id: null,
        });
      }
    }

    // Reset daily summary status to 'pending'
    this.db.createOrUpdateDailySummary({
      date,
      total_minutes: sessions.reduce((sum, s) => sum + s.duration_seconds / 60, 0),
      adjusted_minutes: null,
      status: 'pending',
      sent_at: null,
    });

    console.log(`[AdjustmentService] Day ${date} reopened for editing`);
  }

  /**
   * Update duration for a specific task group (all sessions with same issue_key and activity_id on a date)
   * Distributes the new duration proportionally among sessions
   */
  updateTaskGroupDuration(date: string, issueKey: string, newDurationSeconds: number, activityId?: number | null): void {
    const allSessions = this.db.getWorkSessionsByDate(date);
    const sessions = allSessions.filter(s => {
      if (s.issue_key !== issueKey) return false;
      // If activityId is provided, filter by it; otherwise match sessions with null activity
      if (activityId !== undefined) {
        return s.activity_id === activityId;
      }
      return true; // Backwards compatibility: if no activityId provided, match all for this issueKey
    });

    if (sessions.length === 0) {
      throw new Error(`Aucune session trouvée pour ${issueKey} le ${date}`);
    }

    const originalTotal = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);

    if (originalTotal === 0) {
      // If original total is 0, distribute evenly
      const perSession = Math.round(newDurationSeconds / sessions.length);
      for (const session of sessions) {
        this.db.updateWorkSession(session.id, {
          duration_seconds: perSession,
          status: 'adjusted',
        });
      }
    } else {
      // Distribute proportionally
      let remaining = newDurationSeconds;
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const isLast = i === sessions.length - 1;

        let newDuration: number;
        if (isLast) {
          // Last session gets the remainder to avoid rounding errors
          newDuration = remaining;
        } else {
          const proportion = session.duration_seconds / originalTotal;
          newDuration = Math.round(newDurationSeconds * proportion);
          remaining -= newDuration;
        }

        this.db.updateWorkSession(session.id, {
          duration_seconds: newDuration,
          status: 'adjusted',
        });
      }
    }

    // Update daily summary
    const updatedSessions = this.db.getWorkSessionsByDate(date);
    const totalMinutes = updatedSessions.reduce((sum, s) => sum + s.duration_seconds / 60, 0);

    this.db.createOrUpdateDailySummary({
      date,
      total_minutes: totalMinutes,
      adjusted_minutes: totalMinutes,
      status: 'ready',
      sent_at: null,
    });

    console.log(`[AdjustmentService] Updated ${issueKey} on ${date} to ${newDurationSeconds}s`);
  }
}
