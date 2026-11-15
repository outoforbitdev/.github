const test = require("node:test");
const assert = require("node:assert");
const {
  MAX_DESCRIPTION_LENGTH,
  buildMessages,
  chunkLines,
  escapeLinkText,
  formatAge,
  formatItemLine,
  sortOldestFirst,
  truncate,
} = require("./work-queue");
const { fetchOpenItems } = require("./work-queue-summary");

const NOW = new Date("2026-11-12T10:00:00Z");

/**
 * Build a normalized item with overridable fields.
 * @param {Object} overrides - Fields to override
 * @returns {Object} Item
 */
function item(overrides = {}) {
  return {
    repo: "repo",
    number: 1,
    title: "Title",
    url: "https://github.com/o/repo/issues/1",
    author: "alice",
    createdAt: "2026-11-09T10:00:00Z",
    ...overrides,
  };
}

test("truncate leaves short text and shortens long text", () => {
  assert.strictEqual(truncate("abc", 5), "abc");
  assert.strictEqual(truncate("abcdefgh", 5), "abcd…");
});

test("escapeLinkText escapes brackets and collapses whitespace", () => {
  assert.strictEqual(escapeLinkText("a [b]\n c"), "a \\[b\\] c");
});

test("formatAge returns whole days and never goes negative", () => {
  assert.strictEqual(formatAge("2026-11-09T10:00:00Z", NOW), "3d");
  assert.strictEqual(formatAge("2026-11-12T09:00:00Z", NOW), "0d");
  assert.strictEqual(formatAge("2026-11-13T10:00:00Z", NOW), "0d");
});

test("formatItemLine includes repo, title, age, and author", () => {
  const line = formatItemLine(item(), NOW);
  assert.strictEqual(
    line,
    "[repo#1 Title](https://github.com/o/repo/issues/1) · 3d · alice",
  );
});

test("sortOldestFirst orders by creation date without mutating input", () => {
  const items = [
    item({ number: 2, createdAt: "2026-11-10T00:00:00Z" }),
    item({ number: 1, createdAt: "2026-11-01T00:00:00Z" }),
  ];
  assert.deepStrictEqual(
    sortOldestFirst(items).map((i) => i.number),
    [1, 2],
  );
  assert.strictEqual(items[0].number, 2);
});

test("chunkLines keeps every chunk within the limit", () => {
  const chunks = chunkLines(["aaaa", "bbbb", "cccc"], 9);
  assert.deepStrictEqual(chunks, [["aaaa", "bbbb"], ["cccc"]]);
  for (const chunk of chunks) {
    assert.ok(chunk.join("\n").length <= 9);
  }
});

test("buildMessages returns a nothing-open message when empty", () => {
  const messages = buildMessages([], [], NOW);
  assert.strictEqual(messages.length, 1);
  assert.match(messages[0].description, /No open pull requests or issues/);
});

test("buildMessages lists pull requests before issues", () => {
  const messages = buildMessages([item()], [item({ number: 2 })], NOW);
  assert.deepStrictEqual(
    messages.map((m) => m.title),
    ["Open pull requests (1)", "Open issues (1)"],
  );
});

test("buildMessages splits large sections within Discord limits", () => {
  const many = Array.from({ length: 200 }, (_, i) =>
    item({ number: i, title: "x".repeat(90) }),
  );
  const messages = buildMessages([], many, NOW);
  assert.ok(messages.length > 1);
  for (const message of messages) {
    assert.ok(message.description.length <= MAX_DESCRIPTION_LENGTH);
  }
  assert.match(messages[0].title, /1\/\d+$/);
});

test("fetchOpenItems skips archived repos, drafts, and PRs in issues", async () => {
  const api = {
    repos: { listForOrg: "repos" },
    pulls: { list: "pulls" },
    issues: { listForRepo: "issues" },
    paginate: async (endpoint, params) => {
      if (endpoint === "repos") {
        return [
          { name: "live", archived: false },
          { name: "old", archived: true },
        ];
      }
      assert.strictEqual(params.repo, "live");
      const raw = (number, extra = {}) => ({
        number,
        title: `t${number}`,
        html_url: `u${number}`,
        user: { login: "bob" },
        created_at: "2026-11-01T00:00:00Z",
        ...extra,
      });
      if (endpoint === "pulls") {
        return [raw(1), raw(2, { draft: true })];
      }
      return [raw(1, { pull_request: {} }), raw(3)];
    },
  };
  const { pullRequests, issues } = await fetchOpenItems(api, "org");
  assert.deepStrictEqual(
    pullRequests.map((p) => p.number),
    [1],
  );
  assert.deepStrictEqual(
    issues.map((i) => i.number),
    [3],
  );
});
