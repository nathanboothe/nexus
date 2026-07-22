import { useState } from 'react';
import GoveeLights from './GoveeLights.jsx';
import HomeAssistantEntities from './HomeAssistantEntities.jsx';
import styles from './SmartHome.module.css';

const TABS = [
  { id: 'govee', label: 'Lights' },
  { id: 'ha', label: 'Home Assistant' },
];

export default function SmartHome() {
  const [tab, setTab] = useState('govee');

  return (
    <div>
      <div className={styles.subNav}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? styles.subNavActive : styles.subNavBtn}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'govee' && <GoveeLights />}
      {tab === 'ha' && <HomeAssistantEntities />}
    </div>
  );
}
