#!/usr/bin/env node

/**
 * Fetch every open pull request and issue in a GitHub organization and build
 * the Discord embeds for the daily work queue summary.
 *
 * Archived repositories and draft pull requests are skipped.
 *
 * Usage:
 *   GITHUB_TOKEN=... node work-queue-summary.js --org outoforbitdev
 *
 * The embeds are written as a JSON array to the file named by $GITHUB_OUTPUT
 * (as `messages`) when set, and always printed to stdout as a count.
 */

const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const { buildMessages } = require("./work-queue");

/**
 * Parse command line arguments.
 * @param {string[]} argv - Arguments without the node and script entries
 * @returns {{org: string}} Parsed options
 */
function parseArgs(argv) {
  const index = argv.indexOf("--org");
  const org = index >= 0 ? argv[index + 1] : process.env.GITHUB_ORG;
  if (!org) {
    throw new Error("Organization is required: pass --org or set GITHUB_ORG.");
  }
  return { org };
}

/**
 * Convert a raw API item into the shape used by the formatter.
 * @param {string} repo - Repository name
 * @param {Object} raw - Issue or pull request from the API
 * @returns {Object} Normalized item
 */
function normalize(repo, raw) {
  return {
    repo,
    number: raw.number,
    title: raw.title,
    url: raw.html_url,
    author: raw.user ? raw.user.login : "ghost",
    createdAt: raw.created_at,
  };
}

/**
 * Fetch open non-draft pull requests and open issues for every non-archived
 * repository in the organization.
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - Organization name
 * @returns {Promise<{pullRequests: Object[], issues: Object[]}>} Items
 */
async function fetchOpenItems(octokit, org) {
  const repos = await octokit.paginate(octokit.repos.listForOrg, {
    org,
    type: "all",
    per_page: 100,
  });
  const pullRequests = [];
  const issues = [];

  for (const repo of repos.filter((r) => !r.archived)) {
    const params = {
      owner: org,
      repo: repo.name,
      state: "open",
      per_page: 100,
    };
    const [pulls, repoIssues] = await Promise.all([
      octokit.paginate(octokit.pulls.list, params),
      octokit.paginate(octokit.issues.listForRepo, params),
    ]);
    pullRequests.push(
      ...pulls.filter((p) => !p.draft).map((p) => normalize(repo.name, p)),
    );
    // The issues API also returns pull requests, so drop them here.
    issues.push(
      ...repoIssues
        .filter((i) => !i.pull_request)
        .map((i) => normalize(repo.name, i)),
    );
  }
  return { pullRequests, issues };
}

/**
 * Entry point.
 */
async function main() {
  const { org } = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to read the organization.");
  }

  const octokit = new Octokit({ auth: token });
  const { pullRequests, issues } = await fetchOpenItems(octokit, org);
  const messages = buildMessages(pullRequests, issues, new Date());

  console.log(
    `Found ${pullRequests.length} pull requests and ${issues.length} issues; ` +
      `built ${messages.length} message(s).`,
  );

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `messages=${JSON.stringify(messages)}\n`,
    );
  } else {
    console.log(JSON.stringify(messages, null, 2));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}

module.exports = { fetchOpenItems, normalize, parseArgs };
