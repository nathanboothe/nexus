## 1. Installing NSSM

```powershell
winget install -e --id NSSM.NSSM --accept-package-agreements --accept-source-agreements
```
Open a fresh PowerShell window afterward so `nssm` resolves on PATH (or just call
it by full path, which is what you ended up doing: `C:\tools\nssm.exe`).

---

## 2. Registering the Nexus service (current, `NexusDashboard`)

```powershell
c:\tools\nssm.exe install NexusDashboard "C:\Program Files\nodejs\node.exe"
c:\tools\nssm.exe set NexusDashboard AppDirectory "C:\apps\nexus\server"
c:\tools\nssm.exe set NexusDashboard AppParameters "index.js"
c:\tools\nssm.exe set NexusDashboard AppStdout "C:\apps\nexus\logs\service.log"
c:\tools\nssm.exe set NexusDashboard AppStderr "C:\apps\nexus\logs\error.log"
c:\tools\nssm.exe set NexusDashboard Start SERVICE_AUTO_START
c:\tools\nssm.exe start NexusDashboard
```

Verify:
```powershell
c:\tools\nssm.exe status NexusDashboard
```

Note the log split: `service.log` = AppStdout, `error.log` = AppStderr — actual
crash errors show up in `error.log`, not `service.log`.

### Predecessor version (`IoTDashboard`, same box, before rename)
```powershell
New-Item -ItemType Directory -Path C:\apps\iot-dashboard\logs -Force

nssm install IoTDashboard "C:\Program Files\nodejs\node.exe" "C:\apps\iot-dashboard\server\server.js"
nssm set IoTDashboard AppDirectory "C:\apps\iot-dashboard\server"
nssm set IoTDashboard Start SERVICE_AUTO_START
nssm set IoTDashboard AppStdout "C:\apps\iot-dashboard\logs\out.log"
nssm set IoTDashboard AppStderr "C:\apps\iot-dashboard\logs\err.log"
nssm start IoTDashboard
```

---

## 3. Standard deploy routine

Client-only change (most common case — UI edits):
```powershell
cd C:\apps\nexus\client
npm install
npm run build
c:\tools\nssm.exe restart NexusDashboard
```
Then hard-refresh the browser (Ctrl+Shift+R) — old JS bundle caches aggressively.

Backend change:
```powershell
cd C:\apps\nexus\server
npm install
c:\tools\nssm.exe restart NexusDashboard
```

Config-only change (no rebuild needed):
```powershell
c:\tools\nssm.exe restart NexusDashboard
```

**Order matters:** build before restart, or you serve the stale `dist`.

> Reminder from your own standing rules: PowerShell here doesn't support `&&` —
> run commands on separate lines, not chained.

---

## 4. Service diagnostics / recovery

Check status:
```powershell
c:\tools\nssm.exe status NexusDashboard
Get-Service NexusDashboard
```

If it's stuck in `SERVICE_PAUSED` (NSSM's crash-throttle state) — **use `continue`,
not `restart`**:
```powershell
c:\tools\nssm.exe continue NexusDashboard
```
If the underlying crash persists it will re-pause immediately with the backoff
doubling each time — check `error.log`, not `service.log`, for the real cause:
```powershell
Get-Content "C:\apps\nexus\logs\error.log" -Tail 20
```

If NSSM's own `resume` verb isn't available in your build (v2.24 doesn't have it),
fall back to the Windows service controller directly:
```powershell
Stop-Service NexusDashboard -Force
Start-Service NexusDashboard
Get-Service NexusDashboard
```

Confirm port 8080 is actually listening:
```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | Format-List LocalAddress, LocalPort
```

Find nssm.exe / the service if things seem to have vanished:
```powershell
Get-Service | Where-Object { $_.Name -like "*Nexus*" -or $_.DisplayName -like "*Nexus*" }
Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, OwningProcess
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName
Get-ChildItem -Path "C:\" -Recurse -Filter nssm.exe -ErrorAction SilentlyContinue | Select-Object FullName
```

---

## 5. Regenerating the entities list (predecessor pattern, still useful)

Used to pull the full entity list out of `layout.js` for pasting into `config.js`:
```powershell
cd C:\apps\iot-dashboard\client\src
node --input-type=module -e "import {ALL_ENTITIES} from './layout.js'; console.log(JSON.stringify(ALL_ENTITIES, null, 2))"
```

Verifying a specific panel's config (Rec Room quick-play example):
```powershell
cd C:\apps\iot-dashboard\client
npm install --silent
npm run build
cd src
node --input-type=module -e "
import { PANELS } from './layout.js';
const qp = PANELS.find(p=>p.id==='rec_room').activities.quickPlay;
qp.forEach(q=>console.log(q.label, '->', q.script || q.command));
"
```

---

## 6. Task-file management ("never edit JS via here-string")

Your established, corruption-safe pattern for pulling a delivered file into place:
```powershell
Copy-Item -Path "C:\Users\<you>\Downloads\rtm.js" -Destination "C:\apps\nexus\server\adapters\rtm.js" -Force
```
(JS files are always edited/created in Notepad directly, or delivered as a
download and copied with `Copy-Item -Force` — never built via PowerShell
here-strings, which was the source of at least two file-corruption incidents.)

---

## 7. `Check-NexusTodoToken.ps1`

Diagnostic script for the Microsoft To Do OAuth token cache (from the Tasks
module / Microsoft Graph era, before the RTM migration). Reads token health
against the SYSTEM-profile token cache, with an optional live Graph ping.

```powershell
<#
.SYNOPSIS
    Checks the health of the Nexus Microsoft To Do OAuth token cache.

.DESCRIPTION
    Reads the token cache file used by the Nexus Tasks module's hand-rolled
    device-code flow, reports expiry status, and optionally pings the Graph
    API /me endpoint to confirm the token is actually live (not just
    unexpired on paper).

    Because the NexusDashboard service runs as SYSTEM, the token file lives
    under C:\Windows\System32\config\systemprofile\. Reading it from an
    interactive PowerShell session requires running as Administrator.

.NOTES
    Schedule this via Task Scheduler (as SYSTEM or an admin account) every
    15-30 min if you want proactive alerting rather than checking manually.
    Wire the WARN/EXPIRED branches to email/notification of your choice --
    placeholder below just writes to the console and a log line.
#>

param(
    [string]$TokenPath = "C:\Windows\System32\config\systemprofile\.nexus_todo_token.json",
    [int]$WarningThresholdMinutes = 60,
    [switch]$PingGraph
)

function Write-Status {
    param([string]$Level, [string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    # Optional: append to a log file for later review / Nexus UI ingestion
    Add-Content -Path "$PSScriptRoot\nexus_todo_token_health.log" -Value $line
}

# --- Check current user has access to the token file ---
if (-not (Test-Path $TokenPath)) {
    Write-Status "ERROR" "Token file not found at $TokenPath. If running interactively, try 'Run as Administrator' (file is under the SYSTEM profile)."
    exit 1
}

# NOTE: this script was captured mid-conversation and the remainder (expiry
# comparison logic + the -PingGraph branch calling /me) was not present in
# the retrievable transcript. Regenerate that tail from the Tasks Module
# chat if you still need this script — it's superseded by the RTM adapter
# now anyway, since Tasks moved off Microsoft To Do.
```

> **Note:** this script predates the RTM migration and is likely dead code now
> that Projects & Tasks runs on Remember the Milk instead of Microsoft To Do —
> flagging rather than silently omitting it.

---

## 8. `Export-NexusTasks.ps1`

Full backup/export script for Microsoft To Do tasks (same era as above — pre-RTM).
This one came through complete:

```powershell
<#
Exports all Nexus tasks from Microsoft To Do to timestamped JSON + CSV.
Find the list ID once via: GET https://graph.microsoft.com/v1.0/me/todo/lists
#>

param(
    [string]$TokenPath = "C:\Windows\System32\config\systemprofile\.nexus_todo_token.json",
    [string]$ListId = "REPLACE_WITH_YOUR_NEXUS_LIST_ID",
    [string]$OutputDir = "C:\apps\nexus\backups\tasks",
    [int]$RetainCount = 30
)

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if (-not (Test-Path $TokenPath)) {
    Write-Error "Token file not found at $TokenPath. Run as Administrator if needed."
    exit 1
}

$tokenJson = Get-Content -Path $TokenPath -Raw | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($tokenJson.access_token)" }

$allTasks = @()
$uri = "https://graph.microsoft.com/v1.0/me/todo/lists/$ListId/tasks?`$top=50"

try {
    while ($uri) {
        $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -ErrorAction Stop
        $allTasks += $response.value
        $uri = $response.'@odata.nextLink'
    }
}
catch {
    Write-Error "Failed to pull tasks: $($_.Exception.Message)"
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$jsonPath = Join-Path $OutputDir "nexus_tasks_$timestamp.json"
$csvPath  = Join-Path $OutputDir "nexus_tasks_$timestamp.csv"

$allTasks | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding utf8

$allTasks | Select-Object `
    @{N='Id';E={$_.id}},
    @{N='Title';E={$_.title}},
    @{N='Status';E={$_.status}},
    @{N='Importance';E={$_.importance}},
    @{N='DueDate';E={ if ($_.dueDateTime) { $_.dueDateTime.dateTime } else { $null } }},
    @{N='Categories';E={ ($_.categories -join '; ') }} |
    Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8

Write-Host "Exported $($allTasks.Count) tasks to:`n  $jsonPath`n  $csvPath"

# --- Prune old backups beyond RetainCount ---
$oldBackups = Get-ChildItem -Path $OutputDir -Filter "nexus_tasks_*.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $RetainCount

if ($oldBackups) {
    foreach ($file in $oldBackups) {
        $baseName = $file.BaseName
        Remove-Item -Path $file.FullName -Force
        $matchingCsv = Join-Path $OutputDir "$baseName.csv"
        if (Test-Path $matchingCsv) { Remove-Item -Path $matchingCsv -Force }
    }
    Write-Host "Pruned $($oldBackups.Count) old backup(s), keeping most recent $RetainCount."
}
```

> Same caveat as #7 — written for the Microsoft To Do era of Tasks, now likely
> superseded by RTM. Worth deciding whether you want an RTM-equivalent backup
> script (RTM has no built-in export) — say the word and I'll write one against
> `rtm.js`'s existing auth pattern.

---

## 9. Other diagnostic one-liners used along the way

Confirm what's using port 8080 before assuming the service is broken:
```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | Format-List LocalAddress, LocalPort
```

Confirm build output before troubleshooting further (build-then-test discipline):
```powershell
cd C:\apps\nexus\client
npm install
npm run build
```

---

## Gaps / what I could NOT recover verbatim

Searching turned up **summaries, not full transcripts**, for a fair amount of this
project's history — meaning some PowerShell that was almost certainly run doesn't
show up here because only a text description of the session survived in
searchable form, not the literal commands. Known gaps:

- Initial Windows Server 2025 VM / Hyper-V setup (MAC spoofing timing, switching
  from wireless to wired Hyper-V external switch) — described in memory, exact
  PowerShell/Hyper-V Manager steps not recovered.
- Firewalla DHCP reservation / DNS setup — done via the Firewalla app, not
  PowerShell, as far as I can tell.
- Any ADB install/setup commands for `C:\tools\platform-tools\adb.exe` beyond
  the fact that it was installed and used for `am start -n` app launches.
- Genealogy pipeline (`Process-GenealogyDocument.ps1`) — this is a **separate**
  system, not yet migrated into Nexus (still an open decision per your notes:
  target base, Confidence/Family Line field-type bugs unresolved). Not included
  here since it isn't Nexus code yet.
- The full RTM adapter (`server\adapters\rtm.js`) is JavaScript, not PowerShell,
  so it's intentionally excluded — flagging in case that's actually what you
  need next.

If any of these gaps matter, tell me which one and I'll dig into that specific
chat more deeply rather than re-searching everything broadly again.
