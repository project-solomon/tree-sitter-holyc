package tree_sitter_holyc_test

import (
	"testing"

	tree_sitter_holyc "github.com/project-solomon/tree-sitter-holyc/bindings/go"
)

// TestCanLoadGrammar verifies the grammar's Language() returns a valid pointer.
// Kept dependency-free on purpose: it does not pull in the go-tree-sitter runtime,
// so the module needs no external requires.
func TestCanLoadGrammar(t *testing.T) {
	if tree_sitter_holyc.Language() == nil {
		t.Error("Error loading HolyC grammar")
	}
}
