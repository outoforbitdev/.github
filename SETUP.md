# .github Repository Setup

This repository contains organization-wide configuration, guidelines, and automation scripts.

## Prerequisites

- Python 3.8+
- pre-commit (install via: `brew install pre-commit` on macOS, or `pip install pre-commit`)

## First-Time Setup

1. **Install pre-commit:**
   ```bash
   brew install pre-commit  # macOS
   # or
   pip install pre-commit   # Linux/other
   ```

2. **Install git hooks:**
   ```bash
   cd .github  # Navigate to this repo's root
   pre-commit install --hook-type commit-msg
   ```

3. **Verify setup:**
   ```bash
   pre-commit run --all-files
   ```

## Git Hooks

This repository uses **pre-commit** to enforce code quality and commit message standards.

### What Gets Checked

**Commit Message (via conventional-pre-commit):**
- Enforces conventional commits format: `<type>(<scope>): <subject>`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`
- Allowed scopes: `docs`, `scripts`, `config`, `ci`, `workflow`, `guidelines`
- Example: `feat(scripts): add new guideline verification`

**File Quality (via pre-commit-hooks):**
- Trailing whitespace removal
- End-of-file fixer
- YAML/JSON validation
- Large file detection
- Private key detection
- Line ending normalization (LF)

**Code Formatting (via Prettier):**
- YAML, JSON, and Markdown formatting

## Running Pre-Commit

**Automatically (on git commit):**
```bash
git commit -m "feat(scripts): add new feature"  # Hooks run automatically
```

**Manually (check all files):**
```bash
pre-commit run --all-files
```

**For a specific hook:**
```bash
pre-commit run conventional-pre-commit --all-files
```

## Bypassing Hooks (Not Recommended)

If you need to bypass hooks (use sparingly!):
```bash
git commit --no-verify -m "emergency fix"
```

## Updating Hooks

To update all pre-commit hooks to their latest versions:
```bash
pre-commit autoupdate
```

## Troubleshooting

**"pre-commit: command not found"**
- Make sure pre-commit is installed: `brew install pre-commit`
- Check it's in your PATH: `which pre-commit`

**"Failed to find hook"**
- Run `pre-commit install --hook-type commit-msg` again
- Verify `.git/hooks/commit-msg` exists and is executable

**Commit message is rejected**
- Check the error message for the expected format
- Use format: `<type>(<scope>): <subject>` (lowercase)
- Ensure type is one of the allowed types
- Ensure scope is one of the allowed scopes

**File formatting issues**
- Run `pre-commit run --all-files` to auto-fix issues
- If fixes are made, re-add the files and commit

## References

- [Pre-commit Framework](https://pre-commit.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Pre-commit Hooks Registry](https://pre-commit.com/hooks.html)
