/**
 * Issue management for guideline violations
 */

/**
 * Create or update GitHub issues for unmet guidelines
 * @param {Octokit} octokit - GitHub API client
 * @param {Object} results - Results from guideline checks
 * @param {Object} config - Configuration object
 * @param {string} org - Organization name
 */
async function createOrUpdateIssues(octokit, results, config, org) {
  const issueConfig = config['issue-creation'] || {};

  for (const [repoName, repoResult] of Object.entries(results)) {
    if (repoResult.error || repoResult.compliant) {
      continue; // Skip errors and compliant repos
    }

    for (const [guidelineId, guidelineResult] of Object.entries(repoResult.results)) {
      if (guidelineResult.passed) {
        continue; // Skip passed guidelines
      }

      // Check if issue already exists for this guideline
      const existingIssue = await findExistingIssue(
        octokit,
        org,
        repoName,
        guidelineId,
      );

      if (existingIssue) {
        console.log(`  ℹ️  Issue already exists for ${repoName} ${guidelineId}`);
        // Optionally update the issue
        // await updateIssue(octokit, org, repoName, existingIssue, guidelineResult);
      } else {
        // Create new issue
        await createIssue(
          octokit,
          org,
          repoName,
          guidelineId,
          guidelineResult,
          issueConfig,
        );
        console.log(`  ✅ Created issue for ${repoName} ${guidelineId}`);
      }
    }
  }
}

/**
 * Find an existing issue for a guideline violation
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - Organization name
 * @param {string} repoName - Repository name
 * @param {string} guidelineId - Guideline ID
 * @returns {Promise<Object|null>} Existing issue or null
 */
async function findExistingIssue(octokit, org, repoName, guidelineId) {
  try {
    // List all open issues in the repo
    const { data: issues } = await octokit.issues.listForRepo({
      owner: org,
      repo: repoName,
      state: 'open',
      per_page: 100,
    });

    // Find issue with matching guideline ID in title
    // Title format is: [Guideline Check] G-01: Description
    const existingIssue = issues.find(issue => issue.title.includes(guidelineId));
    return existingIssue || null;
  } catch (error) {
    console.error(`Error searching for existing issue: ${error.message}`);
    return null;
  }
}

/**
 * Create a new GitHub issue for a guideline violation
 * @param {Octokit} octokit - GitHub API client
 * @param {string} org - Organization name
 * @param {string} repoName - Repository name
 * @param {string} guidelineId - Guideline ID
 * @param {Object} guidelineResult - Result of the guideline check
 * @param {Object} issueConfig - Issue configuration
 */
async function createIssue(octokit, org, repoName, guidelineId, guidelineResult, issueConfig) {
  const titlePrefix = issueConfig['title-prefix'] || '[Guideline Check]';
  const includeNumber = issueConfig['include-guideline-number'] !== false;

  const title = includeNumber
    ? `${titlePrefix} [${guidelineId}] ${guidelineResult.name}`
    : `${titlePrefix} ${guidelineResult.name}`;

  const body = generateIssueBody(guidelineId, guidelineResult);
  const labels = issueConfig.labels || ['guideline-check'];

  // Add guideline ID as a label
  const allLabels = [...labels];

  try {
    await octokit.issues.create({
      owner: org,
      repo: repoName,
      title,
      body,
      labels: allLabels,
    });
  } catch (error) {
    console.error(`Error creating issue for ${repoName}: ${error.message}`);
  }
}

/**
 * Generate the issue body
 * @param {string} guidelineId - Guideline ID
 * @param {Object} guidelineResult - Result of the guideline check
 * @returns {string} Formatted issue body
 */
function generateIssueBody(guidelineId, guidelineResult) {
  let body = `## Guideline Violation\n\n`;
  body += `**Guideline:** ${guidelineId}: ${guidelineResult.name}\n\n`;
  body += `**Description:** ${guidelineResult.description || 'See repository guidelines.'}\n\n`;

  body += `## What's Missing\n\n`;
  for (const check of guidelineResult.checks) {
    if (!check.passed) {
      body += `- ${check.reason}\n`;
    }
  }

  body += `\n## How to Fix\n\n`;
  body += `Please review the [Repository Guidelines](../../blob/main/docs/REPOSITORY_GUIDELINES.md#${guidelineId.toLowerCase()}) `;
  body += `for instructions on how to meet this guideline.\n\n`;

  body += `## Next Steps\n\n`;
  body += `1. Review the guideline requirements\n`;
  body += `2. Implement the necessary changes\n`;
  body += `3. Commit and push your changes\n`;
  body += `4. The guideline check will automatically verify compliance on the next run\n\n`;

  body += `---\n\n`;
  body += `*This issue was automatically created by the [Organization Guideline Verification](`;
  body += `https://github.com/outoforbitdev/.github) script.*\n`;

  return body;
}

module.exports = {
  createOrUpdateIssues,
  findExistingIssue,
  createIssue,
  generateIssueBody,
};
