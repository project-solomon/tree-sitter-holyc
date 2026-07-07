/**
 * @file HolyC grammar for tree-sitter
 * @author project-solomon
 * @license MIT
 *
 * Modelled on the HolyC dialect implemented by the `holyc` compiler
 * (github.com/project-solomon/holyc): the lexer in hcc/token and the
 * recursive-descent parser in hcc/parser.go are the source of truth for the
 * tokens, operator precedence, and statement forms encoded here.
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// HolyC's operator precedence (see hcc/parser.go infixOp): a few tiers differ
// from C — the bitwise operators sit *above* `+`/`-`, and `*`/`/`/`%` bind
// tighter than the shifts. Higher number binds tighter.
const PREC = {
  COMMA: -1,
  ASSIGN: 1,
  LOGICAL_OR: 2, // ||
  LOGICAL_XOR: 3, // ^^
  LOGICAL_AND: 4, // &&
  EQUAL: 5, // == !=
  RELATIONAL: 6, // < > <= >=
  ADD: 7, // + -
  BIT_OR: 8, // |
  BIT_XOR: 9, // ^
  BIT_AND: 10, // &
  MULTIPLY: 11, // * / %
  SHIFT: 12, // << >>
  POW: 13, // ` (right-assoc exponentiation)
  CAST: 14,
  UNARY: 15,
  POSTFIX: 16,
  CALL: 17,
  FIELD: 18,
  SUBSCRIPT: 18,
};

const PRIMITIVE_TYPES = [
  'U0', 'I0', 'I8', 'U8', 'I16', 'U16', 'I32', 'U32', 'I64', 'U64', 'F64',
];

module.exports = grammar({
  name: 'holyc',

  word: $ => $.identifier,

  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  supertypes: $ => [
    $._expression,
    $._statement,
    $._declarator,
    $._type_specifier,
  ],

  inline: $ => [
    $._top_level_item,
    $._block_item,
    $._statement,
    $._expr_or_comma,
  ],

  conflicts: $ => [
    [$._type_specifier, $._expression],
    [$._declarator, $._expression],
    [$._declarator, $._type_specifier],
    [$._declarator, $._type_specifier, $._expression],
    [$.type_definition, $._type_specifier],
    // `reg <ident> …`: the ident is the pinned register only if a declarator name
    // follows it; otherwise the ident is the declarator (plain `reg name`).
    [$.storage_class],
  ],

  rules: {
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $._preproc,
      $.function_definition,
      $._statement,
    ),

    // ---------------------------------------------------------------------
    // Preprocessor
    //
    // The compiler runs a separate, line-based preprocessing pass before
    // parsing (hcc/frontend/Preprocessor.zig). It supports object-like and
    // function-like macros (the latter a C extension over TempleOS HolyC) plus
    // the usual conditional/include directives. We model each directive as a
    // single line rather than balanced #if/#endif regions, so unbalanced or
    // half-written conditionals never break parsing of the surrounding code.
    // ---------------------------------------------------------------------
    _preproc: $ => choice(
      $.preproc_include,
      $.preproc_function_def,
      $.preproc_define,
      $.preproc_undef,
      $.preproc_directive,
    ),

    preproc_include: $ => seq(
      '#',
      'include',
      field('path', choice($.string_literal, $.system_lib_string)),
    ),

    preproc_define: $ => seq(
      '#',
      'define',
      field('name', $.identifier),
      field('value', optional($.preproc_arg)),
    ),

    // Function-like macro: `#define NAME(params) body`. The `(` must abut the
    // name with no space (token.immediate) — that is exactly how the compiler
    // tells `#define F(x) …` from an object-like `#define F (x) …`.
    preproc_function_def: $ => seq(
      '#',
      'define',
      field('name', $.identifier),
      field('parameters', $.preproc_params),
      field('value', optional($.preproc_arg)),
    ),

    // The opening `(` must out-prioritize preproc_arg (which also starts right
    // after the name and carries prec 1), so a name immediately followed by `(`
    // is read as a parameter list rather than an object-like body.
    preproc_params: $ => seq(
      token.immediate(prec(2, '(')),
      commaSep(choice($.identifier, $.variadic_parameter)),
      ')',
    ),

    preproc_undef: $ => seq(
      '#',
      'undef',
      field('name', $.identifier),
    ),

    preproc_directive: $ => seq(
      '#',
      field('directive', choice(
        'if', 'ifdef', 'ifndef', 'elif', 'else', 'endif', 'exe',
        'assert', 'error', 'warn', 'help_index', 'help_file',
      )),
      field('argument', optional($.preproc_arg)),
    ),

    // Everything from after the directive name to the end of the line, stopping
    // before a trailing comment, line continuations included. The regex already
    // captures its own leading whitespace, so this is `token.immediate`: it must
    // begin right after the directive/name token, with no extras skipped first.
    // That keeps the argument on the directive's own line — a no-argument
    // directive such as `#else`/`#endif` (or `#define X` with no value) is
    // immediately followed by a newline, which the regex cannot start with, so it
    // yields no argument instead of reaching across the newline and swallowing the
    // next line of code. Lexed only in preprocessor contexts; the raised
    // precedence makes it win over a bare literal that could otherwise start a
    // fresh statement on the same line.
    preproc_arg: _ => token.immediate(prec(1, /(\\(.|\r?\n)|\/[^*/\n]|[^/\n\\])+/)),

    system_lib_string: _ => token(seq('<', /[^>\n]*/, '>')),

    // ---------------------------------------------------------------------
    // Declarations & functions
    // ---------------------------------------------------------------------
    function_definition: $ => seq(
      optional($.linkage_specifier),
      optional(field('type', $._type_specifier)),
      field('declarator', $._declarator),
      field('body', $.compound_statement),
    ),

    declaration: $ => prec.dynamic(1, seq(
      optional($.linkage_specifier),
      field('type', $._type_specifier),
      commaSep1($._init_declarator),
      ';',
    )),

    // A standalone aggregate definition `class Foo {…}` / `union U {…}`. Unlike a
    // declaration the trailing `;` is optional (the compiler accepts both), and it
    // carries no instance declarators — `class Foo {…} a, b;` is a declaration.
    type_definition: $ => prec.right(seq(
      optional($.linkage_specifier),
      field('type', choice($.class_specifier, $.union_specifier)),
      optional(';'),
    )),

    linkage_specifier: _ => choice('public', 'extern', 'import'),

    _init_declarator: $ => seq(
      optional(field('storage', $.storage_class)),
      choice(
        $._declarator,
        $.init_declarator,
      ),
    ),

    // `reg`/`noreg` storage class on a function local, sitting between the type and
    // the variable name (HolyC: `I64 reg R15 i, noreg j;`). `reg` may name a physical
    // register to pin the variable to.
    storage_class: $ => choice(
      'noreg',
      seq('reg', optional(field('register', $.register_name))),
    ),

    register_name: $ => $.identifier,

    init_declarator: $ => seq(
      field('declarator', $._declarator),
      '=',
      field('value', choice($._expression, $.initializer_list)),
    ),

    initializer_list: $ => seq(
      '{',
      commaSep(choice(
        $._expression,
        $.initializer_list,
        $.designated_initializer,
      )),
      optional(','),
      '}',
    ),

    designated_initializer: $ => seq(
      field('designator', choice(
        seq('[', $._expression, ']'),
        seq('.', alias($.identifier, $.field_identifier)),
      )),
      '=',
      field('value', choice($._expression, $.initializer_list)),
    ),

    _declarator: $ => choice(
      $.pointer_declarator,
      $.function_declarator,
      $.array_declarator,
      $.parenthesized_declarator,
      $.identifier,
    ),

    pointer_declarator: $ => prec.dynamic(1, prec.right(seq(
      '*',
      field('declarator', $._declarator),
    ))),

    function_declarator: $ => prec(1, seq(
      field('declarator', $._declarator),
      field('parameters', $.parameter_list),
    )),

    array_declarator: $ => prec(1, seq(
      field('declarator', $._declarator),
      '[',
      field('size', optional($._expr_or_comma)),
      ']',
    )),

    parenthesized_declarator: $ => prec.dynamic(-1, seq(
      '(',
      $._declarator,
      ')',
    )),

    parameter_list: $ => seq(
      '(',
      commaSep(choice($.parameter_declaration, $.variadic_parameter)),
      ')',
    ),

    variadic_parameter: _ => '...',

    parameter_declaration: $ => seq(
      field('type', $._type_specifier),
      optional(field('declarator', choice($._declarator, $._abstract_declarator))),
      optional(seq('=', field('default', $._expression))),
    ),

    _abstract_declarator: $ => choice(
      $.abstract_pointer_declarator,
      $.abstract_function_declarator,
      $.abstract_array_declarator,
      $.abstract_parenthesized_declarator,
    ),

    abstract_pointer_declarator: $ => prec.dynamic(1, prec.right(
      seq('*', optional($._abstract_declarator)),
    )),

    abstract_function_declarator: $ => prec(1, seq(
      optional($._abstract_declarator),
      field('parameters', $.parameter_list),
    )),

    abstract_array_declarator: $ => prec(1, seq(
      optional($._abstract_declarator),
      '[',
      optional($._expr_or_comma),
      ']',
    )),

    abstract_parenthesized_declarator: $ => prec(1, seq(
      '(',
      $._abstract_declarator,
      ')',
    )),

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------
    _type_specifier: $ => choice(
      $.primitive_type,
      $.class_specifier,
      $.union_specifier,
      alias($.identifier, $.type_identifier),
    ),

    primitive_type: _ => token(choice(...PRIMITIVE_TYPES)),

    type_descriptor: $ => seq(
      field('type', $._type_specifier),
      optional(field('declarator', $._abstract_declarator)),
    ),

    class_specifier: $ => prec.right(seq(
      'class',
      field('name', alias($.identifier, $.type_identifier)),
      optional(seq(':', field('base', alias($.identifier, $.type_identifier)))),
      optional(field('body', $.field_declaration_list)),
    )),

    union_specifier: $ => prec.right(seq(
      'union',
      field('name', alias($.identifier, $.type_identifier)),
      optional(seq(':', field('base', alias($.identifier, $.type_identifier)))),
      optional(field('body', $.field_declaration_list)),
    )),

    field_declaration_list: $ => seq(
      '{',
      repeat($._field_list_item),
      '}',
    ),

    _field_list_item: $ => choice(
      $.field_declaration,
      $.anonymous_aggregate_field,
    ),

    field_declaration: $ => seq(
      field('type', $._type_specifier),
      commaSep1($._field_declarator),
      ';',
    ),

    _field_declarator: $ => seq(
      $._declarator,
      repeat($.field_meta),
    ),

    // HolyC member metadata: `key value` pairs after a field declarator, where
    // value is a string or integer literal (e.g. `I64 x format "%d";`).
    field_meta: $ => seq(
      field('key', alias($.identifier, $.property_identifier)),
      field('value', choice($.string_literal, $.number_literal)),
    ),

    anonymous_aggregate_field: $ => seq(
      choice('class', 'union'),
      field('body', $.field_declaration_list),
      ';',
    ),

    // ---------------------------------------------------------------------
    // Statements
    // ---------------------------------------------------------------------
    _statement: $ => choice(
      $.compound_statement,
      $.declaration,
      $.type_definition,
      $.expression_statement,
      $.if_statement,
      $.while_statement,
      $.do_statement,
      $.for_statement,
      $.switch_statement,
      $.case_statement,
      $.default_statement,
      $.switch_range_statement,
      $.break_statement,
      $.return_statement,
      $.goto_statement,
      $.labeled_statement,
      $.try_statement,
      $.throw_statement,
      $.lock_statement,
      $.no_warn_statement,
      $.asm_statement,
      $.empty_statement,
    ),

    compound_statement: $ => seq(
      '{',
      repeat($._block_item),
      '}',
    ),

    _block_item: $ => choice(
      $._preproc,
      $._statement,
    ),

    expression_statement: $ => seq(
      $._expr_or_comma,
      ';',
    ),

    empty_statement: _ => ';',

    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $._statement),
      optional(seq('else', field('alternative', $._statement))),
    )),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $._statement),
    ),

    do_statement: $ => seq(
      'do',
      field('body', $._statement),
      'while',
      field('condition', $.parenthesized_expression),
      ';',
    ),

    for_statement: $ => seq(
      'for',
      '(',
      choice(
        field('initializer', $.declaration),
        seq(field('initializer', optional($._expr_or_comma)), ';'),
      ),
      field('condition', optional($._expr_or_comma)),
      ';',
      field('update', optional($._expr_or_comma)),
      ')',
      field('body', $._statement),
    ),

    switch_statement: $ => seq(
      choice('switch', 'sub_switch'),
      field('condition', choice($.parenthesized_expression, $.bracketed_expression)),
      field('body', $._statement),
    ),

    bracketed_expression: $ => seq('[', $._expr_or_comma, ']'),

    // `case x:` `case lo ... hi:` and the numberless auto-case `case:`.
    case_statement: $ => seq(
      'case',
      optional(seq(
        field('value', $._expression),
        optional(seq('...', field('end', $._expression))),
      )),
      ':',
    ),

    default_statement: _ => seq('default', ':'),

    // HolyC switch range markers `start:` / `end:`.
    switch_range_statement: _ => seq(choice('start', 'end'), ':'),

    break_statement: _ => seq('break', ';'),

    return_statement: $ => seq('return', optional($._expression), ';'),

    goto_statement: $ => seq(
      'goto',
      field('label', alias($.identifier, $.statement_identifier)),
      ';',
    ),

    labeled_statement: $ => seq(
      field('label', alias($.identifier, $.statement_identifier)),
      ':',
      $._statement,
    ),

    try_statement: $ => seq(
      'try',
      field('body', $.compound_statement),
      'catch',
      field('handler', $.compound_statement),
    ),

    throw_statement: $ => seq('throw', optional($._expression), ';'),

    lock_statement: $ => seq('lock', field('body', $.compound_statement)),

    // `no_warn a, b;` — a directive that suppresses the unused-variable warning for
    // the named locals. The names reference ordinary variables.
    no_warn_statement: $ => seq(
      'no_warn',
      commaSep1(field('name', $.identifier)),
      ';',
    ),

    // `asm { … }` — inline assembly: a block of straight-line `mnemonic op, op;`
    // instructions. A bare block is amd64; a qualifier selects another ISA
    // (`asm arm64 { … }`, `asm riscv64 { … }`, `asm ppc64le`, `asm s390x`, …).
    // The qualifier is any identifier — the grammar does not fix the set, so a
    // new target architecture needs no grammar change; the compiler validates
    // and classifies it. The optional arch qualifier is `IDENT {`, so it is
    // never confused with a label (`IDENT:`), leaving label syntax free for the
    // block body. Operands are immediates, register names, or HolyC variables
    // (all plain identifiers in the grammar; the compiler classifies them by
    // the target's register set).
    asm_statement: $ => seq(
      'asm',
      optional(field('arch', alias($.identifier, $.asm_arch))),
      '{',
      repeat($.asm_instruction),
      '}',
    ),

    asm_instruction: $ => seq(
      field('mnemonic', alias($.identifier, $.asm_mnemonic)),
      commaSep(field('operand', $._asm_operand)),
      ';',
    ),

    _asm_operand: $ => choice(
      $.identifier,
      seq(optional('-'), $.number_literal),
    ),

    // ---------------------------------------------------------------------
    // Expressions
    // ---------------------------------------------------------------------
    _expr_or_comma: $ => choice($._expression, $.comma_expression),

    _expression: $ => choice(
      $.identifier,
      $.number_literal,
      $.char_literal,
      $.string_literal,
      $.lastclass,
      $.parenthesized_expression,
      $.call_expression,
      $.subscript_expression,
      $.field_expression,
      $.unary_expression,
      $.binary_expression,
      $.update_expression,
      $.assignment_expression,
      $.cast_expression,
      $.sizeof_expression,
      $.offset_expression,
    ),

    comma_expression: $ => prec.left(PREC.COMMA, seq(
      field('left', $._expression),
      ',',
      field('right', choice($._expression, $.comma_expression)),
    )),

    parenthesized_expression: $ => seq('(', $._expr_or_comma, ')'),

    call_expression: $ => prec(PREC.CALL, seq(
      field('function', $._expression),
      field('arguments', $.argument_list),
    )),

    // HolyC allows skipped arguments — `F(,6)`, `F(a,)` — which fall back to a
    // parameter's default value, so an argument slot may be empty.
    argument_list: $ => seq(
      '(',
      commaSep(optional($._expression)),
      ')',
    ),

    subscript_expression: $ => prec(PREC.SUBSCRIPT, seq(
      field('argument', $._expression),
      '[',
      field('index', $._expr_or_comma),
      ']',
    )),

    field_expression: $ => prec(PREC.FIELD, seq(
      field('argument', $._expression),
      field('operator', choice('.', '->')),
      field('field', alias($.identifier, $.field_identifier)),
    )),

    unary_expression: $ => prec.right(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+', '*', '&')),
      field('argument', $._expression),
    )),

    update_expression: $ => {
      const argument = field('argument', $._expression);
      const operator = field('operator', choice('++', '--'));
      return choice(
        prec.right(PREC.UNARY, seq(operator, argument)),
        prec.left(PREC.POSTFIX, seq(argument, operator)),
      );
    },

    cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $.type_descriptor),
      ')',
      field('value', $._expression),
    )),

    sizeof_expression: $ => prec(PREC.UNARY, seq(
      'sizeof',
      '(',
      choice(
        field('type', $.type_descriptor),
        field('value', $._expr_or_comma),
      ),
      ')',
    )),

    offset_expression: $ => seq(
      'offset',
      '(',
      field('type', alias($.identifier, $.type_identifier)),
      '.',
      field('member', sepBy1('.', alias($.identifier, $.field_identifier))),
      ')',
    ),

    assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
      field('left', $._expression),
      field('operator', choice(
        '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
      )),
      field('right', $._expression),
    )),

    binary_expression: $ => {
      const table = [
        ['||', PREC.LOGICAL_OR],
        ['^^', PREC.LOGICAL_XOR],
        ['&&', PREC.LOGICAL_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['<', PREC.RELATIONAL],
        ['>', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['|', PREC.BIT_OR],
        ['^', PREC.BIT_XOR],
        ['&', PREC.BIT_AND],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];
      return choice(
        ...table.map(([operator, precedence]) => prec.left(precedence, seq(
          field('left', $._expression),
          field('operator', operator),
          field('right', $._expression),
        ))),
        // `\`` is HolyC exponentiation: right-associative.
        prec.right(PREC.POW, seq(
          field('left', $._expression),
          field('operator', '`'),
          field('right', $._expression),
        )),
      );
    },

    // ---------------------------------------------------------------------
    // Literals & identifiers
    // ---------------------------------------------------------------------
    lastclass: _ => 'lastclass',

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    number_literal: _ => {
      const hex = /0[xX][0-9a-fA-F]+/;
      const float = /([0-9]+\.[0-9]+([eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+)/;
      const decimal = /[0-9]+/;
      return token(choice(hex, float, decimal));
    },

    string_literal: $ => seq(
      '"',
      repeat(choice(
        alias(token.immediate(prec(1, /[^"\\\n]+/)), $.string_content),
        $.escape_sequence,
      )),
      '"',
    ),

    char_literal: $ => seq(
      "'",
      repeat1(choice(
        alias(token.immediate(/[^'\\\n]/), $.character),
        $.escape_sequence,
      )),
      "'",
    ),

    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /[ntr0\\'"`abfv]/,
        /x[0-9a-fA-F]{1,2}/,
      ),
    )),

    comment: _ => token(choice(
      seq('//', /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
  },
});

/**
 * Creates a rule to match one or more of the rule separated by a separator.
 * @param {string} sep
 * @param {RuleOrLiteral} rule
 * @returns {SeqRule}
 */
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

/**
 * Creates a rule to optionally match one or more of the rule separated by a comma.
 * @param {RuleOrLiteral} rule
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rule separated by a comma.
 * @param {RuleOrLiteral} rule
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return sepBy1(',', rule);
}
