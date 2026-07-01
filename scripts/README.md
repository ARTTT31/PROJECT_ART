# 📜 Scripts Documentation

## 🚀 Auto-commit Scripts

สคริปต์สำหรับ commit และ push การเปลี่ยนแปลงอัตโนมัติ รองรับหลายแพลตฟอร์ม

### 📁 Available Scripts

1. **`auto-commit-docs.sh`** - Bash script (Linux, macOS, Git Bash)
2. **`auto-commit-docs.bat`** - Batch script (Windows CMD)
3. **`auto-commit-docs.ps1`** - PowerShell script (Windows, macOS, Linux)

---

## 🎯 Features

✅ **Auto-detect changes** - ตรวจหา uncommitted changes อัตโนมัติ
✅ **Smart commit messages** - สร้าง commit message อัตโนมัติตามไฟล์ที่เปลี่ยน
✅ **Custom messages** - รองรับ custom commit message
✅ **Interactive push** - ถามก่อน push ทุกครั้ง
✅ **Colored output** - แสดงผลแบบสีสันสวยงาม
✅ **Error handling** - จัดการ errors อย่างปลอดภัย

---

## 📖 Usage

### Linux / macOS / Git Bash

```bash
# 1. Make script executable (first time only)
chmod +x scripts/auto-commit-docs.sh

# 2. Run with auto-generated message
./scripts/auto-commit-docs.sh

# 3. Run with custom message
./scripts/auto-commit-docs.sh "fix: update calendar widget styling"
```

### Windows CMD

```cmd
REM Run with auto-generated message
scripts\auto-commit-docs.bat

REM Run with custom message
scripts\auto-commit-docs.bat "fix: update calendar widget styling"
```

### Windows PowerShell

```powershell
# Run with auto-generated message
.\scripts\auto-commit-docs.ps1

# Run with custom message
.\scripts\auto-commit-docs.ps1 "fix: update calendar widget styling"
```

---

## 📊 Auto-generated Commit Message Format

สคริปต์จะสร้าง commit message อัตโนมัติตามไฟล์ที่เปลี่ยนแปลง:

```
chore: update project files

Changes:
- 📚 Updated documentation (5 file(s))
- 🔧 Backend changes (2 file(s))
- 🎨 Frontend changes (3 file(s))
- 📜 Script updates (1 file(s))

Committed: 2026-07-01 17:30:45
```

### Categories

| Icon | Category | Detection Pattern |
|------|----------|------------------|
| 📚 | Documentation | `docs/`, `README`, `*.md` |
| 🔧 | Backend | `backend/` |
| 🎨 | Frontend | `frontend/` |
| 📜 | Scripts | `scripts/` |

---

## 🎨 Output Examples

### No Changes

```
========================================
📦 Auto-commit Documentation Script
========================================

📊 Current status:

⚠️  No changes to commit
```

### With Changes

```
========================================
📦 Auto-commit Documentation Script
========================================

📊 Current status:
M  backend/app/api/v1/endpoints/calendar.py
M  frontend/src/components/Widgets/TaskListWidget.tsx
A  docs/CALENDAR_TROUBLESHOOTING.md

📝 Staging all changes...
🤖 Generating commit message...

📝 Commit message:
chore: update project files

Changes:
- 📚 Updated documentation (1 file(s))
- 🔧 Backend changes (1 file(s))
- 🎨 Frontend changes (1 file(s))

Committed: 2026-07-01 17:30:45

💾 Creating commit...
✅ Committed successfully: a1b2c3d

🚀 Push to remote? (y/n)
```

---

## ⚙️ Configuration

### Customize Commit Message Format

Edit the script to modify commit message format:

**Bash/Shell (`auto-commit-docs.sh`):**
```bash
# Line ~50-70
COMMIT_MSG="chore: update project files

Changes:
..."
```

**PowerShell (`auto-commit-docs.ps1`):**
```powershell
# Line ~45-65
$CommitMessage = "chore: update project files`n`nChanges:`n"
```

### Change Auto-push Behavior

To automatically push without confirmation, modify:

**Bash:**
```bash
# Change this line (around line 90)
echo -e "${YELLOW}🚀 Push to remote? (y/n)${NC}"
read -r PUSH_CONFIRM

# To this (auto-push)
PUSH_CONFIRM="y"
```

**PowerShell:**
```powershell
# Change this line (around line 85)
$pushConfirm = Read-Host

# To this (auto-push)
$pushConfirm = "y"
```

---

## 🔒 Safety Features

1. **Git Check:** ตรวจสอบว่าอยู่ใน git repository
2. **Change Detection:** ไม่ commit ถ้าไม่มีการเปลี่ยนแปลง
3. **Interactive Push:** ถามก่อน push ทุกครั้ง (ป้องกัน push ผิดพลาด)
4. **Error Handling:** หยุดทันทีเมื่อเกิด error

---

## 💡 Pro Tips

### Tip 1: Create Aliases

**Bash/Zsh (~/.bashrc or ~/.zshrc):**
```bash
alias ac='./scripts/auto-commit-docs.sh'
alias acp='./scripts/auto-commit-docs.sh && git push'
```

**PowerShell (Profile):**
```powershell
function ac { .\scripts\auto-commit-docs.ps1 }
Set-Alias -Name commit -Value ac
```

**Usage:**
```bash
# Instead of
./scripts/auto-commit-docs.sh "fix: something"

# Use
ac "fix: something"
```

### Tip 2: Git Hooks Integration

Create `.git/hooks/pre-commit` to run checks before commit:

```bash
#!/bin/bash
# Run linters before commit
npm run lint
python -m flake8 backend/
```

### Tip 3: CI/CD Integration

Use in GitHub Actions:

```yaml
- name: Auto-commit changes
  run: |
    chmod +x scripts/auto-commit-docs.sh
    ./scripts/auto-commit-docs.sh "ci: auto-update from workflow"
```

---

## 🐛 Troubleshooting

### Issue: Permission Denied (Linux/Mac)

```bash
# Fix: Make script executable
chmod +x scripts/auto-commit-docs.sh
```

### Issue: PowerShell Execution Policy

```powershell
# Fix: Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass
powershell -ExecutionPolicy Bypass -File scripts/auto-commit-docs.ps1
```

### Issue: Git not found

```bash
# Windows: Add Git to PATH
# Linux/Mac: Install git
sudo apt-get install git  # Ubuntu/Debian
brew install git          # macOS
```

### Issue: Push failed

```
❌ Push failed
```

**Common causes:**
1. Not authenticated with GitHub
2. No internet connection
3. Remote branch doesn't exist
4. Merge conflicts

**Solutions:**
```bash
# 1. Configure Git credentials
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 2. Setup SSH or HTTPS auth
git remote -v  # Check remote URL

# 3. Create remote branch first
git push -u origin branch-name

# 4. Pull and resolve conflicts
git pull origin main
```

---

## 🔄 Workflow Examples

### Example 1: Quick Documentation Update

```bash
# 1. Edit documentation files
nano docs/CALENDAR_TROUBLESHOOTING.md

# 2. Auto-commit with custom message
./scripts/auto-commit-docs.sh "docs: update calendar troubleshooting guide"

# 3. Push when prompted
# 🚀 Push to remote? (y/n): y
```

### Example 2: Multiple File Changes

```bash
# 1. Make changes across multiple files
# - backend/app/api/v1/endpoints/calendar.py
# - frontend/src/components/Widgets/TaskListWidget.tsx
# - docs/CALENDAR_FIX_SUMMARY.md

# 2. Auto-commit (will categorize changes)
./scripts/auto-commit-docs.sh

# Output:
# Changes:
# - 📚 Updated documentation (1 file(s))
# - 🔧 Backend changes (1 file(s))
# - 🎨 Frontend changes (1 file(s))
```

### Example 3: Emergency Hotfix

```bash
# 1. Fix critical bug
nano backend/app/api/v1/endpoints/oil_prices.py

# 2. Quick commit and push
./scripts/auto-commit-docs.sh "hotfix: fix EPPO scraping timeout"
# Press 'y' to push immediately
```

---

## 📚 Related Documentation

- **Git Basics:** https://git-scm.com/docs
- **Commit Messages:** https://www.conventionalcommits.org/
- **Git Hooks:** https://git-scm.com/docs/githooks

---

## 🎓 Conventional Commit Types

Use these prefixes for better commit history:

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add calendar health check endpoint` |
| `fix` | Bug fix | `fix: resolve 502 error in calendar API` |
| `docs` | Documentation | `docs: update troubleshooting guide` |
| `style` | Code style (no logic change) | `style: format calendar endpoint` |
| `refactor` | Code refactoring | `refactor: improve error handling` |
| `test` | Add/update tests | `test: add calendar API tests` |
| `chore` | Maintenance | `chore: update dependencies` |
| `perf` | Performance improvement | `perf: optimize calendar caching` |
| `ci` | CI/CD changes | `ci: add auto-deploy workflow` |

---

## ✨ Advanced Usage

### Multi-branch Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-widget

# 2. Make changes and commit
./scripts/auto-commit-docs.sh "feat: add new weather widget"

# 3. Push to feature branch
# 🚀 Push to remote? (y/n): y
```

### Automated Daily Commits

**Cron job (Linux/Mac):**
```bash
# Edit crontab
crontab -e

# Add daily commit at 5 PM
0 17 * * * cd /path/to/project && ./scripts/auto-commit-docs.sh "chore: daily auto-commit"
```

**Task Scheduler (Windows):**
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\project\scripts\auto-commit-docs.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 5pm
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "AutoCommitDocs"
```

---

## 🆘 Support

Need help? Check:
1. This README
2. Git documentation: https://git-scm.com/docs
3. Project issues: https://github.com/ARTTT31/PROJECT_ART/issues

---

**Happy committing! 🚀**
