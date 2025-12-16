"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempoService = void 0;
const axios_1 = __importDefault(require("axios"));
class TempoService {
    constructor(baseUrl, apiToken, accountId) {
        this.baseUrl = baseUrl;
        this.accountId = accountId;
        this.client = axios_1.default.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Bearer ${apiToken}`,
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
            console.error(`[TempoService] ${context}:`, {
                status,
                message: axiosError.message,
                data,
                url: axiosError.config?.url,
            });
            if (status === 401) {
                throw new Error('Authentification Tempo échouée. Vérifiez votre token API Tempo.');
            }
            else if (status === 403) {
                throw new Error('Accès refusé à Tempo. Vérifiez vos permissions.');
            }
            else if (status === 404) {
                throw new Error('Ressource Tempo non trouvée. Vérifiez l\'URL de l\'API.');
            }
            else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
                throw new Error(`Impossible de se connecter à Tempo (${this.baseUrl}). Vérifiez l'URL.`);
            }
            else if (axiosError.code === 'ETIMEDOUT') {
                throw new Error('Timeout lors de la connexion à Tempo. Vérifiez votre connexion réseau.');
            }
            else if (data?.errors && Array.isArray(data.errors)) {
                const errorMessages = data.errors.map((e) => e.message || e).join(', ');
                throw new Error(`Erreur Tempo: ${errorMessages}`);
            }
            else if (data?.message) {
                throw new Error(`Erreur Tempo: ${data.message}`);
            }
            else {
                throw new Error(`Erreur Tempo (${status || 'unknown'}): ${axiosError.message}`);
            }
        }
        console.error(`[TempoService] ${context}:`, error);
        throw new Error(`Erreur inattendue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    async createWorklog(worklog) {
        try {
            const response = await this.client.post('/worklogs', {
                ...worklog,
                authorAccountId: this.accountId,
            });
            return response.data;
        }
        catch (error) {
            this.handleError(error, 'createWorklog');
        }
    }
    async updateWorklog(worklogId, worklog) {
        try {
            const response = await this.client.put(`/worklogs/${worklogId}`, worklog);
            return response.data;
        }
        catch (error) {
            this.handleError(error, `updateWorklog(${worklogId})`);
        }
    }
    async getWorklogs(startDate, endDate) {
        try {
            const response = await this.client.get('/worklogs/user', {
                params: {
                    from: startDate,
                    to: endDate,
                },
            });
            return response.data.results || [];
        }
        catch (error) {
            this.handleError(error, `getWorklogs(${startDate}, ${endDate})`);
        }
    }
    async deleteWorklog(worklogId) {
        try {
            await this.client.delete(`/worklogs/${worklogId}`);
        }
        catch (error) {
            this.handleError(error, `deleteWorklog(${worklogId})`);
        }
    }
}
exports.TempoService = TempoService;
