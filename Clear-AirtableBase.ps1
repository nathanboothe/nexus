#Requires -Version 7.0
# Clear-AirtableBase.ps1
# Deletes ALL records from all eight tables in the Boothe Genealogy Airtable base.
# Does NOT delete tables, fields, or any data outside Airtable.
# Run ONCE before reloading all 15 source documents cleanly.

$ErrorActionPreference = 'Stop'
$AirtableBaseId = "appkKCuHilZQCy3UF"

# Deletion order matters — linked tables must be cleared before the tables they link to
$TableOrder = @(
    "IR-Subject Links",    # links IR + Subjects — clear first
    "Events",              # links IR + Subjects
    "Families",            # links IR + Subjects
    "Research Questions",  # links Sources + Subjects
    "Information Record",  # links Sources
    "Subject (People)",    # linked by above
    "Sources",             # linked by IR, RQ
    "Repositories"         # linked by Sources
)

Import-Module CredentialManager

function Get-Secret([string]$Target) {
    $c = Get-StoredCredential -Target $Target
    if (-not $c) { throw "Credential '$Target' not found." }
    return $c.GetNetworkCredential().Password
}

function Get-AllRecords([string]$Table) {
    $pat     = Get-Secret 'GenealogyApp_AirtablePAT'
    $records = [System.Collections.Generic.List[string]]::new()
    $offset  = $null

    do {
        $uri = "https://api.airtable.com/v0/$AirtableBaseId/$([System.Uri]::EscapeDataString($Table))?pageSize=100"
        if ($offset) { $uri += "&offset=$offset" }

        $result = Invoke-RestMethod -Uri $uri `
            -Headers @{ Authorization = "Bearer $pat" }

        foreach ($r in $result.records) { $records.Add($r.id) }
        $offset = $result.offset
    } while ($offset)

    return $records
}

function Delete-Records([string]$Table, [System.Collections.Generic.List[string]]$Ids) {
    $pat   = Get-Secret 'GenealogyApp_AirtablePAT'
    $total = $Ids.Count
    $done  = 0

    # Airtable allows deleting up to 10 records per request
    for ($i = 0; $i -lt $total; $i += 10) {
        $batch  = $Ids | Select-Object -Skip $i -First 10
        $params = ($batch | ForEach-Object { "records[]=$_" }) -join "&"
        $uri    = "https://api.airtable.com/v0/$AirtableBaseId/$([System.Uri]::EscapeDataString($Table))?$params"

        $attempt = 0
        while ($attempt -lt 3) {
            try {
                Invoke-RestMethod -Method DELETE -Uri $uri `
                    -Headers @{ Authorization = "Bearer $pat" } | Out-Null
                $done += $batch.Count
                break
            } catch {
                $attempt++
                $status = $_.Exception.Response.StatusCode.value__
                if ($attempt -lt 3 -and $status -in @(429, 500, 502, 503)) {
                    Start-Sleep -Seconds (5 * $attempt)
                } else { throw }
            }
        }

        # Respect Airtable rate limit — 5 requests/sec max
        Start-Sleep -Milliseconds 250
    }
    return $done
}

# ── MAIN ──────────────────────────────────────────────────────────────────────
Write-Host "`n=== Airtable Base Wipe ===" -ForegroundColor Red
Write-Host "Base: $AirtableBaseId" -ForegroundColor Red
Write-Host "This will permanently delete ALL records from all eight tables.`n"

# Step 1 — count records in each table
Write-Host "Counting records..." -ForegroundColor Cyan
$counts = @{}
$totalRecords = 0
foreach ($table in $TableOrder) {
    try {
        $ids = Get-AllRecords $table
        $counts[$table] = $ids
        Write-Host "  $table — $($ids.Count) records"
        $totalRecords += $ids.Count
    } catch {
        Write-Host "  $table — ERROR reading: $_" -ForegroundColor Red
        $counts[$table] = [System.Collections.Generic.List[string]]::new()
    }
}

Write-Host "`nTotal records to delete: $totalRecords" -ForegroundColor Yellow

if ($totalRecords -eq 0) {
    Write-Host "`nAll tables are already empty. Nothing to do." -ForegroundColor Green
    exit 0
}

# Step 2 — confirm
Write-Host "`nType YES to confirm deletion of all $totalRecords records: " -ForegroundColor Red -NoNewline
$confirm = Read-Host
if ($confirm -ne "YES") {
    Write-Host "Aborted — no records deleted." -ForegroundColor Yellow
    exit 0
}

# Step 3 — delete in order
Write-Host "`nDeleting..." -ForegroundColor Cyan
$totalDeleted = 0
foreach ($table in $TableOrder) {
    $ids = $counts[$table]
    if ($ids.Count -eq 0) {
        Write-Host "  $table — already empty, skipping" -ForegroundColor Gray
        continue
    }
    try {
        $deleted = Delete-Records $table $ids
        $totalDeleted += $deleted
        Write-Host "  [OK] $table — deleted $deleted records" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] $table — $_" -ForegroundColor Red
    }
}

Write-Host "`n=== WIPE COMPLETE ===" -ForegroundColor Cyan
Write-Host "Deleted: $totalDeleted of $totalRecords records"
Write-Host "All eight tables are now empty and ready for a clean reload.`n"
