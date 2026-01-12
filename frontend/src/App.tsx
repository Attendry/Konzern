import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CompanyManagement from './pages/CompanyManagement';
import DataImport from './pages/DataImport';
import Consolidation from './pages/Consolidation';
import FinancialStatement from './pages/FinancialStatement';
import ConsolidatedNotes from './pages/ConsolidatedNotes';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="nav-title">Konzern</h1>
            <ul className="nav-links">
              <li>
                <Link to="/">Dashboard</Link>
              </li>
              <li>
                <Link to="/companies">Unternehmen</Link>
              </li>
              <li>
                <Link to="/import">Datenimport</Link>
              </li>
              <li>
                <Link to="/consolidation">Konsolidierung</Link>
              </li>
            </ul>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<CompanyManagement />} />
            <Route path="/import" element={<DataImport />} />
            <Route path="/consolidation" element={<Consolidation />} />
            <Route path="/financial-statements/:id" element={<FinancialStatement />} />
            <Route path="/consolidated-notes/:id" element={<ConsolidatedNotes />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
