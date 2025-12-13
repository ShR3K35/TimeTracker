export interface ElectronAPI {
  config: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    initializeServices: (config: {
      jiraBaseUrl: string;
      jiraEmail: string;
      jiraToken: string;
      tempoApiUrl: string;
      tempoToken: string;
      tempoAccountId: string;
    }) => Promise<{ success: boolean; error?: string }>;
  };

  timer: {
    start: (issueKey: string, issueTitle: string, issueType: string) => Promise<{ sessionId: number }>;
    stop: () => Promise<void>;
    getState: () => Promise<{
      isRunning: boolean;
      currentSession: any | null;
      elapsedSeconds: number;
      startTime: Date | null;
    }>;
    onStarted: (callback: (data: any) => void) => void;
    onStopped: (callback: (data: any) => void) => void;
    onTick: (callback: (elapsedSeconds: number) => void) => void;
  };

  jira: {
    getRecentIssues: () => Promise<any[]>;
    searchIssues: (searchText: string) => Promise<any[]>;
    getIssue: (issueKey: string) => Promise<any>;
  };

  sessions: {
    getByDate: (date: string) => Promise<any[]>;
    getByRange: (startDate: string, endDate: string) => Promise<any[]>;
    update: (id: number, updates: any) => Promise<void>;
  };

  summaries: {
    getPending: () => Promise<any[]>;
    getByRange: (startDate: string, endDate: string) => Promise<any[]>;
  };

  adjustments: {
    analyze: () => Promise<any[]>;
    apply: (adjustments: any[]) => Promise<void>;
    onPending: (callback: (adjustments: any[]) => void) => void;
  };

  tempo: {
    sendWorklog: (worklog: any) => Promise<any>;
    sendDay: (date: string) => Promise<any[]>;
  };

  recent: {
    get: () => Promise<any[]>;
  };

  on: {
    showTaskSelector: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
