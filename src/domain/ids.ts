export const enrollmentId = (contestantId: string, category: string): string => `${contestantId}_${category}`;
export const registrationId = (paymentId: string, itemId: string): string => `${paymentId}:${itemId}`;
