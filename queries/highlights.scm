; HolyC syntax highlighting
; Capture names follow the tree-sitter / nvim-treesitter conventions.

; ---------------------------------------------------------------------------
; Comments
; ---------------------------------------------------------------------------
(comment) @comment @spell

; ---------------------------------------------------------------------------
; Types
; ---------------------------------------------------------------------------
(primitive_type) @type.builtin
(type_identifier) @type

; ---------------------------------------------------------------------------
; Functions
; ---------------------------------------------------------------------------
(function_declarator
  declarator: (identifier) @function)
(function_declarator
  declarator: (pointer_declarator
    declarator: (identifier) @function))

(call_expression
  function: (identifier) @function.call)
(call_expression
  function: (field_expression
    field: (field_identifier) @function.call))

; ---------------------------------------------------------------------------
; Parameters, properties, members
; ---------------------------------------------------------------------------
(parameter_declaration
  declarator: (identifier) @variable.parameter)
(parameter_declaration
  declarator: (pointer_declarator
    declarator: (identifier) @variable.parameter))
(parameter_declaration
  declarator: (array_declarator
    declarator: (identifier) @variable.parameter))

(field_identifier) @property
(property_identifier) @property
(designated_initializer
  designator: (field_identifier) @property)

; ---------------------------------------------------------------------------
; Labels
; ---------------------------------------------------------------------------
(labeled_statement
  label: (statement_identifier) @label)
(goto_statement
  label: (statement_identifier) @label)

; ---------------------------------------------------------------------------
; Literals
; ---------------------------------------------------------------------------
(string_literal) @string
(string_content) @string
(system_lib_string) @string
(escape_sequence) @string.escape
(char_literal) @character
(character) @character
(number_literal) @number

; ---------------------------------------------------------------------------
; Preprocessor
; ---------------------------------------------------------------------------
"#" @keyword.directive
"include" @keyword.directive
"define" @keyword.directive
"undef" @keyword.directive
(preproc_directive
  directive: _ @keyword.directive)
(preproc_arg) @constant.macro
(preproc_define
  name: (identifier) @constant.macro)
(preproc_function_def
  name: (identifier) @function.macro)
(preproc_params
  (identifier) @variable.parameter)
(preproc_undef
  name: (identifier) @constant.macro)

; ---------------------------------------------------------------------------
; Keywords
; ---------------------------------------------------------------------------
[
  "if"
  "else"
  "switch"
  "sub_switch"
  "case"
  "default"
  "start"
  "end"
] @keyword.conditional

[
  "for"
  "while"
  "do"
] @keyword.repeat

[
  "break"
  "goto"
  "return"
] @keyword.return

[
  "try"
  "catch"
  "throw"
] @keyword.exception

[
  "class"
  "union"
] @keyword.type

[
  "public"
  "extern"
  "_extern"
] @keyword.modifier

[
  "lock"
  "no_warn"
] @keyword

[
  "sizeof"
  "offset"
] @keyword.operator

(lastclass) @constant.builtin

; ---------------------------------------------------------------------------
; Operators & punctuation
; ---------------------------------------------------------------------------
[
  "+" "-" "*" "/" "%"
  "=" "+=" "-=" "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>="
  "++" "--"
  "==" "!=" "<" ">" "<=" ">="
  "&&" "||" "^^" "!"
  "&" "|" "^" "~" "<<" ">>"
  "`"
  "."
  "->"
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ";"
  ":"
  "..."
] @punctuation.delimiter

; ---------------------------------------------------------------------------
; Storage classes (reg / noreg)
; ---------------------------------------------------------------------------
[
  "reg"
  "noreg"
] @keyword.modifier

; The physical register a `reg <REG> x` variable is pinned to.
(register_name (identifier) @variable.builtin)

; ---------------------------------------------------------------------------
; Inline assembly
; ---------------------------------------------------------------------------
"asm" @keyword

; The architecture qualifier on a non-default block: `asm arm64 { … }`.
(asm_arch) @keyword

; Instruction mnemonics (mov, add, imul, …).
(asm_instruction
  mnemonic: (asm_mnemonic) @function.builtin)

; Register-name operands (rax, x0, sp, …), distinguished from variables by name.
(asm_instruction
  operand: (identifier) @variable.builtin
  (#match? @variable.builtin "^(r[a-z]x|r[a-z]i|r[a-z]p|r[0-9]+|[xw][0-9]+|sp|xzr)$"))

; ---------------------------------------------------------------------------
; Variables (lowest priority, so the more specific rules above win)
; ---------------------------------------------------------------------------
(identifier) @variable
