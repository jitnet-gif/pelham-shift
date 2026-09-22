'use client';
// next/image 를 쓰지 않습니다. 그 파이프라인은 이미지를 서버에 캐시하는데,
// 이 사진은 사람 얼굴이라 no-store 로 내보내고 있습니다. 캐시하면 그 뜻이 사라집니다.
// oxlint-disable next/no-img-element
import { useEffect, useState } from 'react';
import { Camera, Coffee, MapPin, X } from 'lucide-react';
import type { Employee, Punch, PunchSpot } from '@/lib/domain';
import { duration } from '@/lib/domain';
import { useLang } from './use-lang';
import { prunePunchPhotos, readPunchPhoto } from './punch-photo-store';

// 단말에서 찍힌 출퇴근 기록. 사진은 서버에 남지 않으므로, 찍은 자리와 확인 여부만 보여 줍니다.
const mapLink = (spot: PunchSpot) =>
  'https://www.google.com/maps/search/?api=1&query=' + spot.lat + ',' + spot.lng;
const coords = (spot: PunchSpot) => spot.lat.toFixed(5) + ', ' + spot.lng.toFixed(5);
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function PunchLog({
  punches,
  employees,
  isAdmin,
}: {
  punches: Punch[];
  employees: Employee[];
  isAdmin: boolean;
}) {
  const { t, locale } = useLang();
  // 사진은 서버에 없습니다. 찍은 기기 안에만 있어, 그 기기에서 볼 때만 뜹니다.
  const [mine, setMine] = useState<Record<string, string>>({});
  const [big, setBig] = useState<{ src: string; who: string } | null>(null);
  // 찾아볼 사진 목록. punches 는 렌더마다 새 배열이라 그대로 의존성에 쓰면 effect 가 끝없이 돕니다.
  // 내용이 같으면 같은 문자열이 나오도록 만들어 그것을 기준으로 삼습니다.
  const wanted = punches
    .flatMap((p) => [p.photoAt ? p.id + ':in' : '', p.outPhotoAt ? p.id + ':out' : ''])
    .filter(Boolean)
    .join(',');
  useEffect(() => {
    let alive = true;
    void prunePunchPhotos();
    void (async () => {
      const found: Record<string, string> = {};
      for (const key of wanted ? wanted.split(',') : []) {
        const [punchId, kind] = key.split(':');
        const photo = await readPunchPhoto(punchId, kind === 'out' ? 'out' : 'in');
        if (photo) found[key] = photo;
      }
      if (alive) setMine(found);
    })();
    return () => {
      alive = false;
    };
  }, [wanted]);
  const of = (id: string) => employees.find((e) => e.id === id);
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));
  const list = [...punches].sort(
    (a, b) => b.date.localeCompare(a.date) || b.in.localeCompare(a.in),
  );
  // 찍힌 휴게 전부. 화면에 얼마나 쉬었는지 보여 주는 값입니다.
  const restMinutes = (p: Punch) =>
    (p.breaks ?? []).reduce(
      (n, b) => n + (b.end ? Math.round(duration(b.start, b.end) * 60) : 0),
      0,
    );
  // 근무시간에서 빠지는 건 무급 휴게뿐입니다. 유급 휴게는 일한 시간으로 칩니다 — 급여도 같은 규칙입니다.
  const unpaidMinutes = (p: Punch) =>
    (p.breaks ?? []).reduce(
      (n, b) => n + (!b.paid && b.end ? Math.round(duration(b.start, b.end) * 60) : 0),
      0,
    );
  const label = (status?: string) =>
    t(
      ({ pending: '확인 대기', approved: '확인됨', disputed: '이의 있음' } as Record<string, string>)[
        status ?? 'pending'
      ] || '확인 대기',
    );

  if (!list.length)
    return <p className="punchlog-empty">{t('아직 찍힌 출퇴근 기록이 없습니다.')}</p>;

  return (
    <div className="punchlog">
      {list.map((p) => {
        const who = of(p.employeeId);
        const rest = restMinutes(p);
        const worked = p.out ? Math.max(0, duration(p.in, p.out) - unpaidMinutes(p) / 60) : 0;
        return (
          <article className="punchlog-row" key={p.id}>
            <div className="punchlog-when">
              <b>{dayLabel(p.date)}</b>
              {isAdmin && (
                <span className="punchlog-who">
                  <i style={{ background: who?.color }} />
                  {who?.name ?? p.employeeId}
                </span>
              )}
            </div>

            <div className="punchlog-times">
              <span className="punchlog-stamp">
                <small>{t('출근')}</small>
                <b>{clock(p.in)}</b>
              </span>
              <em>→</em>
              <span className="punchlog-stamp">
                <small>{t('퇴근')}</small>
                <b>{p.out ? clock(p.out) : t('근무 중')}</b>
              </span>
              {p.out && (
                <span className="punchlog-worked">
                  {t('{h}시간', { h: worked.toFixed(2) })}
                </span>
              )}
            </div>

            <div className="punchlog-meta">
              {p.area && <span className="punchlog-area">{p.area}</span>}
              {rest > 0 && (
                <span className="punchlog-rest">
                  <Coffee size={13} />
                  {t('휴게 {n}분', { n: rest })}
                  {unpaidMinutes(p) > 0 && ' · ' + t('무급 {n}분', { n: unpaidMinutes(p) })}
                </span>
              )}
              <span className={'punchlog-mark ' + (p.status ?? 'pending')}>
                {label(p.status)}
              </span>
            </div>
            {p.disputeNote && <p className="punchlog-note">{p.disputeNote}</p>}

            <div className="punchlog-spots">
              {([
                ['in', p.spot, p.photoAt, '출근'],
                ['out', p.outSpot, p.outPhotoAt, '퇴근'],
              ] as const).map(([kind, spot, at, caption]) => (
                <div className="punchlog-spot" key={kind}>
                  <small>{t(caption)}</small>
                  {spot ? (
                    <a href={mapLink(spot)} target="_blank" rel="noreferrer noopener">
                      <MapPin size={14} />
                      <span>{coords(spot)}</span>
                      {spot.accuracy != null && (
                        <em>{t('±{n}m', { n: spot.accuracy })}</em>
                      )}
                    </a>
                  ) : (
                    <span className="none">
                      <MapPin size={14} />
                      {at ? t('위치 없음') : t('기록 없음')}
                    </span>
                  )}
                  {at &&
                    (mine[p.id + ':' + kind] ? (
                      <button
                        className="punchlog-mine"
                        onClick={() =>
                          setBig({
                            src: mine[p.id + ':' + kind],
                            who: (who?.name ?? '') + ' · ' + t(caption),
                          })
                        }
                      >
                        <img src={mine[p.id + ':' + kind]} alt={t(caption)} />
                        <span>
                          <Camera size={13} />
                          {t('사진 보기')}
                        </span>
                      </button>
                    ) : (
                      <span className="punchlog-seen">
                        <Camera size={13} />
                        {t('사진 확인됨')}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          </article>
        );
      })}

      {big && (
        <dialog className="punchlog-view" open aria-label={big.who}>
          <button
            className="punchlog-viewscrim"
            aria-label={t('닫기')}
            onClick={() => setBig(null)}
          />
          <figure>
            <img src={big.src} alt={big.who} />
            <figcaption>{big.who}</figcaption>
          </figure>
          <button className="punchlog-close" aria-label={t('닫기')} onClick={() => setBig(null)}>
            <X size={22} />
          </button>
        </dialog>
      )}
    </div>
  );
}
