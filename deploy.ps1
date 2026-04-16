param(
    [string]$CommitMsg = ""
)

$VPS   = "103.69.190.75"
$PW    = "2Hi!iyvOWXacxGz"
$PLINK = "C:\Program Files\PuTTY\plink.exe"

Set-Location $PSScriptRoot

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n/3] $msg" -ForegroundColor Cyan
}
function Write-OK($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  ERR $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  QLDA Auto Deploy  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Step 1: Git
Write-Step 1 "Git: commit + push to GitHub"

if ($CommitMsg -eq "") {
    $CommitMsg = "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

git -C $PSScriptRoot add -A 2>&1 | Out-Null
$dirty = git -C $PSScriptRoot status --porcelain
if ($dirty) {
    git -C $PSScriptRoot commit -m $CommitMsg 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Fail "git commit that bai" }
} else {
    Write-Host "  (Khong co thay doi moi, skip commit)" -ForegroundColor Gray
}

git -C $PSScriptRoot push origin master 2>$null
Write-OK "GitHub OK"

# Step 2: clasp push + deploy
Write-Step 2 "clasp push to Google Apps Script"

Push-Location $PSScriptRoot
$claspOut = npx clasp push --force 2>&1
$claspOut | ForEach-Object { Write-Host "  $_" }

# Update all production deployments to latest code
$deployIds = @(
    "AKfycbyowvuVCFA4BJs72r1ttz2DP1qcxWgoTax1RsdOMh4vBgeuWP2ZUTX6nOGlySJU4ub-"
)
foreach ($id in $deployIds) {
    $out = npx clasp deploy --deploymentId $id --description "auto-deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1
    Write-Host "  $out"
}
Pop-Location
Write-OK "Google Apps Script OK"

# Step 3: VPS
Write-Step 3 "VPS: git pull + restart qlda_bot"

if (-not (Test-Path $PLINK)) { $PLINK = "plink" }

$vpsResult = (echo "y" | & $PLINK -ssh root@$VPS -pw $PW -batch "cd /root/QLDABot; git pull origin master --quiet; systemctl restart qlda_bot; sleep 2; systemctl is-active qlda_bot") 2>&1
$vpsResult | ForEach-Object { Write-Host "  $_" }

$lastLine = ($vpsResult | Where-Object { $_ -match '\S' } | Select-Object -Last 1)
if ($lastLine -eq "active") {
    Write-OK "Bot dang chay tren VPS"
} else {
    Write-Warn "Kiem tra lai bot tren VPS"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Deploy hoan tat!  $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
