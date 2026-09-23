import { addDays, localDate, type Employee, type Shift } from '@/lib/domain';
import { useLang } from './use-lang';

type Props = {
  date: string;
  employees: Employee[];
  shifts: Shift[];
  onDateChange: (date: string) => void;
  onShiftSelect: (id: string) => void;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

export default function MonthSchedule({
  date,
  employees,
  shifts,
  onDateChange,
  onShiftSelect,
}: Props) {
  const { t, days, locale } = useLang();
  const first = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  const gridStart = addDays(iso(first), -first.getUTCDay());
  const month = date.slice(0, 7);
  const today = localDate(new Date());
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const shiftsByDate = new Map<string, Shift[]>();

  shifts.forEach((shift) => {
    const scheduled = shiftsByDate.get(shift.date) || [];
    scheduled.push(shift);
    shiftsByDate.set(shift.date, scheduled);
  });
  shiftsByDate.forEach((scheduled) =>
    scheduled.sort((a, b) => a.start.localeCompare(b.start)),
  );

  const moveMonth = (offset: number) => {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + offset);
    onDateChange(iso(next));
  };

  return (
    <section className="month-schedule" aria-label={t('월간 근무 일정')}>
      <header className="month-toolbar">
        <button className="month-nav" onClick={() => moveMonth(-1)} aria-label={t('이전 달')}>
          ‹
        </button>
        <strong>
          {new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          }).format(first)}
        </strong>
        <button className="month-nav" onClick={() => moveMonth(1)} aria-label={t('다음 달')}>
          ›
        </button>
        <button className="button month-today" onClick={() => onDateChange(today)}>
          {t('오늘')}
        </button>
      </header>
      <div className="month-scroll">
        <div className="month-grid">
          {days.map((weekday) => (
            <div className="month-weekday" key={weekday}>
              {weekday}
            </div>
          ))}
          {Array.from({ length: 42 }, (_, index) => {
            const cellDate = addDays(gridStart, index);
            const scheduled = shiftsByDate.get(cellDate) || [];
            const outside = !cellDate.startsWith(month);
            return (
              <div
                className={`month-day${outside ? ' outside' : ''}${cellDate === today ? ' today' : ''}`}
                key={cellDate}
              >
                <button
                  className="month-date"
                  onClick={() => onDateChange(cellDate)}
                  aria-label={t('{date} 일정 보기', { date: cellDate })}
                >
                  {Number(cellDate.slice(8))}
                </button>
                <span className="month-shifts">
                  {scheduled.map((shift) => {
                    const employee = employeeById.get(shift.employeeId);
                    if (!employee) return null;
                    return (
                      <button
                        className={
                          'month-shift' + (shift.draft ? ' is-draft' : '')
                        }
                        key={shift.id}
                        onClick={() => onShiftSelect(shift.id)}
                        title={shift.draft ? 'Unpublished' : undefined}
                      >
                        <i style={{ background: employee.color }} />
                        <b>{employee.name}</b>
                        <small>{shift.start}–{shift.end}</small>
                      </button>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
