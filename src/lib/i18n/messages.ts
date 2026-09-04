export type Locale = "en" | "ja";

export type Messages = {
  common: {
    home: string;
    settings: string;
    delete: string;
    cancel: string;
    confirm: string;
    loading: string;
    lastCollected: string;
    devVis: string;
  };
  home: {
    subtitle: string;
    compareRepositories: string;
    repositories: string;
    noReposFound: string;
    addRepoHint: string;
  };
  repo: {
    doraSummary: string;
    deploymentFrequency: string;
    totalPrMerges: string;
    merges: string;
    leadTimeForChanges: string;
    avgPrMergeTime: string;
    hours: string;
    changeFailureRate: string;
    avgFailureRate: string;
    revertRate: string;
    avgRevertRate: string;
    changeSize: string;
    avgLinesChanged: string;
    loc: string;
    timeToFirstReview: string;
    avgTimeToFirstReview: string;
    dataOverview: string;
    commits: string;
    pullRequests: string;
    releases: string;
    issues: string;
    dependencyGraph: string;
  };
  compare: {
    title: string;
    subtitle: string;
    selectRepositories: string;
    compareSelected: (count: number) => string;
    backToHome: string;
    comparisonResults: string;
    metric: string;
    deployments: string;
    failureRate: string;
    selectAtLeast2: string;
    clickCompare: string;
  };
  settings: {
    title: string;
    subtitle: string;
    githubTokens: string;
    addToken: string;
    tokenDisabled: string;
    envToken: string;
    envVariable: string;
    active: string;
    dbTokenPriority: string;
    envTokenInUse: string;
    noTokens: string;
    noTokensHint: string;
    default: string;
    test: string;
    testing: string;
    setDefault: string;
    deleteToken: (label: string) => string;
    validToken: (login: string) => string;
    invalidToken: (error: string) => string;
    added: string;
    addGithubToken: string;
    label: string;
    labelPlaceholder: string;
    personalAccessToken: string;
    tokenPlaceholder: string;
    tokenValidation: string;
    validating: string;
    validateAndSave: string;
    tokenAdded: (login: string) => string;
    failedToSave: string;
    requestFailed: string;
  };
  metrics: {
    period: string;
    day: string;
    week: string;
    month: string;
    metricsCharts: string;
    deploymentFrequency: string;
    leadTimeForChanges: string;
    changeFailureRate: string;
    revertRate: string;
    changeSize: string;
    timeToFirstReview: string;
    detailedData: string;
    periodSummary: string;
    noDataAvailable: string;
    noDeploymentData: string;
    leadTimePerPR: string;
    noMergedPRData: string;
    changeSizeLOC: string;
    noPRSizeData: string;
    noReviewData: string;
    periodHeader: string;
    total: string;
    failed: string;
    failureRate: string;
    pr: string;
    title: string;
    leadTimeHours: string;
    additions: string;
    deletions: string;
    totalLOC: string;
    timeToFirstReviewHours: string;
    merges: string;
    reverts: string;
    revertRateHeader: string;
    avgLeadTimeH: string;
    sigmaH: string;
    perPersonPRMetrics: string;
    perPersonReviewMetrics: string;
    user: string;
    mergedPRs: string;
    avgPRsPerBusinessDay: string;
    reviewedPRsUnique: string;
    reviewCount: string;
    noPRAuthorData: string;
    noReviewerData: string;
    activityHistory: (login: string) => string;
    mergedPRsTab: string;
    createdDate: string;
    mergedDate: string;
    timeToMerge: string;
    commitHistory: string;
    commitDate: string;
    commitMessage: string;
    relatedPR: string;
    noCommitData: string;
    reviewHistory: string;
    reviewDate: string;
    reviewState: string;
    reviewedPR: string;
    noReviewActivityData: string;
    close: string;
  };
  repoSelector: {
    addRepository: string;
    searchPlaceholder: string;
    ownerOnly: string;
    token: string;
    noReposFound: string;
    collect: string;
    collectionComplete: string;
    view: string;
    failed: string;
    retry: string;
    private: string;
  };
  updateButton: {
    update: string;
    updateFailed: string;
    retry: string;
  };
  deleteButton: {
    delete: string;
    deleteConfirm: (name: string) => string;
    confirm: string;
    cancel: string;
    deleting: string;
  };
  dateFilter: {
    from: string;
    to: string;
    reset: string;
    quick: string;
  };
  exportButtons: {
    export: string;
  };
  charts: {
    noDeploymentData: string;
    deployments: string;
    noMergedPRData: string;
    hours: string;
    noCommitData: string;
    failedLabel: string;
    failureRate: string;
    revertsLabel: string;
    revertRate: string;
    noChangeSizeData: string;
    loc: string;
    noReviewData: string;
  };
  dependencies: {
    title: string;
    description: string;
    startPoint: string;
    filterByIssue: string;
    filterByLabel: string;
    filterIssues: string;
    selectedCount: (count: number) => string;
    clearSelection: string;
    noMatchingIssues: string;
    displayLimit: string;
    layout: string;
    view: string;
    viewGraph: string;
    viewTable: string;
    colIssue: string;
    colTitle: string;
    colStatus: string;
    colAssignees: string;
    colParent: string;
    colBlockedBy: string;
    colBlocking: string;
    layoutTopDown: string;
    layoutLeftRight: string;
    noLimit: string;
    limitedTo: (shown: number, total: number) => string;
    selectLabel: string;
    graph: string;
    noEdges: string;
    legend: string;
    notStarted: string;
    started: string;
    completed: string;
    start: string;
    finish: string;
    dependencyEdge: string;
    subIssueGroup: string;
    blockingNow: string;
    chainUpstream: string;
    chainDownstream: string;
    writePermissionRequired: string;
    connectHint: string;
    alreadyLinked: string;
    cannotLinkToItself: string;
    resetLayout: string;
    expand: string;
    exitExpand: string;
  };
};

const en: Messages = {
  common: {
    home: "Home",
    settings: "Settings",
    delete: "Delete",
    cancel: "Cancel",
    confirm: "Confirm",
    loading: "Loading...",
    lastCollected: "Last collected",
    devVis: "dev-vis",
  },
  home: {
    subtitle: "GitHub Repository DORA Metrics Visualization",
    compareRepositories: "Compare Repositories",
    repositories: "Repositories",
    noReposFound: "No repositories found.",
    addRepoHint: 'Click "+ Add Repository" to collect data from GitHub.',
  },
  repo: {
    doraSummary: "DORA Metrics Summary",
    deploymentFrequency: "Deployment Frequency",
    totalPrMerges: "Total PR merges",
    merges: "merges",
    leadTimeForChanges: "Lead Time for Changes",
    avgPrMergeTime: "Average PR merge time",
    hours: "hours",
    changeFailureRate: "Change Failure Rate",
    avgFailureRate: "Average failure rate",
    revertRate: "Revert Rate",
    avgRevertRate: "Average revert commit rate",
    changeSize: "Change Size",
    avgLinesChanged: "Average lines changed",
    loc: "LOC",
    timeToFirstReview: "Time to First Review",
    avgTimeToFirstReview: "Average time to first review",
    dataOverview: "Data Overview",
    commits: "Commits",
    pullRequests: "Pull Requests",
    releases: "Releases",
    issues: "Issues",
    dependencyGraph: "Dependency Graph",
  },
  compare: {
    title: "Repository Comparison",
    subtitle: "Compare DORA metrics across multiple repositories",
    selectRepositories: "Select Repositories",
    compareSelected: (count) => `Compare (${count} selected)`,
    backToHome: "Back to Home",
    comparisonResults: "Comparison Results",
    metric: "Metric",
    deployments: "Deployments",
    failureRate: "Failure Rate",
    selectAtLeast2: "Select at least 2 repositories to compare.",
    clickCompare: 'Click "Compare" to see the results.',
  },
  settings: {
    title: "Settings",
    subtitle: "GitHub Token Management",
    githubTokens: "GitHub Tokens",
    addToken: "+ Add Token",
    tokenDisabled:
      "Token management is disabled (ALLOW_TOKEN_UI=false). Tokens can only be managed via environment variables.",
    envToken: "GITHUB_TOKEN (env)",
    envVariable: "environment variable",
    active: "active",
    dbTokenPriority: "DB token takes priority. Used as fallback.",
    envTokenInUse: "Currently in use. Add a token via UI to override.",
    noTokens: "No tokens configured.",
    noTokensHint:
      "Add a GitHub Personal Access Token to start collecting repository data.",
    default: "default",
    test: "Test",
    testing: "Testing...",
    setDefault: "Set Default",
    deleteToken: (label) => `Delete token "${label}"?`,
    validToken: (login) => `Valid (${login})`,
    invalidToken: (error) => `Invalid: ${error}`,
    added: "Added",
    addGithubToken: "Add GitHub Token",
    label: "Label",
    labelPlaceholder: "e.g. Personal, org-bot",
    personalAccessToken: "Personal Access Token",
    tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
    tokenValidation:
      "Token will be validated against GitHub API before saving.",
    validating: "Validating...",
    validateAndSave: "Validate & Save",
    tokenAdded: (login) => `Token added! (GitHub user: ${login})`,
    failedToSave: "Failed to save token",
    requestFailed: "Request failed",
  },
  metrics: {
    period: "Period",
    day: "Day",
    week: "Week",
    month: "Month",
    metricsCharts: "Metrics Charts",
    deploymentFrequency: "Deployment Frequency",
    leadTimeForChanges: "Lead Time for Changes",
    changeFailureRate: "Change Failure Rate",
    revertRate: "Revert Rate",
    changeSize: "Change Size",
    timeToFirstReview: "Time to First Review",
    detailedData: "Detailed Data",
    periodSummary: "Period Summary",
    noDataAvailable: "No data available.",
    noDeploymentData: "No deployment data available.",
    leadTimePerPR: "Lead Time for Changes per PR (Top 30)",
    noMergedPRData: "No merged PR data available.",
    changeSizeLOC: "Change Size (LOC)",
    noPRSizeData: "No PR size data available.",
    noReviewData: "No review data available.",
    periodHeader: "Period",
    total: "Total",
    failed: "Failed",
    failureRate: "Failure Rate",
    pr: "PR",
    title: "Title",
    leadTimeHours: "Lead Time (hours)",
    additions: "Additions",
    deletions: "Deletions",
    totalLOC: "Total LOC",
    timeToFirstReviewHours: "Time to First Review (hours)",
    merges: "Merges",
    reverts: "Reverts",
    revertRateHeader: "Revert Rate",
    avgLeadTimeH: "Avg Lead Time (h)",
    sigmaH: "\u03C3 (h)",
    perPersonPRMetrics: "PR Metrics (per person)",
    perPersonReviewMetrics: "Review Metrics (per person)",
    user: "User",
    mergedPRs: "Merged PRs",
    avgPRsPerBusinessDay: "Avg PRs / Business Day",
    reviewedPRsUnique: "Reviewed PRs (unique)",
    reviewCount: "Review Count",
    noPRAuthorData: "No PR author data available.",
    noReviewerData: "No reviewer data available.",
    activityHistory: (login) => `${login} Activity History`,
    mergedPRsTab: "Merged PRs",
    createdDate: "Created Date",
    mergedDate: "Merged Date",
    timeToMerge: "Time to Merge (h)",
    commitHistory: "Commits",
    commitDate: "Commit Date",
    commitMessage: "Commit Message",
    relatedPR: "Related PR",
    noCommitData: "No commit data available for this user.",
    reviewHistory: "Reviews",
    reviewDate: "Review Date",
    reviewState: "State",
    reviewedPR: "Reviewed PR",
    noReviewActivityData: "No review activity data available for this user.",
    close: "Close",
  },
  repoSelector: {
    addRepository: "+ Add Repository",
    searchPlaceholder: "Search repositories...",
    ownerOnly: "Owner / Organization only",
    token: "Token",
    noReposFound: "No repositories found",
    collect: "Collect",
    collectionComplete: "Collection complete",
    view: "View",
    failed: "Failed",
    retry: "Retry",
    private: "Private",
  },
  updateButton: {
    update: "Update",
    updateFailed: "Update failed",
    retry: "Retry",
  },
  deleteButton: {
    delete: "Delete",
    deleteConfirm: (name) => `Delete ${name}?`,
    confirm: "Confirm",
    cancel: "Cancel",
    deleting: "Deleting...",
  },
  dateFilter: {
    from: "From:",
    to: "To:",
    reset: "Reset",
    quick: "Quick:",
  },
  exportButtons: {
    export: "Export:",
  },
  charts: {
    noDeploymentData: "No deployment data available",
    deployments: "Deployments",
    noMergedPRData: "No merged PR data available",
    hours: "Hours",
    noCommitData: "No commit data available",
    failedLabel: "Failed",
    failureRate: "Failure Rate",
    revertsLabel: "Reverts",
    revertRate: "Revert Rate",
    noChangeSizeData: "No change size data available",
    loc: "LOC",
    noReviewData: "No review data available",
  },
  dependencies: {
    title: "Issue Dependency Graph",
    description:
      "Visualize GitHub issue dependencies and sub-issue hierarchy. GitHub is the source of truth: adding or removing a dependency here writes it to GitHub, and the Update button re-syncs from it.",
    startPoint: "Start point",
    filterByIssue: "Issue",
    filterByLabel: "Label / tag",
    filterIssues: "Filter by number or title",
    selectedCount: (count) => `${count} selected`,
    clearSelection: "Clear",
    noMatchingIssues: "No matching issues",
    displayLimit: "Display limit",
    layout: "Layout",
    view: "View",
    viewGraph: "Graph",
    viewTable: "Table",
    colIssue: "Issue",
    colTitle: "Title",
    colStatus: "Status",
    colAssignees: "Assignees",
    colParent: "Parent",
    colBlockedBy: "Blocked by",
    colBlocking: "Blocking",
    layoutTopDown: "Top to bottom",
    layoutLeftRight: "Left to right",
    noLimit: "No limit",
    limitedTo: (shown, total) =>
      `Showing ${shown} of ${total} issues. Raise the display limit to see the rest.`,
    selectLabel: "Select a label...",
    graph: "Graph",
    noEdges: "No issues to display yet.",
    legend: "Legend",
    notStarted: "Not started",
    started: "In progress",
    completed: "Done",
    start: "Start",
    finish: "Finish",
    dependencyEdge: "Blocked by",
    subIssueGroup: "Parent issue (contains sub-issues)",
    blockingNow: "Still blocking",
    chainUpstream: "Blocks the hovered issue",
    chainDownstream: "Waiting on the hovered issue",
    writePermissionRequired:
      "GitHub rejected the change. The token needs Issues: Read and write permission on this repository.",
    connectHint:
      "Drag from one issue's outgoing handle to another's incoming handle to add a dependency. Select an arrow and press Delete to remove it. Cards can be dragged around; a reload restores the automatic layout.",
    alreadyLinked: "That dependency already exists.",
    cannotLinkToItself: "An issue cannot depend on itself.",
    resetLayout: "Reset layout",
    expand: "Full screen",
    exitExpand: "Exit full screen (Esc)",
  },
};

const ja: Messages = {
  common: {
    home: "\u30DB\u30FC\u30E0",
    settings: "\u8A2D\u5B9A",
    delete: "\u524A\u9664",
    cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    confirm: "\u78BA\u8A8D",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D...",
    lastCollected: "\u6700\u7D42\u53D6\u5F97",
    devVis: "dev-vis",
  },
  home: {
    subtitle:
      "GitHub \u30EA\u30DD\u30B8\u30C8\u30EA DORA \u30E1\u30C8\u30EA\u30AF\u30B9\u53EF\u8996\u5316",
    compareRepositories: "\u30EA\u30DD\u30B8\u30C8\u30EA\u6BD4\u8F03",
    repositories: "\u30EA\u30DD\u30B8\u30C8\u30EA",
    noReposFound:
      "\u30EA\u30DD\u30B8\u30C8\u30EA\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    addRepoHint:
      "\u300C+ \u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u8FFD\u52A0\u300D\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066 GitHub \u304B\u3089\u30C7\u30FC\u30BF\u3092\u53D6\u5F97\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  },
  repo: {
    doraSummary: "DORA \u30E1\u30C8\u30EA\u30AF\u30B9\u6982\u8981",
    deploymentFrequency: "\u30C7\u30D7\u30ED\u30A4\u983B\u5EA6",
    totalPrMerges: "PR \u30DE\u30FC\u30B8\u7DCF\u6570",
    merges: "\u30DE\u30FC\u30B8",
    leadTimeForChanges: "\u5909\u66F4\u30EA\u30FC\u30C9\u30BF\u30A4\u30E0",
    avgPrMergeTime: "PR \u30DE\u30FC\u30B8\u5E73\u5747\u6642\u9593",
    hours: "\u6642\u9593",
    changeFailureRate: "\u5909\u66F4\u969C\u5BB3\u7387",
    avgFailureRate: "\u5E73\u5747\u969C\u5BB3\u7387",
    revertRate: "\u30EA\u30D0\u30FC\u30C8\u7387",
    avgRevertRate:
      "\u5E73\u5747\u30EA\u30D0\u30FC\u30C8\u30B3\u30DF\u30C3\u30C8\u7387",
    changeSize: "\u5909\u66F4\u30B5\u30A4\u30BA",
    avgLinesChanged: "\u5E73\u5747\u5909\u66F4\u884C\u6570",
    loc: "LOC",
    timeToFirstReview: "\u521D\u56DE\u30EC\u30D3\u30E5\u30FC\u6642\u9593",
    avgTimeToFirstReview:
      "\u521D\u56DE\u30EC\u30D3\u30E5\u30FC\u307E\u3067\u306E\u5E73\u5747\u6642\u9593",
    dataOverview: "\u30C7\u30FC\u30BF\u6982\u8981",
    commits: "\u30B3\u30DF\u30C3\u30C8",
    pullRequests: "\u30D7\u30EB\u30EA\u30AF\u30A8\u30B9\u30C8",
    releases: "\u30EA\u30EA\u30FC\u30B9",
    issues: "\u30A4\u30B7\u30E5\u30FC",
    dependencyGraph: "\u4F9D\u5B58\u95A2\u4FC2\u30B0\u30E9\u30D5",
  },
  compare: {
    title: "\u30EA\u30DD\u30B8\u30C8\u30EA\u6BD4\u8F03",
    subtitle:
      "\u8907\u6570\u30EA\u30DD\u30B8\u30C8\u30EA\u306E DORA \u30E1\u30C8\u30EA\u30AF\u30B9\u3092\u6BD4\u8F03",
    selectRepositories: "\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u9078\u629E",
    compareSelected: (count) =>
      `\u6BD4\u8F03\uFF08${count} \u4EF6\u9078\u629E\uFF09`,
    backToHome: "\u30DB\u30FC\u30E0\u306B\u623B\u308B",
    comparisonResults: "\u6BD4\u8F03\u7D50\u679C",
    metric: "\u30E1\u30C8\u30EA\u30AF\u30B9",
    deployments: "\u30C7\u30D7\u30ED\u30A4\u6570",
    failureRate: "\u969C\u5BB3\u7387",
    selectAtLeast2:
      "\u6BD4\u8F03\u3059\u308B\u306B\u306F 2 \u3064\u4EE5\u4E0A\u306E\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    clickCompare:
      "\u300C\u6BD4\u8F03\u300D\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u7D50\u679C\u3092\u8868\u793A\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
  },
  settings: {
    title: "\u8A2D\u5B9A",
    subtitle: "GitHub \u30C8\u30FC\u30AF\u30F3\u7BA1\u7406",
    githubTokens: "GitHub \u30C8\u30FC\u30AF\u30F3",
    addToken: "+ \u30C8\u30FC\u30AF\u30F3\u8FFD\u52A0",
    tokenDisabled:
      "\u30C8\u30FC\u30AF\u30F3\u7BA1\u7406\u306F\u7121\u52B9\u3067\u3059\uFF08ALLOW_TOKEN_UI=false\uFF09\u3002\u74B0\u5883\u5909\u6570\u3067\u306E\u307F\u30C8\u30FC\u30AF\u30F3\u3092\u7BA1\u7406\u3067\u304D\u307E\u3059\u3002",
    envToken: "GITHUB_TOKEN\uFF08\u74B0\u5883\u5909\u6570\uFF09",
    envVariable: "\u74B0\u5883\u5909\u6570",
    active: "\u6709\u52B9",
    dbTokenPriority:
      "DB \u30C8\u30FC\u30AF\u30F3\u304C\u512A\u5148\u3055\u308C\u307E\u3059\u3002\u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u3068\u3057\u3066\u4F7F\u7528\u3055\u308C\u307E\u3059\u3002",
    envTokenInUse:
      "\u73FE\u5728\u4F7F\u7528\u4E2D\u3067\u3059\u3002UI \u304B\u3089\u30C8\u30FC\u30AF\u30F3\u3092\u8FFD\u52A0\u3059\u308B\u3068\u4E0A\u66F8\u304D\u3055\u308C\u307E\u3059\u3002",
    noTokens:
      "\u30C8\u30FC\u30AF\u30F3\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
    noTokensHint:
      "GitHub Personal Access Token \u3092\u8FFD\u52A0\u3057\u3066\u30EA\u30DD\u30B8\u30C8\u30EA\u30C7\u30FC\u30BF\u306E\u53D6\u5F97\u3092\u958B\u59CB\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    default: "\u30C7\u30D5\u30A9\u30EB\u30C8",
    test: "\u30C6\u30B9\u30C8",
    testing: "\u30C6\u30B9\u30C8\u4E2D...",
    setDefault: "\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u8A2D\u5B9A",
    deleteToken: (label) =>
      `\u30C8\u30FC\u30AF\u30F3\u300C${label}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`,
    validToken: (login) => `\u6709\u52B9\uFF08${login}\uFF09`,
    invalidToken: (error) => `\u7121\u52B9: ${error}`,
    added: "\u8FFD\u52A0\u65E5",
    addGithubToken: "GitHub \u30C8\u30FC\u30AF\u30F3\u3092\u8FFD\u52A0",
    label: "\u30E9\u30D9\u30EB",
    labelPlaceholder: "\u4F8B: Personal, org-bot",
    personalAccessToken: "Personal Access Token",
    tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
    tokenValidation:
      "\u4FDD\u5B58\u524D\u306B GitHub API \u3067\u691C\u8A3C\u3055\u308C\u307E\u3059\u3002",
    validating: "\u691C\u8A3C\u4E2D...",
    validateAndSave: "\u691C\u8A3C\u3057\u3066\u4FDD\u5B58",
    tokenAdded: (login) =>
      `\u30C8\u30FC\u30AF\u30F3\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F\uFF01\uFF08GitHub \u30E6\u30FC\u30B6\u30FC: ${login}\uFF09`,
    failedToSave:
      "\u30C8\u30FC\u30AF\u30F3\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
    requestFailed:
      "\u30EA\u30AF\u30A8\u30B9\u30C8\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
  },
  metrics: {
    period: "\u671F\u9593",
    day: "\u65E5",
    week: "\u9031",
    month: "\u6708",
    metricsCharts: "\u30E1\u30C8\u30EA\u30AF\u30B9\u30C1\u30E3\u30FC\u30C8",
    deploymentFrequency: "\u30C7\u30D7\u30ED\u30A4\u983B\u5EA6",
    leadTimeForChanges: "\u5909\u66F4\u30EA\u30FC\u30C9\u30BF\u30A4\u30E0",
    changeFailureRate: "\u5909\u66F4\u969C\u5BB3\u7387",
    revertRate: "\u30EA\u30D0\u30FC\u30C8\u7387",
    changeSize: "\u5909\u66F4\u30B5\u30A4\u30BA",
    timeToFirstReview: "\u521D\u56DE\u30EC\u30D3\u30E5\u30FC\u6642\u9593",
    detailedData: "\u8A73\u7D30\u30C7\u30FC\u30BF",
    periodSummary: "\u671F\u9593\u30B5\u30DE\u30EA\u30FC",
    noDataAvailable:
      "\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    noDeploymentData:
      "\u30C7\u30D7\u30ED\u30A4\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    leadTimePerPR:
      "\u5909\u66F4\u30EA\u30FC\u30C9\u30BF\u30A4\u30E0 PR \u5225\uFF08\u4E0A\u4F4D 30\uFF09",
    noMergedPRData:
      "\u30DE\u30FC\u30B8\u6E08\u307F PR \u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    changeSizeLOC: "\u5909\u66F4\u30B5\u30A4\u30BA\uFF08LOC\uFF09",
    noPRSizeData:
      "PR \u30B5\u30A4\u30BA\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    noReviewData:
      "\u30EC\u30D3\u30E5\u30FC\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    periodHeader: "\u671F\u9593",
    total: "\u5408\u8A08",
    failed: "\u5931\u6557",
    failureRate: "\u969C\u5BB3\u7387",
    pr: "PR",
    title: "\u30BF\u30A4\u30C8\u30EB",
    leadTimeHours:
      "\u30EA\u30FC\u30C9\u30BF\u30A4\u30E0\uFF08\u6642\u9593\uFF09",
    additions: "\u8FFD\u52A0",
    deletions: "\u524A\u9664",
    totalLOC: "\u5408\u8A08 LOC",
    timeToFirstReviewHours:
      "\u521D\u56DE\u30EC\u30D3\u30E5\u30FC\u6642\u9593\uFF08\u6642\u9593\uFF09",
    merges: "\u30DE\u30FC\u30B8",
    reverts: "\u30EA\u30D0\u30FC\u30C8",
    revertRateHeader: "\u30EA\u30D0\u30FC\u30C8\u7387",
    avgLeadTimeH:
      "\u5E73\u5747\u30EA\u30FC\u30C9\u30BF\u30A4\u30E0\uFF08h\uFF09",
    sigmaH: "\u03C3\uFF08h\uFF09",
    perPersonPRMetrics:
      "PR \u30E1\u30C8\u30EA\u30AF\u30B9\uFF08\u500B\u4EBA\u5225\uFF09",
    perPersonReviewMetrics:
      "\u30EC\u30D3\u30E5\u30FC\u30E1\u30C8\u30EA\u30AF\u30B9\uFF08\u500B\u4EBA\u5225\uFF09",
    user: "\u30E6\u30FC\u30B6\u30FC",
    mergedPRs: "\u30DE\u30FC\u30B8 PR \u6570",
    avgPRsPerBusinessDay: "\u55B6\u696D\u65E5\u3042\u305F\u308A\u5E73\u5747 PR",
    reviewedPRsUnique:
      "\u30EC\u30D3\u30E5\u30FC PR \u6570\uFF08\u30E6\u30CB\u30FC\u30AF\uFF09",
    reviewCount: "\u30EC\u30D3\u30E5\u30FC\u56DE\u6570",
    noPRAuthorData: "PR 作成者データがありません。",
    noReviewerData: "レビュアーデータがありません。",
    activityHistory: (login) => `${login} のアクティビティ履歴`,
    mergedPRsTab: "マージ PR",
    createdDate: "作成日",
    mergedDate: "マージ日",
    timeToMerge: "マージまでの時間 (h)",
    commitHistory: "コミット",
    commitDate: "コミット日",
    commitMessage: "コミットメッセージ",
    relatedPR: "関連 PR",
    noCommitData: "このユーザーのコミットデータがありません。",
    reviewHistory: "レビュー",
    reviewDate: "レビュー日",
    reviewState: "ステート",
    reviewedPR: "レビュー対象 PR",
    noReviewActivityData: "このユーザーのレビューデータがありません。",
    close: "閉じる",
  },
  repoSelector: {
    addRepository: "+ \u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u8FFD\u52A0",
    searchPlaceholder: "\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u691C\u7D22...",
    ownerOnly: "\u30AA\u30FC\u30CA\u30FC / \u7D44\u7E54\u306E\u307F",
    token: "\u30C8\u30FC\u30AF\u30F3",
    noReposFound:
      "\u30EA\u30DD\u30B8\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
    collect: "\u53D6\u5F97",
    collectionComplete: "\u53D6\u5F97\u5B8C\u4E86",
    view: "\u8868\u793A",
    failed: "\u5931\u6557",
    retry: "\u518D\u8A66\u884C",
    private: "\u975E\u516C\u958B",
  },
  updateButton: {
    update: "\u66F4\u65B0",
    updateFailed: "\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
    retry: "\u518D\u8A66\u884C",
  },
  deleteButton: {
    delete: "\u524A\u9664",
    deleteConfirm: (name) =>
      `${name} \u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`,
    confirm: "\u78BA\u8A8D",
    cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    deleting: "\u524A\u9664\u4E2D...",
  },
  dateFilter: {
    from: "\u958B\u59CB:",
    to: "\u7D42\u4E86:",
    reset: "\u30EA\u30BB\u30C3\u30C8",
    quick: "\u30AF\u30A4\u30C3\u30AF:",
  },
  exportButtons: {
    export: "\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8:",
  },
  charts: {
    noDeploymentData:
      "\u30C7\u30D7\u30ED\u30A4\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093",
    deployments: "\u30C7\u30D7\u30ED\u30A4",
    noMergedPRData:
      "\u30DE\u30FC\u30B8\u6E08\u307F PR \u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093",
    hours: "\u6642\u9593",
    noCommitData:
      "\u30B3\u30DF\u30C3\u30C8\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093",
    failedLabel: "\u5931\u6557",
    failureRate: "\u969C\u5BB3\u7387",
    revertsLabel: "\u30EA\u30D0\u30FC\u30C8",
    revertRate: "\u30EA\u30D0\u30FC\u30C8\u7387",
    noChangeSizeData:
      "\u5909\u66F4\u30B5\u30A4\u30BA\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093",
    loc: "LOC",
    noReviewData:
      "\u30EC\u30D3\u30E5\u30FC\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093",
  },
  dependencies: {
    title: "Issue \u4F9D\u5B58\u95A2\u4FC2\u30B0\u30E9\u30D5",
    description:
      "GitHub \u306E Issue \u4F9D\u5B58\u95A2\u4FC2 (blocked by) \u3068\u89AA\u5B50\u95A2\u4FC2 (sub-issue) \u3092\u53EF\u8996\u5316\u3057\u307E\u3059\u3002GitHub \u304C\u6B63\u3068\u306A\u308A\u3001\u3053\u3053\u3067\u306E\u8FFD\u52A0\u30FB\u524A\u9664\u306F GitHub \u306B\u53CD\u6620\u3055\u308C\u3001\u300C\u66F4\u65B0\u300D\u30DC\u30BF\u30F3\u3067\u518D\u540C\u671F\u3055\u308C\u307E\u3059\u3002",
    startPoint: "\u8D77\u70B9",
    filterByIssue: "Issue",
    filterByLabel: "\u30E9\u30D9\u30EB / \u30BF\u30B0",
    filterIssues:
      "\u756A\u53F7\u30FB\u30BF\u30A4\u30C8\u30EB\u3067\u691C\u7D22",
    selectedCount: (count) => `${count} \u4EF6\u9078\u629E\u4E2D`,
    clearSelection: "\u30AF\u30EA\u30A2",
    noMatchingIssues:
      "\u8A72\u5F53\u3059\u308B Issue \u304C\u3042\u308A\u307E\u305B\u3093",
    displayLimit: "\u8868\u793A\u4E0A\u9650",
    layout: "\u30EC\u30A4\u30A2\u30A6\u30C8",
    view: "\u8868\u793A",
    viewGraph: "\u30B0\u30E9\u30D5",
    viewTable: "\u30C6\u30FC\u30D6\u30EB",
    colIssue: "Issue",
    colTitle: "\u30BF\u30A4\u30C8\u30EB",
    colStatus: "\u30B9\u30C6\u30FC\u30BF\u30B9",
    colAssignees: "\u62C5\u5F53\u8005",
    colParent: "\u89AA Issue",
    colBlockedBy: "\u30D6\u30ED\u30C3\u30AF\u5143",
    colBlocking: "\u30D6\u30ED\u30C3\u30AF\u5148",
    layoutTopDown: "\u4E0A\u304B\u3089\u4E0B",
    layoutLeftRight: "\u5DE6\u304B\u3089\u53F3",
    noLimit: "\u4E0A\u9650\u306A\u3057",
    limitedTo: (shown, total) =>
      `${total} \u4EF6\u4E2D ${shown} \u4EF6\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002\u3059\u3079\u3066\u898B\u308B\u306B\u306F\u8868\u793A\u4E0A\u9650\u3092\u4E0A\u3052\u3066\u304F\u3060\u3055\u3044\u3002`,
    selectLabel: "\u30E9\u30D9\u30EB\u3092\u9078\u629E...",
    graph: "\u30B0\u30E9\u30D5",
    noEdges:
      "\u8868\u793A\u3067\u304D\u308B Issue \u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    legend: "\u51E1\u4F8B",
    notStarted: "\u672A\u7740\u624B",
    started: "\u5BFE\u5FDC\u4E2D",
    completed: "\u5B8C\u4E86",
    start: "Start",
    finish: "Finish",
    dependencyEdge: "\u4F9D\u5B58\u95A2\u4FC2 (blocked by)",
    subIssueGroup:
      "\u89AA Issue\uFF08\u30B5\u30D6\u30A4\u30B7\u30E5\u30FC\u3092\u542B\u3080\uFF09",
    blockingNow: "\u30D6\u30ED\u30C3\u30AF\u4E2D",
    chainUpstream:
      "\u4E0A\u6D41\uFF08\u3053\u306E Issue \u3092\u6B62\u3081\u3066\u3044\u308B\uFF09",
    chainDownstream: "\u4E0B\u6D41\uFF08\u3053\u306E Issue \u5F85\u3061\uFF09",
    writePermissionRequired:
      "GitHub \u306B\u62D2\u5426\u3055\u308C\u307E\u3057\u305F\u3002\u30C8\u30FC\u30AF\u30F3\u306B\u3053\u306E\u30EA\u30DD\u30B8\u30C8\u30EA\u306E Issues: Read and write \u6A29\u9650\u304C\u5FC5\u8981\u3067\u3059\u3002",
    connectHint:
      "\u30CE\u30FC\u30C9\u306E\u51FA\u53E3\u5074\u306E\u25CF\u3092\u5225\u306E\u30CE\u30FC\u30C9\u306E\u5165\u53E3\u5074\u306E\u25CF\u306B\u30C9\u30E9\u30C3\u30B0\u3059\u308B\u3068\u4F9D\u5B58\u95A2\u4FC2\u3092\u8FFD\u52A0\u3002\u77E2\u5370\u3092\u9078\u629E\u3057\u3066 Delete \u30AD\u30FC\u3067\u524A\u9664\u3002\u30AB\u30FC\u30C9\u306F\u30C9\u30E9\u30C3\u30B0\u3067\u79FB\u52D5\u3067\u304D\u3001\u30EA\u30ED\u30FC\u30C9\u3067\u81EA\u52D5\u914D\u7F6E\u306B\u623B\u308A\u307E\u3059\u3002",
    alreadyLinked:
      "\u305D\u306E\u4F9D\u5B58\u95A2\u4FC2\u306F\u3059\u3067\u306B\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059\u3002",
    cannotLinkToItself:
      "\u540C\u3058 Issue \u540C\u58EB\u306F\u3064\u306A\u3052\u307E\u305B\u3093\u3002",
    resetLayout: "\u914D\u7F6E\u3092\u30EA\u30BB\u30C3\u30C8",
    expand: "\u5168\u753B\u9762\u8868\u793A",
    exitExpand: "\u5168\u753B\u9762\u8868\u793A\u3092\u7D42\u4E86 (Esc)",
  },
};

export const messages: Record<Locale, Messages> = { en, ja };
