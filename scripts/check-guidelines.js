#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { Octokit } = require('@octokit/rest');
const checks = require('./checks');
const issueManager = require('./issue-manager');

/**
 * Main script to verify repository guidelines
 */
async function main() {
  const args = parseArgs();

  // Validate required arguments
  if (!args.org) {
    console.error('Error: --org flag is required');
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  // Load configuration
  const configPath = args.config || path.join(__dirname, 'guidelines-config.yaml');
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));

  // Initialize GitHub API client
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  console.log(`\n📋 Organization Guideline Verification`);
  console.log(`Organization: ${args.org}`);
  console.log(`Dry-run: ${args.dryRun ? 'Yes' : 'No'}`);
  console.log(`Create issues: ${args.createIssues ? 'Yes' : 'No'}`);

  try {
    // Fetch all repositories in the organization
    console.log(`\n🔍 Fetching repositories from ${args.org}...`);
    const repositories = await fetchOrgRepositories(octokit, args.org, config);
    console.log(`Found ${repositories.length} repositories to check`);

    // Check each repository
    const results = {};
    const summaryStats = {
      total: repositories.length,
      compliant: 0,
      non_compliant: 0,
      error: 0,
    };

    console.log(`\n🔬 Checking repositories...`);
    for (const repo of repositories) {
      try {
        const repoResults = await checkRepository(octokit, repo, config, args, checks);
        results[repo.name] = repoResults;

        if (repoResults.error) {
          summaryStats.error++;
        } else if (repoResults.compliant) {
          summaryStats.compliant++;
        } else {
          summaryStats.non_compliant++;
        }
      } catch (error) {
        console.error(`  Error checking ${repo.name}: ${error.message}`);
        results[repo.name] = { error: true, message: error.message };
        summaryStats.error++;
      }
    }

    // Print summary
    printSummary(results, summaryStats);

    // Handle issue creation if enabled and not dry-run
    if (config['issue-creation']?.enabled && !args.dryRun && args.createIssues) {
      console.log(`\n📝 Creating/updating GitHub issues...`);
      await issueManager.createOrUpdateIssues(octokit, results, config, args.org);
    }

    process.exit(0);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Fetch all repositories in an organization
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - Organization name
 * @param {Object} config - Configuration object
 * @returns {Promise<Array>} Array of repository objects
 */
async function fetchOrgRepositories(octokit, org, config) {
  const repositories = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await octokit.repos.listForOrg({
      org,
      type: 'all',
      per_page: perPage,
      page,
      sort: 'updated',
    });

    if (data.length === 0) break;

    const filter = config['repository-filter'] || {};
    const excluded = config['excluded-repositories'] || [];

    const filtered = data.filter(repo => {
      // Skip archived repos if configured
      if (filter['skip-archived'] && repo.archived) return false;

      // Skip private repos if configured
      if (filter['skip-private'] && repo.private) return false;

      // Skip forked repos if configured
      if (filter['skip-forks'] && repo.fork) return false;

      // Skip explicitly excluded repos
      if (excluded.includes(repo.name)) return false;

      return true;
    });

    repositories.push(...filtered);

    if (data.length < perPage) break;
    page++;
  }

  return repositories;
}

/**
 * Check a single repository against all guidelines
 * @param {Octokit} octokit - GitHub API client
 * @param {Object} repo - Repository object
 * @param {Object} config - Configuration object
 * @param {Object} args - Command-line arguments
 * @param {Object} checksModule - Checks module
 * @returns {Promise<Object>} Results of all checks
 */
async function checkRepository(octokit, repo, config, args, checksModule) {
  // Download repository content
  console.log(`  ✓ Checking ${repo.name}...`);

  const tempDir = path.join('/tmp', `repo-${repo.name}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // For now, we'll check files via GitHub API instead of cloning
    // This is more efficient and doesn't require git
    const checkResults = await runChecksViaAPI(octokit, repo, config.guidelines);

    const allPassed = Object.values(checkResults).every(result => result.passed !== false);

    return {
      repo: repo.name,
      url: repo.html_url,
      compliant: allPassed,
      results: checkResults,
    };
  } finally {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Run checks using GitHub API (without cloning the repo)
 * @param {Octokit} octokit - GitHub API client
 * @param {Object} repo - Repository object
 * @param {Array} guidelines - Guidelines to check
 * @returns {Promise<Object>} Results of all checks
 */
async function runChecksViaAPI(octokit, repo, guidelines) {
  const results = {};

  for (const guideline of guidelines) {
    if (!guideline.enabled) {
      results[guideline.id] = { passed: null, reason: 'Guideline disabled' };
      continue;
    }

    const checkResults = [];
    for (const check of guideline.checks) {
      const checkResult = await runCheckViaAPI(octokit, repo, check);
      checkResults.push(checkResult);
    }

    const allPassed = checkResults.every(result => result.passed);

    results[guideline.id] = {
      passed: allPassed,
      name: guideline.name,
      checks: checkResults,
    };
  }

  return results;
}

/**
 * Run a single check using GitHub API
 * @param {Octokit} octokit - GitHub API client
 * @param {Object} repo - Repository object
 * @param {Object} check - Check configuration
 * @returns {Promise<Object>} Result of the check
 */
async function runCheckViaAPI(octokit, repo, check) {
  const [owner, repoName] = [repo.owner.login, repo.name];

  try {
    switch (check.type) {
      case 'directory-exists':
      case 'file-exists':
        return await checkFileViaAPI(octokit, owner, repoName, check);
      case 'file-contains':
        return await checkFileContainsViaAPI(octokit, owner, repoName, check);
      default:
        return { passed: false, reason: `Unknown check type: ${check.type}` };
    }
  } catch (error) {
    return { passed: false, reason: `Check failed: ${error.message}` };
  }
}

/**
 * Check if a file/directory exists via GitHub API
 * @param {Octokit} octokit - GitHub API client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} check - Check configuration
 * @returns {Promise<Object>} Result of the check
 */
async function checkFileViaAPI(octokit, owner, repo, check) {
  const paths = check.path ? [check.path] : check.paths || [];

  if (check.type === 'directory-exists') {
    // For directories, try to get contents to verify it exists
    for (const p of paths) {
      try {
        await octokit.repos.getContent({ owner, repo, path: p });
        return { passed: true, check: `Directory exists: ${p}` };
      } catch (error) {
        if (error.status === 404) continue;
        throw error;
      }
    }
    return { passed: false, reason: `Directories not found: ${paths.join(', ')}` };
  }

  if (check.type === 'file-exists') {
    if (check['require-one']) {
      for (const p of paths) {
        try {
          await octokit.repos.getContent({ owner, repo, path: p });
          return { passed: true, check: `File exists: ${p}` };
        } catch (error) {
          if (error.status === 404) continue;
          throw error;
        }
      }
      return { passed: false, reason: `None of the required files found: ${paths.join(', ')}` };
    }

    // All files must exist
    for (const p of paths) {
      try {
        await octokit.repos.getContent({ owner, repo, path: p });
      } catch (error) {
        if (error.status === 404) {
          return { passed: false, reason: `File not found: ${p}` };
        }
        throw error;
      }
    }
    return { passed: true, check: `Files exist: ${paths.join(', ')}` };
  }
}

/**
 * Check if a file contains patterns via GitHub API
 * @param {Octokit} octokit - GitHub API client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} check - Check configuration
 * @returns {Promise<Object>} Result of the check
 */
async function checkFileContainsViaAPI(octokit, owner, repo, check) {
  const filePath = check.path;
  const patterns = check.patterns || [];

  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    const content = Buffer.from(data.content, 'base64').toString('utf8');

    const missingPatterns = [];
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'm');
      if (!regex.test(content)) {
        missingPatterns.push(pattern);
      }
    }

    if (missingPatterns.length === 0) {
      return { passed: true, check: `File contains required patterns: ${filePath}` };
    }

    return {
      passed: false,
      reason: `Missing patterns in ${filePath}: ${missingPatterns.join(', ')}`,
    };
  } catch (error) {
    if (error.status === 404) {
      return { passed: false, reason: `File not found: ${filePath}` };
    }
    throw error;
  }
}

/**
 * Print verification summary
 * @param {Object} results - Results object
 * @param {Object} stats - Summary statistics
 */
function printSummary(results, stats) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total repositories checked: ${stats.total}`);
  console.log(`✅ Compliant: ${stats.compliant}`);
  console.log(`❌ Non-compliant: ${stats.non_compliant}`);
  console.log(`⚠️  Errors: ${stats.error}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Detailed Results`);
  console.log(`${'='.repeat(60)}`);

  for (const [repoName, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`\n❌ ${repoName}: Error - ${result.message}`);
    } else {
      const status = result.compliant ? '✅' : '❌';
      console.log(`\n${status} ${repoName}`);

      for (const [guidelineId, guidelineResult] of Object.entries(result.results)) {
        const guidelineStatus = guidelineResult.passed ? '  ✓' : '  ✗';
        console.log(`${guidelineStatus} ${guidelineId}: ${guidelineResult.name}`);

        if (!guidelineResult.passed) {
          for (const check of guidelineResult.checks) {
            if (!check.passed) {
              console.log(`    • ${check.reason}`);
            }
          }
        }
      }
    }
  }
}

/**
 * Parse command-line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = {
    org: process.env.GITHUB_ORG || null,
    config: null,
    dryRun: false,
    createIssues: false,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === '--org') {
      args.org = process.argv[++i];
    } else if (arg === '--config') {
      args.config = process.argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--create-issues') {
      args.createIssues = true;
    }
  }

  return args;
}

// Run the script
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
