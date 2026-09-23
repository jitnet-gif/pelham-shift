self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// 앱을 닫아 둔 동안 쌓인 개수. 화면이 없으니 세어 둘 곳이 필요해 캐시 한 칸을 씁니다.
// 알림은 tag 로 겹쳐 하나만 남기 때문에, 띄운 알림 수로는 셀 수 없습니다.
const COUNT = '/__badge';
const readCount = async () => {
  try {
    const hit = await (await caches.open('badge')).match(COUNT);
    return hit ? Number(await hit.text()) || 0 : 0;
  } catch {
    return 0;
  }
};
// 아이콘 숫자를 올립니다. 설치한 앱에서만 보이고, 지원하지 않는 기기에서는 조용히 넘어갑니다.
const paint = async (count) => {
  try {
    await (await caches.open('badge')).put(COUNT, new Response(String(count)));
  } catch {}
  try {
    if (count) await self.navigator.setAppBadge?.(count);
    else await self.navigator.clearAppBadge?.();
  } catch {}
};

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    (async () => {
      // 숫자를 올리다 실패해도 알림은 뜨도록, 알림을 먼저 띄웁니다.
      await self.registration.showNotification(data.title || 'Pelham Shift', {
        body: data.body || '',
        tag: data.tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/' },
      });
      await paint((await readCount()) + 1);
    })(),
  );
});

// 앱을 열면 화면이 진짜 개수(안 읽은 메시지)를 알려 줍니다. 그 값이 맞고, 여기 센 값은 버립니다.
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg?.type === 'badge') event.waitUntil(paint(Math.max(0, Number(msg.count) || 0)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
