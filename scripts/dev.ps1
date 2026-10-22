# Windows entry point. Run from any directory; paths with spaces are supported.
param([Parameter(Mandatory = $true)][string]$Target)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root 'apps\api'
$web = Join-Path $root 'apps\web'
$py = Join-Path $api '.venv\Scripts\python.exe'
function Invoke-Checked([scriptblock]$Command) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" }
}
function In-Directory([string]$Path, [scriptblock]$Command) {
  Push-Location -LiteralPath $Path
  try { Invoke-Checked $Command } finally { Pop-Location }
}
switch ($Target) {
  'setup' {
    if (-not (Test-Path -LiteralPath $py)) {
      $runtime = if ($env:RENER_PYTHON) { $env:RENER_PYTHON } else { 'python' }
      Invoke-Checked { & $runtime -c 'import sys; assert sys.version_info >= (3,11), "Python >= 3.11 required; set RENER_PYTHON"' }
      Invoke-Checked { & $runtime -m venv (Join-Path $api '.venv') }
    }
    Invoke-Checked { & $py -m pip install -e "${api}[dev]" }
    In-Directory $api { & $py -m app.cli init-db }
    In-Directory $web { npm install }
  }
  'api' { In-Directory $api { & $py -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 } }
  'worker' { In-Directory $api { & $py -m app.worker.run } }
  'web' { In-Directory $web { npm run dev } }
  'dev' {
    # Own these two direct child processes, and stop exactly them when the web command exits.
    $apiChild = Start-Process -FilePath $py -WorkingDirectory $api -WindowStyle Hidden -PassThru -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000'
    $workerChild = Start-Process -FilePath $py -WorkingDirectory $api -WindowStyle Hidden -PassThru -ArgumentList '-m','app.worker.run'
    try { In-Directory $web { npm run dev } }
    finally { $apiChild,$workerChild | Where-Object { -not $_.HasExited } | Stop-Process }
  }
  'seed' { In-Directory $api { & $py -m app.cli seed } }
  'test' { In-Directory $api { & $py -m pytest } }
  'lint' { In-Directory $api { & (Join-Path $api '.venv\Scripts\lint-imports.exe') } }
  'check-fixtures' { In-Directory $root { & $py spec\tools\check_fixtures.py } }
  'generate-api' { In-Directory $web { npm run generate:api } }
  'test-web' { In-Directory $web { npm run test:integration } }
  'test-e2e' { In-Directory $web { npm run test:e2e } }
  'eval' { In-Directory $root { & $py eval\run_eval.py --split dev --methods regex,llm,hybrid } }
  default { throw "Unknown target $Target" }
}
