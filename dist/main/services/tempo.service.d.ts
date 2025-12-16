export interface TempoWorklog {
    tempoWorklogId?: number;
    issueKey: string;
    timeSpentSeconds: number;
    startDate: string;
    startTime?: string;
    description?: string;
    authorAccountId: string;
}
export interface TempoWorklogResponse {
    self: string;
    tempoWorklogId: number;
    issueKey: string;
    timeSpentSeconds: number;
    startDate: string;
    startTime: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    author: {
        accountId: string;
        self: string;
    };
}
export declare class TempoService {
    private client;
    private accountId;
    private baseUrl;
    constructor(baseUrl: string, apiToken: string, accountId: string);
    private handleError;
    createWorklog(worklog: Omit<TempoWorklog, 'authorAccountId'>): Promise<TempoWorklogResponse>;
    updateWorklog(worklogId: number, worklog: Partial<TempoWorklog>): Promise<TempoWorklogResponse>;
    getWorklogs(startDate: string, endDate: string): Promise<TempoWorklogResponse[]>;
    deleteWorklog(worklogId: number): Promise<void>;
}
