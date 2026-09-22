// 두 화면은 기능과 데이터가 같고, 고른 값은 기기별로 기억합니다.
export type Layout = 'pelham' | 'seven';
export const LAYOUT_KEY = 'pelham-shift-layout';
// 지금은 8 shift 화면만 씁니다. 예전에 기본 화면을 골라 둔 기기도 이쪽으로 옵니다.
// 다시 고르게 하려면 아래 한 줄을 지우고 저장된 값을 읽도록 되돌리면 됩니다.
export const readLayout = (): Layout => 'seven';
