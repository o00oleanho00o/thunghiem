param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Add-Type -AssemblyName System.Drawing

$items = @(
  @{ File = 'evidence/r5/01-project-overview.png'; Caption = '01 - project overview' },
  @{ File = 'evidence/r5/02-bom.png'; Caption = '02 - BOM' },
  @{ File = 'evidence/r5/03-panel-loaded.png'; Caption = '03 - panel projection' },
  @{ File = 'evidence/r5/04-panel-selected-device.png'; Caption = '04 - product truth inspector' },
  @{ File = 'evidence/r5/05-panel-after-drag.png'; Caption = '05 - candidate drag' },
  @{ File = 'evidence/r5/06-panel-locked-reflow.png'; Caption = '06 - locked reflow' },
  @{ File = 'evidence/r5/07-cad-ktp700.png'; Caption = '07 - KTP700 CAD' },
  @{ File = 'evidence/r5/08-cad-g120c.png'; Caption = '08 - G120C CAD' },
  @{ File = 'evidence/r5/09-cad-selection-layer.png'; Caption = '09 - CAD selection and layers' },
  @{ File = 'evidence/r5/10-panel-to-cad-navigation.png'; Caption = '10 - panel to CAD context' },
  @{ File = 'evidence/r5/11-validation.png'; Caption = '11 - validation' },
  @{ File = 'evidence/r5/12-export-result.png'; Caption = '12 - export audit' },
  @{ File = 'evidence/r5/13-invalid-dxf-retained.png'; Caption = '13 - invalid DXF retention' }
)

$margin = 28
$gap = 18
$columns = 3
$thumbWidth = 500
$thumbHeight = 348
$captionHeight = 34
$cardHeight = $thumbHeight + $captionHeight
$headerHeight = 96
$rows = [Math]::Ceiling($items.Count / $columns)
$sheetWidth = $margin * 2 + $columns * $thumbWidth + ($columns - 1) * $gap
$sheetHeight = $headerHeight + $margin + $rows * $cardHeight + ($rows - 1) * $gap
$out = Join-Path $Root 'evidence/r5/CONTACT_SHEET.png'
$branch = (git -C $Root branch --show-current).Trim()
$commit = (git -C $Root rev-parse --short HEAD).Trim()

$bitmap = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(244, 247, 249))

$headerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(18, 42, 58))
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(25, 38, 48))
$whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(174, 187, 196), 1)
$headerFont = [System.Drawing.Font]::new('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$subFont = [System.Drawing.Font]::new('Segoe UI', 10)
$captionFont = [System.Drawing.Font]::new('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)

$graphics.FillRectangle($headerBrush, 0, 0, $sheetWidth, $headerHeight)
$graphics.DrawString('R5 Unified Engineering Workbench', $headerFont, $whiteBrush, $margin, 16)
$graphics.DrawString("Branch: $branch | commit under test: $commit", $subFont, $whiteBrush, $margin, 54)

for ($index = 0; $index -lt $items.Count; $index += 1) {
  $item = $items[$index]
  $row = [Math]::Floor($index / $columns)
  $column = $index % $columns
  $x = $margin + $column * ($thumbWidth + $gap)
  $y = $headerHeight + $margin + $row * ($cardHeight + $gap)
  $imagePath = Join-Path $Root $item.File
  $image = [System.Drawing.Image]::FromFile($imagePath)
  $graphics.FillRectangle([System.Drawing.Brushes]::White, $x, $y, $thumbWidth, $thumbHeight)
  $graphics.DrawImage($image, $x, $y, $thumbWidth, $thumbHeight)
  $graphics.DrawRectangle($borderPen, $x, $y, $thumbWidth, $thumbHeight)
  $graphics.DrawString($item.Caption, $captionFont, $textBrush, $x + 4, $y + $thumbHeight + 8)
  $image.Dispose()
}

$bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$headerBrush.Dispose(); $textBrush.Dispose(); $whiteBrush.Dispose(); $borderPen.Dispose()
$headerFont.Dispose(); $subFont.Dispose(); $captionFont.Dispose(); $bitmap.Dispose()
Write-Output $out
