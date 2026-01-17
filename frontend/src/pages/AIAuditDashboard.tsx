import { useState, useEffect } from 'react';
import aiAuditService, { TrendDataPoint, ToolUsageData } from '../services/aiAuditService';
import type { AuditStatistics } from '../types/agent.types';
import { getConfidenceLevel } from '../types/agent.types';
import { BackButton } from '../components/BackButton';
import './AIAuditDashboard.css';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Icon components
const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const GaugeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2a10 10 0 1 0 10 10" />
    <path d="M12 12l5-5" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const AIAuditDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: end };
  });

  const [stats, setStats] = useState<AuditStatistics | null>(null);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsData, trendData, toolData] = await Promise.all([
        aiAuditService.getStatistics(dateRange.startDate, dateRange.endDate),
        aiAuditService.getTrend(dateRange.startDate, dateRange.endDate),
        aiAuditService.getToolUsage(dateRange.startDate, dateRange.endDate),
      ]);

      setStats(statsData);
      setTrend(trendData);
      setToolUsage(toolData);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await aiAuditService.downloadAuditLogExcel(dateRange.startDate, dateRange.endDate);
    } catch (err: any) {
      setError('Export fehlgeschlagen: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportOverrides = async () => {
    setExporting(true);
    try {
      await aiAuditService.downloadOverrideLogExcel(dateRange.startDate, dateRange.endDate);
    } catch (err: any) {
      setError('Export fehlgeschlagen: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await aiAuditService.downloadAuditLogCSV(dateRange.startDate, dateRange.endDate);
    } catch (err: any) {
      setError('Export fehlgeschlagen: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="audit-dashboard">
        <div className="loading">Lade AI-Nutzungsdaten...</div>
      </div>
    );
  }

  return (
    <div className="audit-dashboard">
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <BackButton />
      </div>
      <header className="audit-header">
        <h1>AI-Nutzungsprotokoll</h1>
        <p className="audit-subtitle">Übersicht der AI-Agent Interaktionen und Entscheidungen</p>
      </header>

      {/* Date Range Selector */}
      <div className="date-range-selector">
        <label>
          Von:
          <input
            type="date"
            value={dateRange.startDate.toISOString().split('T')[0]}
            onChange={(e) => setDateRange({
              ...dateRange,
              startDate: new Date(e.target.value),
            })}
          />
        </label>
        <label>
          Bis:
          <input
            type="date"
            value={dateRange.endDate.toISOString().split('T')[0]}
            onChange={(e) => setDateRange({
              ...dateRange,
              endDate: new Date(e.target.value),
            })}
          />
        </label>
        <button className="refresh-btn" onClick={loadData}>
          <RefreshIcon /> Aktualisieren
        </button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <StatCard
              title="Gesamt-Interaktionen"
              value={stats.totalInteractions}
              icon={<ChatIcon />}
            />
            <StatCard
              title="Akzeptanzrate"
              value={`${Math.round((stats.byDecision.accept / Math.max(stats.totalInteractions, 1)) * 100)}%`}
              icon={<CheckIcon />}
              color="green"
            />
            <StatCard
              title="Override-Rate"
              value={`${Math.round(stats.overrideRate * 100)}%`}
              icon={<RefreshIcon />}
              color={stats.overrideRate > 0.3 ? 'red' : 'neutral'}
            />
            <StatCard
              title="Ø Konfidenz"
              value={`${Math.round(stats.averageConfidence * 100)}%`}
              icon={<GaugeIcon />}
              confidenceLevel={getConfidenceLevel(stats.averageConfidence)}
            />
          </div>

          {/* Decision Breakdown */}
          <div className="charts-row">
            <div className="chart-card">
              <h3>Entscheidungen</h3>
              <div className="decision-breakdown">
                <DecisionBar
                  label="Akzeptiert"
                  count={stats.byDecision.accept}
                  total={stats.totalInteractions}
                  color="#22c55e"
                />
                <DecisionBar
                  label="Abgelehnt"
                  count={stats.byDecision.reject}
                  total={stats.totalInteractions}
                  color="#ef4444"
                />
                <DecisionBar
                  label="Modifiziert"
                  count={stats.byDecision.modify}
                  total={stats.totalInteractions}
                  color="#f59e0b"
                />
                <DecisionBar
                  label="Ignoriert"
                  count={stats.byDecision.ignore}
                  total={stats.totalInteractions}
                  color="#9ca3af"
                />
              </div>
            </div>

            <div className="chart-card">
              <h3>Tool-Nutzung</h3>
              <div className="tool-usage">
                {toolUsage.map((tool) => (
                  <div key={tool.tool} className="tool-item">
                    <div className="tool-label">{tool.label}</div>
                    <div className="tool-bar-container">
                      <div
                        className="tool-bar"
                        style={{
                          width: `${(tool.count / Math.max(stats.totalInteractions, 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="tool-count">{tool.count}</div>
                  </div>
                ))}
                {toolUsage.length === 0 && (
                  <p className="no-data">Keine Tool-Nutzung im Zeitraum</p>
                )}
              </div>
            </div>
          </div>

          {/* Trend Chart (Simple) */}
          <div className="chart-card full-width">
            <h3>Verlauf (letzte {trend.length} Tage)</h3>
            <div className="trend-chart">
              {trend.length > 0 ? (
                <div className="trend-bars">
                  {trend.map((day) => (
                    <div key={day.date} className="trend-day">
                      <div className="trend-bar-stack">
                        <div
                          className="trend-bar accept"
                          style={{
                            height: `${(day.accept / Math.max(...trend.map(t => t.total), 1)) * 100}%`,
                          }}
                          title={`Akzeptiert: ${day.accept}`}
                        />
                        <div
                          className="trend-bar reject"
                          style={{
                            height: `${(day.reject / Math.max(...trend.map(t => t.total), 1)) * 100}%`,
                          }}
                          title={`Abgelehnt: ${day.reject}`}
                        />
                      </div>
                      <div className="trend-date">
                        {new Date(day.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">Keine Daten im ausgewählten Zeitraum</p>
              )}
            </div>
          </div>

          {/* Compliance Indicators */}
          <div className="chart-card full-width">
            <h3>Compliance-Indikatoren</h3>
            <div className="compliance-grid">
              <div className="compliance-item">
                <div className="compliance-label">Interaktionen mit niedriger Konfidenz</div>
                <div className={`compliance-value ${stats.lowConfidenceInteractions > 0 ? 'warning' : 'ok'}`}>
                  {stats.lowConfidenceInteractions}
                </div>
              </div>
              <div className="compliance-item">
                <div className="compliance-label">Overrides ohne Begründung</div>
                <div className={`compliance-value ${stats.missingReasoningCount > 0 ? 'error' : 'ok'}`}>
                  {stats.missingReasoningCount}
                </div>
              </div>
              <div className="compliance-item">
                <div className="compliance-label">Aktive Benutzer</div>
                <div className="compliance-value">
                  {stats.byUser.length}
                </div>
              </div>
              <div className="compliance-item">
                <div className="compliance-label">Verschiedene Tools genutzt</div>
                <div className="compliance-value">
                  {Object.keys(stats.byTool).length}
                </div>
              </div>
            </div>
          </div>

          {/* User Breakdown */}
          {stats.byUser.length > 0 && (
            <div className="chart-card full-width">
              <h3>Nach Benutzer</h3>
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Benutzer</th>
                    <th>Interaktionen</th>
                    <th>Akzeptanzrate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byUser.slice(0, 10).map((user) => (
                    <tr key={user.userId}>
                      <td>{user.userName || user.userId.substring(0, 8) + '...'}</td>
                      <td>{user.interactions}</td>
                      <td>
                        <span className={`rate-badge ${user.acceptRate > 0.7 ? 'high' : user.acceptRate > 0.4 ? 'medium' : 'low'}`}>
                          {Math.round(user.acceptRate * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Export Buttons */}
      <div className="export-actions">
        <button
          className="export-btn primary"
          onClick={handleExportExcel}
          disabled={exporting}
        >
          <DownloadIcon /> Vollständiges Protokoll (Excel)
        </button>
        <button
          className="export-btn secondary"
          onClick={handleExportOverrides}
          disabled={exporting}
        >
          <DownloadIcon /> Override-Protokoll (Excel)
        </button>
        <button
          className="export-btn secondary"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          <DownloadIcon /> Export als CSV
        </button>
      </div>
    </div>
  );
};

// Sub-components

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'green' | 'red' | 'neutral';
  confidenceLevel?: 'high' | 'medium' | 'low';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, confidenceLevel }) => {
  const getConfidenceColorClass = () => {
    if (!confidenceLevel) return '';
    return `confidence-${confidenceLevel}`;
  };

  return (
    <div className={`stat-card ${color || ''} ${getConfidenceColorClass()}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </div>
  );
};

interface DecisionBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const DecisionBar: React.FC<DecisionBarProps> = ({ label, count, total, color }) => {
  const percent = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="decision-row">
      <div className="decision-label">{label}</div>
      <div className="decision-bar-container">
        <div
          className="decision-bar"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="decision-count">{count}</div>
      <div className="decision-percent">{Math.round(percent)}%</div>
    </div>
  );
};

export default AIAuditDashboard;
