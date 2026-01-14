import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface ReportSection {
  title: string;
  content: string;
  order: number;
  generatedContent?: string;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
}

export interface ManagementReport {
  id: string;
  financialStatementId: string;
  reportTitle: string;
  fiscalYear: number;
  reportDate: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
  sections: Record<string, ReportSection>;
  keyFigures: Record<string, any>;
  generatedContent: Record<string, string>;
  hgbReference: string;
  createdByUserId?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportDto {
  financialStatementId: string;
  reportTitle?: string;
  fiscalYear: number;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const managementReportService = {
  /**
   * Create a new report
   */
  async create(dto: CreateReportDto): Promise<ManagementReport> {
    const response = await axios.post(
      `${API_BASE_URL}/management-reports`,
      dto,
      { headers: getAuthHeaders() },
    );
    return response.data.report;
  },

  /**
   * Get all reports
   */
  async getAll(): Promise<ManagementReport[]> {
    const response = await axios.get(
      `${API_BASE_URL}/management-reports`,
      { headers: getAuthHeaders() },
    );
    return response.data.reports;
  },

  /**
   * Get report by ID
   */
  async getById(id: string): Promise<ManagementReport> {
    const response = await axios.get(
      `${API_BASE_URL}/management-reports/${id}`,
      { headers: getAuthHeaders() },
    );
    return response.data.report;
  },

  /**
   * Get report by financial statement
   */
  async getByFinancialStatement(financialStatementId: string): Promise<ManagementReport | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/management-reports/financial-statement/${financialStatementId}`,
        { headers: getAuthHeaders() },
      );
      return response.data.report;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Update a section
   */
  async updateSection(
    id: string,
    sectionKey: string,
    content: string,
  ): Promise<ManagementReport> {
    const response = await axios.put(
      `${API_BASE_URL}/management-reports/${id}/sections`,
      { sectionKey, content },
      { headers: getAuthHeaders() },
    );
    return response.data.report;
  },

  /**
   * Generate key figures
   */
  async generateKeyFigures(
    id: string,
    financialStatementId: string,
  ): Promise<Record<string, any>> {
    const response = await axios.post(
      `${API_BASE_URL}/management-reports/${id}/generate-key-figures`,
      { financialStatementId },
      { headers: getAuthHeaders() },
    );
    return response.data.keyFigures;
  },

  /**
   * Generate content suggestions
   */
  async generateSuggestions(id: string): Promise<Record<string, string>> {
    const response = await axios.post(
      `${API_BASE_URL}/management-reports/${id}/generate-suggestions`,
      {},
      { headers: getAuthHeaders() },
    );
    return response.data.suggestions;
  },

  /**
   * Submit for review
   */
  async submitForReview(id: string): Promise<ManagementReport> {
    const response = await axios.post(
      `${API_BASE_URL}/management-reports/${id}/submit-for-review`,
      {},
      { headers: getAuthHeaders() },
    );
    return response.data.report;
  },

  /**
   * Approve report
   */
  async approve(id: string): Promise<ManagementReport> {
    const response = await axios.post(
      `${API_BASE_URL}/management-reports/${id}/approve`,
      {},
      { headers: getAuthHeaders() },
    );
    return response.data.report;
  },

  /**
   * Publish report
   */
  async publish(id: string): Promise<ManagementReport> {
    const response = await axios.post(
      `${API_BASE_URL}/management-reports/${id}/publish`,
      {},
      { headers: getAuthHeaders() },
    );
    return response.data.report;
  },

  /**
   * Get versions
   */
  async getVersions(id: string): Promise<any[]> {
    const response = await axios.get(
      `${API_BASE_URL}/management-reports/${id}/versions`,
      { headers: getAuthHeaders() },
    );
    return response.data.versions;
  },

  /**
   * Export report
   */
  async exportReport(id: string): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/management-reports/${id}/export`,
      { headers: getAuthHeaders() },
    );
    return response.data.data;
  },
};

export default managementReportService;
