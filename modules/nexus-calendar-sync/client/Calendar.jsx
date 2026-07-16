import { useState, useEffect } from 'react';
import { airtable } from '../api.js';
import styles from './Calendar.module.css';

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = ['Family','Work','Health','Personal','Holiday','Other'];

const SOURCE_COLORS = {
  airtable: { bg: '#2E5FA3', label: 'Nexus' },
  outlook:  { bg: '#0078D4', label: 'Outlook' },
  google:   { bg: '#EA4335', label: 'Google' },
};

const CAT_COLORS = {
  'Family':   '#7F77DD',
  'Work':     '#2E5FA3',
  'Health':   '#1D9E75',
  'Personal': '#BA7517',
  'Holiday':  '#c0392b',
  'Outlook':  '#0078D4',
  'Google':   '#EA4335',
  'Other':    '#5c6278',
};

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

async function fetchSyncedEvents(start, end) {
  const res = await fetch(`/api/calendar-sync/events?start=${start.toISOString()}&end=${end.toISOString()}`);
  const data = await res.json();
  return data.events || [];
}

async function fetchAuthStatus() {
  const res = await fetch('/api/calendar-sync/auth/status');
  return res.json();
}

export default function Calendar() {
  const [airtableEvents, setAirtableEvents] = useState([]);
  const [syncedEvents, setSyncedEvents] = useState([]);
  const [authStatus, setAuthStatus] = useState({ outlook: false, google: false });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addTarget, setAddTarget] = useState('airtable');
  const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', allDay: false, category: 'Family', notes: '' });
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [deviceCode, setDeviceCode] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  async function loadAll() {
    setLoading(true);
    try {
      // Airtable events
      const data = await airtable.list('calendar', { maxRecords: 500 });
      const mapped = (data.records || []).map(r => ({
        id:       r.id,
        source:   'airtable',
        title:    r.fields.Title,
        start:    r.fields.Start,
        end:      r.fields.End,
        allDay:   r.fields['All day'],
        category: r.fields.Category || 'Other',
        notes:    r.fields.Notes,
      }));
      setAirtableEvents(mapped);

      // Auth status
      const auth = await fetchAuthStatus();
      setAuthStatus(auth);

      // Synced events (Outlook + Google)
      if (auth.outlook || auth.google) {
        const start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
        const end   = new Date(current.getFullYear(), current.getMonth() + 3, 0);
        const synced = await fetchSyncedEvents(start, end);
        setSyncedEvents(synced);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (authStatus.outlook || authStatus.google) {
      const start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      const end   = new Date(current.getFullYear(), current.getMonth() + 3, 0);
      fetchSyncedEvents(start, end).then(setSyncedEvents).catch(() => {});
    }
  }, [current, authStatus]);

  // Merge all events
  const allEvents = [...airtableEvents, ...syncedEvents].filter(e => {
    if (sourceFilter === 'all') return true;
    return e.source === sourceFilter;
  });

  function eventsForDay(date) {
    return allEvents.filter(e => {
      if (!e.start) return false;
      try { return sameDay(new Date(e.start), date); } catch { return false; }
    });
  }

  function buildMonthGrid() {
    const year  = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const days  = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }

  function weekDays() {
    const d = new Date(current);
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d);
      dd.setDate(d.getDate() + i);
      return dd;
    });
  }

  const upcoming = allEvents
    .filter(e => e.start && new Date(e.start) >= new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 15);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.start) return;
    setAdding(true);
    try {
      if (addTarget === 'airtable') {
        await airtable.create('calendar', {
          Title:    newEvent.title,
          Start:    newEvent.start,
          End:      newEvent.end || newEvent.start,
          Category: newEvent.category,
          Notes:    newEvent.notes,
        });
      } else {
        await fetch('/api/calendar-sync/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newEvent, target: addTarget }),
        });
      }
      setNewEvent({ title: '', start: '', end: '', allDay: false, category: 'Family', notes: '' });
      setShowAdd(false);
      loadAll();
    } catch {}
    setAdding(false);
  }

  async function startOutlookAuth() {
    setAuthMessage('Starting Outlook sign-in...');
    try {
      const res = await fetch('/api/calendar-sync/auth/outlook/start', { method: 'POST' });
      const data = await res.json();
      setDeviceCode(data);
      setAuthMessage(`Go to ${data.verification_uri} and enter code: ${data.user_code}`);
      pollOutlookAuth(data.device_code);
    } catch (err) {
      setAuthMessage(`Error: ${err.message}`);
    }
  }

  async function pollOutlookAuth(code) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/calendar-sync/auth/outlook/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceCode: code }),
        });
        const data = await res.json();
        if (data.ok) {
          clearInterval(interval);
          setAuthMessage('✓ Outlook connected!');
          setAuthStatus(prev => ({ ...prev, outlook: true }));
          setTimeout(() => { setShowAuthPanel(false); setAuthMessage(''); loadAll(); }, 1500);
        }
      } catch {}
    }, 5000);
  }

  async function startGoogleAuth() {
    try {
      const res = await fetch('/api/calendar-sync/auth/google/url');
      const data = await res.json();
      window.open(data.url, '_blank', 'width=500,height=600');
      setAuthMessage('Complete sign-in in the popup window, then click Refresh below.');
    } catch (err) {
      setAuthMessage(`Error: ${err.message}`);
    }
  }

  const today = new Date();
  const monthGrid = buildMonthGrid();

  if (loading) return <div className="page"><p className="text-muted">Loading calendar...</p></div>;

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Calendar</h1>
          <p className="text-muted text-sm">Nexus · Outlook · Google</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Source filter */}
          <div className={styles.sourceFilters}>
            {[
              { id: 'all',      label: 'All' },
              { id: 'airtable', label: '🔵 Nexus' },
              { id: 'outlook',  label: '🔷 Outlook' },
              { id: 'google',   label: '🔴 Google' },
            ].map(f => (
              <button key={f.id}
                className={`${styles.sourceBtn} ${sourceFilter === f.id ? styles.sourceBtnActive : ''}`}
                onClick={() => setSourceFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <button className={styles.authBtn} onClick={() => setShowAuthPanel(s => !s)}>
            {authStatus.outlook && authStatus.google ? '✓ Synced' : '⚙ Connect'}
          </button>
          <div className={styles.viewToggle}>
            <button className={`${styles.toggleBtn} ${view === 'month' ? styles.toggleActive : ''}`} onClick={() => setView('month')}>Month</button>
            <button className={`${styles.toggleBtn} ${view === 'week' ? styles.toggleActive : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`${styles.toggleBtn} ${view === 'upcoming' ? styles.toggleActive : ''}`} onClick={() => setView('upcoming')}>Upcoming</button>
          </div>
          <button className={styles.addBtn} onClick={() => setShowAdd(s => !s)}>+ Event</button>
        </div>
      </div>

      {/* Auth panel */}
      {showAuthPanel && (
        <div className={styles.authPanel}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Calendar connections</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div className={styles.authRow}>
              <span className={styles.authSource}>Outlook</span>
              <span className={`${styles.authStatus} ${authStatus.outlook ? styles.authOk : styles.authNo}`}>
                {authStatus.outlook ? '✓ Connected' : 'Not connected'}
              </span>
              {!authStatus.outlook && (
                <button className={styles.authConnectBtn} onClick={startOutlookAuth}>Connect</button>
              )}
            </div>
            <div className={styles.authRow}>
              <span className={styles.authSource}>Google</span>
              <span className={`${styles.authStatus} ${authStatus.google ? styles.authOk : styles.authNo}`}>
                {authStatus.google ? '✓ Connected' : 'Not connected'}
              </span>
              {!authStatus.google && (
                <button className={styles.authConnectBtn} onClick={startGoogleAuth}>Connect</button>
              )}
              {!authStatus.google && (
                <button className={styles.authConnectBtn} onClick={loadAll}>Refresh</button>
              )}
            </div>
          </div>
          {authMessage && <p className="text-sm" style={{ color: 'var(--green)' }}>{authMessage}</p>}
        </div>
      )}

      {/* Add event form */}
      {showAdd && (
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input type="text" placeholder="Event title" value={newEvent.title}
            onChange={e => setNewEvent(n => ({ ...n, title: e.target.value }))} style={{ flex: 2 }} />
          <input type="datetime-local" value={newEvent.start}
            onChange={e => setNewEvent(n => ({ ...n, start: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }} />
          <input type="datetime-local" value={newEvent.end}
            onChange={e => setNewEvent(n => ({ ...n, end: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }} />
          <select value={newEvent.category} onChange={e => setNewEvent(n => ({ ...n, category: e.target.value }))}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={addTarget} onChange={e => setAddTarget(e.target.value)}
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
            <option value="airtable">Nexus (Airtable)</option>
            {authStatus.outlook && <option value="outlook">Outlook</option>}
            {authStatus.google  && <option value="google">Google</option>}
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
              const isToday    = sameDay(date, today);
              const isSelected = selected && sameDay(date, selected);
              return (
                <div key={date.toISOString()}
                  className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${isSelected ? styles.dayCellSelected : ''}`}
                  onClick={() => setSelected(date)}>
                  <span className={styles.dayNum}>{date.getDate()}</span>
                  <div className={styles.dayEvents}>
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className={styles.eventPill}
                        style={{ background: CAT_COLORS[e.category] || CAT_COLORS.Other }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className={styles.moreEvents}>+{dayEvents.length - 3}</div>
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
              {eventsForDay(selected).length === 0
                ? <p className="text-muted text-sm">No events</p>
                : eventsForDay(selected).map(e => <EventRow key={e.id} event={e} />)
              }
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
  const color  = CAT_COLORS[event.category] || CAT_COLORS.Other;
  const source = SOURCE_COLORS[event.source];
  return (
    <div className={`${styles.eventRow} ${compact ? styles.eventRowCompact : ''}`}>
      <div className={styles.eventDot} style={{ background: color }} />
      <div className={styles.eventInfo}>
        <span className={styles.eventTitle}>{event.title}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {showDate && event.start && (
            <span className="text-xs text-faint">
              {new Date(event.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {!event.allDay && ` · ${new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
            </span>
          )}
          {!showDate && event.start && !event.allDay && (
            <span className="text-xs text-faint">
              {new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          {source && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${source.bg}22`, color: source.bg, border: `1px solid ${source.bg}44` }}>
              {source.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
