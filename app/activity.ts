// 앱 사용 기록을 서버(/api/activity)에 알립니다. 한 화면에서 처음 부르면 'open', 그다음부터는 화면을 옮긴 'tab' 입니다.
// 같은 화면을 거듭 알리지 않고, 실패해도 화면에는 아무 일도 일어나지 않습니다.
const last: Record<string, string> = {};
export function track(app: string, screen = '') {
  if (typeof window === 'undefined' || last[app] === screen) return;
  const action = app in last ? 'tab' : 'open';
  last[app] = screen;
  void fetch('/api/activity' + window.location.search, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, app, screen }),
    keepalive: true,
  }).catch(() => {});
}
