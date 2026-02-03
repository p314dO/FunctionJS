# Get Functions

![](./images/1.png)

A lightweight AST-based function enumerator for JavaScript codebases, designed for **Whitebox Pentesting** and security-oriented code review.

This tool recursively parses a project and extracts all implemented function names along with their source files, presenting the results in a clean ASCII table.

---

## Purpose

During whitebox assessments, one of the first steps is understanding the application’s attack surface:

- Authentication handlers
- Token logic
- Input validation
- Business logic entry points

Instead of grepping blindly, this script uses AST parsing to reliably enumerate:

- Function declarations
- Arrow functions
- Function expressions
- Class methods
- Object methods

This provides a fast overview of the application’s logical structure and helps prioritize manual review.

---

## Approach

This tool uses:

- Node.js
- Acorn (JavaScript AST parser)
- acorn-walk

Rather than regex, it walks the Abstract Syntax Tree to accurately identify real functions.

---

## Supported Languages

Currently supported:

- JavaScript (.js, .mjs, .cjs)

JSX / TypeScript are not supported in this version  
(Babel support can be added easily if required).

---

## Installation (Step by Step)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/GetFunctionsJS.git
cd GetFunctionsJS
```

---

### 2. Initialize npm

Creates package.json:

```bash
npm init -y
```

---

### 3. Install dependencies

```bash
npm install acorn acorn-walk
```

This will create:

- node_modules/
- package-lock.json

---

### 4. Run the tool

From inside the target project or pass a path:

```bash
node list-functions.mjs .
```

Or:

```bash
node list-functions.mjs /path/to/target
```

---

## Output

The script displays:

- ASCII banner
- Table with Function Name and File

Example:

```
┌───────────────┬──────────────────────────────────────────────┐
│ Function Name │ File                                         │
├───────────────┼──────────────────────────────────────────────┤
│ verifyToken   │ src/controllers/auth-controllers.js          │
│ getUserToken  │ src/controllers/auth-controllers.js          │
│ validateEmail │ src/controllers/auth-controllers.js          │
└───────────────┴──────────────────────────────────────────────┘
```

---

## Pentesting Use Cases

- Initial whitebox reconnaissance
- Mapping authentication logic
- Locating validation functions
- Identifying crypto/token handlers
- Building call graphs
- Prioritizing manual review
- CTF / lab environments (HTB, etc.)

---

## Limitations

- JavaScript only
- No call graph generation
- No framework awareness (Express, Nest, etc.)

This is intentionally minimal and meant to be extended.

---

## Future Ideas

- JSX / TypeScript support
- Express route extraction
- Sink detection (eval, exec, child_process)
- CSV export
- Call graph generation

---

## Recommended .gitignore

```
node_modules/
package-lock.json
```

---

## Disclaimer

For educational and authorized security testing only.

---

## Author

Built for whitebox pentesting and secure code review.
