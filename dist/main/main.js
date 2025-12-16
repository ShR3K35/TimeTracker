"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const schema_1 = require("./database/schema");
const jira_service_1 = require("./services/jira.service");
const tempo_service_1 = require("./services/tempo.service");
const timer_service_1 = require("./services/timer.service");
const adjustment_service_1 = require("./services/adjustment.service");
const shortcut_service_1 = require("./services/shortcut.service");
class TimeTrackerApp {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.jiraService = null;
        this.tempoService = null;
        this.notificationTimeout = null;
        this.isQuitting = false;
        this.db = new schema_1.DatabaseManager();
        const notificationInterval = parseInt(this.db.getConfig('notification_interval') || '60');
        this.timerService = new timer_service_1.TimerService(this.db, notificationInterval);
        const maxDailyHours = parseFloat(this.db.getConfig('max_daily_hours') || '7.5');
        this.adjustmentService = new adjustment_service_1.AdjustmentService(this.db, maxDailyHours);
        this.shortcutService = new shortcut_service_1.ShortcutService(this.db);
        this.setupTimerListeners();
        this.setupShortcutListeners();
        this.setupIpcHandlers();
    }
    async init() {
        await electron_1.app.whenReady();
        this.createWindow();
        this.createTray();
        this.checkPendingAdjustments();
        this.shortcutService.initialize(); // Initialize keyboard shortcuts
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });
        electron_1.app.on('window-all-closed', () => {
            // Don't quit on window close, keep running in background
            // app.quit() is only called when user explicitly quits from tray
        });
        electron_1.app.on('will-quit', () => {
            // Unregister all shortcuts before quitting
            this.shortcutService.unregisterAll();
        });
    }
    createWindow() {
        this.mainWindow = new electron_1.BrowserWindow({
            width: 600,
            height: 500,
            resizable: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path_1.default.join(__dirname, 'preload.js'),
            },
            show: false,
        });
        // Load renderer
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.loadURL('http://localhost:3000');
        }
        else {
            this.mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
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
    createTray() {
        const iconPath = path_1.default.join(__dirname, '../../assets/icon.png');
        this.tray = new electron_1.Tray(iconPath);
        const contextMenu = electron_1.Menu.buildFromTemplate([
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
                    new electron_1.Notification({
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
                    electron_1.app.quit();
                },
            },
        ]);
        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip('TGD Time Tracker');
        this.tray.on('click', () => {
            this.mainWindow?.show();
        });
    }
    setupTimerListeners() {
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
    setupShortcutListeners() {
        this.shortcutService.on('shortcut-triggered', (event) => {
            // Start timer when shortcut is triggered
            this.timerService.startTimer(event.issueKey, event.issueTitle, event.issueType);
            // Show notification
            new electron_1.Notification({
                title: 'TGD Time Tracker',
                body: `Chronomètre démarré sur ${event.issueKey}\n${event.issueTitle}`,
            }).show();
            // Show window
            this.mainWindow?.show();
        });
    }
    updateTrayStatus() {
        const state = this.timerService.getState();
        if (state.isRunning && state.currentSession) {
            this.tray?.setTitle(`▶ ${state.currentSession.issue_key}`);
        }
        else {
            this.tray?.setTitle('');
        }
    }
    updateTrayTooltip(elapsedSeconds) {
        const state = this.timerService.getState();
        if (state.isRunning && state.currentSession) {
            const time = this.timerService.formatTime(elapsedSeconds);
            this.tray?.setToolTip(`TGD Time Tracker\n${state.currentSession.issue_key} - ${time}`);
        }
        else {
            this.tray?.setToolTip('TGD Time Tracker');
        }
    }
    showConfirmationNotification() {
        const state = this.timerService.getState();
        if (!state.isRunning || !state.currentSession) {
            return;
        }
        const notification = new electron_1.Notification({
            title: '🕐 TGD Time Tracker',
            body: `Travaillez-vous toujours sur :\n${state.currentSession.issue_key} - ${state.currentSession.issue_title}?\n\nTemps écoulé : ${this.timerService.formatTime(state.elapsedSeconds)}\n\nCliquez sur cette notification pour continuer, ou ne faites rien pour arrêter automatiquement dans 60 secondes.`,
        });
        // Set timeout to auto-stop
        const timeout = parseInt(this.db.getConfig('notification_timeout') || '60');
        this.notificationTimeout = setTimeout(() => {
            this.timerService.stopTimer();
            new electron_1.Notification({
                title: 'TGD Time Tracker',
                body: 'Chronomètre arrêté automatiquement (pas de réponse)',
            }).show();
        }, timeout * 1000);
        notification.on('click', () => {
            // User clicked the notification, continue timer
            if (this.notificationTimeout) {
                clearTimeout(this.notificationTimeout);
                this.notificationTimeout = null;
            }
        });
        notification.on('close', () => {
            // Notification closed without interaction, let timeout handle it
        });
        notification.show();
    }
    checkPendingAdjustments() {
        const adjustments = this.adjustmentService.analyzePendingDays();
        const needsAdjustment = adjustments.filter(a => a.needsAdjustment);
        if (needsAdjustment.length > 0) {
            this.mainWindow?.webContents.send('adjustments-pending', needsAdjustment);
        }
    }
    setupIpcHandlers() {
        // Configuration
        electron_1.ipcMain.handle('config:get', async (_, key) => {
            return this.db.getConfig(key);
        });
        electron_1.ipcMain.handle('config:set', async (_, key, value) => {
            this.db.setConfig(key, value);
        });
        electron_1.ipcMain.handle('config:initialize-services', async (_, config) => {
            try {
                // Store config
                this.db.setConfig('jira_base_url', config.jiraBaseUrl);
                this.db.setConfig('jira_email', config.jiraEmail);
                this.db.setConfig('jira_token', config.jiraToken);
                this.db.setConfig('tempo_api_url', config.tempoApiUrl);
                this.db.setConfig('tempo_token', config.tempoToken);
                this.db.setConfig('tempo_account_id', config.tempoAccountId);
                // Initialize services
                this.jiraService = new jira_service_1.JiraService(config.jiraBaseUrl, config.jiraEmail, config.jiraToken);
                this.tempoService = new tempo_service_1.TempoService(config.tempoApiUrl, config.tempoToken, config.tempoAccountId);
                // Test connection
                await this.jiraService.getCurrentUser();
                return { success: true };
            }
            catch (error) {
                return { success: false, error: error.message };
            }
        });
        // Timer
        electron_1.ipcMain.handle('timer:start', async (_, issueKey, issueTitle, issueType) => {
            const sessionId = this.timerService.startTimer(issueKey, issueTitle, issueType);
            return { sessionId };
        });
        electron_1.ipcMain.handle('timer:stop', async () => {
            this.timerService.stopTimer();
        });
        electron_1.ipcMain.handle('timer:get-state', async () => {
            return this.timerService.getState();
        });
        // Jira
        electron_1.ipcMain.handle('jira:get-recent-issues', async () => {
            if (!this.jiraService) {
                throw new Error('Jira service not initialized');
            }
            const projectKey = this.db.getConfig('jira_project_key') || 'TGD';
            const email = this.db.getConfig('jira_email') || '';
            return await this.jiraService.getRecentIssues(projectKey, email);
        });
        electron_1.ipcMain.handle('jira:search-issues', async (_, searchText) => {
            if (!this.jiraService) {
                throw new Error('Jira service not initialized');
            }
            const projectKey = this.db.getConfig('jira_project_key') || 'TGD';
            return await this.jiraService.searchIssuesByText(projectKey, searchText);
        });
        electron_1.ipcMain.handle('jira:get-issue', async (_, issueKey) => {
            if (!this.jiraService) {
                throw new Error('Jira service not initialized');
            }
            return await this.jiraService.getIssue(issueKey);
        });
        // Work sessions
        electron_1.ipcMain.handle('sessions:get-by-date', async (_, date) => {
            return this.db.getWorkSessionsByDate(date);
        });
        electron_1.ipcMain.handle('sessions:get-by-range', async (_, startDate, endDate) => {
            return this.db.getWorkSessionsByDateRange(startDate, endDate);
        });
        electron_1.ipcMain.handle('sessions:update', async (_, id, updates) => {
            this.db.updateWorkSession(id, updates);
        });
        // Daily summaries
        electron_1.ipcMain.handle('summaries:get-pending', async () => {
            return this.db.getPendingSummaries();
        });
        electron_1.ipcMain.handle('summaries:get-by-range', async (_, startDate, endDate) => {
            return this.db.getDailySummariesByDateRange(startDate, endDate);
        });
        // Adjustments
        electron_1.ipcMain.handle('adjustments:analyze', async () => {
            return this.adjustmentService.analyzePendingDays();
        });
        electron_1.ipcMain.handle('adjustments:apply', async (_, adjustments) => {
            this.adjustmentService.applyAdjustments(adjustments);
        });
        // Tempo sync
        electron_1.ipcMain.handle('tempo:send-worklog', async (_, worklog) => {
            if (!this.tempoService) {
                throw new Error('Tempo service not initialized');
            }
            return await this.tempoService.createWorklog(worklog);
        });
        electron_1.ipcMain.handle('tempo:send-day', async (_, date) => {
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
                }
                catch (error) {
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
        electron_1.ipcMain.handle('recent:get', async () => {
            const limit = parseInt(this.db.getConfig('recent_issues_count') || '10');
            return this.db.getRecentIssues(limit);
        });
        // Favorite tasks
        electron_1.ipcMain.handle('favorites:get', async () => {
            return this.db.getFavoriteTasks();
        });
        electron_1.ipcMain.handle('favorites:add', async (_, task) => {
            try {
                this.db.addFavoriteTask({
                    issue_key: task.issueKey,
                    issue_title: task.issueTitle,
                    issue_type: task.issueType,
                    position: task.position,
                });
                return { success: true };
            }
            catch (error) {
                return { success: false, error: error.message };
            }
        });
        electron_1.ipcMain.handle('favorites:remove', async (_, issueKey) => {
            this.db.removeFavoriteTask(issueKey);
        });
        electron_1.ipcMain.handle('favorites:is-favorite', async (_, issueKey) => {
            return this.db.isFavoriteTask(issueKey);
        });
        electron_1.ipcMain.handle('favorites:update-position', async (_, issueKey, position) => {
            this.db.updateFavoriteTaskPosition(issueKey, position);
        });
        // Keyboard shortcuts
        electron_1.ipcMain.handle('shortcuts:get', async () => {
            return this.db.getKeyboardShortcuts();
        });
        electron_1.ipcMain.handle('shortcuts:add', async (_, shortcut) => {
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
            }
            catch (error) {
                return { success: false, error: error.message };
            }
        });
        electron_1.ipcMain.handle('shortcuts:remove', async (_, accelerator) => {
            this.db.removeKeyboardShortcut(accelerator);
            this.shortcutService.unregisterShortcut(accelerator);
        });
        electron_1.ipcMain.handle('shortcuts:update', async (_, accelerator, updates) => {
            this.db.updateKeyboardShortcut(accelerator, updates);
            this.shortcutService.initialize(); // Re-initialize to apply changes
        });
        electron_1.ipcMain.handle('shortcuts:validate', async (_, accelerator) => {
            return {
                isValid: shortcut_service_1.ShortcutService.isValidAccelerator(accelerator),
                isAvailable: this.shortcutService.isShortcutAvailable(accelerator),
            };
        });
    }
}
// Start app
const timeTrackerApp = new TimeTrackerApp();
timeTrackerApp.init();
