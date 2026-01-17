import { ConsolidationCircle } from '../components/ConsolidationCircle';
import { ExchangeRateManager } from '../components/ExchangeRateManager';
import { BackButton } from '../components/BackButton';
import { useState } from 'react';
import '../App.css';

type TabType = 'circle' | 'currency';

function ConsolidationCirclePage() {
  const [activeTab, setActiveTab] = useState<TabType>('circle');

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <BackButton />
      </div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--spacing-6)' 
      }}>
        <h1>Konsolidierungskreis & Währung</h1>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 'var(--spacing-6)',
      }}>
        <button
          className={`entry-tab ${activeTab === 'circle' ? 'active' : ''}`}
          onClick={() => setActiveTab('circle')}
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'circle' ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
            color: activeTab === 'circle' ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'circle' ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
          }}
        >
          Konsolidierungskreis
        </button>
        <button
          className={`entry-tab ${activeTab === 'currency' ? 'active' : ''}`}
          onClick={() => setActiveTab('currency')}
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'currency' ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
            color: activeTab === 'currency' ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === 'currency' ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
          }}
        >
          Währungskurse (§ 308a HGB)
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'circle' && <ConsolidationCircle />}
      {activeTab === 'currency' && <ExchangeRateManager />}
    </div>
  );
}

export default ConsolidationCirclePage;
