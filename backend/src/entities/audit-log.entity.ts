import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// Type of action performed
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  REVERSE = 'reverse',
  SUBMIT = 'submit',
  IMPORT = 'import',
  EXPORT = 'export',
  CALCULATE = 'calculate',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

// Entity types that can be audited
export enum AuditEntityType {
  COMPANY = 'company',
  FINANCIAL_STATEMENT = 'financial_statement',
  ACCOUNT_BALANCE = 'account_balance',
  CONSOLIDATION_ENTRY = 'consolidation_entry',
  PARTICIPATION = 'participation',
  EXCHANGE_RATE = 'exchange_rate',
  INTERCOMPANY_TRANSACTION = 'intercompany_transaction',
  DEFERRED_TAX = 'deferred_tax',
  IC_RECONCILIATION = 'ic_reconciliation',
  USER = 'user',
  SYSTEM = 'system',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Who performed the action
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_email', nullable: true })
  userEmail: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_name', nullable: true })
  userName: string | null;

  // What action was performed
  @Column({
    type: 'enum',
    enum: AuditAction,
    name: 'action',
  })
  action: AuditAction;

  // Which entity type
  @Column({
    type: 'enum',
    enum: AuditEntityType,
    name: 'entity_type',
  })
  entityType: AuditEntityType;

  // Entity ID
  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId: string | null;

  // Human-readable entity name (for display)
  @Column({ type: 'varchar', length: 500, name: 'entity_name', nullable: true })
  entityName: string | null;

  // Financial statement context (if applicable)
  @Column({ type: 'uuid', name: 'financial_statement_id', nullable: true })
  financialStatementId: string | null;

  // Company context (if applicable)
  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId: string | null;

  // Before state (JSON)
  @Column({ type: 'jsonb', name: 'before_state', nullable: true })
  beforeState: Record<string, any> | null;

  // After state (JSON)
  @Column({ type: 'jsonb', name: 'after_state', nullable: true })
  afterState: Record<string, any> | null;

  // Changes made (diff)
  @Column({ type: 'jsonb', name: 'changes', nullable: true })
  changes: Record<string, { from: any; to: any }> | null;

  // Additional metadata
  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata: Record<string, any> | null;

  // IP address
  @Column({ type: 'varchar', length: 50, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  // User agent
  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string | null;

  // Session ID
  @Column({ type: 'varchar', length: 255, name: 'session_id', nullable: true })
  sessionId: string | null;

  // Description of the action
  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  // Timestamp
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at',
  })
  createdAt: Date;
}

// Interface for querying audit logs
export interface AuditLogQuery {
  userId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  financialStatementId?: string;
  companyId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}
