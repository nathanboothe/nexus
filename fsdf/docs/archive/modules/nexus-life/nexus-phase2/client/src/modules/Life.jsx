import { useState } from 'react';
import ProjectsBoard from './Life/ProjectsBoard.jsx';
import InboxView from './Life/InboxView.jsx';
import TasksView from './Life/TasksView.jsx';
import styles from './Life.module.css';

const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'inbox',    label: 'Inbox' },
  { id: 'tasks',    label: 'Tasks' },
];

export default function Life() {
  const [tab, setTab] = useState('projects');

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Life management</h1>
          <p className="text-muted text-sm">Projects · inbox · tasks</p>
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
        {tab === 'projects' && <ProjectsBoard />}
        {tab === 'inbox'    && <InboxView />}
        {tab === 'tasks'    && <TasksView />}
      </div>
    </div>
  );
}
