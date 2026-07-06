; Code navigation tags (ctags-style), used for symbol search and outlines.

(function_definition
  declarator: (function_declarator
    declarator: (identifier) @name)) @definition.function

(function_definition
  declarator: (pointer_declarator
    declarator: (function_declarator
      declarator: (identifier) @name))) @definition.function

; Function prototypes (declarations whose declarator is a function_declarator).
(declaration
  (function_declarator
    declarator: (identifier) @name)) @definition.function

(class_specifier
  name: (type_identifier) @name) @definition.class

(union_specifier
  name: (type_identifier) @name) @definition.class

(call_expression
  function: (identifier) @name) @reference.call
