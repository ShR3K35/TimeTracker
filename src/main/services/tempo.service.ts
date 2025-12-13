import axios, { AxiosInstance } from 'axios';

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

export class TempoService {
  private client: AxiosInstance;
  private accountId: string;

  constructor(baseUrl: string, apiToken: string, accountId: string) {
    this.accountId = accountId;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async createWorklog(worklog: Omit<TempoWorklog, 'authorAccountId'>): Promise<TempoWorklogResponse> {
    try {
      const response = await this.client.post('/worklogs', {
        ...worklog,
        authorAccountId: this.accountId,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating worklog:', error.response?.data || error.message);
      throw new Error(`Failed to create worklog: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateWorklog(worklogId: number, worklog: Partial<TempoWorklog>): Promise<TempoWorklogResponse> {
    try {
      const response = await this.client.put(`/worklogs/${worklogId}`, worklog);
      return response.data;
    } catch (error: any) {
      console.error('Error updating worklog:', error.response?.data || error.message);
      throw new Error(`Failed to update worklog: ${error.response?.data?.message || error.message}`);
    }
  }

  async getWorklogs(startDate: string, endDate: string): Promise<TempoWorklogResponse[]> {
    try {
      const response = await this.client.get('/worklogs/user', {
        params: {
          from: startDate,
          to: endDate,
        },
      });
      return response.data.results || [];
    } catch (error: any) {
      console.error('Error fetching worklogs:', error.response?.data || error.message);
      throw new Error(`Failed to fetch worklogs: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteWorklog(worklogId: number): Promise<void> {
    try {
      await this.client.delete(`/worklogs/${worklogId}`);
    } catch (error: any) {
      console.error('Error deleting worklog:', error.response?.data || error.message);
      throw new Error(`Failed to delete worklog: ${error.response?.data?.message || error.message}`);
    }
  }
}
