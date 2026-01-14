import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface GoodwillSchedule {
  id: string;
  subsidiaryCompanyId: string;
  subsidiaryCompanyName?: string;
  parentCompanyId: string;
  parentCompanyName?: string;
  participationId?: string;
  initialGoodwill: number;
  acquisitionDate?: string;
  usefulLifeYears: number;
  amortizationMethod: 'linear' | 'declining' | 'custom';
  accumulatedAmortization: number;
  remainingGoodwill: number;
  annualAmortization: number;
  impairmentAmount: number;
  impairmentDate?: string;
  impairmentReason?: string;
  hgbReference: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AmortizationEntry {
  id: string;
  scheduleId: string;
  financialStatementId?: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  amortizationAmount: number;
  impairmentAmount: number;
  closingBalance: number;
  consolidationEntryId?: string;
  isBooked: boolean;
  bookedAt?: string;
  createdAt: string;
}

export interface CreateScheduleDto {
  subsidiaryCompanyId: string;
  parentCompanyId: string;
  participationId?: string;
  initialGoodwill: number;
  acquisitionDate?: string;
  usefulLifeYears?: number;
  amortizationMethod?: GoodwillSchedule['amortizationMethod'];
  notes?: string;
}

export interface GoodwillSummary {
  totalInitialGoodwill: number;
  totalAccumulatedAmortization: number;
  totalImpairment: number;
  totalRemainingGoodwill: number;
  scheduleCount: number;
  schedules: GoodwillSchedule[];
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const goodwillService = {
  // ==================== SCHEDULES ====================

  /**
   * Create a new schedule
   */
  async createSchedule(dto: CreateScheduleDto): Promise<GoodwillSchedule> {
    const response = await axios.post(
      `${API_BASE_URL}/goodwill/schedules`,
      dto,
      { headers: getAuthHeaders() },
    );
    return response.data.schedule;
  },

  /**
   * Get schedules by parent company
   */
  async getSchedulesByParent(parentCompanyId: string): Promise<GoodwillSchedule[]> {
    const response = await axios.get(
      `${API_BASE_URL}/goodwill/schedules/parent/${parentCompanyId}`,
      { headers: getAuthHeaders() },
    );
    return response.data.schedules;
  },

  /**
   * Get schedule by ID
   */
  async getScheduleById(id: string): Promise<GoodwillSchedule> {
    const response = await axios.get(
      `${API_BASE_URL}/goodwill/schedules/${id}`,
      { headers: getAuthHeaders() },
    );
    return response.data.schedule;
  },

  /**
   * Update schedule
   */
  async updateSchedule(id: string, updates: Partial<CreateScheduleDto>): Promise<GoodwillSchedule> {
    const response = await axios.put(
      `${API_BASE_URL}/goodwill/schedules/${id}`,
      updates,
      { headers: getAuthHeaders() },
    );
    return response.data.schedule;
  },

  /**
   * Record impairment
   */
  async recordImpairment(
    id: string,
    amount: number,
    reason: string,
    date?: string,
  ): Promise<GoodwillSchedule> {
    const response = await axios.post(
      `${API_BASE_URL}/goodwill/schedules/${id}/impairment`,
      { amount, reason, date },
      { headers: getAuthHeaders() },
    );
    return response.data.schedule;
  },

  /**
   * Get amortization projection
   */
  async getProjection(id: string, years?: number): Promise<any[]> {
    const response = await axios.get(
      `${API_BASE_URL}/goodwill/schedules/${id}/projection`,
      {
        params: { years },
        headers: getAuthHeaders(),
      },
    );
    return response.data.projection;
  },

  // ==================== ENTRIES ====================

  /**
   * Create amortization entry
   */
  async createEntry(dto: {
    scheduleId: string;
    financialStatementId?: string;
    fiscalYear: number;
    periodStart: string;
    periodEnd: string;
  }): Promise<AmortizationEntry> {
    const response = await axios.post(
      `${API_BASE_URL}/goodwill/entries`,
      dto,
      { headers: getAuthHeaders() },
    );
    return response.data.entry;
  },

  /**
   * Get entries by schedule
   */
  async getEntriesBySchedule(scheduleId: string): Promise<AmortizationEntry[]> {
    const response = await axios.get(
      `${API_BASE_URL}/goodwill/entries/schedule/${scheduleId}`,
      { headers: getAuthHeaders() },
    );
    return response.data.entries;
  },

  /**
   * Book amortization entry
   */
  async bookEntry(
    id: string,
    financialStatementId: string,
  ): Promise<{ entry: AmortizationEntry; consolidationEntryId: string }> {
    const response = await axios.post(
      `${API_BASE_URL}/goodwill/entries/${id}/book`,
      { financialStatementId },
      { headers: getAuthHeaders() },
    );
    return response.data;
  },

  // ==================== SUMMARY ====================

  /**
   * Get goodwill summary for parent company
   */
  async getSummary(parentCompanyId: string): Promise<GoodwillSummary> {
    const response = await axios.get(
      `${API_BASE_URL}/goodwill/summary/${parentCompanyId}`,
      { headers: getAuthHeaders() },
    );
    return response.data.summary;
  },
};

export default goodwillService;
