export interface Configuration {
    id: number;
    key: string;
    value: string;
    updated_at: string;
}
export interface WorkSession {
    id: number;
    issue_key: string;
    issue_title: string;
    issue_type: string;
    start_time: string;
    end_time: string | null;
    duration_seconds: number;
    comment: string | null;
    status: 'draft' | 'adjusted' | 'sent';
    tempo_worklog_id: string | null;
    created_at: string;
    updated_at: string;
}
export interface DailySummary {
    id: number;
    date: string;
    total_minutes: number;
    adjusted_minutes: number | null;
    status: 'pending' | 'ready' | 'sent';
    sent_at: string | null;
}
export interface RecentIssue {
    id: number;
    issue_key: string;
    issue_title: string;
    issue_type: string;
    epic_key: string | null;
    last_used_at: string;
}
export interface FavoriteTask {
    id: number;
    issue_key: string;
    issue_title: string;
    issue_type: string;
    position: number;
    created_at: string;
}
export interface KeyboardShortcut {
    id: number;
    accelerator: string;
    issue_key: string;
    issue_title: string;
    issue_type: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export declare class DatabaseManager {
    private db;
    constructor();
    private initialize;
    private initializeDefaultConfig;
    getConfig(key: string): string | null;
    setConfig(key: string, value: string): void;
    createWorkSession(session: Omit<WorkSession, 'id' | 'created_at' | 'updated_at'>): number;
    updateWorkSession(id: number, updates: Partial<WorkSession>): void;
    getActiveWorkSession(): WorkSession | null;
    getWorkSessionsByDate(date: string): WorkSession[];
    getWorkSessionsByDateRange(startDate: string, endDate: string): WorkSession[];
    createOrUpdateDailySummary(summary: Omit<DailySummary, 'id'>): void;
    getDailySummary(date: string): DailySummary | null;
    getDailySummariesByDateRange(startDate: string, endDate: string): DailySummary[];
    getPendingSummaries(): DailySummary[];
    addRecentIssue(issue: Omit<RecentIssue, 'id' | 'last_used_at'>): void;
    getRecentIssues(limit: number): RecentIssue[];
    addFavoriteTask(task: Omit<FavoriteTask, 'id' | 'created_at'>): void;
    removeFavoriteTask(issueKey: string): void;
    getFavoriteTasks(): FavoriteTask[];
    updateFavoriteTaskPosition(issueKey: string, position: number): void;
    isFavoriteTask(issueKey: string): boolean;
    addKeyboardShortcut(shortcut: Omit<KeyboardShortcut, 'id' | 'created_at' | 'updated_at'>): void;
    removeKeyboardShortcut(accelerator: string): void;
    getKeyboardShortcuts(): KeyboardShortcut[];
    getEnabledKeyboardShortcuts(): KeyboardShortcut[];
    updateKeyboardShortcut(accelerator: string, updates: Partial<KeyboardShortcut>): void;
    close(): void;
}
