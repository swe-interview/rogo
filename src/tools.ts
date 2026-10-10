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
      "Get annual financials for a company: revenue, year-over-year revenue growth, gross margin, operating income, operating margin, net income and free cash flow. Quarters are a fixed seasonal split of the annual number, not independent evidence; omit them unless the question is about a specific quarter.",
    input_schema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Company name or ticker. If several companies match, the tool lists the candidates instead of guessing.",
        },
        includeQuarterly: {
          type: "boolean",
          description:
            "Include quarterly figures. Default false. Only set this when the question asks about a quarter.",
        },
      },
      required: ["company"],
    },
  },
  {
    name: "searchDocuments",
    description:
      "Keyword search over earnings call transcripts, filing excerpts and press releases. Matches title, body, form, and date, so keywords can be a form like 8-K or a filing date. The query is capped at 6 keywords; do not pass more than 6. Longer queries are rejected. Any shared word matches, and each hit includes the keywords that matched. If a company is set and nothing matches, the tool returns that company's document ids, titles, and total. To read the documents, use listDocuments.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "At most 6 keywords, separated by spaces. Queries with more than 6 keywords are rejected.",
        },
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
      "List every research document we hold for one company, including the body. Use this to read what a company filed or said. The result includes a total and is the complete text we hold for that company. Do not follow it with a keyword search of the same company; search will not uncover additional documents or text.",
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
    throw new ToolError("company is required. Pass a company name or ticker.");
  }

  const matches = companiesMatching(needle);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    /* IDEA: I guess this isn't great advice b/c search companies uses the same logic - maybe we could have a list companies tool instead which
    gives you the "coverage universe" blob at the top of the system prompt */
    throw new ToolError(
      `no company found for "${input}". Call searchCompanies with part of the name, then retry with the exact name or ticker.`,
    );
  }
  throw new ToolError(
    `"${input}" matches more than one company: ${matches.map(companyLabel).join(", ")}. Pass one of those full names.`,
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

function round(n: number, places = 3): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

async function getFinancials(company: string, includeQuarterly = false) {
  // await sleep(800);
  const match = resolveCompany(company);
  const record = financials.find((f) => f.company === match.name);
  if (!record) {
    throw new ToolError(
      `no financials found for "${match.name}". There is no financial record on file for this company.`,
    );
  }

  const annual = record.annual.map((row, i) => {
    const prev = i > 0 ? record.annual[i - 1] : undefined;
    const revenueGrowth =
      row.revenue != null && prev?.revenue != null && prev.revenue !== 0
        ? round((row.revenue - prev.revenue) / prev.revenue)
        : null;
    const operatingMargin =
      row.revenue != null && row.operatingIncome != null && row.revenue !== 0
        ? round(row.operatingIncome / row.revenue)
        : null;
    return { ...row, revenueGrowth, operatingMargin };
  });

  return {
    company: record.company,
    ticker: record.ticker,
    currency: record.currency,
    unit: record.unit,
    annual,
    ...(includeQuarterly ? { quarterly: record.quarterly } : {}),
    ...(record.warnings ? { warnings: record.warnings } : {}),
  };
}

async function listDocuments(company: string) {
  // await sleep(700);
  const match = resolveCompany(company);
  const docs = documents.filter((d) => d.company === match.name);
  return {
    company: match.name,
    ticker: match.ticker,
    total: docs.length,
    documents: docs,
  };
}

async function searchDocuments(query: string, company?: string) {
  // await sleep(700);

  const terms = String(query).trim().split(/\s+/).filter(Boolean);
  // The upstream document index rejects long queries.
  if (terms.length > 6) {
    throw new ToolError(
      `document search accepts at most 6 terms (received ${terms.length}). Retry with at most 6 keywords, or call listDocuments for that company.`,
    );
  }

  const scoped = company?.trim() ? resolveCompany(company) : undefined;
  const pool = scoped ? documents.filter((d) => d.company === scoped.name) : documents;

  const scored = pool.map((doc) => {
    const haystack = `${doc.form} ${doc.date} ${doc.title} ${doc.body}`.toLowerCase();
    const matchedTerms = terms.filter((term) => haystack.includes(term.toLowerCase()));
    return { doc, score: matchedTerms.length, matchedTerms };
  });

  const hits = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); /* IDEA: allow the agent to request more results */

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
      return getFinancials(input.company as string, Boolean(input.includeQuarterly));
    case "searchDocuments":
      return searchDocuments(input.query as string, input.company as string | undefined);
    case "listDocuments":
      return listDocuments(input.company as string);
    default:
      throw new ToolError(
        `unknown tool "${name}". Use searchCompanies, getCompanyProfile, getFinancials, searchDocuments, or listDocuments.`,
      );
  }
}
