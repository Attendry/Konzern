import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { 
  AgentResponse as AgentResponseType,
  SuggestedAction,
  OverrideOption,
  ProvenanceInfo,
} from '../../types/agent.types';
import ReasoningDisplay from './ReasoningDisplay';
import QualityDisplay from './QualityDisplay';
import OverrideDialog from './OverrideDialog';
import BatchOperationUI from './BatchOperationUI';
import aiService from '../../services/aiService';
import './agent.css';

interface AgentResponseProps {
  response: AgentResponseType;
  onActionClick?: (action: SuggestedAction) => void;
  onOverride?: (option: OverrideOption, reasoning?: string) => void;
}

export const AgentResponseComponent: React.FC<AgentResponseProps> = ({
  response,
  onActionClick,
  onOverride,
}) => {
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  const handleActionClick = (action: SuggestedAction) => {
    if (onActionClick) {
      onActionClick(action);
    } else {
      // Default action handling
      switch (action.type) {
        case 'navigate':
          if (action.payload?.route) {
            window.location.href = action.payload.route;
          }
          break;
        case 'activate_action_mode':
          // This would be handled by the parent component
          break;
        default:
          console.log('Action clicked:', action);
      }
    }
  };

  const handleOverride = async (option: OverrideOption, reasoning?: string) => {
    if (onOverride) {
      onOverride(option, reasoning);
    }

    // Record the decision if we have an audit log ID
    if (response.auditLogId) {
      try {
        await aiService.recordDecision(
          response.auditLogId,
          'reject',
          reasoning,
        );
      } catch (error) {
        console.error('Failed to record decision:', error);
      }
    }

    setOverrideDialogOpen(false);
  };

  return (
    <div className="agent-response">
      {/* Main message */}
      <div className="agent-message">
        <ReactMarkdown>{response.message}</ReactMarkdown>
      </div>

      {/* Quality summary bar */}
      {response.quality && (
        <QualityDisplay quality={response.quality} />
      )}

      {/* Provenance section */}
      {response.provenance && response.provenance.length > 0 && (
        <ProvenanceSection provenance={response.provenance} />
      )}

      {/* Reasoning toggle */}
      {response.reasoning && (
        <ReasoningDisplay reasoning={response.reasoning} />
      )}

      {/* Batch result summary */}
      {response.batchResult && (
        <BatchOperationUI batchResult={response.batchResult} />
      )}

      {/* Disclaimer */}
      {response.disclaimer && (
        <div className="agent-disclaimer">
          {response.disclaimer}
        </div>
      )}

      {/* Action buttons */}
      <div className="agent-actions">
        {response.suggestedAction && (
          <button
            className="agent-action-btn primary"
            onClick={() => handleActionClick(response.suggestedAction!)}
          >
            {response.suggestedAction.label}
          </button>
        )}
        
        {/* Override button */}
        {response.overrideOptions && response.overrideOptions.length > 0 && (
          <button
            className="agent-action-btn secondary"
            onClick={() => setOverrideDialogOpen(true)}
          >
            Anderer Meinung
          </button>
        )}
      </div>

      {/* Override dialog */}
      {overrideDialogOpen && response.overrideOptions && (
        <OverrideDialog
          options={response.overrideOptions}
          aiRecommendation={response.reasoning?.conclusion || response.message}
          onSubmit={handleOverride}
          onCancel={() => setOverrideDialogOpen(false)}
        />
      )}
    </div>
  );
};

interface ProvenanceSectionProps {
  provenance: ProvenanceInfo[];
}

const ProvenanceSection: React.FC<ProvenanceSectionProps> = ({ provenance }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'database_record':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        );
      case 'hgb_paragraph':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        );
      case 'calculation':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="16" y2="14" />
            <line x1="8" y1="18" x2="16" y2="18" />
          </svg>
        );
      case 'ai_inference':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
            <circle cx="9" cy="13" r="1" />
            <circle cx="15" cy="13" r="1" />
          </svg>
        );
      case 'user_input':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      default:
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
    }
  };

  return (
    <div className="agent-provenance">
      {provenance.map((p, i) => (
        <span key={i} className="provenance-badge" title={p.description || p.source}>
          {getIcon(p.type)}
          <span>{p.hgbParagraph || p.source}</span>
        </span>
      ))}
    </div>
  );
};

export default AgentResponseComponent;
