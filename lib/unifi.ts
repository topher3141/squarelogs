import { config } from "./config";

export type ProtectTransaction = {
  type: "sale";
  externalId: string;
  amount: number;
  currency: string;
  lineItems: Array<{
    title: string;
    quantity: number;
  }>;
  location: {
    id: string;
    name: string;
  };
  paymentTypes: string[];
  timestamp: number;
};

export async function sendProtectTransaction(transaction: ProtectTransaction) {
  const consoleId = encodeURIComponent(config.unifiConsoleId());
  const cameraId = encodeURIComponent(config.unifiCameraId());

  const url =
    `https://api.ui.com/v1/connector/consoles/${consoleId}` +
    `/protect/integration/v1/pos/cameras/${cameraId}/transactions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": config.unifiApiKey(),
    },
    body: JSON.stringify(transaction),
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`UniFi POS ingestion failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}
