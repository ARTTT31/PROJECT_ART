# Auto-commit Documentation and Changes Script (PowerShell)
# Usage: .\scripts\auto-commit-docs.ps1 "your custom message (optional)"

param(
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"

# Colors
function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan "========================================"
Write-ColorOutput Cyan "📦 Auto-commit Documentation Script"
Write-ColorOutput Cyan "========================================"
Write-Output ""

# Check if we're in a git repository
try {
    git rev-parse --git-dir | Out-Null
}
catch {
    Write-ColorOutput Red "❌ Error: Not in a git repository"
    exit 1
}

# Check for uncommitted changes
$status = git status -s
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-ColorOutput Yellow "⚠️  No changes to commit"
    exit 0
}

# Show status
Write-ColorOutput Cyan "📊 Current status:"
git status -s
Write-Output ""

# Stage all changes
Write-ColorOutput Cyan "📝 Staging all changes..."
git add .

# Generate commit message
if ($CommitMessage) {
    Write-ColorOutput Green "✅ Using custom commit message"
}
else {
    Write-ColorOutput Cyan "🤖 Generating commit message..."
    
    # Get list of changed files
    $changedFiles = git diff --cached --name-only
    
    # Categorize changes
    $backendChanges = ($changedFiles | Where-Object { $_ -match "^backend/" }).Count
    $frontendChanges = ($changedFiles | Where-Object { $_ -match "^frontend/" }).Count
    $docChanges = ($changedFiles | Where-Object { $_ -match "^docs/|README|\.md$" }).Count
    $scriptChanges = ($changedFiles | Where-Object { $_ -match "^scripts/" }).Count
    
    # Build commit message
    $CommitMessage = "chore: update project files`n`nChanges:`n"
    
    if ($docChanges -gt 0) {
        $CommitMessage += "- 📚 Updated documentation ($docChanges file(s))`n"
    }
    
    if ($backendChanges -gt 0) {
        $CommitMessage += "- 🔧 Backend changes ($backendChanges file(s))`n"
    }
    
    if ($frontendChanges -gt 0) {
        $CommitMessage += "- 🎨 Frontend changes ($frontendChanges file(s))`n"
    }
    
    if ($scriptChanges -gt 0) {
        $CommitMessage += "- 📜 Script updates ($scriptChanges file(s))`n"
    }
    
    # Add timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $CommitMessage += "`nCommitted: $timestamp"
}

Write-Output ""
Write-ColorOutput Cyan "📝 Commit message:"
Write-Output $CommitMessage
Write-Output ""

# Commit changes
Write-ColorOutput Cyan "💾 Creating commit..."
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput Red "❌ Commit failed"
    exit 1
}

# Show commit info
$commitHash = git rev-parse --short HEAD
Write-ColorOutput Green "✅ Committed successfully: $commitHash"
Write-Output ""

# Ask to push
Write-ColorOutput Yellow "🚀 Push to remote? (y/n)"
$pushConfirm = Read-Host

if ($pushConfirm -eq "y" -or $pushConfirm -eq "Y") {
    Write-ColorOutput Cyan "📤 Pushing to remote..."
    
    # Get current branch
    $currentBranch = git branch --show-current
    
    # Push
    git push origin $currentBranch
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput Green "✅ Pushed to origin/$currentBranch successfully!"
    }
    else {
        Write-ColorOutput Red "❌ Push failed"
        exit 1
    }
}
else {
    Write-ColorOutput Yellow "⏸️  Skipped push. Run 'git push' manually when ready."
}

Write-Output ""
Write-ColorOutput Green "========================================"
Write-ColorOutput Green "✨ Done!"
Write-ColorOutput Green "========================================"
