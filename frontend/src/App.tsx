import { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CompanyManagement from './pages/CompanyManagement';
import DataImport from './pages/DataImport';
import Consolidation from './pages/Consolidation';
import ConsolidationCirclePage from './pages/ConsolidationCirclePage';
import ConsolidatedReportPage from './pages/ConsolidatedReportPage';
import ConsolidationWizardPage from './pages/ConsolidationWizardPage';
import FinancialStatement from './pages/FinancialStatement';
import ConsolidatedNotes from './pages/ConsolidatedNotes';
import DataLineage from './pages/DataLineage';
import KonzernanhangPage from './pages/KonzernanhangPage';
import PlausibilityChecks from './pages/PlausibilityChecks';
import PolicyManagement from './pages/PolicyManagement';
// Priority Features Pages
import FiscalYearAdjustments from './pages/FiscalYearAdjustments';
import CurrencyTranslation from './pages/CurrencyTranslation';
import ManagementReportPage from './pages/ManagementReportPage';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { CommandPalette } from './components/CommandPalette';
import { DarkModeToggle } from './components/DarkModeToggle';
import { PageTransition } from './components/PageTransition';
import { Sidebar } from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSidebarCollapsedChange = useCallback((isCollapsed: boolean) => {
    setSidebarCollapsed(isCollapsed);
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
        <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Sidebar onCollapsedChange={handleSidebarCollapsedChange} />
          <main className="main-content">
            <PageTransition>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/companies" element={<CompanyManagement />} />
                <Route path="/import" element={
                  <ErrorBoundary>
                    <DataImport />
                  </ErrorBoundary>
                } />
                <Route path="/consolidation-circle" element={<ConsolidationCirclePage />} />
                <Route path="/consolidation" element={<Consolidation />} />
                <Route path="/konzernabschluss" element={<ConsolidatedReportPage />} />
                <Route path="/konzernabschluss/:id" element={<ConsolidatedReportPage />} />
                <Route path="/konsolidierung-assistent" element={<ConsolidationWizardPage />} />
                <Route path="/financial-statements/:id" element={<FinancialStatement />} />
                <Route path="/consolidated-notes/:id" element={<ConsolidatedNotes />} />
                <Route path="/lineage" element={<DataLineage />} />
                <Route path="/lineage/:id" element={<DataLineage />} />
                <Route path="/konzernanhang" element={<KonzernanhangPage />} />
                <Route path="/konzernanhang/:id" element={<KonzernanhangPage />} />
                <Route path="/controls" element={<PlausibilityChecks />} />
                <Route path="/controls/:financialStatementId" element={<PlausibilityChecks />} />
                <Route path="/policies" element={<PolicyManagement />} />
                {/* Priority Features Routes */}
                <Route path="/stichtagsverschiebung" element={<FiscalYearAdjustments />} />
                <Route path="/stichtagsverschiebung/:financialStatementId" element={<FiscalYearAdjustments />} />
                <Route path="/waehrungsumrechnung" element={<CurrencyTranslation />} />
                <Route path="/konzernlagebericht" element={<ManagementReportPage />} />
                <Route path="/konzernlagebericht/:id" element={<ManagementReportPage />} />
              </Routes>
            </PageTransition>
          </main>
            <CommandPalette />
          <DarkModeToggle />
        </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
