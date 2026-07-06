# tree-sitter-holyc

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
**HolyC**, the language of the [`holyc`](https://github.com/project-solomon/holyc)
toolchain — a host-targeting dialect that stays close to Terry Davis's HolyC.

The grammar is derived directly from the compiler front end: the lexer in
`hcc/token` and the recursive-descent parser in `hcc/parser.go` are the source of
truth for its tokens, operator precedence, and statement forms.

## What it covers

- The HolyC type set — `U0`–`U64`, `I0`–`I64`, `F64` — plus pointers, arrays,
  `class` / `union` (with inheritance, anonymous members, and member metadata).
- Function definitions, including HolyC's **default return type** (`Foo() {…}`),
  default arguments, varargs, and function pointers.
- All statement forms: `if`/`else`, `while`, `do`/`while`, `for`, `switch` /
  `sub_switch` (with `case lo ... hi:` ranges, numberless auto-`case:`, and
  `start:` / `end:` markers), `goto` + labels, `try`/`catch`/`throw`, `lock`,
  `no_warn`, and `break`/`return`.
- **Inline assembly** — `asm { … }` (bare = amd64) with an optional
  architecture qualifier before the block (`asm arm64 { … }`, `asm riscv64`,
  `asm ppc64le`, `asm s390x`, …). The qualifier is any identifier — the grammar
  does not fix the set, so new target architectures need no grammar change.
- The **`reg` / `noreg` storage classes** on function locals, including a pinned
  physical register (`I64 reg R15 i, noreg j;`).
- The HolyC **inline-print statement** (`"%d\n", x;`) as an ordinary comma
  expression.
- HolyC's own operator-precedence table (the bitwise operators bind tighter than
  `+`/`-`, `*`/`/`/`%` bind tighter than the shifts, and `` ` `` is
  right-associative exponentiation), `sizeof`, `offset`, and casts.
- Line-based preprocessor directives: `#include`, `#define`, `#undef`, and the
  conditional / `#exe` family.

Every `.HC` file in the upstream compiler's conformance suite and resident
prelude parses with zero errors.

## Usage

This repository is a standard tree-sitter grammar. The generated parser lives in
`src/`, queries in `queries/`, and language bindings (C, Go, Node, Rust) in
`bindings/`.

```sh
# Regenerate the parser from grammar.js
npm install
npx tree-sitter generate

# Run the test corpus
npx tree-sitter test

# Parse a file
npx tree-sitter parse path/to/program.HC
```

### Queries

| File | Purpose |
| --- | --- |
| `queries/highlights.scm` | Syntax highlighting |
| `queries/injections.scm` | Language injections (none — HolyC embeds no other language) |
| `queries/locals.scm` | Scopes, definitions, references |
| `queries/indents.scm` | Indentation |
| `queries/tags.scm` | Code navigation tags / outline |

The capture names follow the tree-sitter / nvim-treesitter conventions, so the
grammar works out of the box with Neovim and Helix. Editor-specific query files
(for example Zed's) live with their respective extensions.

## Editors

- **Zed** — see the companion extension in
  [`zed-holyc`](../zed-holyc), which builds this grammar and ships Zed-tuned
  queries.

## License

[MIT](LICENSE) © 2026 Adam Soph
