import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

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
  activity_id: number | null;
  activity_name: string | null;
  activity_value: string | null; // Technical value for Tempo API
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

export interface TempoActivity {
  id: number;
  tempo_id: number;
  name: string;
  value: string; // Technical value to send to Tempo API (without accents)
  position: number;
  created_at: string;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'timetracker.db');
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Configuration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS WorkSession (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_key TEXT NOT NULL,
        issue_title TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_seconds INTEGER DEFAULT 0,
        comment TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'adjusted', 'sent')),
        tempo_worklog_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS DailySummary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        total_minutes INTEGER NOT NULL,
        adjusted_minutes INTEGER,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'sent')),
        sent_at TEXT
      );

      CREATE TABLE IF NOT EXISTS RecentIssue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_key TEXT NOT NULL UNIQUE,
        issue_title TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        epic_key TEXT,
        last_used_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS FavoriteTask (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_key TEXT NOT NULL UNIQUE,
        issue_title TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS KeyboardShortcut (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accelerator TEXT NOT NULL UNIQUE,
        issue_key TEXT NOT NULL,
        issue_title TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS TempoActivity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tempo_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tempoactivity_position ON TempoActivity(position);
      CREATE INDEX IF NOT EXISTS idx_worksession_date ON WorkSession(date(start_time));
      CREATE INDEX IF NOT EXISTS idx_worksession_status ON WorkSession(status);
      CREATE INDEX IF NOT EXISTS idx_dailysummary_date ON DailySummary(date);
      CREATE INDEX IF NOT EXISTS idx_recentissue_last_used ON RecentIssue(last_used_at DESC);
      CREATE INDEX IF NOT EXISTS idx_favoritetask_position ON FavoriteTask(position);
      CREATE INDEX IF NOT EXISTS idx_keyboardshortcut_enabled ON KeyboardShortcut(enabled);
    `);

    // Insert default configuration
    this.initializeDefaultConfig();

    // Run migrations
    this.runMigrations();
  }

  private runMigrations() {
    // Migration: Add activity columns to WorkSession if they don't exist
    const wsColumns = this.db.pragma('table_info(WorkSession)') as { name: string }[];
    const wsColumnNames = wsColumns.map(c => c.name);

    if (!wsColumnNames.includes('activity_id')) {
      this.db.exec('ALTER TABLE WorkSession ADD COLUMN activity_id INTEGER');
    }
    if (!wsColumnNames.includes('activity_name')) {
      this.db.exec('ALTER TABLE WorkSession ADD COLUMN activity_name TEXT');
    }
    if (!wsColumnNames.includes('activity_value')) {
      this.db.exec('ALTER TABLE WorkSession ADD COLUMN activity_value TEXT');
    }

    // Migration: Add value column to TempoActivity if it doesn't exist
    const taColumns = this.db.pragma('table_info(TempoActivity)') as { name: string }[];
    const taColumnNames = taColumns.map(c => c.name);

    if (!taColumnNames.includes('value')) {
      this.db.exec('ALTER TABLE TempoActivity ADD COLUMN value TEXT');
      // Set default value same as name for existing activities
      this.db.exec('UPDATE TempoActivity SET value = name WHERE value IS NULL');
    }
  }

  private initializeDefaultConfig() {
    const defaults = [
      { key: 'max_daily_hours', value: '7.5' },
      { key: 'notification_interval', value: '60' },
      { key: 'notification_timeout', value: '60' },
      { key: 'jira_project_key', value: 'TGD' },
      { key: 'recent_issues_count', value: '10' },
      { key: 'startup_with_windows', value: 'true' },
      { key: 'morning_reminder', value: '09:00' },
      { key: 'sound_enabled', value: 'true' },
    ];

    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO Configuration (key, value) VALUES (?, ?)'
    );

    for (const config of defaults) {
      insert.run(config.key, config.value);
    }
  }

  // Configuration methods
  getConfig(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM Configuration WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  setConfig(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO Configuration (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
      )
      .run(key, value);
  }

  // WorkSession methods
  createWorkSession(session: Omit<WorkSession, 'id' | 'created_at' | 'updated_at'>): number {
    const result = this.db
      .prepare(
        `INSERT INTO WorkSession (issue_key, issue_title, issue_type, start_time, end_time,
         duration_seconds, comment, status, tempo_worklog_id, activity_id, activity_name, activity_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.issue_key,
        session.issue_title,
        session.issue_type,
        session.start_time,
        session.end_time,
        session.duration_seconds,
        session.comment,
        session.status,
        session.tempo_worklog_id,
        session.activity_id,
        session.activity_name,
        session.activity_value
      );
    return result.lastInsertRowid as number;
  }

  updateWorkSession(id: number, updates: Partial<WorkSession>): void {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at')
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'created_at')
      .map(([, value]) => value);

    this.db
      .prepare(`UPDATE WorkSession SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...values, id);
  }

  deleteWorkSession(id: number): void {
    this.db.prepare('DELETE FROM WorkSession WHERE id = ?').run(id);
  }

  deleteDailySummary(date: string): void {
    this.db.prepare('DELETE FROM DailySummary WHERE date = ?').run(date);
  }

  getActiveWorkSession(): WorkSession | null {
    return this.db
      .prepare('SELECT * FROM WorkSession WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1')
      .get() as WorkSession | null;
  }

  getWorkSessionsByDate(date: string): WorkSession[] {
    return this.db
      .prepare('SELECT * FROM WorkSession WHERE date(start_time) = ? ORDER BY start_time')
      .all(date) as WorkSession[];
  }

  getWorkSessionsByDateRange(startDate: string, endDate: string): WorkSession[] {
    return this.db
      .prepare('SELECT * FROM WorkSession WHERE date(start_time) BETWEEN ? AND ? ORDER BY start_time')
      .all(startDate, endDate) as WorkSession[];
  }

  // DailySummary methods
  createOrUpdateDailySummary(summary: Omit<DailySummary, 'id'>): void {
    this.db
      .prepare(
        `INSERT INTO DailySummary (date, total_minutes, adjusted_minutes, status, sent_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
         total_minutes = excluded.total_minutes,
         adjusted_minutes = excluded.adjusted_minutes,
         status = excluded.status,
         sent_at = excluded.sent_at`
      )
      .run(
        summary.date,
        summary.total_minutes,
        summary.adjusted_minutes,
        summary.status,
        summary.sent_at
      );
  }

  getDailySummary(date: string): DailySummary | null {
    return this.db
      .prepare('SELECT * FROM DailySummary WHERE date = ?')
      .get(date) as DailySummary | null;
  }

  getDailySummariesByDateRange(startDate: string, endDate: string): DailySummary[] {
    return this.db
      .prepare('SELECT * FROM DailySummary WHERE date BETWEEN ? AND ? ORDER BY date DESC')
      .all(startDate, endDate) as DailySummary[];
  }

  getPendingSummaries(): DailySummary[] {
    return this.db
      .prepare("SELECT * FROM DailySummary WHERE status != 'sent' ORDER BY date")
      .all() as DailySummary[];
  }

  // RecentIssue methods
  addRecentIssue(issue: Omit<RecentIssue, 'id' | 'last_used_at'>): void {
    this.db
      .prepare(
        `INSERT INTO RecentIssue (issue_key, issue_title, issue_type, epic_key, last_used_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(issue_key) DO UPDATE SET
         issue_title = excluded.issue_title,
         issue_type = excluded.issue_type,
         epic_key = excluded.epic_key,
         last_used_at = CURRENT_TIMESTAMP`
      )
      .run(issue.issue_key, issue.issue_title, issue.issue_type, issue.epic_key);
  }

  getRecentIssues(limit: number): RecentIssue[] {
    return this.db
      .prepare('SELECT * FROM RecentIssue ORDER BY last_used_at DESC LIMIT ?')
      .all(limit) as RecentIssue[];
  }

  // FavoriteTask methods
  addFavoriteTask(task: Omit<FavoriteTask, 'id' | 'created_at'>): void {
    // Check if we already have 10 favorites
    const count = this.db
      .prepare('SELECT COUNT(*) as count FROM FavoriteTask')
      .get() as { count: number };

    if (count.count >= 10) {
      throw new Error('Maximum 10 favorite tasks allowed');
    }

    this.db
      .prepare(
        `INSERT INTO FavoriteTask (issue_key, issue_title, issue_type, position)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(issue_key) DO UPDATE SET
         issue_title = excluded.issue_title,
         issue_type = excluded.issue_type,
         position = excluded.position`
      )
      .run(task.issue_key, task.issue_title, task.issue_type, task.position);
  }

  removeFavoriteTask(issueKey: string): void {
    this.db
      .prepare('DELETE FROM FavoriteTask WHERE issue_key = ?')
      .run(issueKey);
  }

  getFavoriteTasks(): FavoriteTask[] {
    return this.db
      .prepare('SELECT * FROM FavoriteTask ORDER BY position')
      .all() as FavoriteTask[];
  }

  updateFavoriteTaskPosition(issueKey: string, position: number): void {
    this.db
      .prepare('UPDATE FavoriteTask SET position = ? WHERE issue_key = ?')
      .run(position, issueKey);
  }

  isFavoriteTask(issueKey: string): boolean {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM FavoriteTask WHERE issue_key = ?')
      .get(issueKey) as { count: number };
    return row.count > 0;
  }

  // KeyboardShortcut methods
  addKeyboardShortcut(shortcut: Omit<KeyboardShortcut, 'id' | 'created_at' | 'updated_at'>): void {
    this.db
      .prepare(
        `INSERT INTO KeyboardShortcut (accelerator, issue_key, issue_title, issue_type, enabled)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(accelerator) DO UPDATE SET
         issue_key = excluded.issue_key,
         issue_title = excluded.issue_title,
         issue_type = excluded.issue_type,
         enabled = excluded.enabled,
         updated_at = CURRENT_TIMESTAMP`
      )
      .run(shortcut.accelerator, shortcut.issue_key, shortcut.issue_title, shortcut.issue_type, shortcut.enabled ? 1 : 0);
  }

  removeKeyboardShortcut(accelerator: string): void {
    this.db
      .prepare('DELETE FROM KeyboardShortcut WHERE accelerator = ?')
      .run(accelerator);
  }

  getKeyboardShortcuts(): KeyboardShortcut[] {
    const shortcuts = this.db
      .prepare('SELECT * FROM KeyboardShortcut ORDER BY created_at')
      .all() as any[];

    // Convert enabled from INTEGER to boolean
    return shortcuts.map(s => ({
      ...s,
      enabled: s.enabled === 1
    }));
  }

  getEnabledKeyboardShortcuts(): KeyboardShortcut[] {
    const shortcuts = this.db
      .prepare('SELECT * FROM KeyboardShortcut WHERE enabled = 1 ORDER BY created_at')
      .all() as any[];

    // Convert enabled from INTEGER to boolean
    return shortcuts.map(s => ({
      ...s,
      enabled: s.enabled === 1
    }));
  }

  updateKeyboardShortcut(accelerator: string, updates: Partial<KeyboardShortcut>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.issue_key !== undefined) {
      fields.push('issue_key = ?');
      values.push(updates.issue_key);
    }
    if (updates.issue_title !== undefined) {
      fields.push('issue_title = ?');
      values.push(updates.issue_title);
    }
    if (updates.issue_type !== undefined) {
      fields.push('issue_type = ?');
      values.push(updates.issue_type);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    if (fields.length > 0) {
      this.db
        .prepare(`UPDATE KeyboardShortcut SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE accelerator = ?`)
        .run(...values, accelerator);
    }
  }

  // TempoActivity methods
  addTempoActivity(activity: Omit<TempoActivity, 'id' | 'created_at'>): void {
    this.db
      .prepare(
        `INSERT INTO TempoActivity (tempo_id, name, value, position)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tempo_id) DO UPDATE SET
         name = excluded.name,
         value = excluded.value,
         position = excluded.position`
      )
      .run(activity.tempo_id, activity.name, activity.value, activity.position);
  }

  removeTempoActivity(tempoId: number): void {
    this.db
      .prepare('DELETE FROM TempoActivity WHERE tempo_id = ?')
      .run(tempoId);
  }

  getTempoActivities(): TempoActivity[] {
    return this.db
      .prepare('SELECT * FROM TempoActivity ORDER BY position')
      .all() as TempoActivity[];
  }

  getDefaultTempoActivity(): TempoActivity | null {
    return this.db
      .prepare('SELECT * FROM TempoActivity ORDER BY position LIMIT 1')
      .get() as TempoActivity | null;
  }

  updateTempoActivityPosition(tempoId: number, position: number): void {
    this.db
      .prepare('UPDATE TempoActivity SET position = ? WHERE tempo_id = ?')
      .run(position, tempoId);
  }

  reorderTempoActivities(activities: { tempo_id: number; position: number }[]): void {
    const stmt = this.db.prepare('UPDATE TempoActivity SET position = ? WHERE tempo_id = ?');
    const transaction = this.db.transaction((items: { tempo_id: number; position: number }[]) => {
      for (const item of items) {
        stmt.run(item.position, item.tempo_id);
      }
    });
    transaction(activities);
  }

  close(): void {
    this.db.close();
  }
}
