param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$CommitUnderTest = '800fce7'
)

Add-Type -AssemblyName System.Drawing

$items = @(
  @{ Section = 'Cabinet'; File = 'evidence/r4-3c/cabinet/01-before-reflow-unlocked.png'; Caption = '01 - unlocked fixture baseline' },
  @{ Section = 'Cabinet'; File = 'evidence/r4-3c/cabinet/02-after-reflow-unlocked-moved.png'; Caption = '02 - unlocked reflow moved 62.6 mm' },
  @{ Section = 'Cabinet'; File = 'evidence/r4-3c/cabinet/03-before-reflow-locked.png'; Caption = '03 - locked fixture before reflow' },
  @{ Section = 'Cabinet'; File = 'evidence/r4-3c/cabinet/04-after-reflow-locked-unchanged.png'; Caption = '04 - locked fixture unchanged (0 mm)' },
  @{ Section = 'Cabinet'; File = 'evidence/r4-3c/cabinet/05-export-result.png'; Caption = '05 - runtime SVG/DXF export ready' },
  @{ Section = 'mlightcad'; File = 'evidence/r4-3c/mlightcad/01-g120c-runtime-fit.png'; Caption = '01 - G120C runtime fit, 546 rendered' },
  @{ Section = 'mlightcad'; File = 'evidence/r4-3c/mlightcad/02-g120c-bounds-overlay.png'; Caption = '02 - source vs rendered bounds overlay' },
  @{ Section = 'mlightcad'; File = 'evidence/r4-3c/mlightcad/03-g120c-left-extent-highlight.png'; Caption = '03 - MTEXT 80 left extent highlighted' },
  @{ Section = 'mlightcad'; File = 'evidence/r4-3c/mlightcad/04-g120c-deep-zoom-left-side.png'; Caption = '04 - deep zoom left-side evidence' },
  @{ Section = 'mlightcad'; File = 'evidence/r4-3c/mlightcad/05-invalid-dxf-rejected.png'; Caption = '05 - invalid DXF rejected, scene retained' },
  @{ Section = 'mlightcad'; File = 'evidence/r4-3c/mlightcad/06-valid-scene-retained.png'; Caption = '06 - valid SITOP load after invalid input' }
)

$margin = 32
$gap = 24
$thumbWidth = 740
$thumbHeight = 476
$cardHeight = $thumbHeight + 52
$sheetWidth = $margin * 2 + $thumbWidth * 2 + $gap
$headerHeight = 112
$sectionHeight = 56
$rowsPerSection = @{}
foreach ($section in @('Cabinet', 'mlightcad')) {
  $rowsPerSection[$section] = [Math]::Ceiling((@($items | Where-Object { $_.Section -eq $section })).Count / 2)
}
$sheetHeight = $headerHeight + (($sectionHeight + $rowsPerSection['Cabinet'] * ($cardHeight + $gap)) + ($sectionHeight + $rowsPerSection['mlightcad'] * ($cardHeight + $gap))) + $margin

$out = Join-Path $Root 'evidence/r4-3c/CONTACT_SHEET.png'
$bitmap = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(246, 248, 250))

$headerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(23, 44, 60))
$sectionBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(52, 82, 103))
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 40, 48))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(105, 118, 126))
$whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 190, 198), 1)
$headerFont = [System.Drawing.Font]::new('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
$subFont = [System.Drawing.Font]::new('Segoe UI', 11)
$sectionFont = [System.Drawing.Font]::new('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$captionFont = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)

$graphics.FillRectangle($headerBrush, 0, 0, $sheetWidth, $headerHeight)
$graphics.DrawString('R4.3c Visual Evidence', $headerFont, $whiteBrush, $margin, 18)
$graphics.DrawString("Branch: cnb-electrical-lab-r4-3c-runtime-correctness-visual-gate | Commit under test: $CommitUnderTest", $subFont, $whiteBrush, $margin, 62)

$y = $headerHeight
foreach ($section in @('Cabinet', 'mlightcad')) {
  $graphics.FillRectangle($sectionBrush, 0, $y, $sheetWidth, $sectionHeight)
  $graphics.DrawString($section, $sectionFont, $whiteBrush, $margin, $y + 14)
  $y += $sectionHeight
  $sectionItems = @($items | Where-Object { $_.Section -eq $section })
  for ($row = 0; $row -lt [Math]::Ceiling($sectionItems.Count / 2); $row++) {
    for ($col = 0; $col -lt 2; $col++) {
      $index = $row * 2 + $col
      if ($index -ge $sectionItems.Count) { continue }
      $item = $sectionItems[$index]
      $x = $margin + $col * ($thumbWidth + $gap)
      $imagePath = Join-Path $Root $item.File
      $image = [System.Drawing.Image]::FromFile($imagePath)
      $graphics.FillRectangle([System.Drawing.Brushes]::White, $x, $y, $thumbWidth, $thumbHeight)
      $graphics.DrawImage($image, $x, $y, $thumbWidth, $thumbHeight)
      $graphics.DrawRectangle($borderPen, $x, $y, $thumbWidth, $thumbHeight)
      $graphics.DrawString($item.Caption, $captionFont, $textBrush, $x + 4, $y + $thumbHeight + 10)
      $image.Dispose()
    }
    $y += $cardHeight + $gap
  }
}

$bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$headerBrush.Dispose(); $sectionBrush.Dispose(); $textBrush.Dispose(); $mutedBrush.Dispose(); $whiteBrush.Dispose(); $borderPen.Dispose()
$headerFont.Dispose(); $subFont.Dispose(); $sectionFont.Dispose(); $captionFont.Dispose(); $bitmap.Dispose()
Write-Output $out
