const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkDependabotSchedule } = require('./checks');

/**
 * Creates a temporary repository containing the given dependabot.yml content.
 * @param {string|null} content - File content, or null to omit the file
 * @returns {string} Path to the temporary repository
 */
function makeRepo(content) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dependabot-check-'));
  if (content !== null) {
    fs.mkdirSync(path.join(repo, '.github'));
    fs.writeFileSync(path.join(repo, '.github', 'dependabot.yml'), content);
  }
  return repo;
}

const entry = (ecosystem, schedule) => `  - package-ecosystem: "${ecosystem}"
    directory: "/"
    schedule:
${schedule}
`;
const valid = '      interval: "weekly"\n      day: "monday"\n      time: "02:00"';

test('passes when all entries use the required schedule', () => {
  const repo = makeRepo(`version: 2\nupdates:\n${entry('npm', valid)}${entry('github-actions', valid)}`);
  assert.strictEqual(checkDependabotSchedule(repo, {}).passed, true);
});

test('passes with unquoted values and explicit UTC timezone', () => {
  const schedule = '      interval: weekly\n      day: monday\n      time: 02:00\n      timezone: UTC';
  const repo = makeRepo(`version: 2\nupdates:\n${entry('npm', schedule)}`);
  assert.strictEqual(checkDependabotSchedule(repo, {}).passed, true);
});

test('fails and names the ecosystem with the wrong schedule', () => {
  const old = '      interval: "weekly"\n      day: "sunday"\n      time: "09:00"';
  const repo = makeRepo(`version: 2\nupdates:\n${entry('npm', valid)}${entry('github-actions', old)}`);
  const result = checkDependabotSchedule(repo, {});
  assert.strictEqual(result.passed, false);
  assert.match(result.reason, /github-actions: day is "sunday"/);
  assert.doesNotMatch(result.reason, /npm:/);
});

test('fails when day and time are unset', () => {
  const repo = makeRepo(`version: 2\nupdates:\n${entry('npm', '      interval: "weekly"')}`);
  const result = checkDependabotSchedule(repo, {});
  assert.strictEqual(result.passed, false);
  assert.match(result.reason, /day is unset/);
  assert.match(result.reason, /time is unset/);
});

test('fails when a non-UTC timezone is set', () => {
  const schedule = `${valid}\n      timezone: "America/New_York"`;
  const repo = makeRepo(`version: 2\nupdates:\n${entry('npm', schedule)}`);
  assert.match(checkDependabotSchedule(repo, {}).reason, /timezone is "America\/New_York"/);
});

test('fails when the file is missing or has no updates', () => {
  assert.match(checkDependabotSchedule(makeRepo(null), {}).reason, /File not found/);
  assert.match(checkDependabotSchedule(makeRepo('version: 2\n'), {}).reason, /No updates defined/);
});

test('fails on invalid YAML', () => {
  assert.match(checkDependabotSchedule(makeRepo('updates: [\n'), {}).reason, /Invalid YAML/);
});

test('evaluateDependabotSchedule checks raw content without a checkout', () => {
  const { evaluateDependabotSchedule } = require('./checks');
  const good = `version: 2\nupdates:\n${entry('npm', valid)}`;
  const bad = `version: 2\nupdates:\n${entry('npm', '      interval: "daily"')}`;
  assert.strictEqual(evaluateDependabotSchedule(good, {}).passed, true);
  assert.strictEqual(evaluateDependabotSchedule(bad, {}).passed, false);
});
