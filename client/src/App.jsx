import { useState, useEffect } from 'react';
import EntertainmentSystem from './modules/EntertainmentSystem.jsx';
import TvReceiver from './modules/TvReceiver.jsx';
import WholeHomeAudio from './modules/WholeHomeAudio.jsx';
import ClimateLighting from './modules/ClimateLighting.jsx';
import CamerasDevices from './modules/CamerasDevices.jsx';
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

function IconSpeaker(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <circle cx="12" cy="15.5" r="3.2" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSun(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </svg>
  );
}

function IconRemote(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="3.5" />
      <circle cx="12" cy="7.2" r="1.4" />
      <path d="M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

function IconCamera(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 8.5a1.5 1.5 0 0 1 1.5-1.5h2l1.2-2h8.6l1.2 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

const TABS = [
  { id: 'entertainment', label: 'Entertainment System', Icon: IconMedia, Component: EntertainmentSystem },
  { id: 'tv-receiver', label: 'TV & Receiver', Icon: IconRemote, Component: TvReceiver },
  { id: 'audio', label: 'Whole-Home Audio', Icon: IconSpeaker, Component: WholeHomeAudio },
  { id: 'climate', label: 'Climate & Lighting', Icon: IconSun, Component: ClimateLighting },
  { id: 'cameras', label: 'Cameras & Devices', Icon: IconCamera, Component: CamerasDevices },
];

export default function App() {
  const [tab, setTab] = useState('entertainment');
  const Active = TABS.find((t) => t.id === tab)?.Component;

  // Haptic feedback: buzz the tablet briefly on every button press, app-wide.
  // Event delegation on document covers every module (including future ones)
  // without wiring an onClick handler individually into each button.
  // Requires: a device with a vibration motor, a Chromium-based browser
  // (Fully Kiosk Browser included — it's Android WebView under the hood),
  // and a prior user gesture (the click itself satisfies that). Some browsers
  // also gate the Vibration API behind a secure (HTTPS) context — since the
  // dashboard is currently served over plain HTTP, that's the first thing to
  // check if this doesn't buzz on the tablet.
  useEffect(() => {
    function handleClick(e) {
      if (navigator.vibrate && e.target.closest('button')) {
        navigator.vibrate(15);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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

      <main className={styles.main}>{Active && <Active />}</main>
    </div>
  );
}