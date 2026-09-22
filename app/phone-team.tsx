'use client';
import { useState } from 'react';
import {
  Cake,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { Employee } from '@/lib/domain';
import { useLang } from './use-lang';

// 폰에서 보는 팀. 표를 옆으로 미는 대신 이름 목록과 한 사람 화면으로 나눕니다.
export default function PhoneTeam({
  employees,
  archived,
  location,
  meId,
  busy,
  teamLink,
  money,
  picked,
  onPick,
  onAdd,
  onEdit,
  onMessage,
  onRemove,
}: {
  employees: Employee[];
  archived: Employee[];
  location: string;
  meId: string;
  busy: boolean;
  teamLink: string;
  money: (n: number) => string;
  picked: string;
  onPick: (id: string) => void;
  onAdd: () => void;
  onEdit: (employee: Employee) => void;
  onMessage: (employee: Employee) => void;
  onRemove: (employee: Employee) => void;
}) {
  const { t, locale } = useLang();
  const [kept, setKept] = useState(true);
  const [find, setFind] = useState('');
  const list = (kept ? employees : archived)
    .filter((e) => e.name.toLowerCase().includes(find.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const person = [...employees, ...archived].find((e) => e.id === picked);

  if (person)
    return (
      <section className="pteam pteam-one">
        <header className="pteam-onebar">
          <button className="pteam-back" onClick={() => onPick('')}>
            <ChevronLeft size={22} />
            <span className="sr-only">{t('목록으로')}</span>
          </button>
          <button className="pteam-edit" onClick={() => onEdit(person)}>
            {t('수정')}
          </button>
        </header>

        <div className="pteam-hero">
          <span className="pteam-face" style={{ background: person.color }}>
            {person.name.slice(0, 1)}
          </span>
          <b>{person.name}</b>
          <small>
            {person.admin ? t('관리자') : t('직원')}
            {person.taskManager ? ' · ' + t('작업 지시') : ''}
            {person.archived ? ' · ' + t('보관됨') : ''}
          </small>
          <button className="pteam-message" onClick={() => onMessage(person)}>
            <MessageSquare size={17} />
            {t('메시지')}
          </button>
        </div>

        <ul className="pteam-contact">
          <li>
            <Mail size={17} />
            {person.email ? (
              <a href={'mailto:' + person.email}>{person.email}</a>
            ) : (
              <span className="none">{t('이메일 미등록')}</span>
            )}
          </li>
          <li>
            <Phone size={17} />
            {person.phone ? (
              <a href={'tel:' + person.phone.replace(/[^\d+]/g, '')}>{person.phone}</a>
            ) : (
              <span className="none">{t('연락처 미등록')}</span>
            )}
          </li>
          <li>
            <Cake size={17} />
            {person.birthDate ? (
              <span>{person.birthDate}</span>
            ) : (
              <span className="none">{t('생년월일 미등록')}</span>
            )}
          </li>
        </ul>

        <div className="pteam-block">
          <div className="pteam-blockhead">
            <h3>{t('배정')}</h3>
            <button className="pteam-link" onClick={() => onEdit(person)}>
              {t('변경')}
            </button>
          </div>
          <button className="pteam-assign" onClick={() => onEdit(person)}>
            <i style={{ background: person.color }}>
              {person.role.slice(0, 1).toUpperCase()}
            </i>
            <span>
              <b>{person.role}</b>
              <small>{location}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>

        <dl className="pteam-facts">
          <div>
            <dt>{t('시급')}</dt>
            <dd>{t('{money} / 시간', { money: money(person.rate) })}</dd>
          </div>
          <div>
            <dt>{t('직원 ID')}</dt>
            <dd>{person.id}</dd>
          </div>
          <div>
            <dt>{t('출근기계 ID')}</dt>
            <dd>{person.punchId || <span className="none">{t('미등록')}</span>}</dd>
          </div>
        </dl>

        <div className="pteam-block">
          <h3>{t('로그인')}</h3>
          <p className="pteam-note">
            {t('직원은 로그인 화면에서 자기 이름을 골라 들어옵니다. 처음 비밀번호는 본인 직원 ID 이고, 직원이 직접 바꿉니다.')}
          </p>
        </div>

        {!person.archived && person.id !== meId && (
          <button
            className="pteam-remove"
            disabled={busy}
            onClick={() => onRemove(person)}
          >
            <Trash2 size={16} />
            {t('직원 삭제')}
          </button>
        )}
      </section>
    );

  return (
    <section className="pteam">
      <div className="pteam-top">
        <div className="pteam-switch">
          <button
            className={kept ? 'on' : ''}
            aria-pressed={kept}
            onClick={() => setKept(true)}
          >
            {t('재직')}
          </button>
          <button
            className={kept ? '' : 'on'}
            aria-pressed={!kept}
            onClick={() => setKept(false)}
          >
            {t('보관')}
            {archived.length > 0 && <em>{archived.length}</em>}
          </button>
        </div>
        <button className="pteam-add" aria-label={t('직원 추가')} onClick={onAdd}>
          <Plus size={22} />
        </button>
      </div>

      <label className="pteam-find">
        <Search size={18} />
        <input
          type="search"
          value={find}
          placeholder={t('이름으로 검색')}
          onChange={(e) => setFind(e.target.value)}
        />
      </label>

      {list.map((e) => (
        <button className="pteam-row" key={e.id} onClick={() => onPick(e.id)}>
          <span className="pteam-face small" style={{ background: e.color }}>
            {e.name.slice(0, 1)}
          </span>
          <span className="pteam-name">{e.name}</span>
          <ChevronRight size={18} />
        </button>
      ))}
      {!list.length && (
        <p className="pteam-empty">
          {find ? t('찾는 이름이 없습니다.') : t('아직 직원이 없습니다.')}
        </p>
      )}

      {kept && teamLink && (
        <div className="pteam-block">
          <h3>{t('직원 접속 주소')}</h3>
          <input readOnly value={teamLink} onFocus={(e) => e.target.select()} />
          <p className="pteam-note">
            {t('직원은 로그인 화면에서 자기 이름을 골라 들어옵니다. 처음 비밀번호는 본인 직원 ID 이고, 직원이 직접 바꿉니다.')}
          </p>
        </div>
      )}
    </section>
  );
}
