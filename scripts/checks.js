const fs = require('fs');
const path = require('path');

/**
 * Runs all checks for a repository
 * @param {string} repoPath - Path to the repository
 * @param {Array} guidelines - Array of guideline objects from config
 * @returns {Object} Results of all checks
 */
async function runAllChecks(repoPath, guidelines) {
  const results = {};

  for (const guideline of guidelines) {
    if (!guideline.enabled) {
      results[guideline.id] = { passed: null, reason: 'Guideline disabled' };
      continue;
    }

    const guidelineResults = [];
    for (const check of guideline.checks) {
      const checkResult = await runCheck(repoPath, check);
      guidelineResults.push(checkResult);
    }

    results[guideline.id] = evaluateGuidelineResults(guidelineResults, check, guideline);
  }

  return results;
}

/**
 * Runs a single check
 * @param {string} repoPath - Path to the repository
 * @param {Object} check - Check object with type and parameters
 * @returns {Object} Result of the check
 */
async function runCheck(repoPath, check) {
  switch (check.type) {
    case 'directory-exists':
      return checkDirectoryExists(repoPath, check.path);
    case 'file-exists':
      return checkFileExists(repoPath, check.path, check.paths, check.require-one);
    case 'file-contains':
      return checkFileContains(repoPath, check.path, check.patterns);
    default:
      return { passed: false, reason: `Unknown check type: ${check.type}` };
  }
}

/**
 * Checks if a directory exists
 * @param {string} repoPath - Path to the repository
 * @param {string} dirPath - Relative path to the directory
 * @returns {Object} Result of the check
 */
function checkDirectoryExists(repoPath, dirPath) {
  const fullPath = path.join(repoPath, dirPath);
  const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  return {
    passed: exists,
    check: `Directory exists: ${dirPath}`,
    reason: exists ? null : `Directory not found: ${dirPath}`,
  };
}

/**
 * Checks if one or more files exist
 * @param {string} repoPath - Path to the repository
 * @param {string} filePath - Single file path
 * @param {Array} filePaths - Array of file paths (alternative to filePath)
 * @param {boolean} requireOne - If true, at least one file must exist (for requireOne mode)
 * @returns {Object} Result of the check
 */
function checkFileExists(repoPath, filePath, filePaths, requireOneFlag) {
  const pathsToCheck = filePaths || (filePath ? [filePath] : []);

  if (requireOneFlag) {
    const found = pathsToCheck.some(p => fs.existsSync(path.join(repoPath, p)));
    return {
      passed: found,
      check: `At least one file exists: ${pathsToCheck.join(', ')}`,
      reason: found ? null : `None of the required files found: ${pathsToCheck.join(', ')}`,
    };
  }

  const results = pathsToCheck.map(p => {
    const fullPath = path.join(repoPath, p);
    const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    return { path: p, exists };
  });

  const allExist = results.every(r => r.exists);
  const missingPaths = results.filter(r => !r.exists).map(r => r.path);

  return {
    passed: allExist,
    check: `Files exist: ${pathsToCheck.join(', ')}`,
    reason: allExist ? null : `Files not found: ${missingPaths.join(', ')}`,
  };
}

/**
 * Checks if a file contains specific patterns
 * @param {string} repoPath - Path to the repository
 * @param {string} filePath - Relative path to the file
 * @param {Array} patterns - Array of regex patterns or strings to search for
 * @returns {Object} Result of the check
 */
function checkFileContains(repoPath, filePath, patterns) {
  const fullPath = path.join(repoPath, filePath);

  if (!fs.existsSync(fullPath)) {
    return {
      passed: false,
      check: `File contains patterns: ${filePath}`,
      reason: `File not found: ${filePath}`,
    };
  }

  const fileContent = fs.readFileSync(fullPath, 'utf8');
  const missingPatterns = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'm');
    if (!regex.test(fileContent)) {
      missingPatterns.push(pattern);
    }
  }

  const allFound = missingPatterns.length === 0;

  return {
    passed: allFound,
    check: `File contains patterns: ${filePath}`,
    reason: allFound ? null : `Patterns not found in ${filePath}: ${missingPatterns.join(', ')}`,
  };
}

/**
 * Evaluates the results of multiple checks for a guideline
 * @param {Array} checkResults - Array of check results
 * @param {Object} check - The check configuration (for requireOne logic)
 * @param {Object} guideline - The guideline object
 * @returns {Object} Overall guideline result
 */
function evaluateGuidelineResults(checkResults, check, guideline) {
  // If any check has require-one logic, handle that specially
  const allPassed = checkResults.every(result => result.passed);

  return {
    passed: allPassed,
    guideline: guideline.id,
    name: guideline.name,
    description: guideline.description,
    checks: checkResults,
    reason: allPassed ? null : 'One or more checks failed',
  };
}

module.exports = {
  runAllChecks,
  runCheck,
  checkDirectoryExists,
  checkFileExists,
  checkFileContains,
  evaluateGuidelineResults,
};
