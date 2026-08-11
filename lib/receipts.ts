import { redis } from "@/lib/redis";

const RECEIPT_PREFIX = "square-unifi:receipt:";
const RECEIPT_INDEX = "square-unifi:receipts:by-time";

export type ReceiptItem = {
  title: string;
  quantity: number;
  amount?: number;
};

export type ReceiptRecord = {
  paymentId: string;
  orderId: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  timestamp: number;
  createdAt?: string;
  deviceName?: string;
  deviceId?: string;
  paymentType?: string;
  cardBrand?: string;
  receiptUrl?: string;
  items: ReceiptItem[];
  footageUrl: string;
  protectEventId?: string;
};

export async function saveReceiptRecord(record: ReceiptRecord) {
  await redis.set(`${RECEIPT_PREFIX}${record.paymentId}`, record);
  await redis.zadd(RECEIPT_INDEX, {
    score: record.timestamp,
    member: record.paymentId,
  });
}

export async function getRecentReceiptRecords(limit = 500): Promise<ReceiptRecord[]> {
  const ids = await redis.zrange<string[]>(RECEIPT_INDEX, 0, Math.max(limit - 1, 0), {
    rev: true,
  });

  if (!ids?.length) return [];

  const keys = ids.map((id) => `${RECEIPT_PREFIX}${id}`);
  const records = await redis.mget<ReceiptRecord[]>(...keys);
  return (records || []).filter(Boolean) as ReceiptRecord[];
}
