'use client';
import { useState } from 'react';
import { PartyPopper, SquarePen, UserRound } from 'lucide-react';
import type { Employee, Message } from '@/lib/domain';
import { useLang } from './use-lang';

// 직원이 보는 메시지함. 주고받은 대화가 위에, 전체 공지는 옆 탭에 있습니다.
export default function StaffMessaging({
  me,
  tab,
  messages,
  employees,
  teammates,
  onTabChange,
  onCompose,
  onShoutOut,
  onOpen,
}: {
  me: string;
  tab: 'messages' | 'announcements';
  messages: Message[];
  employees: Employee[];
  teammates: number;
  onTabChange: (tab: 'messages' | 'announcements') => void;
  onCompose: (to?: string) => void;
  onShoutOut: () => void;
  onOpen: (ids: string[]) => void;
}) {
  const { t, locale } = useLang();
  const [shown, setShown] = useState<string | null>(null);
  const name = (id: string) => employees.find((e) => e.id === id)?.name || t('관리자');
  const color = (id: string) => employees.find((e) => e.id === id)?.color || '#5c9d61';
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso));
  const unread = (m: Message) => m.sender !== me && !m.readBy.includes(me);
  const announcements = messages
    .filter((m) => m.to === 'all')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // 대화는 상대별로 하나씩. 목록에는 가장 최근 한 줄만 미리 보여 줍니다.
  const direct = messages.filter((m) => m.to !== 'all');
  const threads = [...new Set(direct.map((m) => (m.sender === me ? m.to : m.sender)))]
    .map((who) => {
      const rows = direct
        .filter((m) => (m.sender === me ? m.to : m.sender) === who)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { who, rows, last: rows[0], unread: rows.filter(unread).map((m) => m.id) };
    })
    .filter((thread) => thread.last)
    .sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));
  const rows = tab === 'messages' ? threads : [];

  return (
    <section className="stmsg">
      <header className="stmsg-top">
        <h2>{t('title::메시지')}</h2>
        <button className="stmsg-compose" aria-label={t('새 메시지')} onClick={() => onCompose()}>
          <SquarePen size={21} />
        </button>
      </header>
      <div className="stmsg-scope" role="tablist" aria-label={t('메시지 종류')}>
        {(['messages', 'announcements'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={'stmsg-scope-tab' + (tab === key ? ' on' : '')}
            onClick={() => onTabChange(key)}
          >
            {key === 'messages' ? t('대화') : t('공지')}
          </button>
        ))}
      </div>
      {tab === 'messages' && (
        <>
          <button className="stmsg-shout" onClick={onShoutOut}>
            <b>
              <PartyPopper size={19} /> {t('오늘의 칭찬')}
            </b>
            <span>
              {teammates > 0
                ? t('오늘 같이 일한 동료를 칭찬해 보세요.')
                : t('같이 근무하는 날 동료를 칭찬할 수 있습니다.')}
            </span>
          </button>
          <h3 className="stmsg-section">{t('최근 대화')}</h3>
          {rows.map((thread) => (
            <div className="stmsg-item" key={thread.who}>
              <button
                className={
                  'stmsg-row' +
                  (thread.unread.length ? ' unread' : '') +
                  (shown === thread.who ? ' open' : '')
                }
                aria-expanded={shown === thread.who}
                // 누르면 그 사람과 주고받은 글 전체가 펼쳐집니다.
                // 대화를 열면 마지막 한 줄만이 아니라 안 읽은 메시지를 모두 읽음으로 올려야 알림 숫자가 맞습니다.
                onClick={() => {
                  setShown(shown === thread.who ? null : thread.who);
                  if (thread.unread.length) onOpen(thread.unread);
                }}
              >
                <span className="stmsg-face" style={{ background: color(thread.who) }}>
                  <UserRound size={19} />
                </span>
                <span className="stmsg-main">
                  <b>{thread.who === 'admin' ? t('관리자') : name(thread.who)}</b>
                  {shown !== thread.who && (
                    <small>
                      {thread.last.sender === me ? t('나: ') : ''}
                      {thread.last.body}
                    </small>
                  )}
                </span>
                <time dateTime={thread.last.createdAt}>{when(thread.last.createdAt)}</time>
              </button>
              {shown === thread.who && (
                <div className="stmsg-thread">
                  {thread.rows
                    .slice()
                    .reverse()
                    .map((m) => (
                      <p key={m.id} className={'stmsg-bubble' + (m.sender === me ? ' mine' : '')}>
                        {m.body}
                        <time dateTime={m.createdAt}>{when(m.createdAt)}</time>
                      </p>
                    ))}
                  <button className="stmsg-reply" onClick={() => onCompose(thread.who)}>
                    {t('답장')}
                  </button>
                </div>
              )}
            </div>
          ))}
          {!rows.length && <p className="stmsg-empty">{t('주고받은 메시지가 없습니다.')}</p>}
        </>
      )}
      {tab === 'announcements' && (
        <>
          <h3 className="stmsg-section">{t('전체 공지')}</h3>
          {announcements.map((m) => (
            <button
              className={
                'stmsg-row' + (unread(m) ? ' unread' : '') + (shown === m.id ? ' open' : '')
              }
              key={m.id}
              aria-expanded={shown === m.id}
              // 누르면 공지 전문이 펼쳐지고, 다시 누르면 접힙니다.
              onClick={() => {
                setShown(shown === m.id ? null : m.id);
                if (unread(m)) onOpen([m.id]);
              }}
            >
              <span className={'stmsg-face' + (m.kind === 'rain' ? ' notice' : '')}>
                <UserRound size={19} />
              </span>
              <span className="stmsg-main">
                <b>{name(m.sender)}</b>
                <small>{m.body}</small>
              </span>
              <time dateTime={m.createdAt}>{when(m.createdAt)}</time>
            </button>
          ))}
          {!announcements.length && <p className="stmsg-empty">{t('공지가 없습니다.')}</p>}
        </>
      )}
    </section>
  );
}
