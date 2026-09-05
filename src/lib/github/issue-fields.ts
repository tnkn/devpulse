import type { ProjectFieldDefinition } from "@/types";
import { matchFieldKind } from "./field-names";
import { postGraphQL } from "./projects";

/**
 * GitHub's native issue fields, which are not Projects v2.
 *
 * Every organisation gets Priority, Effort, Start date and Target date on
 * the issue itself, independent of any board. A repository can therefore
 * have a perfectly readable Size on a project board and a Priority that
 * lives here, which is exactly the shape that made Priority look broken:
 * we were only ever reading boards.
 *
 * Read separately from Projects rather than folded into that query
 * because they are separate APIs with separate failure modes — a token
 * that cannot see Projects can still read these — and one query failing
 * should not take the other's values down with it.
 */

const ISSUES_PER_PAGE = 50;
/**
 * An issue carries one value per field its organisation defines, so this
 * is a count of fields rather than of anything unbounded. totalCount is
 * read back to say so out loud when a repository outgrows it.
 */
const VALUES_PER_ISSUE = 50;
const MAX_PAGES = 100;

/**
 * Every value type is selected explicitly.
 *
 * `value` cannot be selected once across the union: it is String! on
 * text, single select and date, Float! on number, and nullable String on
 * multi select, and GraphQL rejects one response key with two types. So
 * each shape gets its own alias.
 *
 * The field's *name* comes from IssueFieldValueCommon.field, the only
 * member the interface has. Note IssueFieldCommon carries name and
 * dataType but NOT id — id exists only on the concrete field types — so
 * anything needing the id has to name them one by one.
 */
const ISSUE_FIELD_VALUES_QUERY = `
query IssueFieldValues($owner: String!, $name: String!, $cursor: String, $since: DateTime) {
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
        viewerCanSetFields
        issueFieldValues(first: ${VALUES_PER_ISSUE}) {
          totalCount
          nodes {
            __typename
            ... on IssueFieldValueCommon {
              field {
                __typename
                ... on IssueFieldCommon { name dataType }
                ... on IssueFieldSingleSelect { id }
                ... on IssueFieldNumber { id }
                ... on IssueFieldText { id }
                ... on IssueFieldDate { id }
                ... on IssueFieldMultiSelect { id }
              }
            }
            ... on IssueFieldSingleSelectValue { singleSelect: name optionId }
            ... on IssueFieldNumberValue { number: value }
            ... on IssueFieldTextValue { text: value }
            ... on IssueFieldDateValue { date: value }
            ... on IssueFieldMultiSelectValue { multi: value }
          }
        }
      }
    }
  }
}`;

interface FieldNode {
  __typename?: string;
  name?: string | null;
  dataType?: string | null;
  id?: string | null;
}

interface ValueNode {
  __typename: string;
  field?: FieldNode | null;
  singleSelect?: string | null;
  optionId?: string | null;
  number?: number | null;
  text?: string | null;
  date?: string | null;
  multi?: string | null;
}

interface IssueNode {
  number: number;
  viewerCanSetFields?: boolean | null;
  issueFieldValues?: {
    totalCount: number;
    nodes: (ValueNode | null)[];
  } | null;
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

/** One issue field's value, as read off an issue. */
export interface IssueFieldValue {
  fieldName: string;
  /** GitHub's IssueFieldDataType: SINGLE_SELECT, NUMBER, TEXT, DATE, MULTI_SELECT. */
  dataType: string;
  fieldId: string | null;
  /** What to show. Null when the field is present but unset. */
  display: string | null;
  /** Set only for a single select, and needed to write one back. */
  optionId: string | null;
}

export interface IssueFields {
  values: IssueFieldValue[];
  /** GitHub's own answer to whether this issue's fields can be edited. */
  canSet: boolean;
}

/** Reads the display value out of whichever value shape came back. */
function displayValue(node: ValueNode): string | null {
  switch (node.__typename) {
    case "IssueFieldSingleSelectValue":
      return node.singleSelect ?? null;
    case "IssueFieldNumberValue":
      // Float in the schema, but an effort of 3 should read "3", not
      // "3.0"; only a genuinely fractional value keeps its decimals.
      return node.number === null || node.number === undefined
        ? null
        : String(node.number);
    case "IssueFieldTextValue":
      return node.text?.trim() || null;
    case "IssueFieldDateValue":
      return node.date?.trim() || null;
    case "IssueFieldMultiSelectValue":
      return node.multi?.trim() || null;
    default:
      // A value type added after this was written: skipped rather than
      // guessed at, and named in the log so it can be added.
      console.warn(`[issue-fields] Unhandled value type ${node.__typename}`);
      return null;
  }
}

function extract(issue: IssueNode): IssueFields {
  const values: IssueFieldValue[] = [];
  const total = issue.issueFieldValues?.totalCount ?? 0;
  const nodes = issue.issueFieldValues?.nodes ?? [];
  if (total > nodes.length) {
    console.warn(
      `[issue-fields] Issue #${issue.number} has ${total} field values but only ${nodes.length} were read; raise VALUES_PER_ISSUE.`,
    );
  }
  for (const node of nodes) {
    const fieldName = node?.field?.name;
    if (!node || !fieldName) continue;
    values.push({
      fieldName,
      dataType: node.field?.dataType ?? "",
      fieldId: node.field?.id ?? null,
      display: displayValue(node),
      optionId: node.optionId ?? null,
    });
  }
  return { values, canSet: issue.viewerCanSetFields === true };
}

/**
 * Issue field values for every issue in a repository, keyed by number.
 *
 * Returns an empty map rather than throwing when the API does not know
 * these types: issue fields are newer than much of what this reads, and
 * a GitHub Enterprise Server that predates them should cost nothing more
 * than an empty Priority column.
 */
export async function fetchIssueFields(
  owner: string,
  repo: string,
  token: string,
  since?: string,
): Promise<Map<number, IssueFields>> {
  const byNumber = new Map<number, IssueFields>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    // Annotated rather than inferred: cursor is read from the previous
    // response and passed into the next call, so leaving the type to
    // inference makes body depend on itself.
    let body: QueryResponse;
    try {
      body = await postGraphQL<QueryResponse>(token, ISSUE_FIELD_VALUES_QUERY, {
        owner,
        name: repo,
        cursor,
        since: since ?? null,
      });
    } catch (err) {
      // Never fatal. Issue fields are a second, independent source, and
      // a failure here must not take down the Projects values collected
      // alongside them — a repository whose Size lives on a board should
      // not lose it because the issue-field query was refused, or
      // because this GitHub is old enough not to have the types at all.
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[issue-fields] Could not read issue fields, leaving them empty: ${message}`,
      );
      return byNumber;
    }

    const issues = body.data?.repository?.issues;
    if (!issues) break;
    for (const issue of issues.nodes) {
      if (!issue) continue;
      byNumber.set(issue.number, extract(issue));
    }
    if (!issues.pageInfo.hasNextPage) break;
    cursor = issues.pageInfo.endCursor;
    if (!cursor) break;
  }

  return byNumber;
}

/**
 * The first issue-field value whose name reads as the wanted kind and
 * actually holds something.
 *
 * A field that exists but is unset is skipped rather than returned as
 * null, so a board value can still fill the gap: an issue with an empty
 * native Priority and a Priority on a board should show the board's.
 */
export function pickField(
  fields: IssueFields | undefined,
  matches: RegExp,
): string | null {
  if (!fields) return null;
  for (const value of fields.values) {
    if (value.display && matches.test(value.fieldName)) return value.display;
  }
  return null;
}

/**
 * The native issue fields seen across a repository, as field definitions.
 *
 * Stored next to the board definitions so the rest of the app can ask
 * one question — "is there a Priority anywhere?" — instead of every
 * caller having to know there are two APIs. `source` keeps them
 * distinguishable, because only the board ones can be edited so far.
 *
 * There is no per-repository listing of these: an organisation defines
 * them, and a repository only ever shows the ones its issues carry. So
 * they are gathered from the values just read, which means a field no
 * issue has ever held stays invisible — an acceptable gap, since a field
 * nothing uses has nothing to display either.
 */
export function issueFieldDefinitions(
  byNumber: Map<number, IssueFields>,
): ProjectFieldDefinition[] {
  const seen = new Map<string, ProjectFieldDefinition>();
  for (const fields of byNumber.values()) {
    for (const value of fields.values) {
      const kind = matchFieldKind(value.fieldName);
      if (!kind) continue;
      const id = value.fieldId ?? value.fieldName;
      if (seen.has(id)) continue;
      seen.set(id, {
        // Not a board, but the pair still has to be unique: these share
        // a table with the board definitions, whose key is (project, field).
        projectId: "issue-fields",
        projectTitle: "Issue fields",
        fieldId: id,
        fieldName: value.fieldName,
        kind,
        dataType: value.dataType,
        source: "issue-field",
        // Left empty deliberately: reading a value tells us nothing about
        // which other options the field offers, and inventing a list from
        // the values seen would offer a picker that silently omits any
        // option nobody has used yet.
        options: [],
      });
    }
  }
  return [...seen.values()];
}
