import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CompanyManagement from './pages/CompanyManagement';
import DataImport from './pages/DataImport';
import Consolidation from './pages/Consolidation';
import ConsolidationCirclePage from './pages/ConsolidationCirclePage';
import ConsolidatedReportPage from './pages/ConsolidatedReportPage';
import ConsolidationWizardPage from './pages/ConsolidationWizardPage';
import FinancialStatement from './pages/FinancialStatement';
import ConsolidatedNotes from './pages/ConsolidatedNotes';
import { ToastProvider } from './contexts/ToastContext';
import { CommandPalette } from './components/CommandPalette';
import { DarkModeToggle } from './components/DarkModeToggle';
import { PageTransition } from './components/PageTransition';
import './App.css';

function App() {
  return (
    <ToastProvider>
      <Router>
        <div className="app">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h1 className="sidebar-title">Konzern</h1>
            </div>
            <nav className="sidebar-nav">
              <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                Dashboard
              </NavLink>
              <NavLink to="/companies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                Unternehmen
              </NavLink>
              <NavLink to="/import" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                Datenimport
              </NavLink>
              <NavLink to="/consolidation-circle" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                Konsolidierungskreis
              </NavLink>
              <NavLink to="/consolidation" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                Konsolidierung
              </NavLink>
              <NavLink to="/konzernabschluss" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                📊 Konzernabschluss
              </NavLink>
            </nav>
          </aside>
          <main className="main-content">
            <PageTransition>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/companies" element={<CompanyManagement />} />
                <Route path="/import" element={<DataImport />} />
                <Route path="/consolidation-circle" element={<ConsolidationCirclePage />} />
                <Route path="/consolidation" element={<Consolidation />} />
                <Route path="/konzernabschluss" element={<ConsolidatedReportPage />} />
                <Route path="/konzernabschluss/:id" element={<ConsolidatedReportPage />} />
                <Route path="/konsolidierung-assistent" element={<ConsolidationWizardPage />} />
                <Route path="/financial-statements/:id" element={<FinancialStatement />} />
                <Route path="/consolidated-notes/:id" element={<ConsolidatedNotes />} />
              </Routes>
            </PageTransition>
          </main>
          <CommandPalette />
          <DarkModeToggle />
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
