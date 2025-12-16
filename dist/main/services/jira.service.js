"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraService = void 0;
const axios_1 = __importDefault(require("axios"));
class JiraService {
    constructor(baseUrl, email, apiToken) {
        this.baseUrl = baseUrl;
        this.client = axios_1.default.create({
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
    handleError(error, context) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            const data = axiosError.response?.data;
            console.error(`[JiraService] ${context}:`, {
                status,
                message: axiosError.message,
                data,
                url: axiosError.config?.url,
            });
            if (status === 401) {
                throw new Error('Authentification Jira échouée. Vérifiez votre email et token API.');
            }
            else if (status === 403) {
                throw new Error('Accès refusé. Vérifiez vos permissions Jira.');
            }
            else if (status === 404) {
                throw new Error('Ressource Jira non trouvée. Vérifiez l\'URL de base.');
            }
            else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
                throw new Error(`Impossible de se connecter à Jira (${this.baseUrl}). Vérifiez l'URL.`);
            }
            else if (axiosError.code === 'ETIMEDOUT') {
                throw new Error('Timeout lors de la connexion à Jira. Vérifiez votre connexion réseau.');
            }
            else if (data?.errorMessages && Array.isArray(data.errorMessages)) {
                throw new Error(`Erreur Jira: ${data.errorMessages.join(', ')}`);
            }
            else {
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
        }
        catch (error) {
            this.handleError(error, 'getCurrentUser');
        }
    }
    async searchIssues(jql, maxResults = 50) {
        try {
            const response = await this.client.get('/search', {
                params: {
                    jql,
                    maxResults,
                    fields: 'summary,issuetype,status,parent',
                },
            });
            return response.data;
        }
        catch (error) {
            this.handleError(error, `searchIssues(jql: "${jql}")`);
        }
    }
    async getIssue(issueKey) {
        try {
            const response = await this.client.get(`/issue/${issueKey}`, {
                params: {
                    fields: 'summary,issuetype,status,parent',
                },
            });
            return response.data;
        }
        catch (error) {
            this.handleError(error, `getIssue(${issueKey})`);
        }
    }
    async getRecentIssues(projectKey, userEmail) {
        const jql = `project = ${projectKey} AND (assignee = currentUser() OR watcher = currentUser() OR creator = currentUser()) ORDER BY updated DESC`;
        const result = await this.searchIssues(jql, 20);
        return result.issues;
    }
    async getAssignedIssues(projectKey) {
        const jql = `project = ${projectKey} AND assignee = currentUser() AND status != Done ORDER BY updated DESC`;
        const result = await this.searchIssues(jql, 50);
        return result.issues;
    }
    async searchIssuesByText(projectKey, searchText) {
        // Escape special characters in search text for JQL
        const escapedText = searchText.replace(/["\\']/g, '\\$&');
        const jql = `project = ${projectKey} AND (text ~ "${escapedText}" OR key = "${searchText.toUpperCase()}") ORDER BY updated DESC`;
        const result = await this.searchIssues(jql, 20);
        return result.issues;
    }
}
exports.JiraService = JiraService;
