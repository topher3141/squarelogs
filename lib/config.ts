function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  squareAccessToken: () => required("SQUARE_ACCESS_TOKEN"),
  squareSignatureKey: () => required("SQUARE_WEBHOOK_SIGNATURE_KEY"),
  squareNotificationUrl: () => required("SQUARE_WEBHOOK_NOTIFICATION_URL"),
  squareApiVersion: () => process.env.SQUARE_API_VERSION?.trim() || "2026-07-15",
  squareLocationId: () => process.env.SQUARE_LOCATION_ID?.trim() || "",
  posLocationName: () => process.env.POS_LOCATION_NAME?.trim() || "Deals & Steals",
  unifiApiKey: () => required("UNIFI_API_KEY"),
  unifiConsoleId: () => required("UNIFI_CONSOLE_ID"),
  unifiCameraId: () => required("UNIFI_CAMERA_ID"),
};
