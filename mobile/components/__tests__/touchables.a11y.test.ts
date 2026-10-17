import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Static a11y gate: every touchable in app/ and components/ must declare an
// accessibilityRole (or opt out with accessible={false}), and touchables with no
// visible text (icon/glyph/backdrop only) must also carry an accessibilityLabel.

const ROOT = path.resolve(__dirname, "..", "..");
const TOUCHABLES = new Set([
  "Pressable",
  "AnimatedPressable",
  "TouchableOpacity",
  "TouchableHighlight",
  "TouchableWithoutFeedback",
]);
// Components that render visible text from these props.
const TEXT_PROPS = /^(label|title|text|name|message)$/i;
const TEXT_TAGS = new Set(["Text", "Typo", "AnimatedNumber"]);

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "__tests__")
      continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listTsx(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function attr(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name
  );
}

function hasVisibleText(children: readonly ts.JsxChild[]): boolean {
  for (const child of children) {
    if (ts.isJsxText(child) && child.text.trim()) return true;
    if (ts.isJsxExpression(child) && child.expression) {
      // {label}, {`${n}`}, {cond && <Text/>} — expressions that may render text.
      let found = false;
      const visit = (n: ts.Node) => {
        if (found) return;
        if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
          const open = ts.isJsxElement(n) ? n.openingElement : n;
          if (TEXT_TAGS.has(tagName(open)) || /Text$/.test(tagName(open))) found = true;
          else if (ts.isJsxElement(n) && hasVisibleText(n.children)) found = true;
          return;
        }
        if (ts.isStringLiteral(n) || ts.isTemplateExpression(n)) found = true;
        ts.forEachChild(n, visit);
      };
      visit(child.expression);
      if (found) return true;
    }
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const open = ts.isJsxElement(child) ? child.openingElement : child;
      const name = tagName(open);
      if (TEXT_TAGS.has(name) || /Text$/.test(name)) return true;
      const textProp = open.attributes.properties.some(
        (p) => ts.isJsxAttribute(p) && TEXT_PROPS.test(p.name.getText())
      );
      if (textProp && !/Icon/.test(name)) return true;
      if (ts.isJsxElement(child) && hasVisibleText(child.children)) return true;
    }
  }
  return false;
}

interface Finding {
  where: string;
  problem: "no-role" | "no-label";
}

function scan(): { total: number; findings: Finding[] } {
  const files = listTsx(path.join(ROOT, "app")).concat(
    listTsx(path.join(ROOT, "components"))
  );
  const findings: Finding[] = [];
  let total = 0;
  for (const file of files) {
    const src = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const open = ts.isJsxElement(node) ? node.openingElement : node;
        if (TOUCHABLES.has(tagName(open))) {
          total++;
          const line = src.getLineAndCharacterOfPosition(open.getStart()).line + 1;
          const where = `${path.relative(ROOT, file).replace(/\\/g, "/")}:${line}`;
          const accessible = attr(open, "accessible");
          const optedOut = accessible?.initializer?.getText() === "{false}";
          if (!optedOut) {
            if (!attr(open, "accessibilityRole") && !attr(open, "role")) {
              findings.push({ where, problem: "no-role" });
            }
            const children = ts.isJsxElement(node)
              ? node.children
              : ([] as ts.JsxChild[]);
            if (!hasVisibleText(children) && !attr(open, "accessibilityLabel")) {
              findings.push({ where, problem: "no-label" });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return { total, findings };
}

describe("touchable accessibility (static)", () => {
  const { total, findings } = scan();

  it("finds the app's touchables", () => {
    expect(total).toBeGreaterThan(50);
  });

  it("every touchable declares an accessibilityRole", () => {
    expect(findings.filter((f) => f.problem === "no-role").map((f) => f.where)).toEqual(
      []
    );
  });

  it("every icon-only / glyph / backdrop touchable has an accessibilityLabel", () => {
    expect(findings.filter((f) => f.problem === "no-label").map((f) => f.where)).toEqual(
      []
    );
  });
});
