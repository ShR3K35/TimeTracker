import axios, { AxiosInstance, AxiosError } from 'axios';

export interface JiraIssue {
  id: string;
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
      timeout: 10000, // 10 second timeout
    });
  }

  private handleError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data as any;

      console.error(`[JiraService] ${context}:`, {
        status,
        message: axiosError.message,
        data,
        url: axiosError.config?.url,
      });

      if (status === 401) {
        throw new Error('Authentification Jira échouée. Vérifiez votre email et token API.');
      } else if (status === 403) {
        throw new Error('Accès refusé. Vérifiez vos permissions Jira.');
      } else if (status === 404) {
        throw new Error('Ressource Jira non trouvée. Vérifiez l\'URL de base.');
      } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        throw new Error(`Impossible de se connecter à Jira (${this.baseUrl}). Vérifiez l'URL.`);
      } else if (axiosError.code === 'ETIMEDOUT') {
        throw new Error('Timeout lors de la connexion à Jira. Vérifiez votre connexion réseau.');
      } else if (data?.errorMessages && Array.isArray(data.errorMessages)) {
        throw new Error(`Erreur Jira: ${data.errorMessages.join(', ')}`);
      } else {
        throw new Error(`Erreur Jira (${status || 'unknown'}): ${axiosError.message}`);
      }
    }

    console.error(`[JiraService] ${context}:`, error);
    throw new Error(`Erreur inattendue: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get('/myself');
      return response.data;
    } catch (error) {
      this.handleError(error, 'getCurrentUser');
    }
  }

  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraSearchResponse> {
    try {
      const response = await this.client.post('/search/jql', {
        jql,
        maxResults,
        fields: ['summary', 'issuetype', 'status', 'parent'],
      });
      return response.data;
    } catch (error) {
      this.handleError(error, `searchIssues(jql: "${jql}")`);
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
      this.handleError(error, `getIssue(${issueKey})`);
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
    // Escape special characters in search text for JQL
    const escapedText = searchText.replace(/["\\']/g, '\\$&');
    const jql = `project = ${projectKey} AND (text ~ "${escapedText}" OR key = "${searchText.toUpperCase()}") ORDER BY updated DESC`;
    const result = await this.searchIssues(jql, 20);
    return result.issues;
  }
}
