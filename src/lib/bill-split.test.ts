import { describe, expect, it } from 'vitest';
import { splitTotal } from './bill-split';

const guests = [{ id: 'ana', ownTotal: 12.5 }, { id: 'leo', ownTotal: 7.5 }, { id: 'mia', ownTotal: 0 }];

describe('splitTotal', () => {
  it('uses each guest consumption for own-items splits', () => {
    expect(splitTotal('own_items', guests, 20, 'ana')).toEqual([{ guestId: 'ana', amount: 12.5 }, { guestId: 'leo', amount: 7.5 }, { guestId: 'mia', amount: 0 }]);
  });
  it('distributes cents exactly in equal splits', () => {
    expect(splitTotal('equal', guests, 10, 'ana')).toEqual([{ guestId: 'ana', amount: 3.34 }, { guestId: 'leo', amount: 3.33 }, { guestId: 'mia', amount: 3.33 }]);
  });
  it('rejects custom amounts that do not match the total', () => {
    expect(() => splitTotal('custom', guests, 20, 'ana', [{ guestId: 'ana', amount: 10 }, { guestId: 'leo', amount: 5 }, { guestId: 'mia', amount: 0 }])).toThrow('INVALID_SPLIT');
  });
});
