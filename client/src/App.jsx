import { useState } from 'react';
import RecRoom from './modules/RecRoom.jsx';
import SmartHome from './modules/SmartHome.jsx';
import styles from './App.module.css';

function IconMedia(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17.5V21" />
      <path d="M10.3 8.3v5.4l4.4-2.7-4.4-2.7Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

const TABS = [
  { id: 'recroom', label: 'Media Controls', Icon: IconMedia },
  { id: 'smarthome', label: 'Smart Home', Icon: IconHome },
];

export default function App() {
  const [tab, setTab] = useState('recroom');

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          <span className={styles.brandName}>Nexus</span>
        </div>

        <nav className={styles.nav}>
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={tab === id ? styles.navActive : styles.navBtn}
              onClick={() => setTab(id)}
            >
              <Icon className={styles.navIcon} />
              {label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.statusDot} />
          Live
        </div>
      </aside>

      <main className={styles.main}>
        {tab === 'recroom' && <RecRoom />}
        {tab === 'smarthome' && <SmartHome />}
      </main>
    </div>
  );
}
