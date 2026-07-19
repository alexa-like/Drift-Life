import webpush from "web-push";

const VAPID_PUBLIC_KEY  = process.env["VAPID_PUBLIC_KEY"];
const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"];
const VAPID_SUBJECT     = process.env["VAPID_SUBJECT"] ?? "mailto:noreply@neonoir.game";

let _configured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  _configured = true;
} else {
  console.warn("[webpush] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set — push notifications disabled");
}

export function isWebPushConfigured(): boolean {
  return _configured;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY ?? "";
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  link?: string;
  tag?: string;
}

/**
 * Send a Web Push notification to a single subscription.
 * Throws `{ expired: true }` if the subscription is 404/410 so callers can clean it up.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<void> {
  if (!_configured) return;
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
      { TTL: 86400 } // 24 h
    );
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      throw Object.assign(new Error("push_subscription_expired"), { expired: true });
    }
    throw err;
  }
}
