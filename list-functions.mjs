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

function nodePos(node) {
  const line = node?.loc?.start?.line ?? "?";
  const col = (node?.loc?.start?.column ?? 0) + 1; // 1-based (humano)
  return { line, col };
}

function makeFunctionsTable(rows) {
  const headers = ["Function Name", "File", "Line", "Col"];

  const w1 = Math.max(headers[0].length, ...rows.map(r => r.fn.length));
  const w2 = Math.max(headers[1].length, ...rows.map(r => r.fileLink.length));
  const w3 = Math.max(headers[2].length, ...rows.map(r => String(r.line).length));
  const w4 = Math.max(headers[3].length, ...rows.map(r => String(r.col).length));

  const line = (l, a, b, c, r) =>
    l +
    "─".repeat(w1 + 2) + a +
    "─".repeat(w2 + 2) + b +
    "─".repeat(w3 + 2) + c +
    "─".repeat(w4 + 2) + r;

  const row = (a, b, c, d) =>
    `│ ${String(a).padEnd(w1)} │ ${String(b).padEnd(w2)} │ ${String(c).padEnd(w3)} │ ${String(d).padEnd(w4)} │`;

  let out = "";
  out += line("┌", "┬", "┬", "┬", "┐") + "\n";
  out += row(headers[0], headers[1], headers[2], headers[3]) + "\n";
  out += line("├", "┼", "┼", "┼", "┤") + "\n";
  for (const r of rows) out += row(r.fn, r.fileLink, r.line, r.col) + "\n";
  out += line("└", "┴", "┴", "┴", "┘");
  return out;
}

function makeSinksTable(rows) {
  const headers = ["Sink", "File", "Line", "Col"];

  const w1 = Math.max(headers[0].length, ...rows.map(r => r.sink.length));
  const w2 = Math.max(headers[1].length, ...rows.map(r => r.fileLink.length));
  const w3 = Math.max(headers[2].length, ...rows.map(r => String(r.line).length));
  const w4 = Math.max(headers[3].length, ...rows.map(r => String(r.col).length));

  const line = (l, a, b, c, r) =>
    l +
    "─".repeat(w1 + 2) + a +
    "─".repeat(w2 + 2) + b +
    "─".repeat(w3 + 2) + c +
    "─".repeat(w4 + 2) + r;

  const row = (a, b, c, d) =>
    `│ ${String(a).padEnd(w1)} │ ${String(b).padEnd(w2)} │ ${String(c).padEnd(w3)} │ ${String(d).padEnd(w4)} │`;

  let out = "";
  out += line("┌", "┬", "┬", "┬", "┐") + "\n";
  out += row(headers[0], headers[1], headers[2], headers[3]) + "\n";
  out += line("├", "┼", "┼", "┼", "┤") + "\n";
  for (const r of rows) out += row(r.sink, r.fileLink, r.line, r.col) + "\n";
  out += line("└", "┴", "┴", "┴", "┘");
  return out;
}

// ---------- Collectors ----------
const fnSeen = new Set();    // "name\tfile\tline\tcol"
const fnRows = [];           // { fn, file, fileLink, line, col }

const sinkSeen = new Set();  // "sink\tfile\tline\tcol"
const sinkRows = [];         // { sink, file, fileLink, line, col }

for (const f of files(ROOT)) {
  if (path.resolve(f) === SELF) continue; // no auto-analizar el script

  const code = fs.readFileSync(f, "utf8");
  let ast;

  // parse module primero, fallback a script
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true
    });
  } catch {
    try {
      ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "script",
        locations: true
      });
    } catch {
      continue;
    }
  }

  const rel = path.relative(process.cwd(), f);

  function addFn(name, nodeForLoc) {
    if (!name) return;
    const { line, col } = nodePos(nodeForLoc);

    // Link clickeable para VS Code / terminal: file:line:col
    const fileLink = `${rel}:${line}:${col}`;

    const key = `${name}\t${rel}\t${line}\t${col}`;
    if (fnSeen.has(key)) return;
    fnSeen.add(key);

    fnRows.push({ fn: name, file: rel, fileLink, line, col });
  }

  function addSink(sinkName, nodeForLoc) {
    const { line, col } = nodePos(nodeForLoc);
    const fileLink = `${rel}:${line}:${col}`;

    const key = `${sinkName}\t${rel}\t${line}\t${col}`;
    if (sinkSeen.has(key)) return;
    sinkSeen.add(key);

    sinkRows.push({ sink: sinkName, file: rel, fileLink, line, col });
  }

  walk.simple(ast, {
    // --- Function enumeration (con line/col) ---
    FunctionDeclaration(n) {
      // mejor saltar al "function ..." que al id a veces; ambos sirven
      addFn(n.id?.name, n.id ?? n);
    },
    VariableDeclarator(n) {
      // const foo = function() {}  OR  const foo = () => {}
      if (n.id?.type === "Identifier") {
        const name = n.id.name;
        if (n.init && (n.init.type === "FunctionExpression" || n.init.type === "ArrowFunctionExpression")) {
          addFn(name, n.id); // salta al nombre foo
        }
      }
    },
    MethodDefinition(n) {
      // class A { bar() {} }
      if (n.key?.type === "Identifier") addFn(n.key.name, n.key);
    },
    Property(n) {
      // { foo() {} } o { foo: () => {} }
      if (n.value && (n.value.type === "FunctionExpression" || n.value.type === "ArrowFunctionExpression")) {
        if (n.key?.type === "Identifier") addFn(n.key.name, n.key);
      }
    },

    // --- Sink detection: eval(...) ---
    CallExpression(n) {
      // Direct call only: eval(...)
      // Evita obj.eval(...) y something["eval"](...)
      if (n.callee?.type === "Identifier" && n.callee.name === "eval") {
        addSink("eval()", n);
      }
    }
  });
}

// ordenar outputs
fnRows.sort(
  (a, b) =>
    a.fn.localeCompare(b.fn) ||
    a.file.localeCompare(b.file) ||
    (a.line - b.line) ||
    (a.col - b.col)
);

sinkRows.sort(
  (a, b) =>
    a.sink.localeCompare(b.sink) ||
    a.file.localeCompare(b.file) ||
    (a.line - b.line) ||
    (a.col - b.col)
);

// ---------- Print ----------
banner();

if (fnRows.length === 0) {
  console.log("No functions found (or all files failed to parse).");
} else {
  console.log(makeFunctionsTable(fnRows));
}

console.log("");

if (sinkRows.length === 0) {
  console.log("No sinks found.");
} else {
  console.log(makeSinksTable(sinkRows));
}
