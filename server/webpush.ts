/**
 * Web Push Notifications Helper
 * Gerencia envio de notificações push para dispositivos PWA
 */
import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions, metasIndicadores } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Configurar VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = "mailto:admin@pedreirasollar.com.br";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

/**
 * Envia notificação push para um usuário específico
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[WebPush] VAPID keys not configured, skipping push");
    return { sent: 0, failed: 0 };
  }

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/icons/icon-192.png",
          badge: payload.badge || "/icons/icon-192.png",
          tag: payload.tag || "solar-alert",
          data: payload.data || { url: "/mobile" },
          requireInteraction: payload.requireInteraction || false,
        })
      );
      sent++;
    } catch (err: any) {
      failed++;
      // Remover subscriptions inválidas (410 Gone)
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  return { sent, failed };
}

/**
 * Envia notificação push para todos os usuários com subscriptions
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[WebPush] VAPID keys not configured, skipping push");
    return { sent: 0, failed: 0 };
  }

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subs = await db.select().from(pushSubscriptions);

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/icons/icon-192.png",
          badge: payload.badge || "/icons/icon-192.png",
          tag: payload.tag || "solar-alert",
          data: payload.data || { url: "/mobile" },
          requireInteraction: payload.requireInteraction || false,
        })
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }

  return { sent, failed };
}

export const vapidPublicKey = VAPID_PUBLIC_KEY;
