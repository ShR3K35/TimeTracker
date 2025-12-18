import { app, BrowserWindow, Tray, Menu, ipcMain, Notification } from 'electron';
import path from 'path';
import { DatabaseManager } from './database/schema';
import { JiraService } from './services/jira.service';
import { TempoService } from './services/tempo.service';
import { TimerService } from './services/timer.service';
import { AdjustmentService } from './services/adjustment.service';
import { ShortcutService } from './services/shortcut.service';

class TimeTrackerApp {
  private mainWindow: BrowserWindow | null = null;
  private reminderWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private db: DatabaseManager;
  private jiraService: JiraService | null = null;
  private tempoService: TempoService | null = null;
  private timerService: TimerService;
  private adjustmentService: AdjustmentService;
  private shortcutService: ShortcutService;
  private notificationTimeout: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private isQuitting: boolean = false;

  constructor() {
    this.db = new DatabaseManager();

    const notificationInterval = parseInt(this.db.getConfig('notification_interval') || '60');
    this.timerService = new TimerService(this.db, notificationInterval);

    const maxDailyHours = parseFloat(this.db.getConfig('max_daily_hours') || '7.5');
    this.adjustmentService = new AdjustmentService(this.db, maxDailyHours);

    this.shortcutService = new ShortcutService(this.db);

    this.setupTimerListeners();
    this.setupShortcutListeners();
    this.setupIpcHandlers();
    this.initializeServicesFromConfig();
  }

  private initializeServicesFromConfig() {
    // Load saved configuration and initialize services
    const jiraBaseUrl = this.db.getConfig('jira_base_url');
    const jiraEmail = this.db.getConfig('jira_email');
    const jiraToken = this.db.getConfig('jira_token');
    const tempoApiUrl = this.db.getConfig('tempo_api_url');
    const tempoToken = this.db.getConfig('tempo_token');
    const tempoAccountId = this.db.getConfig('tempo_account_id');

    if (jiraBaseUrl && jiraEmail && jiraToken) {
      this.jiraService = new JiraService(jiraBaseUrl, jiraEmail, jiraToken);
      console.log('[TimeTrackerApp] Jira service initialized from saved config');
    }

    if (tempoApiUrl && tempoToken && tempoAccountId) {
      this.tempoService = new TempoService(tempoApiUrl, tempoToken, tempoAccountId);
      console.log('[TimeTrackerApp] Tempo service initialized from saved config');
    }
  }

  async init() {
    await app.whenReady();
    this.createWindow();
    this.createTray();
    this.checkPendingAdjustments();
    this.shortcutService.initialize(); // Initialize keyboard shortcuts

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('window-all-closed', () => {
      // Don't quit on window close, keep running in background
      // app.quit() is only called when user explicitly quits from tray
    });

    app.on('will-quit', () => {
      // Unregister all shortcuts before quitting
      this.shortcutService.unregisterAll();
    });
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      show: false,
    });

    // Load renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private createTray() {
    const { nativeImage } = require('electron');
    const iconPath = path.join(__dirname, '../../assets/icon.png');

    let trayIcon;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      // Resize for tray (16x16 on Windows)
      if (!trayIcon.isEmpty()) {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
      }
    } catch (error) {
      console.error('[TimeTrackerApp] Failed to load icon from:', iconPath, error);
    }

    // If icon failed to load, create a simple colored icon
    if (!trayIcon || trayIcon.isEmpty()) {
      console.log('[TimeTrackerApp] Creating fallback icon');
      // Create a simple 16x16 blue square icon
      const size = 16;
      const buffer = Buffer.alloc(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        buffer[i * 4] = 0x00;     // R
        buffer[i * 4 + 1] = 0x82; // G
        buffer[i * 4 + 2] = 0xCC; // B
        buffer[i * 4 + 3] = 255;  // A
      }
      trayIcon = nativeImage.createFromBuffer(buffer, { width: size, height: size });
    }

    this.tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Ouvrir',
        click: () => {
          this.mainWindow?.show();
        },
      },
      {
        label: 'État du chronomètre',
        click: () => {
          const state = this.timerService.getState();
          const message = state.isRunning
            ? `En cours: ${state.currentSession?.issue_key}\nTemps: ${this.timerService.formatTime(state.elapsedSeconds)}`
            : 'Aucun chronomètre actif';

          new Notification({
            title: 'TGD Time Tracker',
            body: message,
          }).show();
        },
      },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => {
          this.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('TGD Time Tracker');

    this.tray.on('click', () => {
      this.mainWindow?.show();
    });
  }

  private setupTimerListeners() {
    this.timerService.on('started', (data) => {
      this.mainWindow?.webContents.send('timer:started', data);
      this.updateTrayStatus();
    });

    this.timerService.on('stopped', (data) => {
      this.mainWindow?.webContents.send('timer:stopped', data);
      this.updateTrayStatus();
    });

    this.timerService.on('tick', (elapsedSeconds) => {
      this.mainWindow?.webContents.send('timer:tick', elapsedSeconds);
      this.updateTrayTooltip(elapsedSeconds);
    });

    this.timerService.on('notification-required', () => {
      this.showConfirmationNotification();
    });
  }

  private setupShortcutListeners() {
    this.shortcutService.on('shortcut-triggered', (event) => {
      console.log(`[TimeTrackerApp] Received shortcut-triggered event:`, event);

      // Start timer when shortcut is triggered
      this.timerService.startTimer(event.issueKey, event.issueTitle, event.issueType);

      // Show notification
      new Notification({
        title: 'TGD Time Tracker',
        body: `Chronomètre démarré sur ${event.issueKey}\n${event.issueTitle}`,
      }).show();

      // Show window
      this.mainWindow?.show();
    });
  }

  private updateTrayStatus() {
    const state = this.timerService.getState();
    if (state.isRunning && state.currentSession) {
      this.tray?.setTitle(`▶ ${state.currentSession.issue_key}`);
    } else {
      this.tray?.setTitle('');
    }
  }

  private updateTrayTooltip(elapsedSeconds: number) {
    const state = this.timerService.getState();
    if (state.isRunning && state.currentSession) {
      const time = this.timerService.formatTime(elapsedSeconds);
      this.tray?.setToolTip(`TGD Time Tracker\n${state.currentSession.issue_key} - ${time}`);
    } else {
      this.tray?.setToolTip('TGD Time Tracker');
    }
  }

  private showConfirmationNotification() {
    const state = this.timerService.getState();
    if (!state.isRunning || !state.currentSession) {
      return;
    }

    // Close existing reminder window if any
    if (this.reminderWindow && !this.reminderWindow.isDestroyed()) {
      this.reminderWindow.close();
    }

    const timeoutSeconds = parseInt(this.db.getConfig('notification_timeout') || '60');
    let remainingSeconds = timeoutSeconds;

    // Create a small modal window with buttons
    this.reminderWindow = new BrowserWindow({
      width: 480,
      height: 320,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      frame: false,
      transparent: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Center on screen
    this.reminderWindow.center();

    // Create HTML content for the reminder
    const issueKey = state.currentSession.issue_key;
    const issueTitle = state.currentSession.issue_title;
    const elapsedTime = this.timerService.formatTime(state.elapsedSeconds);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          color: #333;
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
          user-select: none;
          border: 1px solid #ddd;
        }
        .header {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #444;
        }
        .task-info {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 18px;
        }
        .issue-key {
          font-weight: 700;
          font-size: 16px;
          color: #0052cc;
        }
        .issue-title {
          font-size: 14px;
          color: #555;
          margin-top: 6px;
          line-height: 1.4;
        }
        .elapsed {
          font-size: 13px;
          color: #777;
          margin-top: 10px;
        }
        .countdown {
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          margin: 16px 0;
          color: #333;
        }
        .countdown-label {
          font-size: 12px;
          color: #888;
        }
        .buttons {
          display: flex;
          gap: 12px;
          margin-top: auto;
        }
        button {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s, opacity 0.2s;
        }
        button:hover { opacity: 0.85; }
        button:active { transform: scale(0.98); }
        .btn-continue {
          background: #36b37e;
          color: white;
        }
        .btn-change {
          background: #de350b;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="header">Rappel</div>
      <div class="task-info">
        <div class="issue-key">${issueKey}</div>
        <div class="issue-title">${issueTitle}</div>
        <div class="elapsed">Temps écoulé : ${elapsedTime}</div>
      </div>
      <div class="countdown">
        <span id="timer">${remainingSeconds}</span>s
        <div class="countdown-label">avant arrêt automatique</div>
      </div>
      <div class="buttons">
        <button class="btn-continue" onclick="window.electronAPI.reminderAction('continue')">
          ✓ Continuer
        </button>
        <button class="btn-change" onclick="window.electronAPI.reminderAction('change')">
          ✕ Changer de tâche
        </button>
      </div>
      <script>
        let remaining = ${remainingSeconds};
        const timerEl = document.getElementById('timer');
        setInterval(() => {
          remaining--;
          if (remaining >= 0) timerEl.textContent = remaining;
        }, 1000);
      </script>
    </body>
    </html>
    `;

    this.reminderWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Set timeout to auto-stop
    this.notificationTimeout = setTimeout(() => {
      if (this.timerService.isTimerRunning()) {
        this.closeReminderWindow();
        this.timerService.stopTimer();
        new Notification({
          title: '⏹️ TGD Time Tracker',
          body: `Chronomètre arrêté automatiquement\n${issueKey} - Pas de réponse après ${timeoutSeconds}s`,
        }).show();
        // Open window to select new task
        this.mainWindow?.show();
        this.mainWindow?.webContents.send('show-task-selector');
        console.log('[TimeTrackerApp] Auto-stopped after timeout, opening task selector');
      }
    }, timeoutSeconds * 1000);

    // Handle window close (X button or Alt+F4)
    this.reminderWindow.on('closed', () => {
      this.reminderWindow = null;
    });
  }

  private closeReminderWindow() {
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }
    if (this.reminderWindow && !this.reminderWindow.isDestroyed()) {
      this.reminderWindow.close();
      this.reminderWindow = null;
    }
  }

  private handleReminderAction(action: 'continue' | 'change') {
    const state = this.timerService.getState();
    this.closeReminderWindow();

    if (action === 'continue') {
      console.log('[TimeTrackerApp] User clicked Continue, timer continues');
      new Notification({
        title: '✅ TGD Time Tracker',
        body: `Continué sur ${state.currentSession?.issue_key}`,
        silent: true,
      }).show();
    } else {
      console.log('[TimeTrackerApp] User clicked Change, opening task selector');
      this.timerService.stopTimer();
      this.mainWindow?.show();
      this.mainWindow?.webContents.send('show-task-selector');
    }
  }

  private checkPendingAdjustments() {
    const adjustments = this.adjustmentService.analyzePendingDays();
    const needsAdjustment = adjustments.filter(a => a.needsAdjustment);

    if (needsAdjustment.length > 0) {
      this.mainWindow?.webContents.send('adjustments-pending', needsAdjustment);
    }
  }

  private setupIpcHandlers() {
    // Configuration
    ipcMain.handle('config:get', async (_, key: string) => {
      return this.db.getConfig(key);
    });

    ipcMain.handle('config:set', async (_, key: string, value: string) => {
      this.db.setConfig(key, value);

      // Update services dynamically when settings change
      if (key === 'notification_interval') {
        const minutes = parseInt(value);
        if (!isNaN(minutes) && minutes > 0) {
          this.timerService.setNotificationInterval(minutes);
        }
      } else if (key === 'max_daily_hours') {
        const hours = parseFloat(value);
        if (!isNaN(hours) && hours > 0) {
          this.adjustmentService.setMaxDailyHours(hours);
        }
      }
    });

    ipcMain.handle('config:initialize-services', async (_, config: {
      jiraBaseUrl: string;
      jiraEmail: string;
      jiraToken: string;
      tempoApiUrl: string;
      tempoToken: string;
      tempoAccountId: string;
    }) => {
      try {
        // Store config
        this.db.setConfig('jira_base_url', config.jiraBaseUrl);
        this.db.setConfig('jira_email', config.jiraEmail);
        this.db.setConfig('jira_token', config.jiraToken);
        this.db.setConfig('tempo_api_url', config.tempoApiUrl);
        this.db.setConfig('tempo_token', config.tempoToken);
        this.db.setConfig('tempo_account_id', config.tempoAccountId);

        // Initialize services
        this.jiraService = new JiraService(config.jiraBaseUrl, config.jiraEmail, config.jiraToken);
        this.tempoService = new TempoService(config.tempoApiUrl, config.tempoToken, config.tempoAccountId);

        // Test connection
        await this.jiraService.getCurrentUser();

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Timer
    ipcMain.handle('timer:start', async (_, issueKey: string, issueTitle: string, issueType: string) => {
      const sessionId = this.timerService.startTimer(issueKey, issueTitle, issueType);
      return { sessionId };
    });

    ipcMain.handle('timer:stop', async () => {
      this.timerService.stopTimer();
    });

    ipcMain.handle('timer:get-state', async () => {
      return this.timerService.getState();
    });

    // Jira
    ipcMain.handle('jira:get-recent-issues', async () => {
      if (!this.jiraService) {
        throw new Error('Jira service not initialized');
      }
      const projectKey = this.db.getConfig('jira_project_key') || 'TGD';
      const email = this.db.getConfig('jira_email') || '';
      return await this.jiraService.getRecentIssues(projectKey, email);
    });

    ipcMain.handle('jira:search-issues', async (_, searchText: string) => {
      if (!this.jiraService) {
        throw new Error('Jira service not initialized');
      }
      const projectKey = this.db.getConfig('jira_project_key') || 'TGD';
      return await this.jiraService.searchIssuesByText(projectKey, searchText);
    });

    ipcMain.handle('jira:get-issue', async (_, issueKey: string) => {
      if (!this.jiraService) {
        throw new Error('Jira service not initialized');
      }
      return await this.jiraService.getIssue(issueKey);
    });

    // Work sessions
    ipcMain.handle('sessions:get-by-date', async (_, date: string) => {
      return this.db.getWorkSessionsByDate(date);
    });

    ipcMain.handle('sessions:get-by-range', async (_, startDate: string, endDate: string) => {
      return this.db.getWorkSessionsByDateRange(startDate, endDate);
    });

    ipcMain.handle('sessions:update', async (_, id: number, updates: any) => {
      this.db.updateWorkSession(id, updates);
    });

    // Daily summaries
    ipcMain.handle('summaries:get-pending', async () => {
      return this.db.getPendingSummaries();
    });

    ipcMain.handle('summaries:get-by-range', async (_, startDate: string, endDate: string) => {
      return this.db.getDailySummariesByDateRange(startDate, endDate);
    });

    // Adjustments
    ipcMain.handle('adjustments:analyze', async () => {
      return this.adjustmentService.analyzePendingDays();
    });

    ipcMain.handle('adjustments:apply', async (_, adjustments: any[]) => {
      this.adjustmentService.applyAdjustments(adjustments);
    });

    ipcMain.handle('adjustments:analyze-day', async (_, date: string) => {
      return this.adjustmentService.analyzeDay(date);
    });

    ipcMain.handle('adjustments:apply-day', async (_, date: string) => {
      const adjustment = this.adjustmentService.analyzeDay(date);
      this.adjustmentService.applyDayAdjustment(adjustment);
      return adjustment;
    });

    ipcMain.handle('adjustments:get-max-hours', async () => {
      return this.adjustmentService.getMaxDailyHours();
    });

    // Tempo sync
    ipcMain.handle('tempo:send-worklog', async (_, worklog: any) => {
      if (!this.tempoService) {
        throw new Error('Tempo service not initialized');
      }
      return await this.tempoService.createWorklog(worklog);
    });

    ipcMain.handle('tempo:send-day', async (_, date: string) => {
      if (!this.tempoService) {
        throw new Error('Tempo service not initialized');
      }

      const sessions = this.db.getWorkSessionsByDate(date);
      const results = [];

      // Group sessions by issue_key
      const groupedSessions = new Map<string, {
        issueKey: string;
        totalSeconds: number;
        sessions: typeof sessions;
        comments: string[];
      }>();

      for (const session of sessions) {
        if (session.status === 'sent') {
          continue;
        }

        const existing = groupedSessions.get(session.issue_key);
        if (existing) {
          existing.totalSeconds += session.duration_seconds;
          existing.sessions.push(session);
          if (session.comment) {
            existing.comments.push(session.comment);
          }
        } else {
          groupedSessions.set(session.issue_key, {
            issueKey: session.issue_key,
            totalSeconds: session.duration_seconds,
            sessions: [session],
            comments: session.comment ? [session.comment] : [],
          });
        }
      }

      // Send one worklog per task group
      for (const [issueKey, group] of groupedSessions) {
        try {
          console.log(`[Tempo] Sending worklog for ${issueKey}: ${group.totalSeconds}s`);
          const worklog = await this.tempoService.createWorklog({
            issueKey: group.issueKey,
            timeSpentSeconds: group.totalSeconds,
            startDate: date,
            description: group.comments.join(' | '),
          });

          // Mark all sessions in this group as sent
          for (const session of group.sessions) {
            this.db.updateWorkSession(session.id, {
              tempo_worklog_id: worklog.tempoWorklogId.toString(),
              status: 'sent',
            });
          }

          results.push({
            success: true,
            session: issueKey,
            totalSeconds: group.totalSeconds,
            sessionsCount: group.sessions.length,
          });
          console.log(`[Tempo] Successfully sent worklog for ${issueKey}`);
        } catch (error: any) {
          console.error(`[Tempo] Failed to send worklog for ${issueKey}:`, error.message);
          results.push({
            success: false,
            session: issueKey,
            error: error.message || 'Erreur inconnue',
            totalSeconds: group.totalSeconds,
            sessionsCount: group.sessions.length,
          });
        }
      }

      // Only update daily summary if all worklogs were sent successfully
      const failures = results.filter(r => !r.success);
      const successes = results.filter(r => r.success);

      if (failures.length === 0 && successes.length > 0) {
        const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_seconds / 60, 0);
        this.db.createOrUpdateDailySummary({
          date,
          total_minutes: totalMinutes,
          adjusted_minutes: null,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      }

      return results;
    });

    // Recent issues from DB
    ipcMain.handle('recent:get', async () => {
      const limit = parseInt(this.db.getConfig('recent_issues_count') || '10');
      return this.db.getRecentIssues(limit);
    });

    // Favorite tasks
    ipcMain.handle('favorites:get', async () => {
      return this.db.getFavoriteTasks();
    });

    ipcMain.handle('favorites:add', async (_, task: { issueKey: string; issueTitle: string; issueType: string; position: number }) => {
      try {
        this.db.addFavoriteTask({
          issue_key: task.issueKey,
          issue_title: task.issueTitle,
          issue_type: task.issueType,
          position: task.position,
        });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('favorites:remove', async (_, issueKey: string) => {
      this.db.removeFavoriteTask(issueKey);
    });

    ipcMain.handle('favorites:is-favorite', async (_, issueKey: string) => {
      return this.db.isFavoriteTask(issueKey);
    });

    ipcMain.handle('favorites:update-position', async (_, issueKey: string, position: number) => {
      this.db.updateFavoriteTaskPosition(issueKey, position);
    });

    // Keyboard shortcuts
    ipcMain.handle('shortcuts:get', async () => {
      return this.db.getKeyboardShortcuts();
    });

    ipcMain.handle('shortcuts:add', async (_, shortcut: { accelerator: string; issueKey: string; issueTitle: string; issueType: string; enabled: boolean }) => {
      try {
        this.db.addKeyboardShortcut({
          accelerator: shortcut.accelerator,
          issue_key: shortcut.issueKey,
          issue_title: shortcut.issueTitle,
          issue_type: shortcut.issueType,
          enabled: shortcut.enabled,
        });

        // Re-initialize shortcuts to apply changes
        this.shortcutService.initialize();

        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('shortcuts:remove', async (_, accelerator: string) => {
      this.db.removeKeyboardShortcut(accelerator);
      this.shortcutService.unregisterShortcut(accelerator);
    });

    ipcMain.handle('shortcuts:update', async (_, accelerator: string, updates: any) => {
      this.db.updateKeyboardShortcut(accelerator, updates);
      this.shortcutService.initialize(); // Re-initialize to apply changes
    });

    ipcMain.handle('shortcuts:validate', async (_, accelerator: string) => {
      return {
        isValid: ShortcutService.isValidAccelerator(accelerator),
        isAvailable: this.shortcutService.isShortcutAvailable(accelerator),
      };
    });

    // Reminder window actions
    ipcMain.handle('reminder:action', async (_, action: 'continue' | 'change') => {
      this.handleReminderAction(action);
    });
  }
}

// Start app
const timeTrackerApp = new TimeTrackerApp();
timeTrackerApp.init();
