$ErrorActionPreference = 'Continue'
$cloneRoot = Join-Path (Get-Location) 'research/cloned-or-scripted-spikes'
New-Item -ItemType Directory -Force -Path $cloneRoot | Out-Null
$repos = @(
  @{n='qelectrotech-source'; u='https://github.com/qelectrotech/qelectrotech-source-mirror.git'},
  @{n='qelectrotech-elements'; u='https://github.com/qelectrotech/qelectrotech-elements.git'},
  @{n='sldeditor'; u='https://github.com/NovaShang/sldeditor.git'},
  @{n='librepcb'; u='https://github.com/LibrePCB/LibrePCB.git'},
  @{n='fidocadj'; u='https://github.com/FidoCadJ/FidoCadJ.git'},
  @{n='eschema'; u='https://github.com/manufino/eSchema.git'},
  @{n='cabinet-layout-generator'; u='https://github.com/Taam4142/cabinet-layout-generator.git'},
  @{n='librecad'; u='https://github.com/LibreCAD/LibreCAD.git'},
  @{n='libdxfrw'; u='https://github.com/LibreCAD/libdxfrw.git'},
  @{n='ezdxf'; u='https://github.com/mozman/ezdxf.git'},
  @{n='dxf-kit'; u='https://github.com/arbaev/dxf-kit.git'},
  @{n='dxf-parser'; u='https://github.com/gdsestimating/dxf-parser.git'},
  @{n='dxf-writer'; u='https://github.com/dxfjs/writer.git'},
  @{n='makerjs'; u='https://github.com/microsoft/maker.js.git'},
  @{n='or-tools'; u='https://github.com/google/or-tools.git'},
  @{n='elkjs'; u='https://github.com/kieler/elkjs.git'},
  @{n='xyflow'; u='https://github.com/xyflow/xyflow.git'},
  @{n='cadquery'; u='https://github.com/CadQuery/cadquery.git'},
  @{n='openscad'; u='https://github.com/openscad/openscad.git'},
  @{n='opencascade-js'; u='https://github.com/donalffons/opencascade.js.git'},
  @{n='text2cad'; u='https://github.com/SadilKhan/Text2CAD.git'},
  @{n='cadfusion'; u='https://github.com/microsoft/CADFusion.git'},
  @{n='deepcad'; u='https://github.com/rundiwu/DeepCAD.git'},
  @{n='cad-recode'; u='https://github.com/filaPro/cad-recode.git'}
)
$log = Join-Path $cloneRoot 'clone-log.txt'
Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
foreach ($repo in $repos) {
  $dest = Join-Path $cloneRoot $repo.n
  if (Test-Path (Join-Path $dest '.git')) {
    Add-Content $log "SKIP $($repo.n) existing"
    continue
  }
  Write-Output "CLONE $($repo.n)"
  & git clone --depth 1 --no-tags $repo.u $dest 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -eq 0) { Add-Content $log "OK $($repo.n)" }
  else { Add-Content $log "FAIL $($repo.n) code=$LASTEXITCODE" }
}
Write-Output "DONE $(Get-Date -Format o)"
Get-Content $log -Tail 100
