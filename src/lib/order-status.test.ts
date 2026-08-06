import { describe, expect, it } from 'vitest';
import { expectedOrderStatusForKitchenUpdate } from './order-status';

describe('expectedOrderStatusForKitchenUpdate', () => {
  it('defines the only kitchen transitions', () => {
    expect(expectedOrderStatusForKitchenUpdate('preparing')).toBe('pending');
    expect(expectedOrderStatusForKitchenUpdate('ready')).toBe('preparing');
  });

  it('rejects legacy and non-kitchen statuses', () => {
    expect(expectedOrderStatusForKitchenUpdate('cooking')).toBeNull();
    expect(expectedOrderStatusForKitchenUpdate('delivered')).toBeNull();
  });
});
