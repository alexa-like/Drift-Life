import webpush from "web-push";

const VAPID_PUBLIC_KEY  = "_2eRihoiTaTu1K1mM6b0jHfTxkUNxc2gNRTlwNgm30g0ZeFWwtl7aldkeRaeGah4Ri60MGwnQKXrmCBP6-RC1w";
const VAPID_PRIVATE_KEY = "BzWw_4iN5KbOY_c_aMF_V3ud7Zk3KlQmCpykf-g7O-E";
const VAPID_SUBJECT     = "mailto:admin@neonoir.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export function isWebPushConfigured(): boolean {
  return true;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
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
