import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './PeopleView.module.css';

const FAMILY_LINES = [
  'Boothe','Rutherford','Seymour','Fletcher','Kellogg','Crandall/Stocking',
  'Curry','Munger','Voakes','Schenck','Nicholas','Vanbuskirk','Horgan',
  'McClean','Mangan','Mallory','Frank-Nathan','Frank-Adrienne','Smart','Marlow'
];

export default function PeopleView() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    airtable.list('subjects', { maxRecords: 500 })
      .then(data => { setPeople(data.records || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = people.filter(r => {
    const f = r.fields;
    const name = `${f['Given name'] || ''} ${f.Surname || ''}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchLine = lineFilter === 'All' ||
      (Array.isArray(f['Family Line']) && f['Family Line'].includes(lineFilter)) ||
      f['Family Line'] === lineFilter;
    return matchSearch && matchLine;
  }).sort((a, b) => {
    const sa = a.fields.Surname || '';
    const sb = b.fields.Surname || '';
    return sa.localeCompare(sb);
  });

  if (loading) return <p className="text-muted">Loading people...</p>;

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.lineFilters}>
          <button
            className={`${styles.lineBtn} ${lineFilter === 'All' ? styles.lineBtnActive : ''}`}
            onClick={() => setLineFilter('All')}
          >All lines</button>
          {FAMILY_LINES.map(l => (
            <button
              key={l}
              className={`${styles.lineBtn} ${lineFilter === l ? styles.lineBtnActive : ''}`}
              onClick={() => setLineFilter(l)}
            >{l}</button>
          ))}
        </div>
        <div className={styles.personList}>
          <p className="text-xs text-faint" style={{ padding: '4px 8px' }}>{filtered.length} people</p>
          {filtered.map(rec => {
            const f = rec.fields;
            const name = [f['Given name'], f.Surname].filter(Boolean).join(' ') || 'Unknown';
            return (
              <button
                key={rec.id}
                className={`${styles.personItem} ${selected?.id === rec.id ? styles.personItemActive : ''}`}
                onClick={() => setSelected(rec)}
              >
                <span className={styles.personName}>{name}</span>
                {f.Surname && <span className="text-xs text-faint">{f.Surname}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted text-sm" style={{ padding: '12px 8px' }}>No people found</p>
          )}
        </div>
      </div>

      <div className={styles.main}>
        {selected ? (
          <PersonDetail rec={selected} />
        ) : (
          <div className={styles.empty}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>⬡</p>
            <p className="text-muted">Select a person to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonDetail({ rec }) {
  const f = rec.fields;
  const name = [f['Given name'], f.Surname].filter(Boolean).join(' ') || 'Unknown';
  const lines = Array.isArray(f['Family Line']) ? f['Family Line'] : f['Family Line'] ? [f['Family Line']] : [];

  return (
    <div className={styles.detail}>
      <h2 className={styles.detailName}>{name}</h2>
      <p className="text-xs text-faint" style={{ marginBottom: 16 }}>{rec.fields['Subject ID']}</p>

      <div className={styles.detailGrid}>
        {f['Given name'] && <Field label="Given name" value={f['Given name']} />}
        {f.Surname && <Field label="Surname" value={f.Surname} />}
        {f.Gender && <Field label="Gender" value={f.Gender} />}
        {f['Birth date'] && <Field label="Birth date" value={new Date(f['Birth date']).toLocaleDateString()} />}
        {f['Birth place'] && <Field label="Birth place" value={f['Birth place']} />}
        {f['Death date'] && <Field label="Death date" value={new Date(f['Death date']).toLocaleDateString()} />}
        {f['Death place'] && <Field label="Death place" value={f['Death place']} />}
      </div>

      {lines.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="text-xs text-faint" style={{ marginBottom: 6 }}>Family lines</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {lines.map(l => (
              <span key={l} className="badge badge-gray"
                style={{ background: l.includes('Frank') ? 'rgba(153,53,86,0.15)' : undefined,
                         color: l.includes('Frank') ? '#993556' : undefined }}>
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {f.Notes && (
        <div style={{ marginTop: 16 }}>
          <p className="text-xs text-faint" style={{ marginBottom: 6 }}>Notes</p>
          <p className="text-sm" style={{ lineHeight: 1.6 }}>{f.Notes}</p>
        </div>
      )}

      <div className={styles.manualReminder}>
        <p className="text-xs">⚠ Enter this person in Legacy Family Tree manually</p>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  );
}
