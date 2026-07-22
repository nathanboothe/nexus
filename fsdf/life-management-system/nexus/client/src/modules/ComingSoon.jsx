import { getModule } from '../moduleRegistry.js';

export default function ComingSoon({ id }) {
  const mod = getModule(id);
  if (!mod) return null;
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: mod.color }}>{mod.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{mod.name}</h2>
        <p className="text-muted" style={{ marginBottom: 4 }}>{mod.description}</p>
        <p className="text-faint text-sm">Phase {mod.phase} — coming soon</p>
      </div>
    </div>
  );
}
