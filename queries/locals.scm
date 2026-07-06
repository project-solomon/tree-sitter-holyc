; Local scopes and definitions, used to refine variable highlighting.

; ---------------------------------------------------------------------------
; Scopes
; ---------------------------------------------------------------------------
(source_file) @local.scope
(function_definition) @local.scope
(compound_statement) @local.scope
(for_statement) @local.scope

; ---------------------------------------------------------------------------
; Definitions
; ---------------------------------------------------------------------------
(parameter_declaration
  declarator: (identifier) @local.definition.parameter)
(parameter_declaration
  declarator: (pointer_declarator
    declarator: (identifier) @local.definition.parameter))

(init_declarator
  declarator: (identifier) @local.definition.var)
(declaration
  (identifier) @local.definition.var)
(pointer_declarator
  declarator: (identifier) @local.definition.var)
(array_declarator
  declarator: (identifier) @local.definition.var)

(function_definition
  declarator: (function_declarator
    declarator: (identifier) @local.definition.function))

(labeled_statement
  label: (statement_identifier) @local.definition)

; ---------------------------------------------------------------------------
; References
; ---------------------------------------------------------------------------
(identifier) @local.reference
