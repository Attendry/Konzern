import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DataLineageNode } from './data-lineage-node.entity';
import { ConsolidationEntry } from './consolidation-entry.entity';

// Transformation type - what operation was performed
export enum LineageTransformationType {
  IMPORT = 'import',
  MANUAL_ENTRY = 'manual_entry',
  SUM = 'sum',
  SUBTRACT = 'subtract',
  MULTIPLY = 'multiply',
  PERCENTAGE = 'percentage',
  ELIMINATION = 'elimination',
  OFFSET = 'offset',
  ALLOCATION = 'allocation',
  REVERSAL = 'reversal',
  CARRY_FORWARD = 'carry_forward',
  PRO_RATA = 'pro_rata',
  MAPPING = 'mapping',
}

@Entity('data_lineage_traces')
export class DataLineageTrace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The nodes involved
  @Column({ type: 'uuid', name: 'source_node_id' })
  sourceNodeId: string;

  @ManyToOne(() => DataLineageNode)
  @JoinColumn({ name: 'source_node_id' })
  sourceNode: DataLineageNode;

  @Column({ type: 'uuid', name: 'target_node_id' })
  targetNodeId: string;

  @ManyToOne(() => DataLineageNode)
  @JoinColumn({ name: 'target_node_id' })
  targetNode: DataLineageNode;

  // Transformation details
  @Column({
    type: 'enum',
    enum: LineageTransformationType,
    name: 'transformation_type',
  })
  transformationType: LineageTransformationType;

  @Column({ type: 'text', name: 'transformation_description', nullable: true })
  transformationDescription: string | null;

  // Calculation details
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 6,
    name: 'transformation_factor',
    nullable: true,
  })
  transformationFactor: number | null;

  @Column({ type: 'text', name: 'transformation_formula', nullable: true })
  transformationFormula: string | null;

  // Contribution to target
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    name: 'contribution_amount',
    nullable: true,
  })
  contributionAmount: number | null;

  @Column({
    type: 'decimal',
    precision: 7,
    scale: 4,
    name: 'contribution_percentage',
    nullable: true,
  })
  contributionPercentage: number | null;

  // Consolidation context
  @Column({ type: 'uuid', name: 'consolidation_entry_id', nullable: true })
  consolidationEntryId: string | null;

  @ManyToOne(() => ConsolidationEntry)
  @JoinColumn({ name: 'consolidation_entry_id' })
  consolidationEntry: ConsolidationEntry | null;

  // Ordering
  @Column({ type: 'integer', name: 'sequence_order', default: 0 })
  sequenceOrder: number;

  // Reversal tracking
  @Column({ type: 'boolean', name: 'is_reversible', default: true })
  isReversible: boolean;

  @Column({ type: 'timestamp', name: 'reversed_at', nullable: true })
  reversedAt: Date | null;

  @Column({ type: 'uuid', name: 'reversed_by_trace_id', nullable: true })
  reversedByTraceId: string | null;

  // Timestamp
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at',
  })
  createdAt: Date;
}

// Interface for creating a lineage trace
export interface CreateLineageTraceDto {
  sourceNodeId: string;
  targetNodeId: string;
  transformationType: LineageTransformationType;
  transformationDescription?: string;
  transformationFactor?: number;
  transformationFormula?: string;
  contributionAmount?: number;
  contributionPercentage?: number;
  consolidationEntryId?: string;
  sequenceOrder?: number;
}

// Interface for querying lineage traces
export interface LineageTraceQuery {
  sourceNodeId?: string;
  targetNodeId?: string;
  transformationType?: LineageTransformationType;
  consolidationEntryId?: string;
  includeReversed?: boolean;
}
