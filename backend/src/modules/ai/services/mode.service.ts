import { Injectable, Logger } from '@nestjs/common';
import { 
  AgentMode, 
  AgentModeType, 
  MODE_TIMEOUT_MINUTES 
} from '../types/agent.types';

interface UserModeState {
  mode: AgentMode;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Manages the agent mode (Erklär-Modus vs Aktions-Modus) for each user
 */
@Injectable()
export class ModeService {
  private readonly logger = new Logger(ModeService.name);
  private userModes: Map<string, UserModeState> = new Map();

  /**
   * Get the current mode for a user (defaults to 'explain')
   */
  getCurrentMode(userId: string): AgentMode {
    const state = this.userModes.get(userId);
    
    if (!state) {
      return this.getDefaultMode();
    }

    // Check if mode has expired
    if (state.mode.expiresAt && new Date() > state.mode.expiresAt) {
      this.logger.log(`Mode expired for user ${userId}, reverting to explain mode`);
      this.deactivateActionMode(userId);
      return this.getDefaultMode();
    }

    return state.mode;
  }

  /**
   * Get the default explain mode
   */
  private getDefaultMode(): AgentMode {
    return {
      type: 'explain',
    };
  }

  /**
   * Activate action mode for a user
   */
  activateActionMode(userId: string): AgentMode {
    // Clear any existing timeout
    const existingState = this.userModes.get(userId);
    if (existingState?.timeoutId) {
      clearTimeout(existingState.timeoutId);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + MODE_TIMEOUT_MINUTES * 60 * 1000);

    const mode: AgentMode = {
      type: 'action',
      activatedAt: now,
      activatedBy: userId,
      expiresAt,
    };

    // Set timeout to auto-revert
    const timeoutId = setTimeout(() => {
      this.logger.log(`Auto-reverting to explain mode for user ${userId}`);
      this.deactivateActionMode(userId);
    }, MODE_TIMEOUT_MINUTES * 60 * 1000);

    this.userModes.set(userId, { mode, timeoutId });
    
    this.logger.log(
      `Action mode activated for user ${userId}, expires at ${expiresAt.toISOString()}`
    );

    return mode;
  }

  /**
   * Deactivate action mode and revert to explain mode
   */
  deactivateActionMode(userId: string): AgentMode {
    const state = this.userModes.get(userId);
    
    if (state?.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    this.userModes.delete(userId);
    this.logger.log(`Action mode deactivated for user ${userId}`);

    return this.getDefaultMode();
  }

  /**
   * Check if a user is in action mode
   */
  isActionMode(userId: string): boolean {
    const mode = this.getCurrentMode(userId);
    return mode.type === 'action';
  }

  /**
   * Get remaining time in action mode (in seconds)
   */
  getActionModeRemainingTime(userId: string): number | null {
    const mode = this.getCurrentMode(userId);
    
    if (mode.type !== 'action' || !mode.expiresAt) {
      return null;
    }

    const remaining = mode.expiresAt.getTime() - new Date().getTime();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Check if a tool can be executed in the current mode
   */
  canExecuteTool(
    userId: string, 
    requiredMode: 'explain' | 'action' | 'both'
  ): { allowed: boolean; reason?: string } {
    const currentMode = this.getCurrentMode(userId);

    if (requiredMode === 'both') {
      return { allowed: true };
    }

    if (requiredMode === 'action' && currentMode.type === 'explain') {
      return {
        allowed: false,
        reason: 'Diese Aktion erfordert den Aktions-Modus. Bitte aktivieren Sie zunächst den Aktions-Modus.',
      };
    }

    return { allowed: true };
  }

  /**
   * Get action mode activation prompt
   */
  getActivationPrompt(): {
    title: string;
    description: string;
    capabilities: string[];
    warning: string;
  } {
    return {
      title: 'Aktions-Modus aktivieren',
      description: 'Im Aktions-Modus kann der AI-Agent:',
      capabilities: [
        'Korrekturbuchungen vorschlagen und erstellen',
        'Prüfungen als erledigt markieren',
        'IC-Differenzen akzeptieren',
      ],
      warning: `Alle Aktionen erfordern Ihre Bestätigung. Der Modus wird nach ${MODE_TIMEOUT_MINUTES} Minuten automatisch deaktiviert.`,
    };
  }
}
