import * as prettier from "prettier/standalone";
import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import * as typescript from "prettier/plugins/typescript";
import * as html from "prettier/plugins/html";
import * as postcss from "prettier/plugins/postcss";
import * as markdown from "prettier/plugins/markdown";
import { SupportedLanguage } from "../types";

export interface FormatResult {
  success: boolean;
  formatted?: string;
  error?: string;
  changed: boolean;
}

// Ensure plugin objects are correctly resolved regardless of ESM / CommonJS wrapper
const resolvePlugin = (m: any) =>
  m && m.default && (m.default.parsers || m.default.printers || m.default.languages)
    ? m.default
    : m && (m.parsers || m.printers || m.languages)
    ? m
    : m?.default || m;

const pBabel = resolvePlugin(babel);
const pEstree = resolvePlugin(estree);
const pTypescript = resolvePlugin(typescript);
const pHtml = resolvePlugin(html);
const pPostcss = resolvePlugin(postcss);
const pMarkdown = resolvePlugin(markdown);

/**
 * Custom formatter for Python code:
 * - Normalizes indentation to standard 4 spaces (PEP 8)
 * - Cleans trailing whitespace on each line
 * - Normalizes consecutive blank lines (max 2 at top level, 1 inside functions)
 * - Adjusts spacing around operators, colons, and commas
 * - Ensures single newline at end of file
 */
function formatPythonCode(code: string): string {
  const lines = code.split(/\r?\n/);
  const result: string[] = [];
  let indentLevel = 0;
  let blankCount = 0;
  let inMultiLineString: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for multi-line string / docstring delimiters
    if (!inMultiLineString) {
      if (trimmed.startsWith('"""') && (trimmed.endsWith('"""') ? trimmed.length === 3 : true)) {
        inMultiLineString = '"""';
      } else if (trimmed.startsWith("'''") && (trimmed.endsWith("'''") ? trimmed.length === 3 : true)) {
        inMultiLineString = "'''";
      }
    } else {
      if (trimmed.includes(inMultiLineString)) {
        inMultiLineString = null;
      }
      result.push(rawLine.trimEnd());
      continue;
    }

    // Handle blank lines
    if (trimmed.length === 0) {
      if (result.length > 0 && blankCount < 2) {
        result.push("");
        blankCount++;
      }
      continue;
    }
    blankCount = 0;

    // Check for block outdent triggers (elif, else, except, finally, return, pass, break, continue)
    if (/^(elif|else|except|finally)\b/.test(trimmed) || /^[\)\]\}]/.test(trimmed)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    const indent = "    ".repeat(indentLevel);

    // Format commas and spacing around colons outside of comments
    let formattedLine = trimmed;
    if (!trimmed.startsWith("#")) {
      formattedLine = formattedLine
        .replace(/,\s*/g, ", ")
        .replace(/:\s*$/g, ":")
        .replace(/(?<=\w)\s*==\s*/g, " == ")
        .replace(/(?<=\w)\s*!=\s*/g, " != ")
        .replace(/(?<=\w)\s*<=\s*/g, " <= ")
        .replace(/(?<=\w)\s*>=\s*/g, " >= ");
    }

    result.push(indent + formattedLine);

    // Check for block indent triggers (lines ending with colon, ignoring inline comments)
    const codePart = trimmed.split("#")[0].trim();
    if (codePart.endsWith(":")) {
      indentLevel++;
    }
  }

  return result.join("\n").trimEnd() + "\n";
}

/**
 * Format JSON with standard 2-space indentation
 */
function formatJsonCode(content: string): string {
  const parsed = JSON.parse(content);
  return JSON.stringify(parsed, null, 2) + "\n";
}

/**
 * Automatically formats code based on its supported language.
 * Uses Prettier for JS, TS, HTML, CSS, JSON, Markdown, and custom PEP 8 formatter for Python.
 */
export async function formatCode(
  content: string,
  language: SupportedLanguage
): Promise<FormatResult> {
  if (!content || !content.trim()) {
    return { success: true, formatted: content, changed: false };
  }

  try {
    let formatted = "";

    switch (language) {
      case "javascript": {
        formatted = await prettier.format(content, {
          parser: "babel",
          plugins: [pBabel, pEstree],
          semi: true,
          singleQuote: false,
          tabWidth: 2,
          trailingComma: "es5",
          printWidth: 100,
        });
        break;
      }

      case "typescript": {
        formatted = await prettier.format(content, {
          parser: "typescript",
          plugins: [pTypescript, pEstree],
          semi: true,
          singleQuote: false,
          tabWidth: 2,
          trailingComma: "es5",
          printWidth: 100,
        });
        break;
      }

      case "html": {
        formatted = await prettier.format(content, {
          parser: "html",
          plugins: [pHtml],
          tabWidth: 2,
          printWidth: 100,
        });
        break;
      }

      case "css": {
        formatted = await prettier.format(content, {
          parser: "css",
          plugins: [pPostcss],
          tabWidth: 2,
          printWidth: 100,
        });
        break;
      }

      case "json": {
        try {
          formatted = formatJsonCode(content);
        } catch {
          formatted = await prettier.format(content, {
            parser: "json",
            plugins: [pBabel, pEstree],
            tabWidth: 2,
          });
        }
        break;
      }

      case "markdown": {
        formatted = await prettier.format(content, {
          parser: "markdown",
          plugins: [pMarkdown],
          tabWidth: 2,
          proseWrap: "preserve",
          printWidth: 100,
        });
        break;
      }

      case "python": {
        formatted = formatPythonCode(content);
        break;
      }

      default: {
        return { success: true, formatted: content, changed: false };
      }
    }

    const changed = formatted !== content;
    return {
      success: true,
      formatted,
      changed,
    };
  } catch (err: any) {
    const rawMessage = err?.message || String(err);
    // Extract a friendly, concise syntax error summary
    let friendlyError = rawMessage;
    const lines = rawMessage.split("\n");
    if (lines.length > 0 && lines[0]) {
      friendlyError = lines[0].replace(/^SyntaxError:\s*/i, "");
    }
    return {
      success: false,
      error: friendlyError,
      changed: false,
    };
  }
}
