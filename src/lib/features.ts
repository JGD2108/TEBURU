/**
 * Temporary rollout switch for the kitchen workflow.
 *
 * Keep this disabled while Teburu focuses on QR ordering. Set the public
 * environment variable to "true" to restore the KDS and stations screens.
 */
export const kitchenWorkflowEnabled = process.env.NEXT_PUBLIC_ENABLE_KITCHEN_WORKFLOW === 'true';
