# Organization Guideline Verification Script

This directory contains the automated script that verifies all repositories in the outoforbitdev organization follow the established guidelines.

## Overview

The guideline verification script:

1. Discovers all repositories in the organization via GitHub API
2. Checks each repository against defined guidelines
3. Creates GitHub issues for any unmet requirements
4. Avoids creating duplicate issues
5. Runs automatically on a weekly cron schedule (Mondays 2:00 AM UTC)

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
- **G-03: Dependabot Configuration** — `.github/dependabot.yml` exists and every update entry uses the Monday 2:00 AM UTC weekly schedule
- **G-04: GitHub Workflows** — Required workflows (test, scorecard, release)
- **G-05: Git Hooks & Conventional Commits** — `.husky/` and commit lint config

## Adding New Guidelines

To add a new guideline:

1. Add a new section to `../docs/REPOSITORY_GUIDELINES.md` with a guideline number (G-06, etc.)
2. Add the guideline to `guidelines-config.yaml` in the `guidelines` section
3. Specify the `checks` for the guideline (file-exists, file-contains, directory-exists, dependabot-schedule, etc.)
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

- **Weekly schedule**: Mondays at 2:00 AM UTC (same as Dependabot)
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

## Daily Work Queue Summary

The `work-queue-summary` workflow posts every open pull request and issue in the organization to Discord once a day.

- **Schedule:** `0 10 * * *` UTC, which is 6am EDT or 5am EST. It can also be started manually with `workflow_dispatch`.
- **Scope:** all non-archived repositories. Draft pull requests are excluded, and pull requests are not repeated in the issues list.
- **Format:** pull requests and issues are posted as separate embeds, oldest first. Each line shows the repo, title, age, author, and labels. Long lists are split across several embeds that stay under Discord's 4096 character description limit. On days with nothing open, a short "No open pull requests or issues" message is posted.
- **Code:** `work-queue.js` holds the formatting and splitting logic, and `work-queue-summary.js` fetches the data from GitHub. Run `npm test` in this directory to run the unit tests.

### Required secrets

Add these as repository (or organization) secrets:

| Secret                           | Purpose                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GH_WORK_QUEUE_TOKEN`            | Token that can read issues and pull requests in every organization repo. A fine-grained token needs `Metadata: read`, `Issues: read`, and `Pull requests: read`. |
| `DISCORD_WORK_QUEUE_WEBHOOK_URL` | Discord webhook URL for the target channel. Never log or commit it.                                                                                              |

The workflow itself runs with no `GITHUB_TOKEN` permissions beyond `contents: read` to check out the repo.

### Dry run

Start the workflow manually and set `dry-run` to true to fetch the data and build the messages without posting to Discord. The `work-queue-summary` workflow also runs automatically as a dry run on pull requests that touch the summary code, and `work-queue-summary-test` runs the unit tests. The dry run is skipped for pull requests from forks and Dependabot because they cannot read the secrets.

To preview locally:

```bash
export GITHUB_TOKEN=your_github_token
node work-queue-summary.js --org outoforbitdev
```

### Failures

The workflow fails with a clear error if the token is missing, the GitHub fetch fails, or Discord rejects a message.
