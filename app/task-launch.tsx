'use client';
import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';

export default function TaskLaunch() {
  const [href, setHref] = useState('/tasks');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/tasks') return;
    setHref('/tasks' + window.location.search);
    void fetch('/api/workspace' + window.location.search)
      .then((response) => response.json())
      .then((workspace) => setShow(workspace.actor?.admin === true))
      .catch(() => setShow(false));
  }, []);

  if (!show) return null;
  return (
    <a className="task-launch" href={href}>
      <ClipboardList size={18} /> 작업 수신함
    </a>
  );
}
