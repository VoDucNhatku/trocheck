type ExtensionAnswer = { ok: boolean; error?: string };

export function requestExtension(type: 'PING' | 'CONNECT', token?: string): Promise<ExtensionAnswer> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', receive);
      reject(new Error(type === 'PING'
        ? 'Chưa tìm thấy extension TrọCheck Collector trong trình duyệt này. Cài hoặc bật extension rồi kết nối lại.'
        : 'Extension chưa trả lời kết nối. Mở extension để kiểm tra kết quả trước khi kết nối lại.'));
    }, type === 'PING' ? 2000 : 90000);
    function receive(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== 'trocheck-extension' || data.requestId !== requestId || data.type !== (type === 'PING' ? 'PONG' : 'CONNECTED')) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', receive);
      resolve({ ok: data.ok === true, error: data.error });
    }
    window.addEventListener('message', receive);
    window.postMessage({ source: 'trocheck-web', type, requestId, ...(token ? { token } : {}) }, window.location.origin);
  });
}
