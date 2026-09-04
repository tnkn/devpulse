import type { IssueProjectFields } from "@/types";

// Same override as the REST client, so GitHub Enterprise Server and the
// test stub are pointed at one place. api.github.com serves GraphQL at
// /graphql; GHES serves it at /api/graphql, which the override covers.
const GITHUB_API = process.env.GITHUB_API_URL || "https://api.github.com";

/**
 * Issues fetched per request. Each carries up to PROJECT_ITEMS_PER_ISSUE
 * items and FIELD_VALUES_PER_ITEM values, and GitHub scores a query by
 * the number of nodes it can return, so these three multiply.
 */
const ISSUES_PER_PAGE = 50;
const PROJECT_ITEMS_PER_ISSUE = 5;
const FIELD_VALUES_PER_ITEM = 20;
const MAX_PAGES = 100;

/**
 * Field names are matched rather than hard-coded to "Priority" and
 * "Size": those are only the defaults of GitHub's project templates, and
 * a board that renamed Size to "Estimate" or "Story points" is saying
 * the same thing.
 */
const PRIORITY_FIELD = /^priority$/i;
const SIZE_FIELD = /^(size|estimate|story\s*points?|points?|sp)$/i;

/**
 * Reads Priority and Size off the Projects v2 items an issue belongs to.
 *
 * One request per ISSUES_PER_PAGE issues rather than one per issue: the
 * REST API exposes no project fields at all, so this is the only way to
 * get them, and doing it per issue would be unusable on a real backlog.
 */
const PROJECT_FIELDS_QUERY = `
query ProjectFields($owner: String!, $name: String!, $cursor: String, $since: DateTime) {
  repository(owner: $owner, name: $name) {
    issues(
      first: ${ISSUES_PER_PAGE}
      after: $cursor
      filterBy: { since: $since }
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        projectItems(first: ${PROJECT_ITEMS_PER_ISSUE}, includeArchived: false) {
          nodes {
            fieldValues(first: ${FIELD_VALUES_PER_ITEM}) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ... on ProjectV2FieldCommon { name } }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

interface FieldValueNode {
  __typename: string;
  name?: string | null;
  number?: number | null;
  text?: string | null;
  field?: { name?: string | null } | null;
}

interface IssueNode {
  number: number;
  projectItems: {
    nodes: ({ fieldValues: { nodes: FieldValueNode[] } } | null)[];
  };
}

interface QueryResponse {
  data?: {
    repository?: {
      issues: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: (IssueNode | null)[];
      };
    } | null;
  };
  errors?: { type?: string; message: string }[];
}

/**
 * Raised when the token cannot see projects at all, which is a
 * configuration problem rather than a failed collection: the caller
 * carries on without project fields instead of failing the whole run.
 */
export class ProjectsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectsUnavailableError";
  }
}

/** Reads the display value out of whichever field-value shape came back. */
function displayValue(node: FieldValueNode): string | null {
  switch (node.__typename) {
    case "ProjectV2ItemFieldSingleSelectValue":
      return node.name ?? null;
    case "ProjectV2ItemFieldNumberValue":
      // A Float in the schema, but story points are written as "3", not
      // "3.0"; only a genuinely fractional value keeps its decimals.
      return node.number === null || node.number === undefined
        ? null
        : String(node.number);
    case "ProjectV2ItemFieldTextValue":
      return node.text?.trim() || null;
    default:
      return null;
  }
}

function extractFields(issue: IssueNode): IssueProjectFields {
  let priority: string | null = null;
  let size: string | null = null;

  for (const item of issue.projectItems.nodes) {
    for (const value of item?.fieldValues.nodes ?? []) {
      const fieldName = value.field?.name;
      if (!fieldName) continue;
      // First non-empty value wins: an issue on several boards keeps
      // whatever the first one says rather than flapping between them.
      if (!priority && PRIORITY_FIELD.test(fieldName)) {
        priority = displayValue(value);
      } else if (!size && SIZE_FIELD.test(fieldName)) {
        size = displayValue(value);
      }
    }
  }

  return { priority, size };
}

/**
 * Fetches Priority and Size for a repository's issues, keyed by number.
 *
 * `since` limits the walk to issues updated after that time, matching how
 * the rest of the collector works. Issues with no project item, or whose
 * board has neither field, are simply absent from the result.
 *
 * Takes an already-resolved token so this module stays a thin wrapper
 * over the GraphQL endpoint, with no dependency on the token store.
 *
 * Throws ProjectsUnavailableError when the token lacks project access.
 */
export async function fetchIssueProjectFields(
  owner: string,
  repo: string,
  token: string,
  since?: string,
): Promise<Map<number, IssueProjectFields>> {
  const fields = new Map<number, IssueProjectFields>();
  let cursor: string | null = null;
  let page = 0;

  while (page < MAX_PAGES) {
    const res = await fetch(`${GITHUB_API}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: PROJECT_FIELDS_QUERY,
        variables: { owner, name: repo, cursor, since: since ?? null },
      }),
    });

    if (res.status === 401 || res.status === 403) {
      throw new ProjectsUnavailableError(
        `Token lacks project access (HTTP ${res.status}). A classic token needs the 'read:project' scope; a fine-grained token needs 'Projects: Read'.`,
      );
    }
    if (!res.ok) {
      throw new Error(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as QueryResponse;

    if (body.errors?.length) {
      const message = body.errors.map((e) => e.message).join("; ");
      // GraphQL reports a missing scope in the body with HTTP 200.
      if (
        body.errors.some(
          (e) => e.type === "FORBIDDEN" || e.type === "INSUFFICIENT_SCOPES",
        ) ||
        /read:project|insufficient|scope/i.test(message)
      ) {
        throw new ProjectsUnavailableError(
          `Token lacks project access: ${message}`,
        );
      }
      throw new Error(`GitHub GraphQL error: ${message}`);
    }

    const issues = body.data?.repository?.issues;
    if (!issues) break;

    for (const issue of issues.nodes) {
      if (!issue) continue;
      const extracted = extractFields(issue);
      if (extracted.priority || extracted.size) {
        fields.set(issue.number, extracted);
      }
    }

    if (!issues.pageInfo.hasNextPage) break;
    cursor = issues.pageInfo.endCursor;
    page++;
  }

  return fields;
}
