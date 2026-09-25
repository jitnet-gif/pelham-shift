'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type * as Leaflet from 'leaflet';
import { Crosshair, MapPin, RefreshCw } from 'lucide-react';
import { useLang } from '../use-lang';

type StaffSpot = { lat: number; lng: number; accuracy: number | null; at: string };
type StaffRow = { id: string; name: string; color: string; area: string; in: string; spot: StaffSpot | null };
type Workplace = { lat: number; lng: number; radius: number };
type Feed = { workplace: Workplace | null; staff: StaffRow[]; now: string };

// 지도를 다시 읽는 간격. 직원 앱은 1분마다 자리를 보내므로 이보다 자주 읽어도 달라지는 것이 없습니다.
const POLL_MS = 30000;
// 이만큼 소식이 없으면 흐리게 그립니다. 앱을 닫았거나 화면을 꺼 둔 것입니다 — 마지막 자리일 뿐 지금 자리가 아닙니다.
const STALE_MS = 10 * 60000;

const mapLink = (s: { lat: number; lng: number }) =>
  'https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lng;

export default function StaffMap() {
  const { t } = useLang();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<{ text: string; login?: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  // 처음 한 번만 모두가 보이게 맞춥니다. 읽을 때마다 맞추면 관리자가 옮겨 둔 화면이 30초마다 튑니다.
  const fitted = useRef(false);

  useEffect(() => {
    document.title = t('Pelham Admin · 직원 위치');
  }, [t]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/location', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as Feed & { error?: string };
      if (!res.ok) {
        setError({ text: body.error || t('불러오지 못했습니다.'), login: res.status === 401 || res.status === 403 });
        return;
      }
      setError(null);
      setFeed(body);
      setNow(Date.now());
    } catch {
      setError({ text: t('서버에 닿지 못했습니다. 잠시 뒤 다시 읽습니다.') });
    }
  }, [t]);

  // 화면을 보고 있는 동안에만 다시 읽습니다. 돌아오면 바로 한 번 읽습니다.
  useEffect(() => {
    void load();
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
      else setNow(Date.now());
    }, POLL_MS);
    const back = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', back);
    };
  }, [load]);

  // Leaflet 은 window 를 곧바로 만지므로 서버에서는 불러오지 않고, 화면에 붙은 뒤에만 불러옵니다.
  useEffect(() => {
    let gone = false;
    void import('leaflet').then((L) => {
      if (gone || !box.current || map.current) return;
      lib.current = L;
      map.current = L.map(box.current, { zoomControl: true }).setView([42.98515, -79.30084], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setNow(Date.now());
    });
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  const fitAll = useCallback(() => {
    const L = lib.current;
    if (!L || !map.current || !feed) return;
    const points: [number, number][] = feed.staff.flatMap((s) => (s.spot ? [[s.spot.lat, s.spot.lng] as [number, number]] : []));
    if (feed.workplace) {
      const w = L.latLng(feed.workplace.lat, feed.workplace.lng).toBounds(feed.workplace.radius * 2);
      points.push([w.getSouth(), w.getWest()], [w.getNorth(), w.getEast()]);
    }
    if (points.length) map.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 18 });
  }, [feed]);

  // 읽어 온 자리를 지도에 다시 그립니다. 근무지는 반경 원으로, 직원은 직군 색 점과 이름표로.
  useEffect(() => {
    const L = lib.current;
    if (!L || !layer.current || !feed) return;
    layer.current.clearLayers();
    if (feed.workplace) {
      L.circle([feed.workplace.lat, feed.workplace.lng], {
        radius: feed.workplace.radius,
        color: '#087e6d',
        weight: 1.5,
        fillOpacity: 0.06,
        interactive: false,
      }).addTo(layer.current);
    }
    for (const s of feed.staff) {
      if (!s.spot) continue;
      const stale = now - Date.parse(s.spot.at) > STALE_MS;
      if (s.spot.accuracy && s.spot.accuracy > 15)
        L.circle([s.spot.lat, s.spot.lng], {
          radius: s.spot.accuracy,
          color: s.color,
          weight: 0,
          fillOpacity: stale ? 0.05 : 0.12,
          interactive: false,
        }).addTo(layer.current);
      L.circleMarker([s.spot.lat, s.spot.lng], {
        radius: 9,
        color: '#fff',
        weight: 2.5,
        fillColor: stale ? '#9aa6a2' : s.color,
        fillOpacity: 1,
      })
        .bindTooltip(s.name, { permanent: true, direction: 'top', offset: [0, -10], className: 'staffmap-tag' + (stale ? ' is-stale' : '') })
        .addTo(layer.current);
    }
    if (!fitted.current && map.current) {
      fitted.current = true;
      fitAll();
    }
  }, [feed, now, fitAll]);

  const focus = (s: StaffRow) => {
    if (s.spot && map.current) map.current.setView([s.spot.lat, s.spot.lng], 18);
  };

  const ago = (at: string) => {
    const mins = Math.max(0, Math.floor((now - Date.parse(at)) / 60000));
    return mins < 1 ? t('방금') : t('{n}분 전', { n: mins });
  };

  const located = feed?.staff.filter((s) => s.spot).length ?? 0;

  return (
    <div className="staffmap">
      <header className="staffmap-head">
        <div>
          <div className="eyebrow">ADMIN</div>
          <h1>{t('직원 위치')}</h1>
          <p>{t('출근을 찍어 둔 직원만 보입니다. 직원 앱이 열려 있는 동안 1분마다 자리가 갱신됩니다.')}</p>
        </div>
        <div className="staffmap-actions">
          <button className="button" onClick={fitAll} disabled={!feed}>
            <Crosshair size={16} /> {t('모두 보기')}
          </button>
          <button className="button" onClick={() => void load()}>
            <RefreshCw size={16} /> {t('다시 불러오기')}
          </button>
        </div>
      </header>
      {error && (
        <div className="staffmap-error" role="alert">
          {t(error.text)}
          {error.login && (
            <Link className="button primary" href="/">
              {t('관리자로 로그인')}
            </Link>
          )}
        </div>
      )}
      <div className="staffmap-body">
        <div className="staffmap-map" ref={box} />
        <aside className="staffmap-list">
          <h2>
            {t('근무 중')} <span>{feed ? t('{a}명 중 {b}명 위치 확인', { a: feed.staff.length, b: located }) : ''}</span>
          </h2>
          {feed && feed.staff.length === 0 && <p className="staffmap-empty">{t('지금 출근해 있는 직원이 없습니다.')}</p>}
          <ul>
            {feed?.staff.map((s) => {
              const stale = !!s.spot && now - Date.parse(s.spot.at) > STALE_MS;
              return (
                <li key={s.id} className={!s.spot || stale ? 'is-stale' : ''}>
                  <button
                    className="staffmap-person"
                    onClick={() => focus(s)}
                    disabled={!s.spot}
                    aria-label={s.name}
                  >
                    <i style={{ background: s.color }} />
                    <span>
                      <b>{s.name}</b>
                      <small>
                        {[s.area, t('{a} 출근', { a: s.in })].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                  </button>
                  {s.spot ? (
                    <a className="staffmap-seen" href={mapLink(s.spot)} target="_blank" rel="noreferrer noopener">
                      <MapPin size={13} />
                      {ago(s.spot.at)}
                      {s.spot.accuracy != null && <em>{t('±{n}m', { n: s.spot.accuracy })}</em>}
                    </a>
                  ) : (
                    <span className="staffmap-seen">{t('위치 없음 · 앱이 닫혀 있습니다')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
