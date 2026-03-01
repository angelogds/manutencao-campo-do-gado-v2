(function () {
  function base64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function unsupportedMessage() {
    if (isIOS()) {
      if (!isStandalone()) {
        return [
          'No iPhone, as notificações push funcionam no app instalado na Tela de Início.',
          'Isso vale para Safari, Edge e Chrome no iOS.',
          'Abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.',
          'Depois abra o app salvo na Tela de Início e ative os alertas.',
        ].join('\n');
      }
      return 'Seu iPhone não expôs os recursos de push para este app agora. Atualize o iOS e tente novamente pela Tela de Início.';
    }

    return 'Push não suportado neste navegador/dispositivo.';
  }

  async function enablePush() {
    if (!window.isSecureContext) {
      alert('Notificações push exigem HTTPS.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      alert(unsupportedMessage());
      return;
    }

    const vapidPublicKey = window.__VAPID_PUBLIC_KEY__ || '';
    if (!vapidPublicKey) {
      alert('VAPID_PUBLIC_KEY não configurada no servidor. Contate o suporte.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Permissão de notificação não concedida.');
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
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
      alert('Não foi possível ativar os alertas neste dispositivo.');
      console.warn('Falha ao ativar push:', err?.message || err);
    });
  };
})();
