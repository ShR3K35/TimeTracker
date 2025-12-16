"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected API to renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Configuration
    config: {
        get: (key) => electron_1.ipcRenderer.invoke('config:get', key),
        set: (key, value) => electron_1.ipcRenderer.invoke('config:set', key, value),
        initializeServices: (config) => electron_1.ipcRenderer.invoke('config:initialize-services', config),
    },
    // Timer
    timer: {
        start: (issueKey, issueTitle, issueType) => electron_1.ipcRenderer.invoke('timer:start', issueKey, issueTitle, issueType),
        stop: () => electron_1.ipcRenderer.invoke('timer:stop'),
        getState: () => electron_1.ipcRenderer.invoke('timer:get-state'),
        onStarted: (callback) => {
            electron_1.ipcRenderer.on('timer:started', (_, data) => callback(data));
        },
        onStopped: (callback) => {
            electron_1.ipcRenderer.on('timer:stopped', (_, data) => callback(data));
        },
        onTick: (callback) => {
            electron_1.ipcRenderer.on('timer:tick', (_, elapsedSeconds) => callback(elapsedSeconds));
        },
    },
    // Jira
    jira: {
        getRecentIssues: () => electron_1.ipcRenderer.invoke('jira:get-recent-issues'),
        searchIssues: (searchText) => electron_1.ipcRenderer.invoke('jira:search-issues', searchText),
        getIssue: (issueKey) => electron_1.ipcRenderer.invoke('jira:get-issue', issueKey),
    },
    // Work sessions
    sessions: {
        getByDate: (date) => electron_1.ipcRenderer.invoke('sessions:get-by-date', date),
        getByRange: (startDate, endDate) => electron_1.ipcRenderer.invoke('sessions:get-by-range', startDate, endDate),
        update: (id, updates) => electron_1.ipcRenderer.invoke('sessions:update', id, updates),
    },
    // Daily summaries
    summaries: {
        getPending: () => electron_1.ipcRenderer.invoke('summaries:get-pending'),
        getByRange: (startDate, endDate) => electron_1.ipcRenderer.invoke('summaries:get-by-range', startDate, endDate),
    },
    // Adjustments
    adjustments: {
        analyze: () => electron_1.ipcRenderer.invoke('adjustments:analyze'),
        apply: (adjustments) => electron_1.ipcRenderer.invoke('adjustments:apply', adjustments),
        onPending: (callback) => {
            electron_1.ipcRenderer.on('adjustments-pending', (_, adjustments) => callback(adjustments));
        },
    },
    // Tempo
    tempo: {
        sendWorklog: (worklog) => electron_1.ipcRenderer.invoke('tempo:send-worklog', worklog),
        sendDay: (date) => electron_1.ipcRenderer.invoke('tempo:send-day', date),
    },
    // Recent issues
    recent: {
        get: () => electron_1.ipcRenderer.invoke('recent:get'),
    },
    // Favorite tasks
    favorites: {
        get: () => electron_1.ipcRenderer.invoke('favorites:get'),
        add: (task) => electron_1.ipcRenderer.invoke('favorites:add', task),
        remove: (issueKey) => electron_1.ipcRenderer.invoke('favorites:remove', issueKey),
        isFavorite: (issueKey) => electron_1.ipcRenderer.invoke('favorites:is-favorite', issueKey),
        updatePosition: (issueKey, position) => electron_1.ipcRenderer.invoke('favorites:update-position', issueKey, position),
    },
    // Keyboard shortcuts
    shortcuts: {
        get: () => electron_1.ipcRenderer.invoke('shortcuts:get'),
        add: (shortcut) => electron_1.ipcRenderer.invoke('shortcuts:add', shortcut),
        remove: (accelerator) => electron_1.ipcRenderer.invoke('shortcuts:remove', accelerator),
        update: (accelerator, updates) => electron_1.ipcRenderer.invoke('shortcuts:update', accelerator, updates),
        validate: (accelerator) => electron_1.ipcRenderer.invoke('shortcuts:validate', accelerator),
    },
    // UI events
    on: {
        showTaskSelector: (callback) => {
            electron_1.ipcRenderer.on('show-task-selector', () => callback());
        },
    },
});
