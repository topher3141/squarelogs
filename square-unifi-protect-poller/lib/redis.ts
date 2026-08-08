import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

const PREFIX = "square-unifi:processed:";

export async function wasProcessed(paymentId: string): Promise<boolean> {
  const value = await redis.get(`${PREFIX}${paymentId}`);
  return value !== null;
}

export async function markProcessed(paymentId: string, protectEventId?: string): Promise<void> {
  // Keep the dedupe record for 90 days.
  await redis.set(
    `${PREFIX}${paymentId}`,
    protectEventId || "1",
    { ex: 60 * 60 * 24 * 90 }
  );
}
