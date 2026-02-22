const db = require('../../database/db');

let webPush = null;
try {
  webPush = require('web-push');
} catch (_e) {
  webPush = null;
}

function configureWebPush() {
  if (!webPush) return false;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@campodogado.local';
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function saveSubscription(input) {
  const payload = input || {};
  const userId = payload.userId;
  const userAgent = payload.userAgent;
  const subscription = payload.subscription || {};
  const endpoint = subscription.endpoint;
  const keys = subscription.keys || {};

  if (!userId || !endpoint || !keys.p256dh || !keys.auth) {
    throw new Error('Subscription inválida.');
  }

  const sql = [
    'INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)',
    "VALUES (?, ?, ?, ?, ?, datetime('now'))",
    'ON CONFLICT(endpoint) DO UPDATE SET',
    '  user_id = excluded.user_id,',
    '  p256dh = excluded.p256dh,',
    '  auth = excluded.auth,',
    '  user_agent = excluded.user_agent,',
    "  updated_at = datetime('now')",
  ].join('\n');

  db.prepare(sql).run(Number(userId), endpoint, keys.p256dh, keys.auth, userAgent || null);
  return { ok: true };
}

function listSubscriptionsForUsers(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const inPlaceholders = userIds.map(function () { return '?'; }).join(',');
  const sql =
    'SELECT id, user_id, endpoint, p256dh, auth ' +
    'FROM web_push_subscriptions ' +
    'WHERE user_id IN (' + inPlaceholders + ')';

  return db.prepare(sql).all(...userIds.map(Number));
}

function targetUserIdsForOS() {
  return db.prepare('SELECT id FROM users WHERE ativo = 1').all().map(function (u) {
    return Number(u.id);
  });
}

function createNotificationRows(input) {
  const payload = input || {};
  const osId = payload.osId;
  const title = payload.title;
  const body = payload.body;
  const grau = payload.grau;

  const userIds = targetUserIdsForOS();
  const stmt = db.prepare(
    "INSERT INTO notificacoes_os (os_id, user_id, titulo, corpo, grau, status) VALUES (?, ?, ?, ?, ?, 'PENDENTE')"
  );

  for (const userId of userIds) {
    stmt.run(Number(osId), userId, title, body, grau || null);
  }
  return userIds;
}

async function sendOSPushNotifications(input) {
  const payloadInput = input || {};
  const osId = payloadInput.osId;
  const equipamento = payloadInput.equipamento;
  const grau = payloadInput.grau;
  const descricao = payloadInput.descricao;

  const resumo = String(descricao || '').slice(0, 120);
  const grauNorm = String(grau || '').toUpperCase();
  const isCritica = ['CRITICO', 'CRÍTICO', 'ALTO', 'EMERGENCIAL'].includes(grauNorm);
  const titlePrefix = isCritica ? 'OS CRÍTICA' : 'Nova OS';
  const title = titlePrefix + ' - ' + (equipamento || 'Equipamento');
  const body = 'OS #' + osId + ' • Grau: ' + (grau || '-') + ' • ' + resumo;

  const userIds = createNotificationRows({ osId, title, body, grau });
  const subscriptions = listSubscriptionsForUsers(userIds);
  if (!subscriptions.length) return { sent: 0, skipped: userIds.length };

  const enabled = configureWebPush();
  if (!enabled) return { sent: 0, skipped: subscriptions.length };

  let sent = 0;
  for (const sub of subscriptions) {
    const pushPayload = JSON.stringify({
      title: title,
      body: body,
      data: { id_os: Number(osId), url: '/os/' + osId },
    });

    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload
      );

      db.prepare(
        "UPDATE notificacoes_os SET status='ENVIADO', enviado_em=datetime('now') WHERE os_id=? AND user_id=?"
      ).run(Number(osId), Number(sub.user_id));
      sent += 1;
    } catch (e) {
      db.prepare("UPDATE notificacoes_os SET status='ERRO', erro=? WHERE os_id=? AND user_id=?").run(
        String((e && e.message) || e),
        Number(osId),
        Number(sub.user_id)
      );
    }
  }

  return { sent: sent, skipped: Math.max(0, subscriptions.length - sent) };
}

module.exports = { saveSubscription, sendOSPushNotifications, configureWebPush };
