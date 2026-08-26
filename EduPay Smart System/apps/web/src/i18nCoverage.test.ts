import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const SCANNED_DIRS = ["pages", "components"];
const VISIBLE_ATTRIBUTES = new Set(["placeholder", "title", "aria-label", "alt"]);
const ALLOWED_LITERALS = new Set(["FR", "EN", "SMS", "USD", "KCS", "EduPay", "SAVANEX", "Excel", "PDF", "IA", "AI", "Mobile Money"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx|jsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

function meaningful(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return /[A-Za-zÀ-ÿ]{2}/.test(text) && !ALLOWED_LITERALS.has(text) ? text : "";
}

function violations(file: string) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = meaningful(node.getText(source));
      if (text) found.push(`${relative(SOURCE_ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} text “${text}”`);
    }
    if (ts.isJsxAttribute(node) && VISIBLE_ATTRIBUTES.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const text = meaningful(node.initializer.text);
      if (text) found.push(`${relative(SOURCE_ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${node.name.getText(source)} “${text}”`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("EduPay bilingual UI coverage", () => {
  it("does not allow untranslated visible JSX literals", () => {
    const filter = process.env.I18N_COVERAGE_FILE;
    const files = SCANNED_DIRS.flatMap((directory) => sourceFiles(join(SOURCE_ROOT, directory)))
      .filter((file) => !filter || file.endsWith(filter));
    const found = files.flatMap(violations);
    expect(found, found.join("\n")).toEqual([]);
  });
});
