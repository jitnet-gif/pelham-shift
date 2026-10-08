'use client';
import './cart-board.css';
import { useEffect, useState } from 'react';
import { ListOrdered, PlugZap, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  CART_GAUGE,
  CART_LINEUP_MAX,
  cartLineup,
  cartStatus,
  localTime,
  type Cart,
  type CartStatus,
} from '@/lib/domain';
import { useLang } from './use-lang';

// 골프 카트 60대의 충전 보드입니다. 칸 하나가 카트 한 대입니다.
//   녹색 번개: 충전 완료 — 누르면 손님에게 내준 것(1회)으로 적습니다.
//   반 칸: 1회 사용 — 한 번 더 나갈 수 있습니다. 1회만 쓴 카트는 충전하지 않습니다.
//   빨간 칸: 다 씀 — 잠깁니다. 누르면 충전 시작을 묻습니다.
//   주황 번개: 충전중 — 잠깁니다. 누르면 게이지(1–5칸)와 메모를 적고 충전 완료합니다.
// 완충이 안 된 카트는 칸 아래에 게이지가 붙고 한 번만 나갑니다. 라인업에 세운 카트는 파란 테두리와 순서 번호가 붙습니다.
// 직원 누구나 누릅니다. 누가 눌렀는지는 최근 기록과 활동 로그에 남습니다.
// 칸 수는 보드 폭에 맞춰 5 · 10 · 12칸으로 바뀝니다(cart-board.css 의 container 질의).
type Filter = 'all' | CartStatus | 'partial';
const UNDO_SHOW_MS = 6000;

function Cell({
  cart,
  order,
  small,
  onClick,
  disabled,
}: {
  cart: Cart;
  order?: number;
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const { t } = useLang();
  const st = cartStatus(cart);
  const partial = st === 'ready' && !!cart.level;
  const label = t('{no}번 카트', { no: cart.no }) + ' · ' + t(STATUS_LABEL[st]);
  return (
    <button
      type="button"
      className={
        'cart-cell is-' +
        st +
        (partial ? ' partial' : '') +
        (cart.memo && st !== 'charging' ? ' has-memo' : '') +
        (order ? ' in-line' : '') +
        (small ? ' small' : '')
      }
      aria-label={label + (order ? ' · ' + t('라인업 {n}번', { n: order }) : '')}
      title={cart.memo || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="cart-no">{cart.no}</span>
      {(st === 'ready' || st === 'charging') && <Zap className="cart-icon" aria-hidden="true" />}
      {st === 'empty' && <PlugZap className="cart-icon" aria-hidden="true" />}
      {partial && (
        <span className="cart-gauge" aria-hidden="true">
          {Array.from({ length: CART_GAUGE }, (_, i) => (
            <i key={i} className={i < (cart.level ?? 0) ? 'on' : ''} />
          ))}
        </span>
      )}
      {order ? <span className="cart-order">{order}</span> : null}
    </button>
  );
}

const STATUS_LABEL: Record<CartStatus, string> = {
  ready: '충전 완료',
  half: '1회 사용',
  empty: '충전 필요',
  charging: '충전중',
};

export default function CartBoard({
  carts,
  busy,
  name,
  onCommand,
}: {
  carts: Cart[];
  busy: boolean;
  name: (id: string) => string;
  onCommand: (type: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { t } = useLang();
  const [filter, setFilter] = useState<Filter>('all');
  const [lineMode, setLineMode] = useState(false);
  // 빨간 칸(충전 시작)이나 주황 칸(충전 완료)을 누르면 여는 창.
  const [open, setOpen] = useState<number | null>(null);
  const [level, setLevel] = useState(CART_GAUGE);
  const [memo, setMemo] = useState('');
  // 방금 누른 카트. 몇 초 동안 되돌리기 알림을 띄웁니다.
  const [toast, setToast] = useState<{ no: number; text: string; memo?: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), UNDO_SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const line = cartLineup(carts);
  const orderOf = new Map(line.map((c, i) => [c.no, i + 1]));
  const of = (st: CartStatus) => carts.filter((c) => cartStatus(c) === st);
  const empty = of('empty'),
    charging = of('charging');
  const partial = carts.filter((c) => cartStatus(c) === 'ready' && c.level);
  const counts: Record<CartStatus, number> = {
    ready: of('ready').length,
    half: of('half').length,
    empty: empty.length,
    charging: charging.length,
  };
  const shown = carts.filter((c) =>
    filter === 'all'
      ? true
      : filter === 'partial'
        ? cartStatus(c) === 'ready' && !!c.level
        : cartStatus(c) === filter,
  );
  const target = open === null ? undefined : carts.find((c) => c.no === open);
  const lineFull = line.length >= CART_LINEUP_MAX;

  const handOut = async (cart: Cart) => {
    const ok = await onCommand('cartUse', { no: cart.no, uses: cart.uses });
    if (!ok) return;
    const left = cart.max - cart.uses - 1;
    setToast({
      no: cart.no,
      text:
        left > 0
          ? t('{no}번 · 1회 기록 · 한 번 더 나갈 수 있습니다', { no: cart.no })
          : t('{no}번 · 다 썼습니다 · 충전해야 합니다', { no: cart.no }),
      memo: cart.memo,
    });
  };
  const tap = (cart: Cart) => {
    if (busy) return;
    const st = cartStatus(cart);
    if (st === 'empty' || st === 'charging') {
      setLevel(CART_GAUGE);
      setMemo('');
      setOpen(cart.no);
      return;
    }
    if (lineMode) {
      void onCommand('cartLineup', { no: cart.no, on: !cart.lineup });
      return;
    }
    void handOut(cart);
  };
  const undo = async () => {
    if (!toast) return;
    const ok = await onCommand('cartUndo', { no: toast.no });
    if (ok) setToast(null);
  };
  const startCharge = async () => {
    if (!target) return;
    if (await onCommand('cartCharge', { no: target.no })) setOpen(null);
  };
  const finishCharge = async () => {
    if (!target) return;
    if (await onCommand('cartDone', { no: target.no, level, memo })) setOpen(null);
  };
  const recent = carts
    .filter((c) => c.at)
    .sort((a, b) => b.at!.localeCompare(a.at!))
    .slice(0, 8);
  const chip = (key: Filter, text: string, n: number) => (
    <button
      type="button"
      className={'cart-chip c-' + key + (filter === key ? ' on' : '')}
      aria-pressed={filter === key}
      onClick={() => setFilter(filter === key ? 'all' : key)}
    >
      <i aria-hidden="true" />
      {t(text)} <b>{n}</b>
    </button>
  );

  return (
    <section className="cartboard" aria-label={t('카트')}>
      <div className="cart-line" aria-label={t('라인업')}>
        <b className="cart-line-title">
          <ListOrdered size={16} aria-hidden="true" />
          {t('다음 손님')}
          <small>
            {line.length}/{CART_LINEUP_MAX}
          </small>
        </b>
        {line.length ? (
          <div className="cart-line-cells">
            {line.map((c, i) => (
              <Cell
                key={c.no}
                cart={c}
                order={i + 1}
                small
                disabled={busy}
                onClick={() => (lineMode ? tap(c) : void handOut(c))}
              />
            ))}
          </div>
        ) : (
          <span className="cart-line-empty">
            {t('라인업에 세운 카트가 없습니다. “라인업 세우기”를 켜고 카트를 누르세요.')}
          </span>
        )}
        <button
          type="button"
          className={'button cart-linemode' + (lineMode ? ' on' : '')}
          aria-pressed={lineMode}
          onClick={() => setLineMode((v) => !v)}
        >
          {lineMode ? t('라인업 세우기 끝') : t('라인업 세우기')}
        </button>
      </div>
      {lineMode && (
        <p className="cart-hint">
          {lineFull
            ? t('라인업이 가득 찼습니다({n}대). 줄에서 빼려면 카트를 누르세요.', { n: CART_LINEUP_MAX })
            : t('나갈 수 있는 카트를 누르면 줄 끝에 섭니다. 줄에 선 카트를 누르면 뺍니다.')}
        </p>
      )}

      <div className="cart-chips">
        {chip('ready', '충전 완료', counts.ready)}
        {chip('half', '1회 사용', counts.half)}
        {chip('empty', '충전 필요', counts.empty)}
        {chip('charging', '충전중', counts.charging)}
        {chip('partial', '완충 안 됨', partial.length)}
      </div>

      <div className="cart-main">
        <div className="cart-grid">
          {shown.map((c) => (
            <Cell
              key={c.no}
              cart={c}
              order={orderOf.get(c.no)}
              disabled={busy || (lineMode && !c.lineup && lineFull && !['empty', 'charging'].includes(cartStatus(c)))}
              onClick={() => tap(c)}
            />
          ))}
          {!shown.length && <p className="cart-none">{t('이 상태의 카트가 없습니다.')}</p>}
        </div>

        <aside className="cart-side">
          <h3 className="t-empty">
            {t('충전 필요')} <b>{empty.length}</b>
          </h3>
          {empty.map((c) => (
            <div className="cart-row" key={c.no}>
              <Cell cart={c} small disabled={busy} onClick={() => tap(c)} />
              <span>{t('{no}번', { no: c.no })}</span>
              <button type="button" className="cart-act a-charge" disabled={busy} onClick={() => tap(c)}>
                {t('충전 시작')}
              </button>
            </div>
          ))}
          <h3 className="t-charging">
            {t('충전중')} <b>{charging.length}</b>
          </h3>
          {charging.map((c) => (
            <div className="cart-row" key={c.no}>
              <Cell cart={c} small disabled={busy} onClick={() => tap(c)} />
              <span>
                {t('{no}번', { no: c.no })}
                <small>{localTime(new Date(c.charging!))}</small>
              </span>
              <button type="button" className="cart-act a-done" disabled={busy} onClick={() => tap(c)}>
                {t('충전 완료')}
              </button>
            </div>
          ))}
          {!!partial.length && (
            <>
              <h3 className="t-partial">
                {t('완충 안 됨')} <b>{partial.length}</b>
              </h3>
              {partial.map((c) => (
                <div className="cart-row memo" key={c.no}>
                  <Cell cart={c} small disabled />
                  <span>
                    {t('{no}번', { no: c.no })}{' '}
                    <b className="tabular">
                      {c.level}/{CART_GAUGE}
                    </b>
                    {c.memo && <small>{c.memo}</small>}
                  </span>
                </div>
              ))}
            </>
          )}
          {!!recent.length && (
            <>
              <h3>{t('최근 기록')}</h3>
              <ul className="cart-log">
                {recent.map((c) => (
                  <li key={c.no}>
                    <time>{localTime(new Date(c.at!))}</time> {t('{no}번', { no: c.no })} ·{' '}
                    {t(c.lineup ? '라인업' : STATUS_LABEL[cartStatus(c)])} · {name(c.by ?? '')}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {toast && (
        <div className="cart-toast" aria-live="polite">
          <span>
            {toast.text}
            {toast.memo && <small>{t('메모')}: {toast.memo}</small>}
          </span>
          <button type="button" disabled={busy} onClick={() => void undo()}>
            {t('cart::되돌리기')}
          </button>
        </div>
      )}

      {target && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="shift-dialog cart-dialog">
            {cartStatus(target) === 'empty' ? (
              <>
                <DialogTitle>{t('{no}번 카트 충전 시작', { no: target.no })}</DialogTitle>
                <DialogDescription>
                  {t('충전기에 꽂았으면 충전 시작을 누르세요. 충전이 끝날 때까지 이 카트는 잠깁니다.')}
                </DialogDescription>
                <button type="button" className="button cart-go a-charge" disabled={busy} onClick={() => void startCharge()}>
                  <Zap size={17} aria-hidden="true" />
                  {t('충전 시작')}
                </button>
              </>
            ) : cartStatus(target) === 'charging' ? (
              <>
                <DialogTitle>{t('{no}번 카트 충전 완료', { no: target.no })}</DialogTitle>
                <DialogDescription>
                  {t('얼마나 찼는지 고르세요. 완충이 아니면 게이지가 표시되고 한 번만 나갑니다.')}
                </DialogDescription>
                <div className="cart-pick" aria-label={t('게이지')}>
                  {Array.from({ length: CART_GAUGE }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={level === i + 1}
                      className={i < level ? 'on' : ''}
                      onClick={() => setLevel(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <p className={'cart-picked' + (level < CART_GAUGE ? ' partial' : '')}>
                  {level}/{CART_GAUGE} ·{' '}
                  {level < CART_GAUGE ? t('완충 안 됨 · 한 번만 나갑니다') : t('완충 · 두 번 나갑니다')}
                </p>
                <label className="field">
                  {t('메모 (선택)')}
                  <textarea
                    value={memo}
                    maxLength={200}
                    placeholder={t('예: 충전기 불량으로 3칸까지만')}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </label>
                <button type="button" className="button cart-go a-done" disabled={busy} onClick={() => void finishCharge()}>
                  <Zap size={17} aria-hidden="true" />
                  {t('충전 완료 저장')}
                </button>
              </>
            ) : (
              <DialogTitle>{t('{no}번 카트', { no: target.no })}</DialogTitle>
            )}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
