# Organization Guideline Verification Script

This directory contains the automated script that verifies all repositories in the outoforbitdev organization follow the established guidelines.

## Overview

The guideline verification script:

1. Discovers all repositories in the organization via GitHub API
2. Checks each repository against defined guidelines
3. Creates GitHub issues for any unmet requirements
4. Avoids creating duplicate issues
5. Runs automatically on a weekly cron schedule (Sundays 9:00 AM UTC)

## Quick Start

### Installation

```bash
cd scripts
npm install
```

### Running Locally (Dry-Run)

```bash
export GITHUB_TOKEN=your_github_token
export GITHUB_ORG=outoforbitdev
node check-guidelines.js --org outoforbitdev --dry-run
```

### Creating Issues

To actually create issues for unmet guidelines (not just preview):

```bash
node check-guidelines.js --org outoforbitdev --create-issues
```

## File Structure

- **check-guidelines.js** — Main script that orchestrates the verification process
- **checks.js** — Module containing functions to verify individual guidelines
- **issue-manager.js** — Module for creating and managing GitHub issues
- **guidelines-config.yaml** — Configuration file defining which guidelines to check and exclusions

## Configuration

The `guidelines-config.yaml` file controls:

- **Organization** — The GitHub organization to check
- **Repository Filters** — Whether to skip archived, private, or forked repos
- **Excluded Repositories** — List of repos to skip
- **Guidelines** — Which guidelines to check and what files to look for
- **Issue Creation** — Settings for automatic issue creation

## Guidelines Reference

The script verifies the following guidelines defined in `../docs/REPOSITORY_GUIDELINES.md`:

- **G-01: Documentation Structure** — `docs/internal/` directory structure
- **G-02: Justfile Commands** — Required commands in `Justfile`
- **G-03: Dependabot Configuration** — `.github/dependabot.yml` exists
- **G-04: GitHub Workflows** — Required workflows (test, scorecard, release)
- **G-05: Git Hooks & Conventional Commits** — `.husky/` and commit lint config

## Adding New Guidelines

To add a new guideline:

1. Add a new section to `../docs/REPOSITORY_GUIDELINES.md` with a guideline number (G-06, etc.)
2. Add the guideline to `guidelines-config.yaml` in the `guidelines` section
3. Specify the `checks` for the guideline (file-exists, file-contains, directory-exists, etc.)
4. Run the script to test the new guideline

### Example: Adding G-06

```yaml
- id: "G-06"
  name: "My New Guideline"
  description: "Description of what this guideline requires"
  enabled: true
  checks:
    - type: "file-exists"
      path: "path/to/required/file"
```

## CLI Arguments

- `--org <name>` — Organization name (required)
- `--config <path>` — Path to configuration file (default: guidelines-config.yaml)
- `--dry-run` — Preview issues without creating them
- `--create-issues` — Actually create GitHub issues for unmet guidelines

## Environment Variables

- `GITHUB_TOKEN` (required) — GitHub personal access token or actions token
- `GITHUB_ORG` (optional) — Organization name (can also be passed via --org flag)

### Required Permissions

The GitHub token requires the following permissions:

- `read:org` — Read organization repositories
- `repo` or `public_repo` — Access to repository contents
- `issues:write` — Create issues in repositories

## GitHub Actions Workflow

The script is automatically triggered by a GitHub Actions workflow (`.github/workflows/check-guidelines.yml`) that runs:

- **Weekly schedule**: Sundays at 9:00 AM UTC (same as Dependabot)
- **Manual trigger**: Via `workflow_dispatch` in the GitHub Actions UI

## Output

The script outputs:

1. **Console Output** — Detailed results for each repository and guideline
2. **GitHub Issues** — Created in non-compliant repositories (if `--create-issues` flag is used)
3. **Summary** — Total compliant, non-compliant, and error counts

### Example Output

```
📋 Organization Guideline Verification
Organization: outoforbitdev
Dry-run: Yes
Create issues: No

🔍 Fetching repositories from outoforbitdev...
Found 15 repositories to check

🔬 Checking repositories...
  ✓ Checking app-galaxy-map...
  ✓ Checking library-galaxy-map...
  ...

============================================================
📊 Summary
============================================================
Total repositories checked: 15
✅ Compliant: 8
❌ Non-compliant: 7
⚠️  Errors: 0

============================================================
📝 Detailed Results
============================================================

❌ app-galaxy-map
  ✗ G-01: Documentation Structure
    • Directory not found: docs/internal
  ✓ G-02: Justfile Commands
  ✓ G-03: Dependabot Configuration
  ✓ G-04: GitHub Workflows
  ✓ G-05: Git Hooks & Conventional Commits
```

## Troubleshooting

### "GITHUB_TOKEN environment variable is required"

Set the GitHub token before running:

```bash
export GITHUB_TOKEN=ghp_your_token_here
node check-guidelines.js --org outoforbitdev
```

### "Patterns not found in Justfile"

The script looks for specific patterns in the Justfile. Ensure your Justfile has the required commands:

```justfile
setup:
    # setup commands

install:
    # install commands

test:
    # test commands

lint:
    # lint commands

lint-write:
    # lint-write commands

gate:
    # gate commands
```

### Rate Limiting

If you encounter GitHub API rate limit errors, the script will wait and retry. Each organization check uses approximately 1-2 API calls per repository (fetching file contents).

## Contributing

To improve the guideline checker:

1. Update guidelines in `../docs/REPOSITORY_GUIDELINES.md`
2. Add corresponding checks to `guidelines-config.yaml`
3. Test locally with `--dry-run` flag
4. Submit a pull request

## License

MIT
