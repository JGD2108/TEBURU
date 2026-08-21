import 'server-only';

import type { ExtractionValidationStatus } from './types';

/** This vocabulary describes provider advice only; it is deliberately separate from server validation reasons. */
export const PROVIDER_DECISION_RECOMMENDATIONS = ['approve', 'review', 'reject'] as const;
export type ProviderDecisionRecommendation = typeof PROVIDER_DECISION_RECOMMENDATIONS[number];

export const PROVIDER_DECISION_REASONS = [
  'CLEAR_EXTRACTION',
  'CLEAR_PRICE_ASSOCIATION',
  'COMPLETE_ITEM',
  'AMBIGUOUS_SOURCE',
  'MISSING_REQUIRED_FIELD',
  'POSSIBLE_NON_MENU_CONTENT',
  'CONFLICTING_EVIDENCE',
] as const;
export type ProviderDecisionReason = typeof PROVIDER_DECISION_REASONS[number];

/** Advisory evidence that is incompatible with unattended bulk approval. */
export const PROVIDER_BLOCKING_DECISION_REASONS = [
  'AMBIGUOUS_SOURCE',
  'MISSING_REQUIRED_FIELD',
  'POSSIBLE_NON_MENU_CONTENT',
  'CONFLICTING_EVIDENCE',
] as const satisfies readonly ProviderDecisionReason[];

export type ProviderDecisionMetadata = {
  recommendation: ProviderDecisionRecommendation;
  decisionConfidence: number;
  decisionReasons: ProviderDecisionReason[];
};

/** One strict decoder shared by provider and persistence boundaries. */
export function parseProviderDecisionMetadata(value: unknown): ProviderDecisionMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const decision = value as Record<string, unknown>;
  if (Object.keys(decision).some((key) => !['recommendation', 'decisionConfidence', 'decisionReasons'].includes(key))) return undefined;
  if (!PROVIDER_DECISION_RECOMMENDATIONS.includes(decision.recommendation as ProviderDecisionRecommendation)) return undefined;
  if (typeof decision.decisionConfidence !== 'number' || !Number.isFinite(decision.decisionConfidence)
    || decision.decisionConfidence < 0 || decision.decisionConfidence > 1) return undefined;
  if (!Array.isArray(decision.decisionReasons) || decision.decisionReasons.length === 0
    || new Set(decision.decisionReasons).size !== decision.decisionReasons.length
    || decision.decisionReasons.some((reason) => !PROVIDER_DECISION_REASONS.includes(reason as ProviderDecisionReason))) return undefined;
  return {
    recommendation: decision.recommendation as ProviderDecisionRecommendation,
    decisionConfidence: decision.decisionConfidence,
    decisionReasons: decision.decisionReasons as ProviderDecisionReason[],
  };
}

export const ASSISTED_APPROVAL_POLICY_VERSION = 'assisted-approval-v1';
export const DEFAULT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD = 0.90;

export type AssistedApprovalPolicy = {
  version: typeof ASSISTED_APPROVAL_POLICY_VERSION;
  confidenceThreshold: number;
};

/** These are server policy outcomes, never copies of semantic extraction reason codes. */
export const ASSISTED_APPROVAL_BLOCKING_REASONS = [
  'NON_V5_ANALYZER',
  'NOT_VALID',
  'MISSING_ADVISORY_METADATA',
  'RECOMMENDATION_NOT_APPROVE',
  'CONFIDENCE_BELOW_THRESHOLD',
  'PROVIDER_BLOCKING_REASON',
  'MISSING_REQUIRED_FIELDS',
  'HAS_VALIDATION_REASONS',
  'STALE_DRAFT',
  'DRAFT_CHANGED',
  'ALREADY_APPROVED',
  'EXCLUDED',
  'PROVIDER_FAILURE',
  'NON_EVALUABLE',
] as const;
export type AssistedApprovalBlockingReason = typeof ASSISTED_APPROVAL_BLOCKING_REASONS[number];

export type AssistedApprovalEligibilityInput = {
  analyzerVersion?: string | null;
  serverStatus?: ExtractionValidationStatus | null;
  providerDecision?: ProviderDecisionMetadata | null;
  requiredFieldsComplete: boolean;
  hasValidationReasons: boolean;
  stale?: boolean;
  changed?: boolean;
  alreadyApproved?: boolean;
  excluded?: boolean;
  providerFailed?: boolean;
  evaluable?: boolean;
};

export type AssistedApprovalEligibility = {
  eligible: boolean;
  blockingReasons: AssistedApprovalBlockingReason[];
  policyVersion: typeof ASSISTED_APPROVAL_POLICY_VERSION;
  confidenceThreshold: number;
};

function configuredThreshold(value: string | undefined) {
  if (value === undefined || value.trim() === '') return DEFAULT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD;
  const threshold = Number(value);
  return Number.isFinite(threshold) && threshold >= 0 && threshold <= 1
    ? threshold
    : DEFAULT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD;
}

/**
 * The only runtime input is a server environment variable. Callers cannot provide
 * a threshold, which keeps audit results stable and prevents client policy control.
 */
export function activeAssistedApprovalPolicy(environment?: { MENU_IMPORT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD?: string }): AssistedApprovalPolicy {
  const processEnvironment = process.env as unknown as Record<string, string | undefined>;
  return {
    version: ASSISTED_APPROVAL_POLICY_VERSION,
    confidenceThreshold: configuredThreshold(environment?.MENU_IMPORT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD ?? processEnvironment.MENU_IMPORT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD),
  };
}

/**
 * Server-authoritative eligibility. Provider advice is evidence only: an approve
 * recommendation cannot change a review or invalid server status into an eligible draft.
 */
export function deriveAssistedApprovalEligibility(
  input: AssistedApprovalEligibilityInput,
  policy: AssistedApprovalPolicy = activeAssistedApprovalPolicy(),
): AssistedApprovalEligibility {
  const blockingReasons: AssistedApprovalBlockingReason[] = [];
  const decision = input.providerDecision;

  if (input.analyzerVersion !== 'menu-import-v5-text') blockingReasons.push('NON_V5_ANALYZER');
  if (input.serverStatus !== 'valid') blockingReasons.push('NOT_VALID');
  if (!decision) {
    blockingReasons.push('MISSING_ADVISORY_METADATA');
  } else {
    if (decision.recommendation !== 'approve') blockingReasons.push('RECOMMENDATION_NOT_APPROVE');
    if (!Number.isFinite(decision.decisionConfidence) || decision.decisionConfidence < policy.confidenceThreshold) {
      blockingReasons.push('CONFIDENCE_BELOW_THRESHOLD');
    }
    if (decision.decisionReasons.some((reason) => PROVIDER_BLOCKING_DECISION_REASONS.includes(reason as typeof PROVIDER_BLOCKING_DECISION_REASONS[number]))) {
      blockingReasons.push('PROVIDER_BLOCKING_REASON');
    }
  }
  if (!input.requiredFieldsComplete) blockingReasons.push('MISSING_REQUIRED_FIELDS');
  if (input.hasValidationReasons) blockingReasons.push('HAS_VALIDATION_REASONS');
  if (input.stale) blockingReasons.push('STALE_DRAFT');
  if (input.changed) blockingReasons.push('DRAFT_CHANGED');
  if (input.alreadyApproved) blockingReasons.push('ALREADY_APPROVED');
  if (input.excluded) blockingReasons.push('EXCLUDED');
  if (input.providerFailed) blockingReasons.push('PROVIDER_FAILURE');
  if (input.evaluable === false) blockingReasons.push('NON_EVALUABLE');

  return {
    eligible: blockingReasons.length === 0,
    blockingReasons,
    policyVersion: policy.version,
    confidenceThreshold: policy.confidenceThreshold,
  };
}
