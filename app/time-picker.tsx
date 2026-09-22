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

// 창은 열릴 때 새로 붙습니다 — 그래서 지금 값에서 시작하는 데 따로 손볼 것이 없습니다.
export default function TimePicker({
  value,
  label,
  minuteStep = 1,
  onCancel,
  onPick,
}: {
  value: string;
  label: string;
  minuteStep?: number;
  onCancel: () => void;
  onPick: (value: string) => void;
}) {
  const { t } = useLang();
  const [stage, setStage] = useState<'hour' | 'minute'>('hour');
  const [hour24, setHour24] = useState(() => parse(value).hour24);
  const [minute, setMinute] = useState(() => parse(value).minute);
  const face = useRef<HTMLDivElement>(null);

  const pm = hour24 >= 12;
  // 분은 허용된 간격 위에만 섭니다. 30분 단위면 00 과 30 만 고를 수 있습니다.
  const step = Math.max(1, Math.min(30, minuteStep));
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  const hours = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  const marks = stage === 'hour' ? hours : minutes;
  const angleOf = (n: number) => (stage === 'hour' ? ((n % 12) / 12) * 360 : (n / 60) * 360);
  const active = stage === 'hour' ? to12(hour24) : minute;
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
    if (stage === 'hour') setHour12(Math.round(angle / 30) % 12 || 12);
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
            {pad(to12(hour24))}
          </button>
          <em>:</em>
          <button
            className={'clockpick-unit' + (stage === 'minute' ? ' on' : '')}
            onClick={() => setStage('minute')}
          >
            {pad(minute)}
          </button>
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
          <i className="clockpick-hand" style={{ transform: `rotate(${angleOf(active)}deg)` }}>
            <b />
          </i>
          <span className="clockpick-pin" />
          {marks.map((n) => (
            <button
              key={n}
              className={'clockpick-mark' + (n === active ? ' on' : '')}
              style={{
                left: `calc(50% + ${Math.sin((angleOf(n) * Math.PI) / 180) * NUMBER_RADIUS}% )`,
                top: `calc(50% - ${Math.cos((angleOf(n) * Math.PI) / 180) * NUMBER_RADIUS}% )`,
              }}
              onClick={() => {
                if (stage === 'hour') {
                  setHour12(n);
                  setStage('minute');
                } else setMinute(n);
              }}
            >
              {stage === 'hour' ? n : pad(n)}
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
