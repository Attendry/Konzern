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
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    
    try {
      // Add cache-busting query parameter with timestamp and version
      const timestamp = Date.now();
      const version = '3.0';
      const cacheBuster = `?v=${version}&t=${timestamp}`;
      
      const response = await api.get(`/import/template${cacheBuster}`, {
        responseType: 'blob',
        // Note: Cache-busting is handled by query parameters (v and t)
        // Removing custom headers to avoid CORS preflight issues
      });
      url = window.URL.createObjectURL(new Blob([response.data]));
      link = document.createElement('a');
      link.href = url;
      // Include timestamp in filename to ensure unique downloads
      link.setAttribute('download', `Konsolidierung_Muster_v${version}_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
    } catch (error: any) {
      console.error('Fehler beim Download:', error);
      throw new Error(`Fehler beim Herunterladen der Vorlage: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      // Cleanup: always revoke URL and remove link to prevent memory leaks
      if (link && link.parentNode) {
        link.remove();
      }
      if (url) {
        window.URL.revokeObjectURL(url);
      }
    }
  },
};
