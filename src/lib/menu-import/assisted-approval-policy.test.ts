import { describe, expect, it } from 'vitest';

import {
  ASSISTED_APPROVAL_POLICY_VERSION,
  DEFAULT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD,
  activeAssistedApprovalPolicy,
  deriveAssistedApprovalEligibility,
} from './assisted-approval-policy';
import type { ProviderDecisionMetadata } from './assisted-approval-policy';

const providerDecision: ProviderDecisionMetadata = {
  recommendation: 'approve',
  decisionConfidence: 0.9,
  decisionReasons: ['CLEAR_EXTRACTION'],
};

function evaluate(overrides: Partial<Parameters<typeof deriveAssistedApprovalEligibility>[0]> = {}) {
  return deriveAssistedApprovalEligibility({
    analyzerVersion: 'menu-import-v5-text',
    serverStatus: 'valid',
    providerDecision,
    requiredFieldsComplete: true,
    hasValidationReasons: false,
    ...overrides,
  });
}

describe('V5 assisted approval policy', () => {
  it('uses a versioned server-only threshold with a safe default', () => {
    expect(activeAssistedApprovalPolicy({})).toEqual({
      version: ASSISTED_APPROVAL_POLICY_VERSION,
      confidenceThreshold: DEFAULT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD,
    });
    expect(activeAssistedApprovalPolicy({ MENU_IMPORT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD: '0.95' })).toMatchObject({ confidenceThreshold: 0.95 });
    expect(activeAssistedApprovalPolicy({ MENU_IMPORT_ASSISTED_APPROVAL_CONFIDENCE_THRESHOLD: '1.1' })).toMatchObject({ confidenceThreshold: 0.9 });
  });

  it('accepts only an unchanged valid V5 approve recommendation at the threshold', () => {
    expect(evaluate()).toMatchObject({ eligible: true, blockingReasons: [], confidenceThreshold: 0.9 });
    expect(deriveAssistedApprovalEligibility({
      analyzerVersion: 'menu-import-v5-text', serverStatus: 'valid', providerDecision, requiredFieldsComplete: true, hasValidationReasons: false,
    }, { version: ASSISTED_APPROVAL_POLICY_VERSION, confidenceThreshold: 0.91 })).toMatchObject({
      eligible: false, blockingReasons: ['CONFIDENCE_BELOW_THRESHOLD'],
    });
  });

  it('never upgrades review or invalid server outcomes despite an approve recommendation', () => {
    expect(evaluate({ serverStatus: 'review', hasValidationReasons: true })).toMatchObject({
      eligible: false, blockingReasons: expect.arrayContaining(['NOT_VALID', 'HAS_VALIDATION_REASONS']),
    });
    expect(evaluate({ serverStatus: 'invalid' })).toMatchObject({ eligible: false, blockingReasons: ['NOT_VALID'] });
  });

  it('keeps rejection as provider evidence and blocks legacy, changed, and stale drafts', () => {
    expect(evaluate({ providerDecision: { ...providerDecision, recommendation: 'reject' } })).toMatchObject({
      eligible: false, blockingReasons: ['RECOMMENDATION_NOT_APPROVE'],
    });
    expect(evaluate({ providerDecision: undefined })).toMatchObject({ eligible: false, blockingReasons: ['MISSING_ADVISORY_METADATA'] });
    expect(evaluate({ changed: true, stale: true })).toMatchObject({
      eligible: false, blockingReasons: expect.arrayContaining(['DRAFT_CHANGED', 'STALE_DRAFT']),
    });
  });

  it.each([
    'AMBIGUOUS_SOURCE',
    'MISSING_REQUIRED_FIELD',
    'POSSIBLE_NON_MENU_CONTENT',
    'CONFLICTING_EVIDENCE',
  ] as const)('blocks a valid server draft when provider evidence contains %s', (reason) => {
    expect(evaluate({ providerDecision: { ...providerDecision, decisionConfidence: 0.99, decisionReasons: [reason] } })).toMatchObject({
      eligible: false,
      blockingReasons: ['PROVIDER_BLOCKING_REASON'],
    });
  });

  it('blocks every provider reason classified as unsafe for unattended approval', () => {
    for (const reason of ['AMBIGUOUS_SOURCE', 'MISSING_REQUIRED_FIELD', 'POSSIBLE_NON_MENU_CONTENT', 'CONFLICTING_EVIDENCE'] as const) {
      expect(evaluate({ providerDecision: { ...providerDecision, decisionReasons: [reason] } })).toMatchObject({
        eligible: false, blockingReasons: ['PROVIDER_BLOCKING_REASON'],
      });
    }
  });

  it.each([
    ['menu-import-v4-visual', {}],
    ['menu-import-v3', {}],
    ['menu-import-v5-text', { providerFailed: true }],
    ['menu-import-v5-text', { evaluable: false }],
  ] as const)('keeps historical, failed, and non-evaluable imports ineligible (%s)', (analyzerVersion, flags) => {
    expect(evaluate({ analyzerVersion, ...flags })).toMatchObject({ eligible: false });
  });
});
