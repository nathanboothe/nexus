import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { modules } from '../moduleRegistry.js';
import styles from './Layout.module.css';

export default function Layout() {
  const nav = useNavigate();

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.logo} onClick={() => nav('/')}>
          <span className={styles.logoMark}>N</span>
          <span className={styles.logoText}>Nexus</span>
        </div>
        <div className={styles.navLinks}>
          {modules.map(m => (
            <NavLink
              key={m.id}
              to={m.route}
              end={m.route === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''} ${!m.live ? styles.navDim : ''}`
              }
              title={!m.live ? `Phase ${m.phase} — coming soon` : m.name}
            >
              <span className={styles.navIcon}>{m.icon}</span>
              <span className={styles.navLabel}>{m.name}</span>
              {!m.live && <span className={styles.navPill}>P{m.phase}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
