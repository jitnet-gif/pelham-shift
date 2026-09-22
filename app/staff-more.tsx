'use client';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from './use-lang';

export type MoreItem = {
  key: string;
  label: string;
  Icon: LucideIcon;
  count?: number;
  onSelect: () => void;
};

// 탭바에 자리가 없는 화면을 모아 둔 목록. 고르면 뒤로가기가 달린 화면으로 넘어갑니다.
export default function StaffMore({
  name,
  role,
  groups,
}: {
  name: string;
  role: string;
  groups: { label?: string; items: MoreItem[] }[];
}) {
  const { t } = useLang();
  return (
    <section className="stmore">
      <div className="stmore-me">
        <span className="stmore-face">{name.slice(0, 1)}</span>
        <span>
          <b>{name}</b>
          <small>{role || t('직원')}</small>
        </span>
      </div>
      {groups.map((group, i) => (
        <div className="stmore-group" key={group.label ?? i}>
          {group.label && <h3>{t(group.label)}</h3>}
          {group.items.map((item) => (
            <button className="stmore-row" key={item.key} onClick={item.onSelect}>
              <item.Icon size={20} />
              <span>{t(item.label)}</span>
              {(item.count ?? 0) > 0 && <em>{item.count}</em>}
              <ChevronRight size={19} />
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
