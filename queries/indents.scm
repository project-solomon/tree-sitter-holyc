; Indentation rules (nvim-treesitter conventions).

[
  (compound_statement)
  (field_declaration_list)
  (initializer_list)
  (parameter_list)
  (argument_list)
  (bracketed_expression)
] @indent.begin

[
  "}"
  ")"
  "]"
] @indent.end

[
  "}"
  ")"
  "]"
] @indent.branch

(comment) @indent.ignore
