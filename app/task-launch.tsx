'use client';
import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useLang } from './use-lang';
import { readLayout } from './layout-choice';

export default function TaskLaunch() {
  const { t } = useLang();
  const [href, setHref] = useState('/tasks');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // seven-shifts has 작업 in its sidebar, so the floating button is only for pelham-shifts.
    if (window.location.pathname === '/tasks' || readLayout() === 'seven') return;
    setHref('/tasks' + window.location.search);
    void fetch('/api/workspace' + window.location.search)
      .then((response) => response.json())
      .then((workspace) => setShow(Boolean(workspace.actor)))
      .catch(() => setShow(false));
  }, []);

  if (!show) return null;
  return (
    <a className="task-launch" href={href}>
      <ClipboardList size={18} /> {t('작업 수신함')}
    </a>
  );
}
