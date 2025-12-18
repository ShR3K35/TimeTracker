import { contextBridge, ipcRenderer } from 'electron';

// Expose protected API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('config:set', key, value),
    initializeServices: (config: any) => ipcRenderer.invoke('config:initialize-services', config),
  },

  // Timer
  timer: {
    start: (issueKey: string, issueTitle: string, issueType: string) =>
      ipcRenderer.invoke('timer:start', issueKey, issueTitle, issueType),
    stop: () => ipcRenderer.invoke('timer:stop'),
    getState: () => ipcRenderer.invoke('timer:get-state'),
    onStarted: (callback: (data: any) => void) => {
      ipcRenderer.on('timer:started', (_, data) => callback(data));
    },
    onStopped: (callback: (data: any) => void) => {
      ipcRenderer.on('timer:stopped', (_, data) => callback(data));
    },
    onTick: (callback: (elapsedSeconds: number) => void) => {
      ipcRenderer.on('timer:tick', (_, elapsedSeconds) => callback(elapsedSeconds));
    },
  },

  // Jira
  jira: {
    getRecentIssues: () => ipcRenderer.invoke('jira:get-recent-issues'),
    searchIssues: (searchText: string) => ipcRenderer.invoke('jira:search-issues', searchText),
    getIssue: (issueKey: string) => ipcRenderer.invoke('jira:get-issue', issueKey),
  },

  // Work sessions
  sessions: {
    getByDate: (date: string) => ipcRenderer.invoke('sessions:get-by-date', date),
    getByRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('sessions:get-by-range', startDate, endDate),
    update: (id: number, updates: any) => ipcRenderer.invoke('sessions:update', id, updates),
  },

  // Daily summaries
  summaries: {
    getPending: () => ipcRenderer.invoke('summaries:get-pending'),
    getByRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('summaries:get-by-range', startDate, endDate),
  },

  // Adjustments
  adjustments: {
    analyze: () => ipcRenderer.invoke('adjustments:analyze'),
    apply: (adjustments: any[]) => ipcRenderer.invoke('adjustments:apply', adjustments),
    analyzeDay: (date: string) => ipcRenderer.invoke('adjustments:analyze-day', date),
    applyDay: (date: string) => ipcRenderer.invoke('adjustments:apply-day', date),
    getMaxHours: () => ipcRenderer.invoke('adjustments:get-max-hours'),
    onPending: (callback: (adjustments: any[]) => void) => {
      ipcRenderer.on('adjustments-pending', (_, adjustments) => callback(adjustments));
    },
  },

  // Tempo
  tempo: {
    sendWorklog: (worklog: any) => ipcRenderer.invoke('tempo:send-worklog', worklog),
    sendDay: (date: string) => ipcRenderer.invoke('tempo:send-day', date),
  },

  // Recent issues
  recent: {
    get: () => ipcRenderer.invoke('recent:get'),
  },

  // Favorite tasks
  favorites: {
    get: () => ipcRenderer.invoke('favorites:get'),
    add: (task: { issueKey: string; issueTitle: string; issueType: string; position: number }) =>
      ipcRenderer.invoke('favorites:add', task),
    remove: (issueKey: string) => ipcRenderer.invoke('favorites:remove', issueKey),
    isFavorite: (issueKey: string) => ipcRenderer.invoke('favorites:is-favorite', issueKey),
    updatePosition: (issueKey: string, position: number) =>
      ipcRenderer.invoke('favorites:update-position', issueKey, position),
  },

  // Keyboard shortcuts
  shortcuts: {
    get: () => ipcRenderer.invoke('shortcuts:get'),
    add: (shortcut: { accelerator: string; issueKey: string; issueTitle: string; issueType: string; enabled: boolean }) =>
      ipcRenderer.invoke('shortcuts:add', shortcut),
    remove: (accelerator: string) => ipcRenderer.invoke('shortcuts:remove', accelerator),
    update: (accelerator: string, updates: any) =>
      ipcRenderer.invoke('shortcuts:update', accelerator, updates),
    validate: (accelerator: string) => ipcRenderer.invoke('shortcuts:validate', accelerator),
  },

  // UI events
  on: {
    showTaskSelector: (callback: () => void) => {
      ipcRenderer.on('show-task-selector', () => callback());
    },
  },

  // Reminder window
  reminderAction: (action: string) => ipcRenderer.invoke('reminder:action', action),
});
