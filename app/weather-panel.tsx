'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Droplets,
  Sun,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';
import { TIME_ZONE } from '@/lib/domain';
import { useLang } from './use-lang';
import './weather-panel.css';

// 골프장은 해가 뜨기 전에 사람이 나옵니다. 스케줄을 보는 자리에서 그 날의 하늘과
// 해 뜨고 지는 시각을 같이 봅니다. Open-Meteo 는 열쇠 없이 열려 있어 서버를 거치지 않습니다.

const API = 'https://api.open-meteo.com/v1/forecast';
// 예보가 닿는 범위. 이보다 먼 날은 불러도 빈 답이 옵니다.
const PAST_DAYS = 92;
const AHEAD_DAYS = 15;

type Day = {
  code: number;
  high: number;
  low: number;
  rain: number;
  sunrise: string;
  sunset: string;
};
type Now = { temp: number; feels: number; code: number; wind: number };
type Reading = { day: Day; now?: Now };

const sky = (code: number) => {
  if (code <= 0) return { Icon: Sun, label: '맑음' };
  if (code === 1) return { Icon: Sun, label: '대체로 맑음' };
  if (code === 2) return { Icon: CloudSun, label: '구름 조금' };
  if (code === 3) return { Icon: Cloudy, label: '흐림' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: '안개' };
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: '이슬비' };
  if (code >= 61 && code <= 67) return { Icon: CloudRain, label: '비' };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, label: '눈' };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, label: '소나기' };
  if (code === 85 || code === 86) return { Icon: CloudSnow, label: '진눈깨비' };
  if (code === 95) return { Icon: CloudLightning, label: '뇌우' };
  if (code === 96 || code === 99) return { Icon: CloudHail, label: '우박을 동반한 뇌우' };
  return { Icon: Cloud, label: '날씨 정보 없음' };
};

// 'YYYY-MM-DDTHH:mm' 에서 시각만 떼어 스케줄 화면과 같은 12시간 표기로 씁니다.
const clock = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12}:${iso.slice(14, 16)} ${h < 12 ? 'AM' : 'PM'}`;
};
const minutes = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const midday = (date: string) => Date.parse(date + 'T12:00:00Z');
const degrees = (v: number) => `${Math.round(v)}°`;
const first = (v: unknown): number =>
  Array.isArray(v) && typeof v[0] === 'number' ? v[0] : NaN;
const firstText = (v: unknown): string =>
  Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '';

export default function WeatherPanel({
  date,
  today,
  spot,
  onRainNotice,
}: {
  date: string;
  today: string;
  // 근무지 좌표. 출퇴근 반경을 잡기 전에는 비어 있습니다.
  spot: { lat: number; lng: number } | null;
  onRainNotice?: () => void;
}) {
  const { t, locale } = useLang();
  const [reading, setReading] = useState<Reading | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const ahead = Math.round((midday(date) - midday(today)) / 86400000);
  const live = date === today;
  // 예보가 닿지 않는 날은 물어볼 것도 없습니다. 그릴 때 바로 갈라 둡니다.
  const far = ahead > AHEAD_DAYS || ahead < -PAST_DAYS;

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (far || !spot) return;
      const url =
        `${API}?latitude=${spot.lat}&longitude=${spot.lng}&timezone=${encodeURIComponent(TIME_ZONE)}` +
        // 온타리오는 섭씨와 km/h 로 날씨를 읽습니다. 급여를 CAD 로 셈하는 곳과 같은 기준입니다.
        '&temperature_unit=celsius&wind_speed_unit=kmh' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
        (live ? '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' : '') +
        `&start_date=${date}&end_date=${date}`;
      fetch(url, { signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((body: Record<string, Record<string, unknown>>) => {
          const daily = body.daily ?? {};
          const sunrise = firstText(daily.sunrise);
          const sunset = firstText(daily.sunset);
          if (!sunrise || !sunset) throw new Error('empty');
          const now = body.current;
          setReading({
            day: {
              code: first(daily.weather_code),
              high: first(daily.temperature_2m_max),
              low: first(daily.temperature_2m_min),
              rain: first(daily.precipitation_probability_max),
              sunrise,
              sunset,
            },
            now:
              live && now && typeof now.temperature_2m === 'number'
                ? {
                    temp: now.temperature_2m,
                    feels: Number(now.apparent_temperature),
                    code: Number(now.weather_code),
                    wind: Number(now.wind_speed_10m),
                  }
                : undefined,
          });
          setState('ready');
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setState('failed');
        });
    },
    [date, far, live, spot],
  );

  useEffect(() => {
    const stop = new AbortController();
    load(stop.signal);
    return () => stop.abort();
  }, [load]);

  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'));
  const day = reading?.day;
  const shown = reading?.now ? reading.now.code : (day?.code ?? -1);
  const { Icon, label } = sky(shown);
  const span = day ? minutes(day.sunset) - minutes(day.sunrise) : 0;

  return (
    <section className="weather" aria-label={t('날씨와 일출·일몰')}>
      <header className="weather-head">
        <Icon size={26} />
        <div>
          <b>{spot && !far && state === 'ready' ? t(label) : t('날씨')}</b>
          <small>{dayLabel}</small>
        </div>
        {spot && !far && state === 'ready' && day && (
          <span className="weather-temp">
            {reading?.now ? degrees(reading.now.temp) : degrees(day.high)}
          </span>
        )}
      </header>
      {!spot ? (
        <p className="weather-note">
          {t('근무지 좌표가 없어 날씨를 불러올 수 없습니다. 출퇴근 반경을 먼저 설정해주세요.')}
        </p>
      ) : far ? (
        <p className="weather-note">{t('이 날짜는 예보 범위를 벗어났습니다.')}</p>
      ) : state === 'loading' ? (
        <p className="weather-note">{t('날씨를 불러오는 중입니다.')}</p>
      ) : state === 'failed' ? (
        <p className="weather-note">
          {t('날씨를 불러오지 못했습니다.')}{' '}
          <button
            className="weather-retry"
            onClick={() => {
              setState('loading');
              load();
            }}
          >
            {t('다시 시도')}
          </button>
        </p>
      ) : null}
      {spot && !far && state === 'ready' && day && (
        <>
          <dl className="weather-sun">
            <div>
              <dt>
                <Sunrise size={17} />
                {t('일출')}
              </dt>
              <dd>{clock(day.sunrise)}</dd>
            </div>
            <div>
              <dt>
                <Sunset size={17} />
                {t('일몰')}
              </dt>
              <dd>{clock(day.sunset)}</dd>
            </div>
            <div>
              <dt>
                <Sun size={17} />
                {t('낮 길이')}
              </dt>
              <dd>
                {t('{h}시간 {m}분', { h: Math.floor(span / 60), m: span % 60 })}
              </dd>
            </div>
          </dl>
          <ul className="weather-facts">
            <li>
              {t('최고 · 최저')}
              <b>
                {degrees(day.high)} · {degrees(day.low)}
              </b>
            </li>
            {Number.isFinite(day.rain) && (
              <li>
                <Droplets size={15} />
                {t('강수 확률')}
                <b>{Math.round(day.rain)}%</b>
              </li>
            )}
            {reading?.now && (
              <li>
                <Wind size={15} />
                {t('바람')}
                <b>{Math.round(reading.now.wind)} km/h</b>
              </li>
            )}
            {reading?.now && Number.isFinite(reading.now.feels) && (
              <li>
                {t('체감')}
                <b>{degrees(reading.now.feels)}</b>
              </li>
            )}
          </ul>
        </>
      )}
      {onRainNotice && (
        <button className="weather-rain" onClick={onRainNotice}>
          <CloudRain size={16} />
          {t('우천 근무 종료')}
        </button>
      )}
    </section>
  );
}
