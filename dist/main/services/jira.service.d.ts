export interface JiraIssue {
    key: string;
    fields: {
        summary: string;
        issuetype: {
            name: string;
        };
        status: {
            name: string;
        };
        parent?: {
            key: string;
            fields: {
                summary: string;
            };
        };
    };
}
export interface JiraSearchResponse {
    issues: JiraIssue[];
    total: number;
}
export declare class JiraService {
    private client;
    private baseUrl;
    constructor(baseUrl: string, email: string, apiToken: string);
    private handleError;
    getCurrentUser(): Promise<any>;
    searchIssues(jql: string, maxResults?: number): Promise<JiraSearchResponse>;
    getIssue(issueKey: string): Promise<JiraIssue>;
    getRecentIssues(projectKey: string, userEmail: string): Promise<JiraIssue[]>;
    getAssignedIssues(projectKey: string): Promise<JiraIssue[]>;
    searchIssuesByText(projectKey: string, searchText: string): Promise<JiraIssue[]>;
}
