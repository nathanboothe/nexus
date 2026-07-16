import { useState, useEffect } from 'react';
import { airtable } from '../api.js';
import styles from './Calendar.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = ['Family', 'Work', 'Health', 'Personal', 'Holiday', 'Other'];
const CAT_COLORS = {
  'Family':   '#7F77DD',
  'Work':     '#2E5FA3',
  'Health':   '#1D9E75',
  'Personal': '#BA7517',
  'Holiday':  '#c0392b',
  'Other':    '#5c6278',
};

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function eventDate(e) {
  return new Date(e.fields.Start || e.fields['Start']);
}

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [newEvent, setNewEvent] = useState({ Title: '', Start: '', End: '', 'All day': false, Category: 'Family', Notes: '' });

  function load() {
    setLoading(true);
    airtable.list('calendar', { maxRecords: 500 })
      .then(data => { setEvents(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newEvent.Title.trim() || !newEvent.Start) return;
    setAdding(true);
    try {
      const fields = {
        Title: newEvent.Title,
        Start: newEvent.Start,
        End: newEvent.End || newEvent.Start,
        Category: newEvent.Category,
      };
      if (newEvent['All day']) fields['All day'] = true;
      if (newEvent.Notes) fields.Notes = newEvent.Notes;
      const rec = await airtable.create('calendar', fields);
      setEvents(prev => [...prev, rec]);
      setNewEvent({ Title: '', Start: '', End: '', 'All day': false, Category: 'Family', Notes: '' });
      setShowAdd(false);
    } catch {}
    setAdding(false);
  }

  // Build month grid
  function buildMonthGrid() {
    const year = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }

  function eventsForDay(date) {
    return events.filter(e => {
      if (!e.fields.Start) return false;
      try { return sameDay(new Date(e.fields.Start), date); } catch { return false; }
    });
  }

  // Week view helpers
  function weekDays() {
    const d = new Date(current);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d);
      dd.setDate(d.getDate() + i);
      return dd;
    });
  }

  // Upcoming events
  const upcoming = events
    .filter(e => e.fields.Start && new Date(e.fields.Start) >= new Date())
    .sort((a, b) => new Date(a.fields.Start) - new Date(b.fields.Start))
    .slice(0, 10);

  const today = new Date();
  const monthGrid = buildMonthGrid();

  if (loading) return <div className="page"><p className="text-muted">Loading calendar...</p></div>;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Calendar</h1>
          <p className="text-muted text-sm">Events · upcoming</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.viewToggle}>
            <button className={`${styles.toggleBtn} ${view === 'month' ? styles.toggleActive : ''}`} onClick={() => setView('month')}>Month</button>
            <button className={`${styles.toggleBtn} ${view === 'week' ? styles.toggleActive : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`${styles.toggleBtn} ${view === 'upcoming' ? styles.toggleActive : ''}`} onClick={() => setView('upcoming')}>Upcoming</button>
          </div>
          <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ Event</button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input type="text" placeholder="Event title" value={newEvent.Title}
            onChange={e => setNewEvent(n => ({ ...n, Title: e.target.value }))} style={{ flex: 2 }} />
          <input type="datetime-local" value={newEvent.Start}
            onChange={e => setNewEvent(n => ({ ...n, Start: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }} />
          <input type="datetime-local" value={newEvent.End}
            onChange={e => setNewEvent(n => ({ ...n, End: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }} />
          <select value={newEvent.Category} onChange={e => setNewEvent(n => ({ ...n, Category: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className={styles.addBtn} disabled={adding}>{adding ? '...' : 'Save'}</button>
            <button type="button" onClick={() => setShowAdd(false)}
              style={{ padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Month view */}
      {view === 'month' && (
        <div className={styles.monthWrap}>
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
            <span className={styles.monthTitle}>{MONTHS[current.getMonth()]} {current.getFullYear()}</span>
            <button className={styles.navBtn} onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
            <button className={styles.todayBtn} onClick={() => setCurrent(new Date())}>Today</button>
          </div>
          <div className={styles.dayHeaders}>
            {DAYS.map(d => <div key={d} className={styles.dayHeader}>{d}</div>)}
          </div>
          <div className={styles.monthGrid}>
            {monthGrid.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className={styles.emptyCell} />;
              const dayEvents = eventsForDay(date);
              const isToday = sameDay(date, today);
              const isSelected = selected && sameDay(date, selected);
              return (
                <div
                  key={date.toISOString()}
                  className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${isSelected ? styles.dayCellSelected : ''}`}
                  onClick={() => setSelected(date)}
                >
                  <span className={styles.dayNum}>{date.getDate()}</span>
                  <div className={styles.dayEvents}>
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className={styles.eventPill}
                        style={{ background: CAT_COLORS[e.fields.Category] || CAT_COLORS.Other }}>
                        {e.fields.Title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className={styles.moreEvents}>+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selected && (
            <div className={styles.selectedDay}>
              <h3 className={styles.selectedTitle}>
                {selected.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              {eventsForDay(selected).length === 0 ? (
                <p className="text-muted text-sm">No events</p>
              ) : (
                eventsForDay(selected).map(e => <EventRow key={e.id} event={e} />)
              )}
            </div>
          )}
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className={styles.weekWrap}>
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={() => setCurrent(d => { const dd = new Date(d); dd.setDate(dd.getDate() - 7); return dd; })}>‹</button>
            <span className={styles.monthTitle}>Week of {weekDays()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <button className={styles.navBtn} onClick={() => setCurrent(d => { const dd = new Date(d); dd.setDate(dd.getDate() + 7); return dd; })}>›</button>
            <button className={styles.todayBtn} onClick={() => setCurrent(new Date())}>Today</button>
          </div>
          <div className={styles.weekGrid}>
            {weekDays().map(date => {
              const dayEvents = eventsForDay(date);
              const isToday = sameDay(date, today);
              return (
                <div key={date.toISOString()} className={`${styles.weekDay} ${isToday ? styles.weekDayToday : ''}`}>
                  <div className={styles.weekDayHeader}>
                    <span className={styles.weekDayName}>{DAYS[date.getDay()]}</span>
                    <span className={`${styles.weekDayNum} ${isToday ? styles.weekDayNumToday : ''}`}>{date.getDate()}</span>
                  </div>
                  <div className={styles.weekEvents}>
                    {dayEvents.length === 0 && <p className="text-faint text-xs" style={{ padding: '4px 0' }}>—</p>}
                    {dayEvents.map(e => <EventRow key={e.id} event={e} compact />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming view */}
      {view === 'upcoming' && (
        <div className={styles.upcomingWrap}>
          {upcoming.length === 0 && <p className="text-muted">No upcoming events</p>}
          {upcoming.map(e => <EventRow key={e.id} event={e} showDate />)}
        </div>
      )}
    </div>
  );
}

function EventRow({ event, compact, showDate }) {
  const f = event.fields;
  const color = CAT_COLORS[f.Category] || CAT_COLORS.Other;
  return (
    <div className={`${styles.eventRow} ${compact ? styles.eventRowCompact : ''}`}>
      <div className={styles.eventDot} style={{ background: color }} />
      <div className={styles.eventInfo}>
        <span className={styles.eventTitle}>{f.Title}</span>
        {showDate && f.Start && (
          <span className="text-xs text-faint">
            {new Date(f.Start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(f.Start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {!showDate && f.Start && !f['All day'] && (
          <span className="text-xs text-faint">
            {new Date(f.Start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {f.Category && <span className="text-xs" style={{ color }}>{f.Category}</span>}
      </div>
    </div>
  );
}
