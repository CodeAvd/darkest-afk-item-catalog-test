#!/bin/bash

# Script to initialize Git repository and prepare for GitHub

echo "🚀 Setting up Git repository for Darkest AFK Item Catalog..."

# Initialize git repository
if [ ! -d ".git" ]; then
    git init
    echo "✅ Initialized Git repository"
else
    echo "ℹ️  Git repository already exists"
fi

# Add all files
git add index.html items.html styles.css script.js items.json README.md .gitignore

# Create initial commit
git commit -m "Initial commit: Darkest AFK Item Catalog support tool

- Add responsive item catalog (index.html)
- Add simple items list view (items.html)
- Add shared stylesheet with design tokens
- Add item data in JSON format
- Include README and .gitignore"

echo ""
echo "✅ Repository initialized and files committed!"
echo ""
echo "📋 Next steps to create GitHub repository:"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Create a new repository (e.g., 'darkest-afk-item-catalog')"
echo "3. Run these commands:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "Or if you prefer SSH:"
echo "   git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""

