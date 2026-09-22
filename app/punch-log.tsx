'use client';
// next/image 를 쓰지 않습니다. 그 파이프라인은 이미지를 서버에 캐시하는데,
// 이 사진은 사람 얼굴이라 no-store 로 내보내고 있습니다. 캐시하면 그 뜻이 사라집니다.
// oxlint-disable next/no-img-element
import { useState } from 'react';
import { Camera, Coffee, X } from 'lucide-react';
import type { Employee, Punch } from '@/lib/domain';
import { duration } from '@/lib/domain';
import { useLang } from './use-lang';

// 단말에서 찍힌 출퇴근 기록. 사진은 state 에 없고 필요할 때 한 장씩 불러옵니다.
const photoSrc = (punchId: string, kind: 'in' | 'out') =>
  '/api/punch-photo?punch=' + encodeURIComponent(punchId) + '&kind=' + kind;
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
  // 크게 볼 사진 한 장. 닫으면 다시 비웁니다.
  const [shown, setShown] = useState<{ id: string; kind: 'in' | 'out'; who: string } | null>(null);
  // 사진은 두 급여 기간이 지나면 지워지지만 찍힌 시각은 기록에 남습니다.
  // 지워진 사진을 부르면 깨진 그림이 뜨므로, 한 번 실패한 자리는 안내로 바꿉니다.
  const [gone, setGone] = useState<string[]>([]);
  const missing = (id: string, kind: string) => gone.includes(id + ':' + kind);
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

            <div className="punchlog-shots">
              {([
                ['in', p.photoAt, '출근 사진'],
                ['out', p.outPhotoAt, '퇴근 사진'],
              ] as const).map(([kind, at, caption]) =>
                at && !missing(p.id, kind) ? (
                  <button
                    className="punchlog-shot"
                    key={kind}
                    onClick={() =>
                      setShown({ id: p.id, kind, who: (who?.name ?? '') + ' · ' + t(caption) })
                    }
                  >
                    <img
                      src={photoSrc(p.id, kind)}
                      alt={t(caption)}
                      loading="lazy"
                      decoding="async"
                      onError={() =>
                        setGone((list) =>
                          list.includes(p.id + ':' + kind) ? list : [...list, p.id + ':' + kind],
                        )
                      }
                    />
                    <span>{t(caption)}</span>
                  </button>
                ) : (
                  <span className="punchlog-shot none" key={kind}>
                    <Camera size={16} />
                    <span>
                      {t(caption)}{' '}
                      {/* 왜 못 불러왔는지는 화면에서 알 수 없습니다 — 보관 기간이 지났을 수도,
                          저장이 실패했을 수도 있어 단정하지 않습니다. */}
                      {at ? t('불러오지 못함') : t('없음')}
                    </span>
                  </span>
                ),
              )}
            </div>
          </article>
        );
      })}

      {shown && (
        <dialog className="punchlog-view" open aria-label={shown.who}>
          <button
            className="punchlog-viewscrim"
            aria-label={t('닫기')}
            onClick={() => setShown(null)}
          />
          <figure>
            <img src={photoSrc(shown.id, shown.kind)} alt={shown.who} />
            <figcaption>{shown.who}</figcaption>
          </figure>
          <button
            className="punchlog-close"
            aria-label={t('닫기')}
            onClick={() => setShown(null)}
          >
            <X size={22} />
          </button>
        </dialog>
      )}
    </div>
  );
}
