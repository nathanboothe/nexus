import { useState } from 'react';
import RecRoom from './modules/RecRoom.jsx';
import SmartHome from './modules/SmartHome.jsx';
import styles from './App.module.css';

const TABS = [
  { id: 'recroom', label: 'Rec Room' },
  { id: 'smarthome', label: 'Smart Home' },
];

export default function App() {
  const [tab, setTab] = useState('recroom');

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? styles.navActive : styles.navBtn}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className={styles.main}>
        {tab === 'recroom' && <RecRoom />}
        {tab === 'smarthome' && <SmartHome />}
      </main>
    </div>
  );
}
