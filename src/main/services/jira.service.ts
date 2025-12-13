import axios, { AxiosInstance } from 'axios';

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

export class JiraService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: `${baseUrl}/rest/api/3`,
      auth: {
        username: email,
        password: apiToken,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get('/myself');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw new Error('Failed to authenticate with Jira');
    }
  }

  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraSearchResponse> {
    try {
      const response = await this.client.get('/search', {
        params: {
          jql,
          maxResults,
          fields: 'summary,issuetype,status,parent',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching issues:', error);
      throw new Error('Failed to search Jira issues');
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/issue/${issueKey}`, {
        params: {
          fields: 'summary,issuetype,status,parent',
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching issue ${issueKey}:`, error);
      throw new Error(`Failed to fetch issue ${issueKey}`);
    }
  }

  async getRecentIssues(projectKey: string, userEmail: string): Promise<JiraIssue[]> {
    const jql = `project = ${projectKey} AND (assignee = currentUser() OR watcher = currentUser() OR creator = currentUser()) ORDER BY updated DESC`;
    const result = await this.searchIssues(jql, 20);
    return result.issues;
  }

  async getAssignedIssues(projectKey: string): Promise<JiraIssue[]> {
    const jql = `project = ${projectKey} AND assignee = currentUser() AND status != Done ORDER BY updated DESC`;
    const result = await this.searchIssues(jql, 50);
    return result.issues;
  }

  async searchIssuesByText(projectKey: string, searchText: string): Promise<JiraIssue[]> {
    const jql = `project = ${projectKey} AND (text ~ "${searchText}" OR key = "${searchText.toUpperCase()}") ORDER BY updated DESC`;
    const result = await this.searchIssues(jql, 20);
    return result.issues;
  }
}
