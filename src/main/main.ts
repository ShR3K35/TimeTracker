import { app, BrowserWindow, Tray, Menu, ipcMain, Notification } from 'electron';
import path from 'path';
import { DatabaseManager } from './database/schema';
import { JiraService } from './services/jira.service';
import { TempoService } from './services/tempo.service';
import { TimerService } from './services/timer.service';
import { AdjustmentService } from './services/adjustment.service';

class TimeTrackerApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private db: DatabaseManager;
  private jiraService: JiraService | null = null;
  private tempoService: TempoService | null = null;
  private timerService: TimerService;
  private adjustmentService: AdjustmentService;
  private notificationTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.db = new DatabaseManager();

    const notificationInterval = parseInt(this.db.getConfig('notification_interval') || '60');
    this.timerService = new TimerService(this.db, notificationInterval);

    const maxDailyHours = parseFloat(this.db.getConfig('max_daily_hours') || '7.5');
    this.adjustmentService = new AdjustmentService(this.db, maxDailyHours);

    this.setupTimerListeners();
    this.setupIpcHandlers();
  }

  async init() {
    await app.whenReady();
    this.createWindow();
    this.createTray();
    this.checkPendingAdjustments();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('window-all-closed', () => {
      // Don't quit on window close, keep running in background
      // app.quit() is only called when user explicitly quits from tray
    });
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 600,
      height: 500,
      resizable: false,
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
      if (!app.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private createTray() {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    this.tray = new Tray(iconPath);

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
          app.isQuitting = true;
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

    const notification = new Notification({
      title: '🕐 TGD Time Tracker',
      body: `Travaillez-vous toujours sur :\n${state.currentSession.issue_key} - ${state.currentSession.issue_title}?\n\nTemps écoulé : ${this.timerService.formatTime(state.elapsedSeconds)}`,
      requireInteraction: true,
      actions: [
        { text: 'Oui, continuer', type: 'button' },
        { text: 'Non, arrêter', type: 'button' },
      ],
    });

    // Set timeout to auto-stop
    const timeout = parseInt(this.db.getConfig('notification_timeout') || '60');
    this.notificationTimeout = setTimeout(() => {
      this.timerService.stopTimer();
      new Notification({
        title: 'TGD Time Tracker',
        body: 'Chronomètre arrêté automatiquement (pas de réponse)',
      }).show();
    }, timeout * 1000);

    notification.on('action', (event, index) => {
      if (this.notificationTimeout) {
        clearTimeout(this.notificationTimeout);
        this.notificationTimeout = null;
      }

      if (index === 1) {
        // "Non, arrêter" clicked
        this.timerService.stopTimer();
        this.mainWindow?.show();
        this.mainWindow?.webContents.send('show-task-selector');
      }
      // If index === 0 ("Oui, continuer"), do nothing, timer continues
    });

    notification.on('close', () => {
      if (this.notificationTimeout) {
        clearTimeout(this.notificationTimeout);
        this.notificationTimeout = null;
      }
    });

    notification.show();
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

      for (const session of sessions) {
        if (session.status === 'sent') {
          continue;
        }

        try {
          const worklog = await this.tempoService.createWorklog({
            issueKey: session.issue_key,
            timeSpentSeconds: session.duration_seconds,
            startDate: date,
            description: session.comment || '',
          });

          this.db.updateWorkSession(session.id, {
            tempo_worklog_id: worklog.tempoWorklogId.toString(),
            status: 'sent',
          });

          results.push({ success: true, session: session.issue_key });
        } catch (error: any) {
          results.push({ success: false, session: session.issue_key, error: error.message });
        }
      }

      // Update daily summary
      this.db.createOrUpdateDailySummary({
        date,
        total_minutes: sessions.reduce((sum, s) => sum + s.duration_seconds / 60, 0),
        adjusted_minutes: null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      return results;
    });

    // Recent issues from DB
    ipcMain.handle('recent:get', async () => {
      const limit = parseInt(this.db.getConfig('recent_issues_count') || '10');
      return this.db.getRecentIssues(limit);
    });
  }
}

// Start app
const timeTrackerApp = new TimeTrackerApp();
timeTrackerApp.init();
