## api keys
GitHub-token: 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
Firewalla-token: 6a16a3491d677b63dbfb48db74541cbc
Firewalla-domain: dwz7drtwk0d.d.firewalla.org
Raindrop.ai-token: 1b9645cc-623e-4e36-bc9d-1df04a3bbd17
home-assistant-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIwYjE1ZTc4OGRlZjk0Mjg2YjkzZmYxMmVmYWQxZTA4MiIsImlhdCI6MTc4MDc0NTYzNSwiZXhwIjoyMDk2MTA1NjM1fQ.ukia_YYZhe5fo5J4CeD6Zp-rEiKjwWJn4K7VcQSTUwg


## Windows Server 2025 key
KYM4V-NXK68-FDG9G-D8KC8-RYCQ3

## RDP to IoT server
mstsc /v:192.168.230.175

## Powershell remoting to IoT server
Set-Item WSMan:\localhost\Client\TrustedHosts -Value '192.168.230.84' -Force
or
Set-Item WSMan:\localhost\Client\TrustedHosts -Value '192.168.230.84' -Force -Concatenate

Enter-PSSession -ComputerName 192.168.230.84 -Credential (Get-Credential)
or
Invoke-Command -ComputerName 192.168.230.84 -Credential (Get-Credential) -ScriptBlock { node --version }

## Tailscale IP
100.95.164.64

## rebuild dashboard
cd C:\apps\iot-dashboard\client
npm install
npm run build
$nssm = "C:\apps\iot-dashboard\nssm.exe"
& $nssm restart IoTDashboard