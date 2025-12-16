"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdjustmentService = void 0;
class AdjustmentService {
    constructor(db, maxDailyHours = 7.5) {
        this.db = db;
        this.maxDailyMinutes = maxDailyHours * 60;
    }
    /**
     * Analyze pending days and calculate adjustments if needed
     */
    analyzePendingDays() {
        const pendingSummaries = this.db.getPendingSummaries();
        const adjustments = [];
        for (const summary of pendingSummaries) {
            const sessions = this.db.getWorkSessionsByDate(summary.date);
            const totalMinutes = this.calculateTotalMinutes(sessions);
            if (totalMinutes > this.maxDailyMinutes) {
                const adjusted = this.adjustDaySessions(summary.date, sessions, totalMinutes);
                adjustments.push(adjusted);
            }
            else {
                adjustments.push({
                    date: summary.date,
                    originalTotalMinutes: totalMinutes,
                    adjustedTotalMinutes: totalMinutes,
                    sessions: sessions.map(s => ({
                        original: s,
                        adjusted: s,
                        wasAdjusted: false,
                    })),
                    needsAdjustment: false,
                });
            }
        }
        return adjustments;
    }
    /**
     * Adjust sessions for a specific day to fit within max daily time
     */
    adjustDaySessions(date, sessions, totalMinutes) {
        if (totalMinutes <= this.maxDailyMinutes) {
            return {
                date,
                originalTotalMinutes: totalMinutes,
                adjustedTotalMinutes: totalMinutes,
                sessions: sessions.map(s => ({
                    original: s,
                    adjusted: s,
                    wasAdjusted: false,
                })),
                needsAdjustment: false,
            };
        }
        const coefficient = this.maxDailyMinutes / totalMinutes;
        const adjustedSessions = [];
        let adjustedTotal = 0;
        // First pass: apply coefficient and round to nearest 15 minutes
        for (const session of sessions) {
            const originalMinutes = session.duration_seconds / 60;
            const adjustedMinutes = this.roundToQuarterHour(originalMinutes * coefficient);
            adjustedTotal += adjustedMinutes;
            const adjustedSession = {
                ...session,
                duration_seconds: adjustedMinutes * 60,
            };
            adjustedSessions.push({
                original: session,
                adjusted: adjustedSession,
                wasAdjusted: adjustedMinutes !== originalMinutes,
            });
        }
        // Second pass: adjust if total doesn't equal max daily minutes exactly
        const difference = this.maxDailyMinutes - adjustedTotal;
        if (difference !== 0) {
            this.distributeRemainder(adjustedSessions, difference);
        }
        return {
            date,
            originalTotalMinutes: totalMinutes,
            adjustedTotalMinutes: this.maxDailyMinutes,
            sessions: adjustedSessions,
            needsAdjustment: true,
        };
    }
    /**
     * Apply adjustments to database
     */
    applyAdjustments(adjustments) {
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
    calculateTotalMinutes(sessions) {
        return sessions.reduce((total, session) => {
            return total + (session.duration_seconds / 60);
        }, 0);
    }
    /**
     * Round minutes to nearest quarter hour (15 minutes)
     */
    roundToQuarterHour(minutes) {
        return Math.round(minutes / 15) * 15;
    }
    /**
     * Distribute remainder minutes to sessions
     */
    distributeRemainder(sessions, remainderMinutes) {
        if (remainderMinutes === 0 || sessions.length === 0) {
            return;
        }
        // Sort sessions by duration (largest first)
        const sortedSessions = [...sessions].sort((a, b) => {
            return b.adjusted.duration_seconds - a.adjusted.duration_seconds;
        });
        // Distribute in 15-minute increments
        let remaining = remainderMinutes;
        let index = 0;
        while (remaining !== 0 && index < sortedSessions.length) {
            const session = sortedSessions[index];
            const increment = remaining > 0 ? 15 : -15;
            // Only adjust if it won't make the duration negative
            if (remaining < 0 && session.adjusted.duration_seconds < 15 * 60) {
                index++;
                continue;
            }
            session.adjusted.duration_seconds += increment * 60;
            remaining -= increment;
            session.wasAdjusted = true;
            if (Math.abs(remaining) < 15) {
                break;
            }
            index++;
            // Reset to beginning if we've gone through all sessions
            if (index >= sortedSessions.length) {
                index = 0;
            }
        }
    }
    /**
     * Get adjustment summary for display
     */
    getAdjustmentSummary(adjustment) {
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
    formatMinutes(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h${mins.toString().padStart(2, '0')}`;
    }
}
exports.AdjustmentService = AdjustmentService;
