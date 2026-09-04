import type { IssueProjectFields, ProjectFieldDefinition } from "@/types";

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
const PROJECTS_PER_REPO = 10;
const FIELDS_PER_PROJECT = 50;
const OPTIONS_PER_FIELD = 50;
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
            id
            project { id }
            fieldValues(first: ${FIELD_VALUES_PER_ITEM}) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2FieldCommon { id name } }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ... on ProjectV2FieldCommon { id name } }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ... on ProjectV2FieldCommon { id name } }
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
  field?: { id?: string | null; name?: string | null } | null;
}

interface ProjectItemNode {
  id: string;
  project: { id: string } | null;
  fieldValues: { nodes: FieldValueNode[] };
}

interface IssueNode {
  number: number;
  projectItems: { nodes: (ProjectItemNode | null)[] };
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
  let projectId: string | null = null;
  let projectItemId: string | null = null;

  for (const item of issue.projectItems.nodes) {
    if (!item) continue;
    for (const value of item.fieldValues.nodes) {
      const fieldName = value.field?.name;
      if (!fieldName) continue;
      const isPriority = PRIORITY_FIELD.test(fieldName);
      const isSize = SIZE_FIELD.test(fieldName);
      if (!isPriority && !isSize) continue;

      // First non-empty value wins: an issue on several boards keeps
      // whatever the first one says rather than flapping between them.
      if (isPriority && !priority) priority = displayValue(value);
      else if (isSize && !size) size = displayValue(value);
      else continue;

      // Remembered so an edit writes back to the item the value was read
      // from. An issue on several boards is edited on the first of them.
      if (!projectItemId) {
        projectItemId = item.id;
        projectId = item.project?.id ?? null;
      }
    }
  }

  return { priority, size, projectId, projectItemId };
}

/**
 * The single door to GitHub's GraphQL endpoint.
 *
 * Both refusal shapes are classified here: an HTTP 401/403, and a
 * FORBIDDEN carried in the body of an otherwise successful 200 — which
 * is how a missing scope usually arrives.
 */
async function postGraphQL<
  T extends { errors?: { type?: string; message: string }[] },
>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ProjectsUnavailableError(
      `Token lacks project access (HTTP ${res.status}). A classic token needs the 'read:project' scope; a fine-grained token needs 'Projects: Read'.`,
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as T;
  if (body.errors?.length) {
    const message = body.errors.map((e) => e.message).join("; ");
    if (
      body.errors.some(
        (e) => e.type === "FORBIDDEN" || e.type === "INSUFFICIENT_SCOPES",
      ) ||
      /read:project|project.*scope|insufficient|scope/i.test(message)
    ) {
      throw new ProjectsUnavailableError(
        `Token lacks project access: ${message}`,
      );
    }
    throw new Error(`GitHub GraphQL error: ${message}`);
  }
  return body;
}

/**
 * The Priority and Size field definitions on the repository's boards.
 *
 * Read separately from the values because an issue with no Priority set
 * carries no field value to learn the field's id from — and an unset
 * field is exactly the one someone opens the table to fill in.
 */
const PROJECT_FIELD_DEFS_QUERY = `
query ProjectFieldDefs($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    projectsV2(first: ${PROJECTS_PER_REPO}) {
      nodes {
        id
        title
        fields(first: ${FIELDS_PER_PROJECT}) {
          nodes {
            __typename
            ... on ProjectV2FieldCommon { id name dataType }
            ... on ProjectV2SingleSelectField {
              options(first: ${OPTIONS_PER_FIELD}) { id name }
            }
          }
        }
      }
    }
  }
}`;

interface FieldDefNode {
  __typename: string;
  id?: string | null;
  name?: string | null;
  dataType?: string | null;
  options?: { id: string; name: string }[] | null;
}

interface FieldDefsResponse {
  data?: {
    repository?: {
      projectsV2: {
        nodes: ({
          id: string;
          title: string;
          fields: { nodes: (FieldDefNode | null)[] };
        } | null)[];
      };
    } | null;
  };
  errors?: { type?: string; message: string }[];
}

/**
 * Reads the editable Priority and Size fields on every board the
 * repository has, so a cell knows what it may be set to.
 *
 * Boards with neither field are skipped: nothing on them is editable
 * from here.
 */
export async function fetchProjectFieldDefs(
  owner: string,
  repo: string,
  token: string,
): Promise<ProjectFieldDefinition[]> {
  const body = await postGraphQL<FieldDefsResponse>(
    token,
    PROJECT_FIELD_DEFS_QUERY,
    { owner, name: repo },
  );

  const definitions: ProjectFieldDefinition[] = [];
  for (const project of body.data?.repository?.projectsV2.nodes ?? []) {
    if (!project) continue;
    for (const field of project.fields.nodes) {
      if (!field?.id || !field.name) continue;
      const kind = PRIORITY_FIELD.test(field.name)
        ? "priority"
        : SIZE_FIELD.test(field.name)
          ? "size"
          : null;
      if (!kind) continue;
      definitions.push({
        projectId: project.id,
        projectTitle: project.title,
        fieldId: field.id,
        fieldName: field.name,
        kind,
        dataType: field.dataType ?? "TEXT",
        options: field.options ?? [],
      });
    }
  }
  return definitions;
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
    // Annotated rather than inferred: `cursor` is read from the previous
    // response and passed into the next call, so leaving the type to
    // inference makes body depend on itself.
    const body: QueryResponse = await postGraphQL(token, PROJECT_FIELDS_QUERY, {
      owner,
      name: repo,
      cursor,
      since: since ?? null,
    });

    const issues = body.data?.repository?.issues;
    if (!issues) break;

    for (const issue of issues.nodes) {
      if (!issue) continue;
      const extracted = extractFields(issue);
      // An issue on a board is kept even with both fields empty: the
      // item id is what makes it editable, and "not set yet" is exactly
      // the case someone opens the table to fix.
      const item = issue.projectItems.nodes.find((n) => n !== null);
      if (extracted.priority || extracted.size || item) {
        fields.set(issue.number, {
          ...extracted,
          projectItemId: extracted.projectItemId ?? item?.id ?? null,
          projectId: extracted.projectId ?? item?.project?.id ?? null,
        });
      }
    }

    if (!issues.pageInfo.hasNextPage) break;
    cursor = issues.pageInfo.endCursor;
    page++;
  }

  return fields;
}

const UPDATE_FIELD_MUTATION = `
mutation SetField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }
  ) {
    projectV2Item { id }
  }
}`;

const CLEAR_FIELD_MUTATION = `
mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
  clearProjectV2ItemFieldValue(
    input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }
  ) {
    projectV2Item { id }
  }
}`;

/**
 * Builds the value in the shape the field expects.
 *
 * A single-select field is set by option id, not by the option's text,
 * so the caller resolves the wording it was given against the field's
 * own options; a wording the board does not offer is refused here rather
 * than silently doing nothing.
 */
function fieldValueFor(
  definition: ProjectFieldDefinition,
  value: string,
): Record<string, unknown> {
  if (definition.dataType === "SINGLE_SELECT") {
    const option = definition.options.find(
      (o) => o.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (!option) {
      throw new ProjectFieldValueError(
        `"${value}" is not an option of ${definition.fieldName}. Available: ${definition.options.map((o) => o.name).join(", ")}`,
      );
    }
    return { singleSelectOptionId: option.id };
  }
  if (definition.dataType === "NUMBER") {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new ProjectFieldValueError(
        `${definition.fieldName} takes a number, not "${value}".`,
      );
    }
    return { number: parsed };
  }
  return { text: value };
}

/** Raised when a value cannot belong to the field it was aimed at. */
export class ProjectFieldValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFieldValueError";
  }
}

/**
 * Sets — or, with a null value, clears — one project field on one item.
 *
 * GitHub is the source of truth here as it is for dependencies: this
 * runs first, and only a success is written to the local database.
 */
export async function setProjectFieldValue(
  token: string,
  definition: ProjectFieldDefinition,
  projectItemId: string,
  value: string | null,
): Promise<void> {
  const shared = {
    projectId: definition.projectId,
    itemId: projectItemId,
    fieldId: definition.fieldId,
  };

  if (value === null || value.trim() === "") {
    await postGraphQL(token, CLEAR_FIELD_MUTATION, shared);
    return;
  }

  await postGraphQL(token, UPDATE_FIELD_MUTATION, {
    ...shared,
    value: fieldValueFor(definition, value),
  });
}
