/**
 * The agent's tools. These stand in for the real research APIs — same shapes,
 * local data, plus a little latency so the app behaves like the real thing.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { type Company, companies, documents, financials } from "./data.ts";

/** Thrown when a tool cannot service a request. */
export class ToolError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const toolSchemas: Anthropic.Tool[] = [
  {
    name: "searchCompanies",
    description:
      "Search the coverage universe by company name or ticker. Returns the company name, ticker and sector for every match.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A company name, ticker, or part of one." },
      },
      required: ["query"],
    },
  },
  {
    name: "getCompanyProfile",
    description:
      "Get a company's profile: description, sector, headquarters, headcount, business segments and the filings we hold.",
    input_schema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Company name or ticker. If several companies match, the tool lists the candidates instead of guessing.",
        },
      },
      required: ["company"],
    },
  },
  {
    name: "getFinancials",
    description:
      "Get annual and quarterly financials for a company: revenue, gross margin, operating income, net income and free cash flow.",
    input_schema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Company name or ticker. If several companies match, the tool lists the candidates instead of guessing.",
        },
      },
      required: ["company"],
    },
  },
  {
    name: "searchDocuments",
    description:
      "Keyword search over earnings call transcripts, filing excerpts and press releases. The query is capped at 6 keywords; do not pass more than 6. Longer queries are rejected. Any shared word matches, and each hit includes the keywords that matched. If a company is set and nothing matches, the tool returns that company's document ids, titles, and total. To read the documents, use listDocuments.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "At most 6 keywords, separated by spaces. Queries with more than 6 keywords are rejected.",
        }, /* IDEA: why not just have the tool take in an array of terms, and then tell the agent it's max 6 */
        company: {
          type: "string",
          description:
            "Optional. Company name or ticker. If several companies match, the tool lists the candidates instead of searching.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "listDocuments",
    description:
      "List every research document we hold for one company, including the body. Use this to read what a company filed or said. The result includes a total and is the complete set. Keyword search only finds documents that contain the given words.",
    input_schema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Company name or ticker. If several companies match, the tool lists the candidates instead of documents.",
        },
      },
      required: ["company"],
    },
  },
];

function companyLabel(company: Company): string {
  return `${company.name} (${company.ticker})`;
}

function companiesMatching(needle: string): Company[] {
  return companies.filter(
    (c) => c.name.toLowerCase().includes(needle) || c.ticker.toLowerCase().includes(needle),
  );
}

/** One company whose name or ticker contains the input. Several matches are an error. */
function resolveCompany(input: string): Company {
  const needle = String(input).trim().toLowerCase();
  if (!needle) {
    throw new ToolError("company is required");
  }

  const matches = companiesMatching(needle);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new ToolError(`no company found for "${input}"`);
  }
  throw new ToolError(
    `"${input}" matches more than one company: ${matches.map(companyLabel).join(", ")}. Pass the full company name.`,
  );
}

/* IDEA: search by fuzzy matching the company name aka allow for regex searching */
async function searchCompanies(query: string) {
  // await sleep(250);
  const matches = companiesMatching(String(query).trim().toLowerCase());
  return matches.map((c) => ({
    name: c.name,
    ticker: c.ticker,
    sector: c.sector,
  }));
}

async function getCompanyProfile(company: string) {
  // await sleep(450);
  return resolveCompany(company);
}

/* IDEA: drop provenance section not useful */
async function getFinancials(company: string) {
  // await sleep(800);
  const match = resolveCompany(company);
  const record = financials.find((f) => f.company === match.name);
  if (!record) {
    throw new ToolError(`no financials found for "${match.name}"`);
  }
  return record;
}

async function listDocuments(company: string) {
  const match = resolveCompany(company);
  const docs = documents.filter((d) => d.company === match.name);
  return {
    company: match.name,
    ticker: match.ticker,
    total: docs.length,
    documents: docs,
  };
}

/* IDEA: tool for searching for documents related to filings a company has */
async function searchDocuments(query: string, company?: string) {
  // await sleep(700);

  const terms = String(query).trim().split(/\s+/).filter(Boolean);
  // The upstream document index rejects long queries.
  if (terms.length > 6) {
    throw new ToolError(
      `document search accepts at most 6 terms (received ${terms.length})`,
    );
  }

  const scoped = company?.trim() ? resolveCompany(company) : undefined;
  const pool = scoped ? documents.filter((d) => d.company === scoped.name) : documents;

  const scored = pool.map((doc) => {
    const haystack = `${doc.title} ${doc.body}`.toLowerCase(); /* IDEA: add the form and other fields in here as well */
    const matchedTerms = terms.filter((term) => haystack.includes(term.toLowerCase()));
    return { doc, score: matchedTerms.length, matchedTerms };
  });

  const hits = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (hits.length === 0 && scoped) {
    return {
      matches: [],
      total: pool.length,
      note: `No documents contain those keywords. ${scoped.name} has ${pool.length} documents on file. Use listDocuments to read them.`,
      documents: pool.map((d) => ({
        id: d.id,
        form: d.form,
        title: d.title,
        date: d.date,
      })),
    };
  }

  return hits.map((s) => ({ ...s.doc, matchedTerms: s.matchedTerms }));
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "searchCompanies":
      return searchCompanies(input.query as string);
    case "getCompanyProfile":
      return getCompanyProfile(input.company as string);
    case "getFinancials":
      return getFinancials(input.company as string);
    case "searchDocuments":
      return searchDocuments(input.query as string, input.company as string | undefined);
    case "listDocuments":
      return listDocuments(input.company as string);
    default:
      throw new ToolError(`unknown tool "${name}"`);
  }
}
