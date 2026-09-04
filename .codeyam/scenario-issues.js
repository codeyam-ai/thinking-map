// codeyam-generated — DO NOT EDIT.
// codeyam-editor: 0.1.7  build: 2c2ee89df86b0902dfd9a88e5200b9427bb8e3f5  source-sha256: ed07b1e3af4e8904a3a2aaa77f4d0dc663901bf9cc6944fd611d879ae5d81835
function createIssue(kind, message, extra = {}) {
  const issue = {
    kind,
    message,
    url: extra.url ?? null,
    status: extra.status ?? null,
  };
  if (extra.matchedPattern != null) issue.matchedPattern = extra.matchedPattern;
  if (extra.contextSnippet != null) issue.contextSnippet = extra.contextSnippet;
  // The hydration gate's cross-origin ATTRIBUTION, carried as data rather than
  // only as prose. A consumer that must act on the verdict — escalating the
  // preview off the subpath when the counterpart origin hydrates — would
  // otherwise have to regex the English message, which breaks the moment the
  // wording is improved. Same conditional shape as the two fields above so an
  // issue that carries no attribution serializes exactly as it did before.
  if (extra.crossOrigin != null) issue.crossOrigin = extra.crossOrigin;
  if (extra.counterpartUrl != null) issue.counterpartUrl = extra.counterpartUrl;
  return issue;
}

function pushIssue(issues, issue) {
  const key = JSON.stringify(issue);
  if (!issues.some((existing) => JSON.stringify(existing) === key)) {
    issues.push(issue);
  }
}

function buildResult({
  loaded,
  hasContent,
  issues,
  outputPath,
  url,
  unmockedRoutes = [],
  mockUsage = { used: [], unused: [] },
  externalRequests = [],
}) {
  return {
    ok: loaded && hasContent && issues.length === 0,
    loaded,
    hasContent,
    url,
    outputPath: outputPath ?? null,
    issues,
    // Diagnostic-only: same-origin 4xx routes with no scenario mock. Does NOT
    // affect `ok` — the paired console error already fails the capture; this is
    // the actionable route list the failure message and `stub-unmocked-routes`
    // consume. Defaults to `[]` so callers that omit it are unchanged.
    unmockedRoutes,
    // Diagnostic-only, and deliberately NOT part of `ok`: an unused mock is not
    // automatically an error (a scenario may legitimately declare a mock for a
    // request the page makes only on interaction). Reporting it turns a silent
    // inertness into a visible fact; failing on it would break working scenarios
    // for a heuristic.
    mockUsage,
    // Requests grouped by origin, split mocked/unmocked and same/cross-origin.
    // The line that ends a "why is this page blank" misdiagnosis.
    externalRequests,
  };
}

module.exports = {
  createIssue,
  pushIssue,
  buildResult,
};
