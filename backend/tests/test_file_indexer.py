"""T01: File indexer tests."""

from pathlib import Path
import pytest

FIXTURES_SRC = Path(__file__).parent / "fixtures" / "src"

EXPECTED_MODULES = {
    "top", "cpu", "alu", "regfile", "mem_ctrl", "cache", "uart", "gpio"
}


def test_T01_module_map_completeness(module_map):
    """T01: module_to_file contains all 8 modules."""
    assert EXPECTED_MODULES == set(module_map.keys()), (
        f"Missing: {EXPECTED_MODULES - set(module_map.keys())}, "
        f"extra: {set(module_map.keys()) - EXPECTED_MODULES}"
    )


def test_T01_module_map_paths_exist(module_map):
    """All mapped file paths exist on disk."""
    for name, path in module_map.items():
        assert Path(path).is_file(), f"File for module '{name}' not found: {path}"


def test_file_tree_root_name(file_tree):
    """File tree root node has correct name."""
    assert file_tree["name"] == "src"
    assert file_tree["type"] == "dir"


def test_file_tree_has_children(file_tree):
    """File tree root has child entries."""
    assert len(file_tree["children"]) > 0
