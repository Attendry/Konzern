import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface FiscalYearAdjustment {
  id: string;
  companyId: string;
  companyName?: string;
  financialStatementId?: string;
  groupFinancialStatementId?: string;
  subsidiaryFiscalYearEnd: string;
  groupReportingDate: string;
  differenceDays: number;
  differenceMonths: number;
  adjustmentMethod: 'pro_rata' | 'interim_statement' | 'estimate' | 'none';
  isHgbCompliant: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';
  adjustmentEntries: any[];
  significantEvents: any[];
  justification?: string;
  hgbReference: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  differenceDays: number;
  differenceMonths: number;
  requiresAdjustment: boolean;
  hgbCompliant: boolean;
  message: string;
  recommendations: string[];
}

export interface CreateAdjustmentDto {
  companyId: string;
  financialStatementId?: string;
  groupFinancialStatementId?: string;
  subsidiaryFiscalYearEnd: string;
  groupReportingDate: string;
  adjustmentMethod: FiscalYearAdjustment['adjustmentMethod'];
  justification?: string;
  significantEvents?: any[];
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fiscalYearAdjustmentService = {
  /**
   * Validate date difference
   */
  async validateDateDifference(subsidiaryDate: string, groupDate: string): Promise<ValidationResult> {
    const response = await axios.post(
      `${API_BASE_URL}/fiscal-year-adjustments/validate`,
      { subsidiaryDate, groupDate },
      { headers: getAuthHeaders() },
    );
    return response.data.validation;
  },

  /**
   * Get companies with different fiscal years
   */
  async getCompaniesWithDifferences(
    parentCompanyId: string,
    groupReportingDate: string,
  ): Promise<{ company: any; validation: ValidationResult }[]> {
    const response = await axios.get(
      `${API_BASE_URL}/fiscal-year-adjustments/companies-with-differences`,
      {
        params: { parentCompanyId, groupReportingDate },
        headers: getAuthHeaders(),
      },
    );
    return response.data.results;
  },

  /**
   * Create adjustment
   */
  async create(dto: CreateAdjustmentDto): Promise<FiscalYearAdjustment> {
    const response = await axios.post(
      `${API_BASE_URL}/fiscal-year-adjustments`,
      dto,
      { headers: getAuthHeaders() },
    );
    return response.data.adjustment;
  },

  /**
   * Get adjustments by company
   */
  async getByCompany(companyId: string): Promise<FiscalYearAdjustment[]> {
    const response = await axios.get(
      `${API_BASE_URL}/fiscal-year-adjustments/company/${companyId}`,
      { headers: getAuthHeaders() },
    );
    return response.data.adjustments;
  },

  /**
   * Get adjustments by financial statement
   */
  async getByFinancialStatement(financialStatementId: string): Promise<FiscalYearAdjustment[]> {
    const response = await axios.get(
      `${API_BASE_URL}/fiscal-year-adjustments/financial-statement/${financialStatementId}`,
      { headers: getAuthHeaders() },
    );
    return response.data.adjustments;
  },

  /**
   * Get adjustment by ID
   */
  async getById(id: string): Promise<FiscalYearAdjustment> {
    const response = await axios.get(
      `${API_BASE_URL}/fiscal-year-adjustments/${id}`,
      { headers: getAuthHeaders() },
    );
    return response.data.adjustment;
  },

  /**
   * Update adjustment
   */
  async update(id: string, updates: Partial<CreateAdjustmentDto>): Promise<FiscalYearAdjustment> {
    const response = await axios.put(
      `${API_BASE_URL}/fiscal-year-adjustments/${id}`,
      updates,
      { headers: getAuthHeaders() },
    );
    return response.data.adjustment;
  },

  /**
   * Calculate pro-rata adjustments
   */
  async calculateProRata(id: string, financialStatementId: string): Promise<any[]> {
    const response = await axios.post(
      `${API_BASE_URL}/fiscal-year-adjustments/${id}/calculate-pro-rata`,
      { financialStatementId },
      { headers: getAuthHeaders() },
    );
    return response.data.entries;
  },

  /**
   * Approve adjustment
   */
  async approve(id: string): Promise<FiscalYearAdjustment> {
    const response = await axios.post(
      `${API_BASE_URL}/fiscal-year-adjustments/${id}/approve`,
      {},
      { headers: getAuthHeaders() },
    );
    return response.data.adjustment;
  },

  /**
   * Delete adjustment
   */
  async delete(id: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/fiscal-year-adjustments/${id}`,
      { headers: getAuthHeaders() },
    );
  },
};

export default fiscalYearAdjustmentService;
