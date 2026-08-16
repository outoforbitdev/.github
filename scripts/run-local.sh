#!/bin/bash

# Local testing script for guideline verification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Organization Guideline Checker - Local Setup${NC}"
echo ""

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ Error: GITHUB_TOKEN environment variable is not set${NC}"
    echo ""
    echo "To use this script, you need a GitHub personal access token:"
    echo "1. Go to https://github.com/settings/tokens"
    echo "2. Click 'Generate new token'"
    echo "3. Select 'repo' and 'read:org' scopes"
    echo "4. Copy the token and run:"
    echo ""
    echo "   export GITHUB_TOKEN=your_token_here"
    echo "   $0"
    echo ""
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Parse arguments
ORG="${1:-outoforbitdev}"
DRY_RUN="${2:---dry-run}"

echo -e "${GREEN}✅ Environment ready${NC}"
echo ""
echo "Running guideline check for organization: ${ORG}"
echo "Dry-run mode: ${DRY_RUN}"
echo ""

# Run the script
echo -e "${BLUE}🔍 Starting verification...${NC}"
echo ""

node check-guidelines.js --org "$ORG" $DRY_RUN

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Guideline check completed successfully${NC}"
else
    echo ""
    echo -e "${RED}❌ Guideline check failed with exit code $EXIT_CODE${NC}"
fi

exit $EXIT_CODE
