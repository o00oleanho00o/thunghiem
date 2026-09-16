[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repoRoot '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $python)) {
    throw "Missing virtual environment: $python. Follow README.md Quick start first."
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] [string] $Command,
        [Parameter()] [string[]] $Arguments = @()
    )

    Write-Host "`n== $Label =="
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

Push-Location $repoRoot
try {
    $env:PYTHONPATH = $repoRoot
    Invoke-Checked 'Python tests' $python @('-m', 'pytest')
    Invoke-Checked 'Python syntax' $python @('-m', 'compileall', '-q', 'packages', 'examples', 'scripts', 'tests')
    Invoke-Checked 'Core demos and layout benchmark' $python @('examples/run_core_demo.py')
    Invoke-Checked 'JavaScript CAD exporter contract' 'node' @('scripts/test_cad_export.cjs')
    Invoke-Checked 'Python EIR to browser adapter contract' 'node' @('scripts/test_eir_adapter.cjs')
    Invoke-Checked 'Raw Python EIR web API export contract' 'node' @('scripts/test_web_api.cjs')
    Invoke-Checked 'R3.1 canonical nested hash contract' 'node' @('scripts/test_canonical_json.cjs')
    Invoke-Checked 'R3.1 export chain verification' $python @('scripts/verify_export_chain.py')
    Invoke-Checked 'R3.1 API truth gate contract' 'node' @('scripts/test_r3_api.cjs')
    Invoke-Checked 'Browser editor interaction contract' 'node' @('scripts/test_web_ui_behaviors.cjs')
    Invoke-Checked 'Independent ezdxf audit: canonical Python export' $python @('scripts/audit_dxf_ezdxf.py', 'evidence/generated-dxf/mcc-6-motor/mcc-6-motor.dxf')
    Invoke-Checked 'Independent ezdxf audit: web API export' $python @('scripts/audit_dxf_ezdxf.py', 'evidence/generated-dxf/api-mcc-6-motor.dxf')
    Invoke-Checked 'Independent ezdxf render: web API export' $python @('scripts/render_dxf_ezdxf.py', 'evidence/generated-dxf/api-mcc-6-motor.dxf', 'evidence/screenshots/api-mcc-6-motor-ezdxf.png')

    $javascriptFiles = @(rg --files -g '*.js' -g '*.cjs' -g '!node_modules/**' -g '!research/**')
    foreach ($file in $javascriptFiles) {
        Invoke-Checked "JavaScript syntax: $file" 'node' @('--check', $file)
    }

    $requiredDocs = @(
        'README.md',
        'docs/research/REPO_MATRIX.csv',
        'docs/research/REPO_MATRIX.md',
        'docs/research/LICENSE_MATRIX.md',
        'docs/research/COMMERCIAL_WORKFLOW_BENCHMARK.md',
        'docs/research/OPEN_SOURCE_LANDSCAPE.md',
        'docs/architecture/DOMAIN_MODEL.md',
        'docs/architecture/ARCHITECTURE_OPTIONS.md',
        'docs/architecture/RECOMMENDED_ARCHITECTURE.md',
        'docs/architecture/AI_STRATEGY.md',
        'docs/architecture/AUTO_LAYOUT_STRATEGY.md',
        'docs/FINAL_REPORT.md',
        'docs/NEXT_90_DAYS.md',
        'docs/DEFINITION_OF_DONE.md'
    )
    $missingDocs = @($requiredDocs | Where-Object { -not (Test-Path -LiteralPath $_) })
    if ($missingDocs.Count -gt 0) {
        throw "Required documents missing: $($missingDocs -join ', ')"
    }

    $matrix = @(Import-Csv 'docs/research/REPO_MATRIX.csv')
    if ($matrix.Count -lt 40) {
        throw "Research matrix contains only $($matrix.Count) rows"
    }

    Write-Host "`nRELEASE GATE PASS: $($matrix.Count) research rows, $($requiredDocs.Count) required documents."
}
finally {
    Pop-Location
}
