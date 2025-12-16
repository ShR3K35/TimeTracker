import { EventEmitter } from 'events';
import { DatabaseManager, WorkSession } from '../database/schema';
export interface TimerState {
    isRunning: boolean;
    currentSession: WorkSession | null;
    elapsedSeconds: number;
    startTime: Date | null;
}
export declare class TimerService extends EventEmitter {
    private isRunning;
    private currentSessionId;
    private startTime;
    private elapsedSeconds;
    private intervalId;
    private notificationIntervalId;
    private db;
    private notificationInterval;
    constructor(db: DatabaseManager, notificationInterval?: number);
    private recoverActiveSession;
    startTimer(issueKey: string, issueTitle: string, issueType: string): number;
    stopTimer(): void;
    pauseTimer(): void;
    resumeTimer(): void;
    private startNotificationTimer;
    getState(): TimerState;
    getElapsedTime(): number;
    isTimerRunning(): boolean;
    formatTime(seconds: number): string;
}
