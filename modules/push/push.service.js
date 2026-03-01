const db = require('../../database/db');

let webPush = null;
try {
  webPush = require('web-push');
} catch (_e) {
  webPush = null;
}

function hasVapidConfig() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function saveSubscription({ userId, subscription }) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Subscription inválida.');
  }

  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `).run(userId ? Number(userId) : null, endpoint, p256dh, auth);

  return { ok: true };
}

function listSubscriptions() {
  return db.prepare(`
    SELECT id, endpoint, p256dh, auth
    FROM push_subscriptions
    ORDER BY id ASC
  `).all();
}

function removeSubscriptionById(id) {
  db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(Number(id));
}

async function sendPushToAll(payload) {
  if (!webPush || !hasVapidConfig()) return { sent: 0, skipped: 0 };

  const items = listSubscriptions();
  if (!items.length) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const sub of items) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      const code = Number(err?.statusCode || 0);
      if (code === 404 || code === 410) {
        removeSubscriptionById(sub.id);
      }
      skipped += 1;
    }
  }

  return { sent, skipped };
}

module.exports = {
  saveSubscription,
  sendPushToAll,
};
