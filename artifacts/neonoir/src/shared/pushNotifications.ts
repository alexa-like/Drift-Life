/**
 * Browser-side Web Push helpers.
 * Import these from the notifications settings tab and anywhere
 * you need to check or change the user's push subscription.
 */
import { api } from "./api";

let _cachedVapidKey: string | null = null;

/**
 * Detect whether the page is running inside a native app WebView (Android or iOS).
 * WebViews do not support the Web Push API (PushManager), so subscriptions will
 * always fail there — even if the OS has granted notification permission.
 *
 * Android WebView UA contains "wv" or matches the bare Android pattern without
 * a recognisable browser name. iOS WKWebView lacks the "Safari" token that the
 * real Safari browser includes.
 */
export function isWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Android WebView
  if (/Android/.test(ua) && /wv\b/.test(ua)) return true;
  if (/Android/.test(ua) && !/Chrome\/\d/.test(ua) && !/Firefox\/\d/.test(ua)) return true;
  // iOS WKWebView (no "Safari/" token, but has "AppleWebKit")
  if (/iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) return true;
  return false;
}

/** Convert a URL-safe base64 VAPID public key to a Uint8Array for the browser API. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function fetchVapidKey(): Promise<string> {
  if (_cachedVapidKey) return _cachedVapidKey;
  const { key } = await api.get<{ key: string }>("/notifications/push/vapid-key");
  _cachedVapidKey = key;
  return key;
}

/** True if the browser supports Web Push at all. */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  // WebViews (webtoapp / GoNative / WebIntoApp wrappers) expose Notification
  // at the OS level but don't implement PushManager — subscriptions always fail.
  if (isWebView()) return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current browser permission state: 'default' | 'granted' | 'denied' */
export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

/** True if the user currently has an active push subscription registered. */
export async function getSubscriptionStatus(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

/**
 * Request permission and subscribe the browser to push notifications.
 * Saves the subscription on the server. Returns `{ success, error? }`.
 */
export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications are not supported in this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, error: "Notification permission was denied. Enable it in your browser settings." };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const key = await fetchVapidKey();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await api.post("/notifications/push/subscribe", {
      endpoint:  json.endpoint,
      keys:      json.keys,
      userAgent: navigator.userAgent.slice(0, 200),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Failed to subscribe to push notifications." };
  }
}

/**
 * Unsubscribe the browser from push notifications and remove the
 * subscription from the server.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await api.post("/notifications/push/unsubscribe", { endpoint });
  } catch (err) {
    console.error("[push] unsubscribe failed", err);
  }
}
