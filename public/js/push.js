(function () {
  function base64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function enablePush() {
    if (!window.isSecureContext) {
      alert('Notificações push exigem HTTPS.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      alert('Push não suportado neste navegador.');
      return;
    }

    const vapidPublicKey = window.__VAPID_PUBLIC_KEY__ || '';
    if (!vapidPublicKey) {
      alert('VAPID_PUBLIC_KEY não configurada no servidor.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(vapidPublicKey),
    });

    const response = await fetch('/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) {
      throw new Error('Falha ao registrar inscrição push.');
    }

    const button = document.getElementById('btn-ativar-push');
    if (button) {
      button.textContent = 'Alertas ativados neste dispositivo';
      button.disabled = true;
    }
  }

  window.enablePush = function () {
    enablePush().catch(function (err) {
      console.warn('Falha ao ativar push:', err?.message || err);
    });
  };
})();
