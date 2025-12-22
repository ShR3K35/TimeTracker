import { app, BrowserWindow, Tray, Menu, ipcMain, Notification } from 'electron';
import path from 'path';
import { DatabaseManager } from './database/schema';
import { JiraService } from './services/jira.service';
import { TempoService } from './services/tempo.service';
import { TimerService } from './services/timer.service';
import { AdjustmentService } from './services/adjustment.service';
import { ShortcutService } from './services/shortcut.service';
import { IdleAlertService } from './services/idle-alert.service';

class TimeTrackerApp {
  private mainWindow: BrowserWindow | null = null;
  private reminderWindow: BrowserWindow | null = null;
  private idleAlertWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private db: DatabaseManager;
  private jiraService: JiraService | null = null;
  private tempoService: TempoService | null = null;
  private timerService: TimerService;
  private adjustmentService: AdjustmentService;
  private shortcutService: ShortcutService;
  private idleAlertService: IdleAlertService;
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
    this.idleAlertService = new IdleAlertService(this.db, this.timerService);

    this.setupTimerListeners();
    this.setupShortcutListeners();
    this.setupIdleAlertListeners();
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
    this.idleAlertService.start(); // Start idle alert monitoring

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

      // Get default activity
      const defaultActivity = this.db.getDefaultTempoActivity();

      // Start timer when shortcut is triggered (with default activity)
      this.timerService.startTimer(
        event.issueKey,
        event.issueTitle,
        event.issueType,
        defaultActivity?.tempo_id,
        defaultActivity?.name,
        defaultActivity?.value
      );

      // Show notification
      new Notification({
        title: 'TGD Time Tracker',
        body: `Chronomètre démarré sur ${event.issueKey}\n${event.issueTitle}`,
      }).show();

      // Show window
      this.mainWindow?.show();
    });
  }

  private setupIdleAlertListeners() {
    this.idleAlertService.on('idle-alert-required', () => {
      this.showIdleAlert();
    });
    // Note: Don't start here, start after app is ready in init()
  }

  private showIdleAlert() {
    // Don't show if window is already open
    if (this.idleAlertWindow && !this.idleAlertWindow.isDestroyed()) {
      this.idleAlertWindow.focus();
      return;
    }

    this.idleAlertService.setAlertWindowOpen(true);

    // Create a modal window for the idle alert
    this.idleAlertWindow = new BrowserWindow({
      width: 450,
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
    this.idleAlertWindow.center();

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
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #444;
        }
        .icon {
          font-size: 24px;
        }
        .message {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          font-size: 14px;
          line-height: 1.5;
          color: #856404;
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
        .btn-select {
          background: #0052cc;
          color: white;
        }
        .btn-ignore {
          background: #ddd;
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="header"><span class="icon">⏰</span> Aucune tâche en cours</div>
      <div class="message">
        Vous êtes actif sur votre ordinateur mais aucun chronomètre n'est lancé.<br><br>
        Souhaitez-vous sélectionner une tâche à suivre ?
      </div>
      <div class="buttons">
        <button class="btn-select" onclick="window.electronAPI.idleAlertAction('select')">
          Sélectionner une tâche
        </button>
        <button class="btn-ignore" onclick="window.electronAPI.idleAlertAction('ignore')">
          Ignorer
        </button>
      </div>
    </body>
    </html>
    `;

    this.idleAlertWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Handle window close
    this.idleAlertWindow.on('closed', () => {
      this.idleAlertWindow = null;
      this.idleAlertService.setAlertWindowOpen(false);
    });
  }

  private closeIdleAlertWindow() {
    if (this.idleAlertWindow && !this.idleAlertWindow.isDestroyed()) {
      this.idleAlertWindow.close();
      this.idleAlertWindow = null;
    }
    this.idleAlertService.setAlertWindowOpen(false);
  }

  private handleIdleAlertAction(action: 'select' | 'ignore') {
    this.closeIdleAlertWindow();

    if (action === 'select') {
      console.log('[TimeTrackerApp] User clicked Select Task from idle alert');
      this.mainWindow?.show();
      this.mainWindow?.webContents.send('show-task-selector');
    } else {
      console.log('[TimeTrackerApp] User ignored idle alert');
      // Reset last alert time so it won't immediately show again
      this.idleAlertService.resetLastAlertTime();
    }
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
    ipcMain.handle('timer:start', async (_, issueKey: string, issueTitle: string, issueType: string, activityId?: number, activityName?: string, activityValue?: string, startedAt?: string) => {
      const sessionId = this.timerService.startTimer(issueKey, issueTitle, issueType, activityId, activityName, activityValue, startedAt);
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

    ipcMain.handle('sessions:update-group-activity', async (_, date: string, issueKey: string, oldActivityId: number | null, newActivityId: number | null, newActivityName: string | null, newActivityValue: string | null) => {
      // Get all sessions for this date, issue key, and old activity
      const sessions = this.db.getWorkSessionsByDate(date);
      const matchingSessions = sessions.filter(s =>
        s.issue_key === issueKey &&
        (s.activity_id === oldActivityId || (s.activity_id === null && oldActivityId === null))
      );

      // Update each session with the new activity
      for (const session of matchingSessions) {
        this.db.updateWorkSession(session.id, {
          activity_id: newActivityId,
          activity_name: newActivityName,
          activity_value: newActivityValue,
        });
      }

      return { success: true, updatedCount: matchingSessions.length };
    });

    // Create manual session
    ipcMain.handle('sessions:create-manual', async (_, data: {
      date: string;
      issueKey: string;
      issueTitle: string;
      issueType: string;
      durationSeconds: number;
      activityId: number | null;
      activityName: string | null;
      activityValue: string | null;
    }) => {
      // Create a session with the specified date at 09:00
      const startTime = `${data.date}T09:00:00.000Z`;
      const endTime = new Date(new Date(startTime).getTime() + data.durationSeconds * 1000).toISOString();

      const sessionId = this.db.createWorkSession({
        issue_key: data.issueKey,
        issue_title: data.issueTitle,
        issue_type: data.issueType,
        start_time: startTime,
        end_time: endTime,
        duration_seconds: data.durationSeconds,
        comment: null,
        status: 'draft',
        tempo_worklog_id: null,
        activity_id: data.activityId,
        activity_name: data.activityName,
        activity_value: data.activityValue,
      });

      // Update daily summary
      const sessions = this.db.getWorkSessionsByDate(data.date);
      const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_seconds / 60, 0);

      this.db.createOrUpdateDailySummary({
        date: data.date,
        total_minutes: totalMinutes,
        adjusted_minutes: null,
        status: 'pending',
        sent_at: null,
      });

      console.log(`[Main] Created manual session for ${data.issueKey} on ${data.date}: ${data.durationSeconds}s`);
      return { success: true, sessionId };
    });

    ipcMain.handle('sessions:delete-group', async (_, date: string, issueKey: string, activityId: number | null) => {
      const sessions = this.db.getWorkSessionsByDate(date);
      const sessionsToDelete = sessions.filter(s => {
        if (s.issue_key !== issueKey) return false;
        return s.activity_id === activityId;
      });

      if (sessionsToDelete.length === 0) {
        throw new Error(`Aucune session trouvée pour ${issueKey} le ${date}`);
      }

      // Delete all sessions in the group
      for (const session of sessionsToDelete) {
        this.db.deleteWorkSession(session.id);
      }

      // Update daily summary
      const remainingSessions = this.db.getWorkSessionsByDate(date);
      if (remainingSessions.length === 0) {
        // Delete the summary if no sessions remain
        this.db.deleteDailySummary(date);
      } else {
        const totalMinutes = remainingSessions.reduce((sum, s) => sum + s.duration_seconds / 60, 0);
        this.db.createOrUpdateDailySummary({
          date,
          total_minutes: totalMinutes,
          adjusted_minutes: null,
          status: 'pending',
          sent_at: null,
        });
      }

      console.log(`[Main] Deleted ${sessionsToDelete.length} session(s) for ${issueKey} on ${date}`);
      return { success: true, deletedCount: sessionsToDelete.length };
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

    ipcMain.handle('adjustments:reopen-day', async (_, date: string) => {
      // Get sessions to find tempo worklog IDs before resetting
      const sessions = this.db.getWorkSessionsByDate(date);
      const deletionResults: { sessionId: number; worklogId: string; success: boolean; error?: string }[] = [];

      // Delete worklogs from Tempo if service is available
      if (this.tempoService) {
        for (const session of sessions) {
          if (session.tempo_worklog_id) {
            try {
              const worklogId = parseInt(session.tempo_worklog_id);
              await this.tempoService.deleteWorklog(worklogId);
              deletionResults.push({ sessionId: session.id, worklogId: session.tempo_worklog_id, success: true });
              console.log(`[Main] Deleted Tempo worklog ${session.tempo_worklog_id} for session ${session.id}`);
            } catch (error: any) {
              console.error(`[Main] Failed to delete Tempo worklog ${session.tempo_worklog_id}:`, error.message);
              deletionResults.push({ sessionId: session.id, worklogId: session.tempo_worklog_id, success: false, error: error.message });
            }
          }
        }
      }

      // Reset local status
      this.adjustmentService.reopenDay(date);

      const failedDeletions = deletionResults.filter(r => !r.success);
      if (failedDeletions.length > 0) {
        console.warn(`[Main] ${failedDeletions.length} Tempo worklog(s) could not be deleted`);
      }

      return {
        success: true,
        tempoDeleted: deletionResults.filter(r => r.success).length,
        tempoFailed: failedDeletions.length,
        failures: failedDeletions,
      };
    });

    ipcMain.handle('adjustments:update-task-duration', async (_, date: string, issueKey: string, durationSeconds: number, activityId?: number | null) => {
      this.adjustmentService.updateTaskGroupDuration(date, issueKey, durationSeconds, activityId);
      return { success: true };
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
      if (!this.jiraService) {
        throw new Error('Jira service not initialized');
      }

      const sessions = this.db.getWorkSessionsByDate(date);
      const results = [];

      // Group sessions by issue_key AND activity_id
      // (same task with different activities should be separate worklogs)
      const groupedSessions = new Map<string, {
        issueKey: string;
        activityId: number | null;
        activityName: string | null;
        activityValue: string | null;
        totalSeconds: number;
        sessions: typeof sessions;
        comments: string[];
      }>();

      for (const session of sessions) {
        if (session.status === 'sent') {
          continue;
        }

        // Group key includes both issue_key and activity_id
        const groupKey = `${session.issue_key}|${session.activity_id || 'none'}`;
        const existing = groupedSessions.get(groupKey);
        if (existing) {
          existing.totalSeconds += session.duration_seconds;
          existing.sessions.push(session);
          if (session.comment) {
            existing.comments.push(session.comment);
          }
        } else {
          groupedSessions.set(groupKey, {
            issueKey: session.issue_key,
            activityId: session.activity_id,
            activityName: session.activity_name,
            activityValue: session.activity_value,
            totalSeconds: session.duration_seconds,
            sessions: [session],
            comments: session.comment ? [session.comment] : [],
          });
        }
      }

      // Send one worklog per task+activity group
      for (const [, group] of groupedSessions) {
        try {
          console.log(`[Tempo] Fetching issue ID for ${group.issueKey}`);
          // Get the issue ID from Jira (Tempo requires numeric issue ID, not key)
          const jiraIssue = await this.jiraService.getIssue(group.issueKey);
          const issueId = parseInt(jiraIssue.id, 10);

          // Filter out crash recovery messages from comments
          const cleanComments = group.comments
            .filter(c => c && !c.includes('[À vérifier - récupéré après crash]'))
            .map(c => c.trim())
            .filter(c => c.length > 0);

          // Build worklog payload for Tempo API v4
          const worklogPayload: any = {
            issueId: issueId,
            timeSpentSeconds: group.totalSeconds,
            startDate: date, // Format: yyyy-MM-dd
            startTime: '09:00:00',
          };

          // Only add description if there are meaningful comments
          if (cleanComments.length > 0) {
            worklogPayload.description = cleanComments.join(' | ');
          }

          // Add activity attribute if configured (Tempo v4 format)
          // Use the activity VALUE (technical value without accents) for the API
          if (group.activityId) {
            // Try to get the value from the session, or look it up from TempoActivity table
            let activityValue = group.activityValue;
            if (!activityValue) {
              // Fallback: look up the activity value from the TempoActivity table
              const activities = this.db.getTempoActivities();
              const activity = activities.find(a => a.tempo_id === group.activityId);
              activityValue = activity?.value || null;
            }

            if (activityValue) {
              worklogPayload.attributes = [
                {
                  key: '_Activité_',
                  value: activityValue,
                },
              ];
            }
          }

          console.log(`[Tempo] Sending worklog for ${group.issueKey} (ID: ${issueId}): ${group.totalSeconds}s, activity: ${group.activityName || 'none'}`);
          const worklog = await this.tempoService.createWorklog(worklogPayload);

          // Mark all sessions in this group as sent
          for (const session of group.sessions) {
            this.db.updateWorkSession(session.id, {
              tempo_worklog_id: worklog.tempoWorklogId.toString(),
              status: 'sent',
            });
          }

          results.push({
            success: true,
            session: group.issueKey,
            activity: group.activityName,
            totalSeconds: group.totalSeconds,
            sessionsCount: group.sessions.length,
          });
          console.log(`[Tempo] Successfully sent worklog for ${group.issueKey}`);
        } catch (error: any) {
          console.error(`[Tempo] Failed to send worklog for ${group.issueKey}:`, error.message);
          results.push({
            success: false,
            session: group.issueKey,
            activity: group.activityName,
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

    // Idle alert window actions
    ipcMain.handle('idle-alert:action', async (_, action: 'select' | 'ignore') => {
      this.handleIdleAlertAction(action);
    });

    // Idle alert configuration
    ipcMain.handle('idle-alert:get-config', async () => {
      return {
        enabled: this.idleAlertService.isEnabled(),
        intervalMinutes: this.idleAlertService.getAlertInterval(),
        ...this.idleAlertService.getWorkingHours(),
      };
    });

    ipcMain.handle('idle-alert:set-enabled', async (_, enabled: boolean) => {
      this.idleAlertService.setEnabled(enabled);
    });

    ipcMain.handle('idle-alert:set-interval', async (_, minutes: number) => {
      this.idleAlertService.setAlertInterval(minutes);
    });

    ipcMain.handle('idle-alert:set-working-hours', async (_, startHour: number, endHour: number) => {
      this.idleAlertService.setWorkingHours(startHour, endHour);
    });

    // Tempo Activities
    ipcMain.handle('activities:get', async () => {
      return this.db.getTempoActivities();
    });

    ipcMain.handle('activities:get-default', async () => {
      return this.db.getDefaultTempoActivity();
    });

    ipcMain.handle('activities:add', async (_, activity: { tempo_id: number; name: string; value: string; position: number }) => {
      this.db.addTempoActivity(activity);
      return { success: true };
    });

    ipcMain.handle('activities:remove', async (_, tempoId: number) => {
      this.db.removeTempoActivity(tempoId);
      return { success: true };
    });

    ipcMain.handle('activities:reorder', async (_, activities: { tempo_id: number; position: number }[]) => {
      this.db.reorderTempoActivities(activities);
      return { success: true };
    });
  }
}

// Start app
const timeTrackerApp = new TimeTrackerApp();
timeTrackerApp.init();
