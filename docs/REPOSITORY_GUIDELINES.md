# Repository Guidelines

This document outlines the standards and best practices for all repositories in the [outoforbitdev](https://github.com/outoforbitdev) organization. These guidelines serve three key purposes:

1. **Easier onboarding**: Consistent repository structures make it simpler for contributors to navigate and find information.
2. **Standardized workflows**: Uniform configurations enable standardized agentic workflows and tooling.
3. **Safety and security**: Consistent security practices across all repositories reduce organizational risk.

## G-01: Documentation Structure

All repositories should follow a consistent documentation structure to aid discoverability and navigation.

### Recommended Structure

All documentation should be organized under a `docs/internal/` directory with topical subdirectories:

```
docs/
├── README.md                          # Overview of the documentation structure
└── internal/
    ├── README.md                      # Index of internal documentation
    ├── assets/                        # Design files, images, and other media
    ├── onboarding/                    # Contributor onboarding guides
    ├── features/                      # Feature-specific documentation
    │   ├── feature-x/
    │   │   ├── README.md
    │   │   ├── requirements.md
    │   │   ├── design.md
    │   │   └── plan.md
    │   └── feature-y/
    │       ├── README.md
    │       ├── requirements.md
    │       ├── design.md
    │       └── plan.md
    ├── quality/
    │   ├── coding-standards.md
    │   ├── review-guidelines.md
    │   └── definition-of-done.md
    ├── workflows/
    │   ├── branching-strategy.md
    │   ├── development-process.md
    │   ├── testing-strategy.md
    │   └── release-process.md
    ├── architecture/
    │   ├── overview.md
    │   ├── system-context.md
    │   └── api-design.md
    ├── agents/
    │   ├── overview.md
    │   ├── context-map.md
    │   └── rules.md
    ├── requirements/
    │   ├── core-functional-requirements.md
    │   ├── non-functional-requirements.md
    │   └── constraints.md
    └── product/
        ├── vision.md
        ├── strategy.md
        └── glossary.md
```

### Documentation Standards

- **docs/README.md**: Provide a brief overview of the documentation structure and point to key documents.
- **docs/internal/README.md**: Index of internal documentation with descriptions of each section.
- **Assets**: Design files, mockups, diagrams, and other media assets.
- **Onboarding**: Guides for new contributors, environment setup, and local development setup.
- **Features**: Feature-specific documentation, including design documents and feature descriptions.
- **Quality**: Coding standards, review guidelines, and definition of done.
- **Workflows**: Development process, testing strategy, branching strategy, and release process.
- **Architecture**: System overview, design decisions, and API design.
- **Agents**: Agent context maps, rules, and prompts used in agentic workflows.
- **Requirements**: Functional requirements, non-functional requirements, and constraints.
- **Product**: Vision, strategy, and glossary.

### Example

Refer to the [library-galaxy-map](https://github.com/outoforbitdev/library-galaxy-map/tree/main/docs) repository for an exemplary documentation structure.

## G-02: Justfile Commands

All repositories should include a `justfile` with the following standard commands for consistency across the organization:

- **`setup`**: One-time repository setup (install tools, configure environment, initialize git hooks, etc.)
- **`install`**: Install dependencies
- **`test`**: Run the test suite
- **`lint`**: Run linters and format checkers
- **`lint-write`**: Run linters and automatically fix issues
- **`gate`**: Run agentic verification step (includes tests, linting, type checking, etc.)

This standardization enables:
- Consistent agentic workflows and permissions
- Easy onboarding for contributors familiar with the organization
- Predictable CI/CD pipeline configurations

### Example justfile

```justfile
# Setup: one-time repository initialization
setup:
    # Install dependencies and configure environment
    @echo "Setting up repository..."
    npm install
    # Initialize git hooks with husky
    npx husky install

# Install: install project dependencies
install:
    npm install

# Test: run the test suite
test:
    npm test

# Lint: check code style and formatting
lint:
    npm run lint

# Lint-write: automatically fix linting issues
lint-write:
    npm run lint -- --fix

# Gate: agentic verification step (tests, lint, type check)
gate: test lint
    npm run type-check
```

## G-03: Dependabot Configuration

Every repository must run Dependabot to automate dependency updates and maintain security.

### Configuration Schedule

**Frequency**: Weekly updates  
**Recommended Timing**: Sundays at 9:00 AM UTC

**Rationale**: Weekly Sunday updates allow the team to address pull requests throughout the week, ensuring dependencies are kept current while providing ample time for review and testing.

### Setup Instructions

Create `.github/dependabot.yml` in your repository:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "sunday"
      time: "09:00"
    commit-message:
      prefix: "chore"
      prefix-scope: "deps"
    pull-request-branch-name:
      separator: "/"

  # Add additional package ecosystems as needed
  # For example, pip for Python projects
  # - package-ecosystem: "pip"
  #   directory: "/"
  #   schedule:
  #     interval: "weekly"
  #     day: "sunday"
  #     time: "09:00"
```

Adjust the `package-ecosystem`, `reviewers`, and other fields as appropriate for your repository.

## G-04: GitHub Workflows

All repositories should include the following standardized GitHub Actions workflows. These workflows enable visibility into repository health and status across the organization.

### Required Workflows

#### 1. Scorecard Workflow

**Purpose**: Security scoring using the OSSF Scorecard.  
**Trigger**: Scheduled weekly + on push to main  
**Badge Display**: Allows at-a-glance security assessment

Rather than implementing scorecard inline, use the reusable workflow from the [outoforbitdev/reusable-workflows-library](https://github.com/outoforbitdev/reusable-workflows-library).

**File**: `.github/workflows/scorecard.yml`

```yaml
name: scorecard

on:
  branch_protection_rule:
  push:
    branches: [main]
  schedule:
    - cron: "0 9 * * 0"  # Weekly, Sunday at 9:00 AM UTC (same as Dependabot)
  workflow_dispatch: {}  # Manual trigger to run the workflow on demand

jobs:
  scorecard:
    uses: outoforbitdev/reusable-workflows-library/.github/workflows/scorecard.yml@main
```

See the [reusable-workflows-library](https://github.com/outoforbitdev/reusable-workflows-library) repository for implementation details and the latest version.

#### 2. Test Workflow

**Purpose**: Run automated tests on pull requests and main branch.  
**Trigger**: On pull requests, push to main, and manual dispatch  
**Badge Display**: Shows test status for the main branch

**File**: `.github/workflows/test.yml`

```yaml
name: test

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install Dependencies
        run: npm install

      - name: Run Tests
        run: npm test

      - name: Run Linting
        run: npm run lint

      - name: Type Check
        run: npm run type-check
```

#### 3. Release Workflow

**Purpose**: Create releases and publish artifacts when code is pushed to main.  
**Trigger**: On push to main and manual dispatch

**File**: `.github/workflows/release.yml`

```yaml
name: release

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          registry-url: "https://registry.npmjs.org"

      - name: Install Dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Badge Display

Display workflow status badges in your repository's main README.md:

```markdown
## Status

[![Test](https://github.com/outoforbitdev/repo-name/actions/workflows/test.yml/badge.svg)](https://github.com/outoforbitdev/repo-name/actions/workflows/test.yml)
[![Scorecard](https://github.com/outoforbitdev/repo-name/actions/workflows/scorecard.yml/badge.svg)](https://github.com/outoforbitdev/repo-name/actions/workflows/scorecard.yml)
[![Release](https://github.com/outoforbitdev/repo-name/actions/workflows/release.yml/badge.svg)](https://github.com/outoforbitdev/repo-name/actions/workflows/release.yml)
```

Organization-level workflow status can be viewed in a centralized dashboard once scripts are in place.

## G-05: GitHub Workflow Triggers

All required GitHub Actions workflows must have the correct triggers configured to ensure they run at the appropriate times.

### Trigger Requirements

**Test Workflow** (`.github/workflows/test.yml`):
- `pull_request` — Trigger on all pull requests (required)
- `push` to `main` branch — Trigger on commits to main (required)
- `workflow_dispatch` — Manual trigger capability (optional)

**Scorecard Workflow** (`.github/workflows/scorecard.yml`):
- `schedule` — Weekly or more frequent cron (recommended: Sunday 9:00 AM UTC): `0 9 * * 0` (required)
- `push` to `main` branch — Trigger on commits to main (required)
- `branch_protection_rule` — Trigger on branch protection rule changes (optional)
- `workflow_dispatch` — Manual trigger capability (optional)

**Cron Schedule Requirement:** The schedule must run at least weekly (7 days or less between runs) to maintain security and compliance visibility.

**Release Workflow** (`.github/workflows/release.yml` or `npm_publish.yml`):
- `push` to `main` branch — Trigger on commits to main (required)
- `workflow_dispatch` — Manual trigger capability (optional)

These triggers ensure that code quality checks run on every PR, security assessments run on schedule and main updates, and releases are created automatically when code is merged.

## G-06: Git Hooks & Conventional Commits

Git hooks help maintain code quality and consistency by automatically checking commits before they are created. All repositories must use [pre-commit](https://pre-commit.com/) for git hook management.

Pre-commit is a language-agnostic framework that works with any programming language, making it ideal for polyglot repositories and consistent across the organization.

### Setup Instructions

1. Install pre-commit:
   ```bash
   brew install pre-commit  # macOS
   pip install pre-commit   # Linux/Python
   ```

2. Create `.pre-commit-config.yaml` in your repository root with conventional commits enforcement:
   ```yaml
   repos:
     - repo: https://github.com/compilerla/conventional-pre-commit
       rev: v2.4.0
       hooks:
         - id: conventional-pre-commit
           stages: [commit-msg]
     
     # Add other hooks as needed for your project
     - repo: https://github.com/pre-commit/pre-commit-hooks
       rev: v4.5.0
       hooks:
         - id: trailing-whitespace
         - id: end-of-file-fixer
         - id: check-yaml
   ```

3. Install the git hooks:
   ```bash
   pre-commit install --hook-type commit-msg
   ```

4. Test the setup:
   ```bash
   pre-commit run --all-files
   ```

### Conventional Commits Standard

All commits must follow the Conventional Commits format:

**Format**: `<type>(<scope>): <subject>`

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Example**: `feat(auth): add JWT token refresh mechanism`

### Migration from Husky

Repositories currently using Husky should migrate to pre-commit:

1. Remove Husky: `npm uninstall husky`
2. Remove `.husky/` directory: `rm -rf .husky/`
3. Remove husky hooks from `package.json`
4. Set up pre-commit as described above
5. Add `.pre-commit-config.yaml` to version control

### Verification

The automated guideline checker verifies that all repositories have `.pre-commit-config.yaml` configured with conventional commits enforcement via `conventional-pre-commit`.

## Compliance Checking

### Automated Guideline Verification

An automated script runs weekly (Sundays at 9:00 AM UTC, aligned with Dependabot) to verify that all repositories in the organization follow these guidelines:

- **G-01: Documentation Structure** — Verifies presence of `docs/internal/` directory structure
- **G-02: Justfile Commands** — Verifies Justfile has required commands (setup, install, test, lint, lint-write, gate)
- **G-03: Dependabot Configuration** — Verifies `.github/dependabot.yml` exists
- **G-04: GitHub Workflows** — Verifies required workflows exist (test, scorecard, release/publish)
- **G-05: GitHub Workflow Triggers** — Verifies workflows have correct triggers (push, pull_request, schedule, workflow_dispatch)
- **G-06: Git Hooks & Conventional Commits** — Verifies `.pre-commit-config.yaml` exists and includes `conventional-pre-commit` for commit message enforcement

### How the Process Works

1. **Automated Scanning**: The script runs on a cron schedule and checks all repositories in the organization
2. **Issue Creation**: If guidelines are not met, GitHub issues are automatically created in the non-compliant repositories
3. **Duplicate Prevention**: The script checks for existing issues to avoid creating duplicates
4. **Status Tracking**: Issues are labeled with guideline IDs for easy tracking and filtering

### Resolving Guideline Violations

If your repository receives a guideline violation issue:

1. Read the issue description to understand which guideline is not met
2. Review the specific section in this document for implementation instructions
3. Make the necessary changes to your repository
4. Commit and push your changes
5. The guideline check will verify compliance on the next scheduled run (weekly)

### Future Enhancements

- **Agent-based Evaluation**: An agent prompt to evaluate less-deterministic guidelines on-demand (when tokens are available), such as documentation quality and code standards compliance.

### Manual Compliance Check

Repository maintainers should regularly review this document and can run manual compliance checks using the guideline verification script in the `.github` repository.

## Migration Path

Existing repositories should be updated to comply with these guidelines incrementally:

1. **Phase 1** (Immediate): Add required GitHub Workflows and Dependabot configuration.
2. **Phase 2** (This sprint): Ensure documentation structure is in place.
3. **Phase 3** (Next sprint): Implement justfile commands and pre-commit hooks.

## Questions or Clarifications?

Refer to the issue [#20](https://github.com/outoforbitdev/.github/issues/20) in the .github repository for discussion and context.
