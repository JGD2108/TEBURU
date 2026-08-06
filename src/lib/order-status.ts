export const kitchenStatusTransitions = {
  preparing: 'pending',
  ready: 'preparing',
} as const;

export type KitchenOrderStatus = keyof typeof kitchenStatusTransitions;

export function expectedOrderStatusForKitchenUpdate(status: unknown): string | null {
  if (typeof status !== 'string' || !(status in kitchenStatusTransitions)) {
    return null;
  }

  return kitchenStatusTransitions[status as KitchenOrderStatus];
}
