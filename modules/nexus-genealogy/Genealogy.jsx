import { useState } from 'react';
import PipelineView from './Genealogy/PipelineView.jsx';
import PeopleView from './Genealogy/PeopleView.jsx';
import SourcesView from './Genealogy/SourcesView.jsx';
import ResearchView from './Genealogy/ResearchView.jsx';
import styles from './Genealogy.module.css';

const TABS = [
  { id: 'pipeline',  label: 'Pipeline' },
  { id: 'people',    label: 'People' },
  { id: 'sources',   label: 'Sources' },
  { id: 'research',  label: 'Research questions' },
];

export default function Genealogy() {
  const [tab, setTab] = useState('pipeline');

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Genealogy</h1>
          <p className="text-muted text-sm">Research · pipeline · people</p>
        </div>
        <div className={styles.warning}>
          <span style={{ fontSize: 12, color: 'var(--amber)' }}>
            ⚠ Legacy Family Tree — manual entry only
          </span>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === 'pipeline' && <PipelineView />}
        {tab === 'people'   && <PeopleView />}
        {tab === 'sources'  && <SourcesView />}
        {tab === 'research' && <ResearchView />}
      </div>
    </div>
  );
}
