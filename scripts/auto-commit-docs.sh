#!/bin/bash
# Auto-commit Documentation and Changes Script
# Usage: ./scripts/auto-commit-docs.sh "your custom message (optional)"

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📦 Auto-commit Documentation Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if [[ -z $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
    exit 0
fi

# Show status
echo -e "${BLUE}📊 Current status:${NC}"
git status -s
echo ""

# Stage all changes
echo -e "${BLUE}📝 Staging all changes...${NC}"
git add .

# Generate commit message
if [ -n "$1" ]; then
    # Use custom message if provided
    COMMIT_MSG="$1"
    echo -e "${GREEN}✅ Using custom commit message${NC}"
else
    # Auto-generate commit message based on changed files
    echo -e "${BLUE}🤖 Generating commit message...${NC}"
    
    # Get list of changed files
    CHANGED_FILES=$(git diff --cached --name-only)
    
    # Categorize changes
    BACKEND_CHANGES=$(echo "$CHANGED_FILES" | grep -E "^backend/" | wc -l)
    FRONTEND_CHANGES=$(echo "$CHANGED_FILES" | grep -E "^frontend/" | wc -l)
    DOC_CHANGES=$(echo "$CHANGED_FILES" | grep -E "^docs/|README|\.md$" | wc -l)
    SCRIPT_CHANGES=$(echo "$CHANGED_FILES" | grep -E "^scripts/" | wc -l)
    
    # Build commit message
    COMMIT_MSG="chore: update project files

Changes:
"
    
    if [ $DOC_CHANGES -gt 0 ]; then
        COMMIT_MSG="${COMMIT_MSG}- 📚 Updated documentation (${DOC_CHANGES} file(s))
"
    fi
    
    if [ $BACKEND_CHANGES -gt 0 ]; then
        COMMIT_MSG="${COMMIT_MSG}- 🔧 Backend changes (${BACKEND_CHANGES} file(s))
"
    fi
    
    if [ $FRONTEND_CHANGES -gt 0 ]; then
        COMMIT_MSG="${COMMIT_MSG}- 🎨 Frontend changes (${FRONTEND_CHANGES} file(s))
"
    fi
    
    if [ $SCRIPT_CHANGES -gt 0 ]; then
        COMMIT_MSG="${COMMIT_MSG}- 📜 Script updates (${SCRIPT_CHANGES} file(s))
"
    fi
    
    # Add timestamp
    COMMIT_MSG="${COMMIT_MSG}
Committed: $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo -e "${BLUE}📝 Commit message:${NC}"
echo "$COMMIT_MSG"
echo ""

# Commit changes
echo -e "${BLUE}💾 Creating commit...${NC}"
git commit -m "$COMMIT_MSG"

# Show commit info
COMMIT_HASH=$(git rev-parse --short HEAD)
echo -e "${GREEN}✅ Committed successfully: ${COMMIT_HASH}${NC}\n"

# Ask to push
echo -e "${YELLOW}🚀 Push to remote? (y/n)${NC}"
read -r PUSH_CONFIRM

if [[ $PUSH_CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}📤 Pushing to remote...${NC}"
    
    # Get current branch
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Push
    if git push origin "$CURRENT_BRANCH"; then
        echo -e "${GREEN}✅ Pushed to origin/${CURRENT_BRANCH} successfully!${NC}"
    else
        echo -e "${RED}❌ Push failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⏸️  Skipped push. Run 'git push' manually when ready.${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✨ Done!${NC}"
echo -e "${GREEN}========================================${NC}"
