import { useNavigate } from 'react-router-dom';
import { ConsolidationWizard } from '../components/ConsolidationWizard';
import '../App.css';

function ConsolidationWizardPage() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <ConsolidationWizard
        onComplete={() => navigate('/konzernabschluss')}
        onCancel={() => navigate('/consolidation')}
      />
    </div>
  );
}

export default ConsolidationWizardPage;
