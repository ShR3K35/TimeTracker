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
    start: (issueKey: string, issueTitle: string, issueType: string, activityId?: number, activityName?: string, activityValue?: string) =>
      ipcRenderer.invoke('timer:start', issueKey, issueTitle, issueType, activityId, activityName, activityValue),
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
    updateGroupActivity: (date: string, issueKey: string, oldActivityId: number | null, newActivityId: number | null, newActivityName: string | null, newActivityValue: string | null) =>
      ipcRenderer.invoke('sessions:update-group-activity', date, issueKey, oldActivityId, newActivityId, newActivityName, newActivityValue),
    createManual: (data: {
      date: string;
      issueKey: string;
      issueTitle: string;
      issueType: string;
      durationSeconds: number;
      activityId: number | null;
      activityName: string | null;
      activityValue: string | null;
    }) => ipcRenderer.invoke('sessions:create-manual', data),
    deleteGroup: (date: string, issueKey: string, activityId: number | null) =>
      ipcRenderer.invoke('sessions:delete-group', date, issueKey, activityId),
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
    reopenDay: (date: string) => ipcRenderer.invoke('adjustments:reopen-day', date),
    updateTaskDuration: (date: string, issueKey: string, durationSeconds: number, activityId?: number | null) =>
      ipcRenderer.invoke('adjustments:update-task-duration', date, issueKey, durationSeconds, activityId),
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

  // Tempo Activities
  activities: {
    get: () => ipcRenderer.invoke('activities:get'),
    getDefault: () => ipcRenderer.invoke('activities:get-default'),
    add: (activity: { tempo_id: number; name: string; value: string; position: number }) =>
      ipcRenderer.invoke('activities:add', activity),
    remove: (tempoId: number) => ipcRenderer.invoke('activities:remove', tempoId),
    reorder: (activities: { tempo_id: number; position: number }[]) =>
      ipcRenderer.invoke('activities:reorder', activities),
  },
});
