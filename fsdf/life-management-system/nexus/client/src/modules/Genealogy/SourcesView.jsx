import { useState, useEffect } from 'react';
import { airtable } from '../../api.js';
import styles from './SourcesView.module.css';

const SOURCE_TYPES = [
  'Census record','Birth certificate','Death certificate','Marriage record',
  'Obituary','Newspaper article','Compiled biography','Adoption order',
  'Genealogical reference','Photograph','Deed','Will','Other'
];

export default function SourcesView() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    airtable.list('sources', { maxRecords: 200 })
      .then(data => {
        const sorted = (data.records || []).sort((a, b) => {
          const sa = a.fields['Source ID'] || '';
          const sb = b.fields['Source ID'] || '';
          return sa.localeCompare(sb);
        });
        setSources(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = sources.filter(r => {
    const f = r.fields;
    const matchSearch = !search ||
      (f['Source ID'] || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.Title || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || f.Type === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) return <p className="text-muted">Loading sources...</p>;

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <div className={styles.searchBar}>
          <input type="text" placeholder="Search sources..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className={styles.typeFilters}>
          <button className={`${styles.typeBtn} ${typeFilter === 'All' ? styles.typeBtnActive : ''}`}
            onClick={() => setTypeFilter('All')}>All types</button>
          {SOURCE_TYPES.map(t => (
            <button key={t}
              className={`${styles.typeBtn} ${typeFilter === t ? styles.typeBtnActive : ''}`}
              onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
        <div className={styles.sourceList}>
          <p className="text-xs text-faint" style={{ padding: '4px 8px' }}>{filtered.length} sources</p>
          {filtered.map(rec => {
            const f = rec.fields;
            return (
              <button key={rec.id}
                className={`${styles.sourceItem} ${selected?.id === rec.id ? styles.sourceItemActive : ''}`}
                onClick={() => setSelected(rec)}>
                <span className={styles.sourceId}>{f['Source ID'] || '—'}</span>
                <span className={styles.sourceTitle}>{f.Title || 'Untitled'}</span>
                {f.Type && <span className="text-xs text-faint">{f.Type}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted text-sm" style={{ padding: '12px 8px' }}>No sources found</p>
          )}
        </div>
      </div>

      <div className={styles.main}>
        {selected ? (
          <SourceDetail rec={selected} />
        ) : (
          <div className={styles.empty}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>◎</p>
            <p className="text-muted">Select a source to view citation</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceDetail({ rec }) {
  const f = rec.fields;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{f['Source ID']}</h2>
        {f.Type && <span className="badge badge-gray">{f.Type}</span>}
      </div>
      <p style={{ fontSize: 16, marginBottom: 16 }}>{f.Title}</p>

      <div className={styles.qualityGrid}>
        {f['Source quality'] && (
          <div className={styles.qualityItem}>
            <span className={styles.qualityLabel}>Source</span>
            <span className={styles.qualityValue}>{f['Source quality']}</span>
          </div>
        )}
        {f['Information quality'] && (
          <div className={styles.qualityItem}>
            <span className={styles.qualityLabel}>Information</span>
            <span className={styles.qualityValue}>{f['Information quality']}</span>
          </div>
        )}
        {f['Evidence quality'] && (
          <div className={styles.qualityItem}>
            <span className={styles.qualityLabel}>Evidence</span>
            <span className={styles.qualityValue}>{f['Evidence quality']}</span>
          </div>
        )}
      </div>

      {f.Citation && (
        <div className={styles.citation}>
          <p className="text-xs text-faint" style={{ marginBottom: 6 }}>Evidence Explained citation</p>
          <p className="text-sm" style={{ lineHeight: 1.7, fontStyle: 'italic' }}>{f.Citation}</p>
        </div>
      )}

      {f['File name'] && (
        <div style={{ marginTop: 12 }}>
          <p className="text-xs text-faint" style={{ marginBottom: 4 }}>File name</p>
          <code style={{ fontSize: 12, background: 'var(--surface2)', padding: '4px 8px', borderRadius: 4 }}>
            {f['File name']}
          </code>
        </div>
      )}

      {f.Notes && (
        <div style={{ marginTop: 16 }}>
          <p className="text-xs text-faint" style={{ marginBottom: 6 }}>Notes</p>
          <p className="text-sm" style={{ lineHeight: 1.6 }}>{f.Notes}</p>
        </div>
      )}
    </div>
  );
}
