/**
 * Pure helpers for building the daily work queue Discord summary.
 *
 * Nothing in this module talks to the network, so everything here is unit
 * testable. The GitHub API calls live in work-queue-summary.js.
 */

/** Maximum characters of an embed description we allow, below Discord's 4096. */
const MAX_DESCRIPTION_LENGTH = 4000;

/** Maximum characters of an item title before it is truncated. */
const MAX_TITLE_LENGTH = 100;

/** Maximum characters of the label list on one item line. */
const MAX_LABELS_LENGTH = 80;

/** Embed accent colors, as hex strings without the leading #. */
const COLORS = {
  pullRequest: "8957e5",
  issue: "2ea44f",
  empty: "6e7781",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Truncate text to a maximum length, ending with an ellipsis when cut.
 * @param {string} text - Text to truncate
 * @param {number} max - Maximum length of the result
 * @returns {string} The original text, or a shortened copy ending in "…"
 */
function truncate(text, max) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Escape characters that would break a Markdown link label.
 * @param {string} text - Raw text
 * @returns {string} Text safe to place inside [ ] of a Markdown link
 */
function escapeLinkText(text) {
  return text.replace(/([\\[\]*_`~|>])/g, "\\$1").replace(/\s+/g, " ");
}

/**
 * Format an item's age in whole days.
 * @param {string} createdAt - ISO creation timestamp
 * @param {Date} now - Current time
 * @returns {string} Age such as "12d"
 */
function formatAge(createdAt, now) {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / MS_PER_DAY),
  );
  return `${days}d`;
}

/**
 * Format one item as a single Markdown line.
 * @param {Object} item - Normalized item
 * @param {string} item.repo - Repository name
 * @param {number} item.number - Issue or pull request number
 * @param {string} item.title - Title
 * @param {string} item.url - Web URL
 * @param {string} item.author - Author login
 * @param {string[]} item.labels - Label names
 * @param {string} item.createdAt - ISO creation timestamp
 * @param {Date} now - Current time
 * @returns {string} Line such as "[repo#1 Title](url) · 3d · author · bug"
 */
function formatItemLine(item, now) {
  const label = escapeLinkText(
    `${item.repo}#${item.number} ${truncate(item.title, MAX_TITLE_LENGTH)}`,
  );
  const parts = [
    `[${label}](${item.url})`,
    formatAge(item.createdAt, now),
    item.author,
  ];
  if (item.labels.length > 0) {
    parts.push(truncate(item.labels.join(", "), MAX_LABELS_LENGTH));
  }
  return parts.join(" · ");
}

/**
 * Sort items by creation date, oldest first. Does not mutate the input.
 * @param {Object[]} items - Normalized items
 * @returns {Object[]} Sorted copy
 */
function sortOldestFirst(items) {
  return [...items].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
}

/**
 * Group lines into chunks whose joined text fits within a length limit.
 * Lines are never split. A single oversized line gets its own chunk.
 * @param {string[]} lines - Lines to group
 * @param {number} limit - Maximum joined length of a chunk
 * @returns {string[][]} Chunks of lines
 */
function chunkLines(lines, limit) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const line of lines) {
    const added = line.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && length + added > limit) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    length += line.length + (current.length > 0 ? 1 : 0);
    current.push(line);
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Build the embeds for one section (pull requests or issues).
 * @param {string} name - Section name, such as "Open pull requests"
 * @param {Object[]} items - Normalized items for the section
 * @param {string} color - Embed accent color
 * @param {Date} now - Current time
 * @returns {{title: string, description: string, color: string}[]} Embeds
 */
function buildSection(name, items, color, now) {
  if (items.length === 0) {
    return [];
  }
  const lines = sortOldestFirst(items).map((item) => formatItemLine(item, now));
  const chunks = chunkLines(lines, MAX_DESCRIPTION_LENGTH);
  return chunks.map((chunk, index) => ({
    title:
      chunks.length === 1
        ? `${name} (${items.length})`
        : `${name} (${items.length}) · ${index + 1}/${chunks.length}`,
    description: chunk.join("\n"),
    color,
  }));
}

/**
 * Build every Discord embed for the daily summary.
 * Pull requests come first, then issues. When nothing is open, a single
 * "nothing open" embed is returned.
 * @param {Object[]} pullRequests - Normalized open pull requests
 * @param {Object[]} issues - Normalized open issues
 * @param {Date} now - Current time
 * @returns {{title: string, description: string, color: string}[]} Embeds
 */
function buildMessages(pullRequests, issues, now) {
  const messages = [
    ...buildSection(
      "Open pull requests",
      pullRequests,
      COLORS.pullRequest,
      now,
    ),
    ...buildSection("Open issues", issues, COLORS.issue, now),
  ];
  if (messages.length === 0) {
    return [
      {
        title: "Work queue",
        description: "No open pull requests or issues.",
        color: COLORS.empty,
      },
    ];
  }
  return messages;
}

module.exports = {
  COLORS,
  MAX_DESCRIPTION_LENGTH,
  buildMessages,
  chunkLines,
  escapeLinkText,
  formatAge,
  formatItemLine,
  sortOldestFirst,
  truncate,
};
