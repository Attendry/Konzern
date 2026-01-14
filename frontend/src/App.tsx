import { useState, useEffect, useCallback, useRef } from 'react';
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
import DataLineage from './pages/DataLineage';
import KonzernanhangPage from './pages/KonzernanhangPage';
import PlausibilityChecks from './pages/PlausibilityChecks';
import PolicyManagement from './pages/PolicyManagement';
import { ToastProvider } from './contexts/ToastContext';
import { CommandPalette } from './components/CommandPalette';
import { DarkModeToggle } from './components/DarkModeToggle';
import { PageTransition } from './components/PageTransition';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// SVG Icons for navigation items
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  company: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  ),
  import: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17,8 12,3 7,8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  consolidationCircle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="12" y1="9" x2="12" y2="5" />
      <line x1="6.5" y1="6.5" x2="9.5" y2="9.5" />
      <line x1="6.5" y1="17.5" x2="9.5" y2="14.5" />
      <line x1="17.5" y1="6.5" x2="14.5" y2="9.5" />
      <line x1="17.5" y1="17.5" x2="14.5" y2="14.5" />
    </svg>
  ),
  consolidation: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  ),
  report: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  notes: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  ),
  auditTrail: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  ),
  controls: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9,12 11,14 15,10" />
    </svg>
  ),
  policies: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="12" y2="14" />
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  pin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </svg>
  ),
  pinFilled: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </svg>
  ),
};

function App() {
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Sidebar pinned state - when pinned, sidebar stays in user's chosen state
  // When unpinned, sidebar auto-collapses on mouse leave and expands on hover
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    const saved = localStorage.getItem('sidebarPinned');
    return saved ? JSON.parse(saved) : true; // Default to pinned
  });

  // Track if sidebar is temporarily expanded due to hover (only when unpinned)
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Persist sidebar pinned state
  useEffect(() => {
    localStorage.setItem('sidebarPinned', JSON.stringify(sidebarPinned));
  }, [sidebarPinned]);

  // When pinned state changes to unpinned, collapse the sidebar
  useEffect(() => {
    if (!sidebarPinned) {
      setSidebarCollapsed(true);
    }
  }, [sidebarPinned]);

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        if (sidebarPinned) {
          setSidebarCollapsed(!sidebarCollapsed);
        } else {
          // If unpinned, pin it and expand
          setSidebarPinned(true);
          setSidebarCollapsed(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed, sidebarPinned]);

  // Handle mouse enter on sidebar (expand if unpinned)
  const handleMouseEnter = useCallback(() => {
    if (!sidebarPinned) {
      // Clear any pending collapse timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setHoverExpanded(true);
    }
  }, [sidebarPinned]);

  // Handle mouse leave on sidebar (collapse if unpinned)
  const handleMouseLeave = useCallback(() => {
    if (!sidebarPinned) {
      // Add a small delay before collapsing to avoid flickering
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverExpanded(false);
      }, 150);
    }
  }, [sidebarPinned]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Toggle pin state
  const togglePin = useCallback(() => {
    if (sidebarPinned) {
      // Unpinning - collapse the sidebar
      setSidebarPinned(false);
      setSidebarCollapsed(true);
      setHoverExpanded(false);
    } else {
      // Pinning - keep current visual state
      setSidebarPinned(true);
      setSidebarCollapsed(!hoverExpanded);
      setHoverExpanded(false);
    }
  }, [sidebarPinned, hoverExpanded]);

  // Manual toggle only works when pinned
  const toggleSidebar = useCallback(() => {
    if (sidebarPinned) {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  }, [sidebarPinned, sidebarCollapsed]);

  // Determine if sidebar should appear collapsed
  const isVisuallyCollapsed = sidebarPinned ? sidebarCollapsed : !hoverExpanded;

  const navGroups = [
    {
      title: 'Übersicht',
      items: [
        { path: '/', label: 'Dashboard', icon: Icons.dashboard, end: true },
        { path: '/companies', label: 'Unternehmen', icon: Icons.company },
      ],
    },
    {
      title: 'Daten',
      items: [
        { path: '/import', label: 'Datenimport', icon: Icons.import },
      ],
    },
    {
      title: 'Konsolidierung',
      items: [
        { path: '/consolidation-circle', label: 'Konsolidierungskreis', icon: Icons.consolidationCircle },
        { path: '/consolidation', label: 'Konsolidierung', icon: Icons.consolidation },
        { path: '/konzernabschluss', label: 'Konzernabschluss', icon: Icons.report },
      ],
    },
    {
      title: 'Berichte',
      items: [
        { path: '/konzernanhang', label: 'Konzernanhang', icon: Icons.notes },
        { path: '/lineage', label: 'Prüfpfad', icon: Icons.auditTrail },
      ],
    },
    {
      title: 'Qualität',
      items: [
        { path: '/controls', label: 'Kontrollen', icon: Icons.controls },
        { path: '/policies', label: 'Richtlinien', icon: Icons.policies },
      ],
    },
  ];

  return (
    <ToastProvider>
      <Router>
        <div className={`app ${isVisuallyCollapsed ? 'sidebar-collapsed' : ''}`}>
          <aside 
            className={`sidebar ${!sidebarPinned ? 'sidebar-dynamic' : ''}`}
            ref={sidebarRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="sidebar-header">
              {!isVisuallyCollapsed && <h1 className="sidebar-title">Konzern</h1>}
              <div className="sidebar-controls">
                <button
                  className={`sidebar-pin ${sidebarPinned ? 'pinned' : ''}`}
                  onClick={togglePin}
                  title={sidebarPinned ? 'Sidebar losen (dynamisch)' : 'Sidebar fixieren'}
                  aria-label="Pin sidebar"
                >
                  {sidebarPinned ? Icons.pinFilled : Icons.pin}
                </button>
                {sidebarPinned && (
                  <button
                    className="sidebar-toggle"
                    onClick={toggleSidebar}
                    title={isVisuallyCollapsed ? 'Sidebar erweitern (Strg+B)' : 'Sidebar minimieren (Strg+B)'}
                    aria-label="Toggle sidebar"
                  >
                    {Icons.menu}
                  </button>
                )}
              </div>
            </div>
            <nav className="sidebar-nav">
              {navGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="nav-group">
                  {!isVisuallyCollapsed && (
                    <div className="nav-group-header">{group.title}</div>
                  )}
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                      end={item.end}
                      title={isVisuallyCollapsed ? item.label : undefined}
                    >
                      <span className="nav-item-icon">{item.icon}</span>
                      {!isVisuallyCollapsed && <span className="nav-item-label">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
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
