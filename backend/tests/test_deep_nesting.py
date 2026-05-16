"""Tests for deeply nested module hierarchy (soc -> cpu -> core -> exec_unit -> alu = 5 levels)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from file_indexer import build_module_map
from module_parser import extract_hierarchy

DEEP_SRC = Path(__file__).parent / "fixtures" / "deep_src"

EXPECTED_MODULES = {
    "soc",
    "cpu", "core", "fetch", "exec_unit", "alu", "mul_unit",
    "l2_cache", "cache_ctrl", "sram_bank",
    "bus_matrix", "mem_top",
    "peri_subsystem", "uart", "spi",
}


@pytest.fixture(scope="module")
def deep_map():
    return build_module_map(DEEP_SRC)


@pytest.fixture(scope="module")
def deep_hier(deep_map):
    return extract_hierarchy("soc", deep_map, DEEP_SRC)


def find_child(node: dict, instance_name: str) -> dict | None:
    for c in node.get("children", []):
        if c["instance_name"] == instance_name:
            return c
    return None


# ── Module map ───────────────────────────────────────────────────────────────

def test_deep_module_map_completeness(deep_map):
    """All 15 modules are discovered."""
    assert EXPECTED_MODULES == set(deep_map.keys()), (
        f"Missing: {EXPECTED_MODULES - set(deep_map.keys())}, "
        f"Extra: {set(deep_map.keys()) - EXPECTED_MODULES}"
    )


# ── Level 1: soc ─────────────────────────────────────────────────────────────

def test_soc_children(deep_hier):
    """soc has 4 children: cpu, bus_matrix, mem_top, peri_subsystem."""
    assert len(deep_hier["children"]) == 4
    names = {c["name"] for c in deep_hier["children"]}
    assert names == {"cpu", "bus_matrix", "mem_top", "peri_subsystem"}


# ── Level 2: cpu ─────────────────────────────────────────────────────────────

def test_cpu_children(deep_hier):
    """cpu has 2 children: core, l2_cache."""
    cpu = find_child(deep_hier, "u_cpu")
    assert cpu is not None
    assert len(cpu["children"]) == 2
    names = {c["name"] for c in cpu["children"]}
    assert names == {"core", "l2_cache"}


# ── Level 3: core ────────────────────────────────────────────────────────────

def test_core_children(deep_hier):
    """core has 2 children: fetch, exec_unit."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    assert core is not None
    assert len(core["children"]) == 2
    names = {c["name"] for c in core["children"]}
    assert names == {"fetch", "exec_unit"}


def test_core_fetch_is_leaf(deep_hier):
    """fetch is a leaf at level 4."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    fetch = find_child(core, "u_fetch")
    assert fetch is not None
    assert fetch["children"] == []


# ── Level 4: exec_unit ───────────────────────────────────────────────────────

def test_exec_unit_children(deep_hier):
    """exec_unit has 2 children: alu, mul_unit."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    exec_u = find_child(core, "u_exec")
    assert exec_u is not None
    assert len(exec_u["children"]) == 2
    names = {c["name"] for c in exec_u["children"]}
    assert names == {"alu", "mul_unit"}


# ── Level 5: alu (deepest leaf) ──────────────────────────────────────────────

def test_alu_is_leaf_at_level5(deep_hier):
    """alu is a leaf at level 5 — the deepest node."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    exec_u = find_child(core, "u_exec")
    alu = find_child(exec_u, "u_alu")
    assert alu is not None
    assert alu["name"] == "alu"
    assert alu["children"] == []
    assert alu["file"] is not None  # resolved from nested cpu/ directory


def test_mul_unit_is_leaf_at_level5(deep_hier):
    """mul_unit is also a leaf at level 5."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    exec_u = find_child(core, "u_exec")
    mul = find_child(exec_u, "u_mul")
    assert mul is not None
    assert mul["children"] == []


# ── Level 3: l2_cache ────────────────────────────────────────────────────────

def test_l2_cache_children(deep_hier):
    """l2_cache has 2 children: cache_ctrl, sram_bank."""
    cpu = find_child(deep_hier, "u_cpu")
    l2 = find_child(cpu, "u_l2")
    assert l2 is not None
    assert len(l2["children"]) == 2
    names = {c["name"] for c in l2["children"]}
    assert names == {"cache_ctrl", "sram_bank"}


def test_l2_cache_sliced_signal(deep_hier):
    """l2_cache u_ctrl connection preserves addr[9:0] signal expression."""
    cpu = find_child(deep_hier, "u_cpu")
    l2 = find_child(cpu, "u_l2")
    ctrl = find_child(l2, "u_ctrl")
    assert ctrl is not None
    conn_map = {c["port"]: c["signal"] for c in ctrl["connections"]}
    assert conn_map.get("addr") == "addr[9:0]"


# ── Level 2: peri_subsystem ──────────────────────────────────────────────────

def test_peri_subsystem_children(deep_hier):
    """peri_subsystem has 2 children: uart, spi."""
    peri = find_child(deep_hier, "u_peri")
    assert peri is not None
    names = {c["name"] for c in peri["children"]}
    assert names == {"uart", "spi"}


def test_uart_spi_are_leaves(deep_hier):
    """uart and spi are leaves."""
    peri = find_child(deep_hier, "u_peri")
    for inst in ("u_uart", "u_spi"):
        node = find_child(peri, inst)
        assert node is not None
        assert node["children"] == []


# ── Connections at various depths ────────────────────────────────────────────

def test_soc_to_cpu_connections(deep_hier):
    """soc→cpu connections are correctly captured."""
    cpu = find_child(deep_hier, "u_cpu")
    conn_map = {c["port"]: c["signal"] for c in cpu["connections"]}
    assert conn_map["clk"] == "clk"
    assert conn_map["rst_n"] == "rst_n"
    assert conn_map["bus_out"] == "cpu_bus"
    assert conn_map["mem_addr"] == "mem_addr"


def test_cpu_to_core_connections(deep_hier):
    """cpu→core connections are correctly captured."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    conn_map = {c["port"]: c["signal"] for c in core["connections"]}
    assert conn_map["clk"] == "clk"
    assert conn_map["result"] == "core_result"
    assert conn_map["addr"] == "core_addr"


def test_core_to_exec_connections(deep_hier):
    """core→exec_unit connections are correctly captured."""
    cpu = find_child(deep_hier, "u_cpu")
    core = find_child(cpu, "u_core")
    exec_u = find_child(core, "u_exec")
    conn_map = {c["port"]: c["signal"] for c in exec_u["connections"]}
    assert conn_map["instr"] == "fetch_instr"
    assert conn_map["result"] == "exec_result"


# ── Top-level soc has no connections ────────────────────────────────────────

def test_soc_no_connections(deep_hier):
    """soc is the top module — connections must be empty."""
    assert deep_hier["connections"] == []


# ── bus_matrix, mem_top are leaves at level 2 ───────────────────────────────

def test_level2_leaves(deep_hier):
    """bus_matrix and mem_top have no children."""
    for inst in ("u_bus", "u_mem"):
        node = find_child(deep_hier, inst)
        assert node is not None, f"{inst} not found"
        assert node["children"] == [], f"{inst} should be a leaf"
