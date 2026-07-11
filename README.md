# Nexus

Self-hosted home automation dashboard. Modules: Rec Room (Samsung TV / Denon AVR / Google TV), Smart Home (Govee).

## First-time setup (on the Windows host)

```powershell
git clone <your-repo-url> C:\apps\nexus
cd C:\apps\nexus\server
Copy-Item config.example.js config.js
notepad config.js   # fill in HA token + Govee API key — this file is gitignored, never committed
npm install
cd C:\apps\nexus\client
npm install
npm run build
```

Then point NSSM at it:
```powershell
c:\tools\nssm.exe install NexusDashboard "C:\Program Files\nodejs\node.exe" index.js
c:\tools\nssm.exe set NexusDashboard AppDirectory C:\apps\nexus\server
c:\tools\nssm.exe start NexusDashboard
```

## Deploying updates (going forward — replaces manual file copying)

```powershell
cd C:\apps\nexus
git pull
cd server
npm install        # only if package.json changed
cd ..\client
npm install         # only if package.json changed
npm run build
c:\tools\nssm.exe restart NexusDashboard
```

`config.js` is gitignored and lives only on the server — `git pull` will never touch it or overwrite your real secrets.

## Devices

| Device | IP | Notes |
|---|---|---|
| Home Assistant | 192.168.230.81:8123 | headless integration layer only |
| Denon AVR | 192.168.230.29:11080 | direct HTTP, no auth, plain HTTP not HTTPS |
| Google TV streamer | 192.168.230.174 | ADB for app launch only; nav goes through HA |
| Broadlink RM4 Pro | 192.168.230.73 | `remote.base_station` in HA, controls Samsung TV via IR |
