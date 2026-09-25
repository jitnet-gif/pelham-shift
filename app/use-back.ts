'use client';
import { useEffect, useRef } from 'react';

// 폰의 뒤로 가기는 앱을 닫지 않고 한 단계씩 되돌립니다.
// 페이지마다 useBack 을 한 번만 걸고, 아래 화면이 여는 작은 창은 useBackClose 로 닫는 법만 올려 둡니다.
// 화면마다 popstate 를 따로 들으면 한 번 누를 때 자리가 여러 개 채워져 뒤로 가기가 쌓입니다.
const closers: (() => void)[] = [];

// 아래 화면이 열어 둔 창이 있으면 가장 나중에 연 것 하나를 닫고 true 를 돌려줍니다.
export function closeTop() {
  const close = closers.pop();
  if (!close) return false;
  close();
  return true;
}

// 열려 있는 동안만 뒤로 가기로 닫히게 올려 둡니다.
export function useBackClose(open: boolean, close: () => void) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const fn = () => latest.current();
    closers.push(fn);
    return () => {
      const at = closers.lastIndexOf(fn);
      if (at >= 0) closers.splice(at, 1);
    };
  }, [open]);
}

// step 은 한 걸음을 되돌립니다. 되돌릴 곳이 없으면 아무것도 하지 않고 그 자리에 머뭅니다.
export function useBack(step: () => void) {
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    // 되돌아갈 자리를 항상 하나 채워 둡니다. 이게 없으면 뒤로 가기가 앱을 닫습니다.
    const refill = () => window.history.pushState({ pelham: true }, '');
    refill();
    // 크롬은 손을 대기 전에 채운 자리를 건너뛸 수 있습니다. 처음 손이 닿을 때 한 번 더 채워 둡니다.
    const arm = () => {
      window.removeEventListener('pointerdown', arm, true);
      window.removeEventListener('keydown', arm, true);
      refill();
    };
    window.addEventListener('pointerdown', arm, true);
    window.addEventListener('keydown', arm, true);
    const onPop = () => {
      refill();
      latest.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace') return;
      // 글자를 지우는 중이면 건드리지 않습니다.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', arm, true);
      window.removeEventListener('keydown', arm, true);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
