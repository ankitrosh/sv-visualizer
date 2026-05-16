"""Shared fixtures for the SV Visualizer test suite."""

import sys
from pathlib import Path

import pytest

# Make backend/ importable without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent))

from file_indexer import build_module_map, build_file_tree
from module_parser import extract_hierarchy

FIXTURES_SRC = Path(__file__).parent / "fixtures" / "src"


@pytest.fixture(scope="session")
def module_map():
    return build_module_map(FIXTURES_SRC)


@pytest.fixture(scope="session")
def hierarchy(module_map):
    return extract_hierarchy(
        top_name="top",
        module_map=module_map,
        src_dir=FIXTURES_SRC,
    )


@pytest.fixture(scope="session")
def file_tree():
    return build_file_tree(FIXTURES_SRC)
