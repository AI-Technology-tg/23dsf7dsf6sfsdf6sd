param(
    [switch]$Deploy,
    [switch]$Enrich,
    [string]$ProjectRoot = "",
    [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $Message"
}

function Find-NodeCommand {
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return "npm" }
    $npmCmd = "C:\Program Files\nodejs\npm.cmd"
    if (Test-Path $npmCmd) { return $npmCmd }
    throw "npm не найден. Установите Node.js или добавьте npm в PATH."
}

function Ensure-KodikToken {
    if ($env:KODIK_API_TOKEN -and $env:KODIK_API_TOKEN.Trim()) {
        return
    }

    $secure = Read-Host "Введите KODIK_API_TOKEN" -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
    if (-not $plain -or -not $plain.Trim()) {
        throw "KODIK_API_TOKEN пустой."
    }
    $env:KODIK_API_TOKEN = $plain.Trim()
}

if (-not $ProjectRoot) {
    $ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}

if (-not $LogPath) {
    $logDir = Join-Path $ProjectRoot "logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $LogPath = Join-Path $logDir ("anime-auto-update-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
}

Start-Transcript -Path $LogPath -Append | Out-Null

try {
    Write-Step "Re-Minko anime automation start"
    Write-Step "Project root: $ProjectRoot"
    Set-Location $ProjectRoot

    $npm = Find-NodeCommand
    Ensure-KodikToken

    if ($Enrich) {
        Write-Step "Updating Kodik data + enrichment"
        & $npm run automate:anime:api:enrich
    } else {
        Write-Step "Updating Kodik data"
        & $npm run automate:anime:api
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Anime automation failed with exit code $LASTEXITCODE"
    }

    if ($Deploy) {
        Write-Step "Deploying to Netlify"
        & npx netlify deploy --prod --dir "$ProjectRoot"
        if ($LASTEXITCODE -ne 0) {
            throw "Netlify deploy failed with exit code $LASTEXITCODE"
        }
    } else {
        Write-Step "Deploy skipped. Run with -Deploy to publish via Netlify CLI."
    }

    Write-Step "Re-Minko anime automation finished"
} finally {
    Remove-Item Env:KODIK_API_TOKEN -ErrorAction SilentlyContinue
    Stop-Transcript | Out-Null
}
