import api from './api';

export interface ImportResult {
  imported: number;
  errors: string[];
  warnings?: string[];
}

export const importService = {
  importExcel: async (
    file: File,
    financialStatementId: string,
    sheetName?: string,
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('financialStatementId', financialStatementId);
    formData.append('fileType', 'excel');
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }

    // WICHTIG: Content-Type nicht explizit setzen - axios setzt es automatisch mit boundary
    const response = await api.post<ImportResult>('/import/excel', formData);
    return response.data;
  },

  importCsv: async (
    file: File,
    financialStatementId: string,
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('financialStatementId', financialStatementId);
    formData.append('fileType', 'csv');

    // WICHTIG: Content-Type nicht explizit setzen - axios setzt es automatisch mit boundary
    const response = await api.post<ImportResult>('/import/csv', formData);
    return response.data;
  },

  downloadTemplate: async (): Promise<void> => {
    try {
      const response = await api.get('/import/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Konsolidierung_Muster_v3.0.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Fehler beim Download:', error);
      throw new Error(`Fehler beim Herunterladen der Vorlage: ${error.message || 'Unbekannter Fehler'}`);
    }
  },
};
