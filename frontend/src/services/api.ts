import axios from 'axios';

// In development, use relative URL to leverage Vite proxy (avoids CORS)
// In production, use absolute URL from env or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '/api' : 'http://localhost:3000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 Sekunden Timeout
});

// Request Interceptor für Debugging und Content-Type
api.interceptors.request.use(
  (config) => {
    const fullUrl = config.baseURL && config.url 
      ? `${config.baseURL}${config.url}` 
      : config.url || 'unknown';
    console.log(`[API] ${config.method?.toUpperCase()} ${fullUrl}`);
    
    // Setze Content-Type nur für JSON-Requests, nicht für FormData
    if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    // Für FormData wird axios automatisch den richtigen Content-Type mit boundary setzen
    
    return config;
  },
  (error) => {
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor für Fehlerbehandlung
api.interceptors.response.use(
  (response) => {
    const fullUrl = response.config.baseURL && response.config.url 
      ? `${response.config.baseURL}${response.config.url}` 
      : response.config.url || 'unknown';
    console.log(`[API] ${response.config.method?.toUpperCase()} ${fullUrl} - ${response.status}`);
    return response;
  },
  (error) => {
    const fullUrl = error.config?.baseURL && error.config?.url 
      ? `${error.config.baseURL}${error.config.url}` 
      : error.config?.url || 'unknown';
    
    if (error.code === 'ECONNABORTED' || error.message === 'timeout of 30000ms exceeded') {
      console.error(`[API] Request Timeout: ${error.config?.method?.toUpperCase()} ${fullUrl}`);
      error.message = 'Request timeout - Der Server antwortet nicht. Bitte prüfen Sie, ob das Backend läuft.';
    } else if (error.response) {
      // Server hat geantwortet, aber mit Fehlerstatus
      console.error(`[API] Response Error: ${error.config?.method?.toUpperCase()} ${fullUrl} - ${error.response.status}`, error.response.data);
    } else if (error.request) {
      // Request wurde gesendet, aber keine Antwort erhalten
      console.error(`[API] No Response: ${error.config?.method?.toUpperCase()} ${fullUrl}`, error.request);
      error.message = 'Keine Antwort vom Server. Bitte prüfen Sie, ob das Backend läuft und erreichbar ist.';
    } else {
      // Fehler beim Erstellen des Requests
      console.error('[API] Request Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
