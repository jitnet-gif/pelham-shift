// 이 기기를 푸시 알림에 등록합니다. 스케줄 앱과 출퇴근 앱이 같이 씁니다.
// 구독은 주소(origin)마다 하나라 어느 쪽에서 켜도 두 앱에 모두 알림이 옵니다.

// 지금 이 기기가 알림을 받도록 되어 있는지. 권한만 있고 구독이 없으면 켜진 것이 아닙니다.
export const pushOn = async () => {
  try {
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
    return !!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
};

const send = async (query: string, body: unknown) => {
  const r = await fetch('/api/push' + query, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await r.json()) as { error?: string };
  if (!r.ok) throw Error(json.error);
  return json;
};

// 켜기. 실패하면 사람이 읽을 수 있는 이유로 던집니다 — 부르는 쪽이 그대로 띄웁니다.
export async function subscribePush(query: string, lang: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined')
    throw Error('이 브라우저에서는 푸시 알림을 켤 수 없습니다. iPhone은 Safari 공유 버튼 → 홈 화면에 추가한 뒤, 홈 화면 앱에서 켜세요.');
  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== 'granted')
    throw Error('알림 권한이 허용되지 않았습니다. 브라우저 설정에서 이 사이트의 알림을 허용하세요.');
  const r = await fetch('/api/push' + query);
  const json = (await r.json()) as { publicKey?: string; error?: string };
  if (!r.ok || !json.publicKey) throw Error(json.error);
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  const key = atob(json.publicKey.replaceAll('-', '+').replaceAll('_', '/'));
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(key, (c) => c.charCodeAt(0)),
  });
  await send(query, { action: 'subscribe', subscription: sub.toJSON(), lang });
}

// 이미 켜 둔 기기의 말을 바꿉니다. 알림 문구는 서버가 기기별로 고르기 때문입니다.
export async function relangPush(query: string, lang: string) {
  try {
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
    if (sub) await send(query, { action: 'subscribe', subscription: sub.toJSON(), lang });
  } catch {}
}
