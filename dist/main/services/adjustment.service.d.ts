import { DatabaseManager, WorkSession } from '../database/schema';
export interface AdjustedSession {
    original: WorkSession;
    adjusted: WorkSession;
    wasAdjusted: boolean;
}
export interface DailyAdjustment {
    date: string;
    originalTotalMinutes: number;
    adjustedTotalMinutes: number;
    sessions: AdjustedSession[];
    needsAdjustment: boolean;
}
export declare class AdjustmentService {
    private db;
    private maxDailyMinutes;
    constructor(db: DatabaseManager, maxDailyHours?: number);
    /**
     * Analyze pending days and calculate adjustments if needed
     */
    analyzePendingDays(): DailyAdjustment[];
    /**
     * Adjust sessions for a specific day to fit within max daily time
     */
    adjustDaySessions(date: string, sessions: WorkSession[], totalMinutes: number): DailyAdjustment;
    /**
     * Apply adjustments to database
     */
    applyAdjustments(adjustments: DailyAdjustment[]): void;
    /**
     * Calculate total minutes from work sessions
     */
    private calculateTotalMinutes;
    /**
     * Round minutes to nearest quarter hour (15 minutes)
     */
    private roundToQuarterHour;
    /**
     * Distribute remainder minutes to sessions
     */
    private distributeRemainder;
    /**
     * Get adjustment summary for display
     */
    getAdjustmentSummary(adjustment: DailyAdjustment): string;
    /**
     * Format minutes as hours:minutes
     */
    formatMinutes(minutes: number): string;
}
