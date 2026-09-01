<#
.SYNOPSIS
  เลือกใช้งาน: ลบ IDE-specific skill folders ที่ซ้ำกัน (13 โฟลเดอร์) ออกจาก working directory
.DESCRIPTION
  โฟลเดอร์เหล่านี้ (.augment, .claude, .codebuddy, .codex, .continue, .factory,
  .kilocode, .opencode, .qoder, .roo, .trae, .warp, .windsurf) เป็น IDE metadata
  ที่ซ้ำกันเกือบทั้งหมด (~95%) และมีขนาดรวมหลาย MB
  - ถ้าใช้งาน IDE ใด IDE หนึ่ง เหล่านี้สามารถลบทิ้งได้ และจะถูกดาวน์โหลดใหม่โดย IDE
  - .github/ จะถูก KEEP ไว้เสมอ (เป็นสินทรัพย์จริงของโปรเจค)
.PARAMETER DryRun
  แสดงแค่รายชื่อที่จะลบ ไม่ทำการลบจริง (Default = True)
  พอใจแล้วค่อยรันด้วย -DryRun:$false
.EXAMPLE
  .\cleanup-ide-skills.ps1           # แสดงรายการที่จะลบ (Safe)
  .\cleanup-ide-skills.ps1 -DryRun:$false  # ลบจริงๆ
#>

param(
    [Parameter(Mandatory = $false)]
    [bool]$DryRun = $true
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$ideFolders = @(
    ".agents", ".augment", ".claude", ".codebuddy", ".codex", ".continue", ".factory",
    ".kilocode", ".opencode", ".qoder", ".roo", ".trae", ".warp", ".windsurf"
)

Write-Host "`n=== ART Workspace: IDE Skill Folders Cleanup ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host "Mode: $(if ($DryRun) { "DRY-RUN (no files deleted)" } else { "LIVE (files WILL be deleted)" })" -ForegroundColor $(if ($DryRun) { "Yellow" } else { "Red" })
Write-Host ""

$totalBytes = 0
$removed = 0
$kept = 0

foreach ($folder in $ideFolders) {
    $path = Join-Path $root $folder
    if (Test-Path $path) {
        try {
            $size = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue |
                     Measure-Object -Property Length -Sum).Sum
            $totalBytes += [int64]$size
            if (-not $DryRun) {
                Remove-Item $path -Recurse -Force -ErrorAction Stop
            }
            $removed++
            Write-Host "  [$(if ($DryRun) { "WOULD REMOVE" } else { "REMOVED" })]  $folder  ( $([math]::Round($size / 1KB, 1)) KB )"
        }
        catch {
            Write-Host "  [SKIP-ERROR] $folder : $_" -ForegroundColor Red
            $kept++
        }
    }
    else {
        Write-Host "  [SKIP] $folder (not present)"
    }
}

Write-Host ""
Write-Host "Folders found/removed : $removed" -ForegroundColor Green
Write-Host "Total size          : $([math]::Round($totalBytes / 1KB, 1)) KB  ($([math]::Round($totalBytes / 1MB, 2)) MB)"
if ($DryRun) {
    Write-Host ""
    Write-Host "ถ้าพอใจแล้วให้รันด้วย -DryRun:`$false เพื่อลบจริง:" -ForegroundColor Yellow
    Write-Host "  .\scripts\cleanup-ide-skills.ps1 -DryRun:`$false"
}
else {
    Write-Host "Done! หาก IDE ต้องการ skills ใหม่ ให้ดาวน์โหลดผ่านตัวติดตั้ง Skill ของ IDE นั้นๆ"
}
Write-Host ""
