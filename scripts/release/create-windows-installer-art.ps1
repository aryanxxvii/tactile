param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "../../src-tauri/windows")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Bounds,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($Bounds.X, $Bounds.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Bounds.X, $Bounds.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-InstallerBitmap {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [scriptblock]$Paint
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  try {
    & $Paint $graphics $bitmap
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$iconPath = Join-Path $PSScriptRoot "../../src-tauri/icons/icon.png"
$icon = [System.Drawing.Image]::FromFile((Resolve-Path $iconPath))

$ivory = [System.Drawing.Color]::FromArgb(248, 245, 238)
$ink = [System.Drawing.Color]::FromArgb(37, 37, 34)
$rust = [System.Drawing.Color]::FromArgb(188, 79, 53)

try {
  $bannerPath = Join-Path $OutputDirectory "banner.bmp"
  Save-InstallerBitmap 493 58 $bannerPath {
    param($g, $bitmap)
    $g.Clear($ivory)
    $markSize = 32
    $markX = 166
    $markY = [int](($bitmap.Height - $markSize) / 2)
    $g.DrawImage($icon, (New-Object System.Drawing.Rectangle $markX, $markY, $markSize, $markSize))

    $font = New-Object System.Drawing.Font "Segoe UI", 18, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $text = "Tactile"
    $measure = $g.MeasureString($text, $font)
    $textX = $markX + $markSize + 12
    $textY = ($bitmap.Height - $measure.Height) / 2 - 1
    $g.DrawString($text, $font, (New-Object System.Drawing.SolidBrush $ink), $textX, $textY)
    $font.Dispose()
  }

  $dialogPath = Join-Path $OutputDirectory "dialog.bmp"
  Save-InstallerBitmap 493 312 $dialogPath {
    param($g, $bitmap)
    $g.Clear($ivory)
    $card = New-RoundedRectanglePath (New-Object System.Drawing.RectangleF 22, 22, 449, 268) 22
    $g.FillPath((New-Object System.Drawing.SolidBrush $ivory), $card)
    $card.Dispose()

    $markSize = 82
    $markX = [int](($bitmap.Width - $markSize) / 2)
    $markY = 84
    $g.DrawImage($icon, (New-Object System.Drawing.Rectangle $markX, $markY, $markSize, $markSize))

    $font = New-Object System.Drawing.Font "Segoe UI", 30, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $text = "Tactile"
    $measure = $g.MeasureString($text, $font)
    $textX = ($bitmap.Width - $measure.Width) / 2
    $textY = 181
    $g.DrawString($text, $font, (New-Object System.Drawing.SolidBrush $ink), $textX, $textY)
    $font.Dispose()
  }
} finally {
  $icon.Dispose()
}

Write-Output "Created $bannerPath"
Write-Output "Created $dialogPath"
