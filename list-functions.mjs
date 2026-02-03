import fs from "fs";
import path from "path";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const ROOT = process.argv[2] ?? ".";
const SELF = path.resolve(process.argv[1]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "vendor",
  ".next",
  "coverage",
  "out"
]);

const exts = new Set([".js", ".mjs", ".cjs"]);

function* files(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* files(p);
    } else {
      if (exts.has(path.extname(ent.name))) yield p;
    }
  }
}

function banner() {
  console.log(String.raw`
 ███████╗██╗   ██╗███╗   ██╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗     ██╗███████╗
 ██╔════╝██║   ██║████╗  ██║██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║     ██║██╔════╝
 █████╗  ██║   ██║██╔██╗ ██║██║        ██║   ██║██║   ██║██╔██╗ ██║     ██║███████╗
 ██╔══╝  ██║   ██║██║╚██╗██║██║        ██║   ██║██║   ██║██║╚██╗██║██   ██║╚════██║
 ██║     ╚██████╔╝██║ ╚████║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║╚█████╔╝███████║
 ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚════╝ ╚══════╝
by p314d0
`);
}


function makeTable(rows) {
  const header1 = "Function Name";
  const header2 = "File";

  const col1w = Math.max(header1.length, ...rows.map(r => r.fn.length));
  const col2w = Math.max(header2.length, ...rows.map(r => r.file.length));

  const line = (l, m, r) => l + "─".repeat(col1w + 2) + m + "─".repeat(col2w + 2) + r;
  const row  = (a, b) => `│ ${a.padEnd(col1w)} │ ${b.padEnd(col2w)} │`;

  let out = "";
  out += line("┌", "┬", "┐") + "\n";
  out += row(header1, header2) + "\n";
  out += line("├", "┼", "┤") + "\n";
  for (const r of rows) out += row(r.fn, r.file) + "\n";
  out += line("└", "┴", "┘");

  return out;
}

const seen = new Set(); // "name\tfile" to dedupe
const rows = [];

for (const f of files(ROOT)) {
  if (path.resolve(f) === SELF) continue; // no auto-analizar el script

  const code = fs.readFileSync(f, "utf8");
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  } catch {
    // si quieres, puedes intentar sourceType:"script" como fallback
    continue;
  }

  const rel = path.relative(process.cwd(), f);

  function add(name) {
    if (!name) return;
    const key = `${name}\t${rel}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ fn: name, file: rel });
  }

  walk.simple(ast, {
    FunctionDeclaration(n) {
      add(n.id?.name);
    },
    VariableDeclarator(n) {
      // const foo = function() {}  OR  const foo = () => {}
      if (n.id?.type === "Identifier") {
        const name = n.id.name;
        if (n.init && (n.init.type === "FunctionExpression" || n.init.type === "ArrowFunctionExpression")) {
          add(name);
        }
      }
    },
    MethodDefinition(n) {
      // class A { bar() {} }
      if (n.key?.type === "Identifier") add(n.key.name);
    },
    Property(n) {
      // { foo() {} } o { foo: () => {} }
      if (n.value && (n.value.type === "FunctionExpression" || n.value.type === "ArrowFunctionExpression")) {
        if (n.key?.type === "Identifier") add(n.key.name);
      }
    }
  });
}

// ordenar por nombre, luego por archivo
rows.sort((a, b) => a.fn.localeCompare(b.fn) || a.file.localeCompare(b.file));

banner();
if (rows.length === 0) {
  console.log("No functions found (or all files failed to parse).");
} else {
  console.log(makeTable(rows));
}