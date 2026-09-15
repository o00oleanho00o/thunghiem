$ErrorActionPreference = 'Continue'
$root = Join-Path (Get-Location) 'research/cloned-or-scripted-spikes'
$outDir = Join-Path (Get-Location) 'evidence/test-logs/external'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Run-Step([string]$name, [string]$dir, [string]$command) {
  $log = Join-Path $outDir "$name.log"
  "COMMAND: $command" | Set-Content -LiteralPath $log
  "DIR: $dir" | Add-Content -LiteralPath $log
  Push-Location $dir
  try {
    cmd.exe /d /c $command 2>&1 | Tee-Object -FilePath $log -Append
    $code = $LASTEXITCODE
  } catch {
    $_ | Out-String | Add-Content -LiteralPath $log
    $code = 99
  } finally { Pop-Location }
  "EXIT_CODE: $code" | Add-Content -LiteralPath $log
  Write-Output "$name exit=$code"
}

Run-Step 'sldeditor-npm-ci' (Join-Path $root 'sldeditor') 'npm ci --ignore-scripts'
Run-Step 'sldeditor-test' (Join-Path $root 'sldeditor') 'npm test -- --run'
Run-Step 'sldeditor-build' (Join-Path $root 'sldeditor') 'npm run build'
Run-Step 'dxf-parser-npm-ci' (Join-Path $root 'dxf-parser') 'npm ci --ignore-scripts'
Run-Step 'dxf-parser-test' (Join-Path $root 'dxf-parser') 'npm test'
Run-Step 'dxf-writer-npm-install' (Join-Path $root 'dxf-writer') 'npm install --ignore-scripts'
Run-Step 'dxf-writer-build' (Join-Path $root 'dxf-writer') 'npm run build'
Run-Step 'elkjs-npm-ci' (Join-Path $root 'elkjs') 'npm ci --ignore-scripts'
Run-Step 'elkjs-test' (Join-Path $root 'elkjs') 'npm test'
Run-Step 'makerjs-npm-ci' (Join-Path $root 'makerjs') 'npm ci --ignore-scripts'
Run-Step 'makerjs-build' (Join-Path $root 'makerjs') 'npm run build'
Run-Step 'cabinet-web-npm-ci' (Join-Path $root 'cabinet-layout-generator/web') 'npm ci --ignore-scripts'
Run-Step 'cabinet-web-test' (Join-Path $root 'cabinet-layout-generator/web') 'npm test -- --run'
Run-Step 'cabinet-web-build' (Join-Path $root 'cabinet-layout-generator/web') 'npm run build'

