import { useState } from 'react';
import MetricsView from './Health/MetricsView.jsx';
import AppointmentsView from './Health/AppointmentsView.jsx';
import MedicationsView from './Health/MedicationsView.jsx';
import WorkoutsView from './Health/WorkoutsView.jsx';
import styles from './Health.module.css';

const TABS = [
  { id: 'metrics',      label: 'Metrics' },
  { id: 'workouts',     label: 'Workouts' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'medications',  label: 'Medications' },
];

export default function Health() {
  const [tab, setTab] = useState('metrics');

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Health</h1>
          <p className="text-muted text-sm">Metrics, workouts, appointments, medications</p>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === 'metrics'      && <MetricsView />}
        {tab === 'workouts'     && <WorkoutsView />}
        {tab === 'appointments' && <AppointmentsView />}
        {tab === 'medications'  && <MedicationsView />}
      </div>
    </div>
  );
}
