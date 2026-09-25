'use client';
import { useRef, useState } from 'react';
import { useLang } from './use-lang';

// 앱이 직접 그리는 시계. 기기마다 다르게 뜨는 기본 시간 선택창을 대신하고,
// 아래에는 Cancel 과 Ok 만 둡니다.
const pad = (n: number) => String(n).padStart(2, '0');
const parse = (value: string) => {
  const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return {
    hour24: ok ? Number(value.slice(0, 2)) : 9,
    minute: ok ? Number(value.slice(3, 5)) : 0,
  };
};
// 12시간 표시로 바꾼 값. 자정과 정오는 12로 읽습니다.
const to12 = (hour24: number) => hour24 % 12 || 12;
const NUMBER_RADIUS = 38;
// 24시간 시계의 안쪽 고리. 00 과 13–23 이 여기 섭니다.
const INNER_RADIUS = 25;

// 창은 열릴 때 새로 붙습니다 — 그래서 지금 값에서 시작하는 데 따로 손볼 것이 없습니다.
export default function TimePicker({
  value,
  label,
  minuteStep = 1,
  twentyFour = false,
  onCancel,
  onPick,
}: {
  value: string;
  label: string;
  minuteStep?: number;
  // 켜면 AM/PM 없이 00–23 시로 고릅니다.
  twentyFour?: boolean;
  onCancel: () => void;
  onPick: (value: string) => void;
}) {
  const { t } = useLang();
  const [stage, setStage] = useState<'hour' | 'minute'>('hour');
  const [hour24, setHour24] = useState(() => parse(value).hour24);
  const [minute, setMinute] = useState(() => parse(value).minute);
  const face = useRef<HTMLDivElement>(null);

  const pm = hour24 >= 12;
  // 분은 허용된 간격 위에만 섭니다. 10분 단위면 00, 10, 20, 30, 40, 50 만 고를 수 있습니다.
  const step = Math.max(1, Math.min(30, minuteStep));
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  const hours = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  // 눈금마다 값·글자·반지름을 둡니다. 24시간이면 바깥은 1–12, 안쪽은 00·13–23 입니다.
  const marks =
    stage === 'minute'
      ? minutes.map((n) => ({ n, text: pad(n), r: NUMBER_RADIUS }))
      : twentyFour
        ? [
            ...hours.map((n) => ({ n, text: String(n), r: NUMBER_RADIUS })),
            ...hours.map((n) => ({ n: (n + 12) % 24, text: pad((n + 12) % 24), r: INNER_RADIUS })),
          ]
        : hours.map((n) => ({ n, text: String(n), r: NUMBER_RADIUS }));
  const angleOf = (n: number) => (stage === 'hour' ? ((n % 12) / 12) * 360 : (n / 60) * 360);
  const active = stage === 'hour' ? (twentyFour ? hour24 : to12(hour24)) : minute;
  const inner = twentyFour && stage === 'hour' && (hour24 === 0 || hour24 > 12);
  const setHour12 = (h: number) => setHour24((h % 12) + (pm ? 12 : 0));
  const setMeridiem = (next: boolean) => setHour24((h) => (h % 12) + (next ? 12 : 0));

  // 시계판 위의 손가락 위치를 눈금으로 읽습니다. 12시 방향이 0도입니다.
  const pointAt = (event: { clientX: number; clientY: number }) => {
    const box = face.current?.getBoundingClientRect();
    if (!box) return;
    const angle =
      (Math.atan2(event.clientX - (box.left + box.width / 2), (box.top + box.height / 2) - event.clientY) *
        180) /
        Math.PI +
      360;
    const h12 = Math.round(angle / 30) % 12 || 12;
    if (stage === 'hour' && twentyFour) {
      // 가운데에서 두 고리 사이보다 가까우면 안쪽 고리(00·13–23)로 읽습니다.
      const dist = Math.hypot(event.clientX - (box.left + box.width / 2), event.clientY - (box.top + box.height / 2));
      setHour24(dist < (box.width * (NUMBER_RADIUS + INNER_RADIUS)) / 200 ? (h12 + 12) % 24 : h12);
    } else if (stage === 'hour') setHour12(h12);
    else {
      const raw = (Math.round((angle % 360) / (step * 6)) * step) % 60;
      setMinute(raw);
    }
  };

  return (
    <dialog className="clockpick" open aria-label={label}>
      <div className="clockpick-scrim" />
      <div className="clockpick-box">
        <p className="clockpick-label">{label}</p>
        <div className="clockpick-readout">
          <button
            className={'clockpick-unit' + (stage === 'hour' ? ' on' : '')}
            onClick={() => setStage('hour')}
          >
            {pad(twentyFour ? hour24 : to12(hour24))}
          </button>
          <em>:</em>
          <button
            className={'clockpick-unit' + (stage === 'minute' ? ' on' : '')}
            onClick={() => setStage('minute')}
          >
            {pad(minute)}
          </button>
          {!twentyFour && (
          <span className="clockpick-half">
            <button
              className={pm ? '' : 'on'}
              aria-pressed={!pm}
              onClick={() => setMeridiem(false)}
            >
              AM
            </button>
            <button className={pm ? 'on' : ''} aria-pressed={pm} onClick={() => setMeridiem(true)}>
              PM
            </button>
          </span>
          )}
        </div>
        <div
          className="clockpick-face"
          ref={face}
          // 숫자를 눌러도 되고, 바늘을 끌어도 됩니다. 키보드로는 아래 숫자 버튼을 씁니다.
          role="presentation"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pointAt(e);
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && pointAt(e)}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (stage === 'hour') setStage('minute');
          }}
        >
          <i
            className="clockpick-hand"
            style={{
              transform: `rotate(${angleOf(active)}deg)`,
              ...(inner && { top: `${50 - INNER_RADIUS}%`, height: `${INNER_RADIUS}%` }),
            }}
          >
            <b />
          </i>
          <span className="clockpick-pin" />
          {marks.map(({ n, text, r }) => (
            <button
              key={n}
              className={'clockpick-mark' + (r === INNER_RADIUS ? ' inner' : '') + (n === active ? ' on' : '')}
              style={{
                left: `calc(50% + ${Math.sin((angleOf(n) * Math.PI) / 180) * r}% )`,
                top: `calc(50% - ${Math.cos((angleOf(n) * Math.PI) / 180) * r}% )`,
              }}
              onClick={() => {
                if (stage === 'hour') {
                  if (twentyFour) setHour24(n);
                  else setHour12(n);
                  setStage('minute');
                } else setMinute(n);
              }}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="clockpick-foot">
          <button onClick={onCancel}>{t('cancel::취소')}</button>
          <button onClick={() => onPick(`${pad(hour24)}:${pad(minute)}`)}>{t('ok::확인')}</button>
        </div>
      </div>
    </dialog>
  );
}
