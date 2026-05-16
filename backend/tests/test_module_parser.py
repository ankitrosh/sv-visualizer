"""T02-T16: Module parser and hierarchy tests."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from file_indexer import build_module_map
from module_parser import extract_hierarchy

FIXTURES_SRC = Path(__file__).parent / "fixtures" / "src"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def find_child(node: dict, instance_name: str) -> dict | None:
    for child in node.get("children", []):
        if child["instance_name"] == instance_name:
            return child
    return None


def find_child_by_type(node: dict, module_type: str) -> dict | None:
    for child in node.get("children", []):
        if child["name"] == module_type:
            return child
    return None


# ---------------------------------------------------------------------------
# T02 - T04: Structure
# ---------------------------------------------------------------------------

def test_T02_top_children_count(hierarchy):
    """T02: top has exactly 4 children."""
    assert len(hierarchy["children"]) == 4


def test_T03_cpu_children_count(hierarchy):
    """T03: cpu has exactly 2 children (alu, regfile)."""
    cpu = find_child(hierarchy, "u_cpu")
    assert cpu is not None, "u_cpu not found in top children"
    assert len(cpu["children"]) == 2


def test_T04_leaf_nodes_have_no_children(hierarchy):
    """T04: alu, regfile, cache, uart, gpio have children=[]."""
    cpu = find_child(hierarchy, "u_cpu")
    alu = find_child(cpu, "u_alu")
    regfile = find_child(cpu, "u_regfile")
    mem = find_child(hierarchy, "u_mem")
    cache = find_child(mem, "u_cache")
    uart = find_child(hierarchy, "u_uart")
    gpio = find_child(hierarchy, "u_gpio")

    for node, name in [(alu, "alu"), (regfile, "regfile"), (cache, "cache"),
                       (uart, "uart"), (gpio, "gpio")]:
        assert node is not None, f"{name} node not found"
        assert node["children"] == [], f"{name} should be a leaf"


# ---------------------------------------------------------------------------
# T05: Parameterized instantiation
# ---------------------------------------------------------------------------

def test_T05_parameterized_instantiation(hierarchy):
    """T05: regfile found despite #(.NUM_REGS(32)) in cpu."""
    cpu = find_child(hierarchy, "u_cpu")
    regfile = find_child(cpu, "u_regfile")
    assert regfile is not None, "u_regfile not found under cpu"
    assert regfile["name"] == "regfile"
    assert regfile["file"] is not None, "regfile should have a resolved file path"


# ---------------------------------------------------------------------------
# T06: Port extraction
# ---------------------------------------------------------------------------

def test_T06_alu_ports(hierarchy):
    """T06: alu has 4 ports with correct directions and widths."""
    cpu = find_child(hierarchy, "u_cpu")
    alu = find_child(cpu, "u_alu")
    assert alu is not None

    ports_by_name = {p["name"]: p for p in alu["ports"]}
    assert set(ports_by_name.keys()) == {"clk", "a", "b", "result"}

    assert ports_by_name["clk"]["direction"] == "input"
    assert ports_by_name["a"]["direction"] == "input"
    assert ports_by_name["a"].get("width") == "[31:0]"
    assert ports_by_name["b"]["direction"] == "input"
    assert ports_by_name["b"].get("width") == "[31:0]"
    assert ports_by_name["result"]["direction"] == "output"
    assert ports_by_name["result"].get("width") == "[31:0]"


# ---------------------------------------------------------------------------
# T07: File paths in nested directories
# ---------------------------------------------------------------------------

def test_T07_cache_file_path(hierarchy):
    """T07: cache.file contains 'memory/cache.sv'."""
    mem = find_child(hierarchy, "u_mem")
    cache = find_child(mem, "u_cache")
    assert cache is not None
    assert cache["file"] is not None
    # Use posix separators for cross-platform comparison
    assert "memory/cache.sv" in cache["file"].replace("\\", "/"), (
        f"Expected 'memory/cache.sv' in '{cache['file']}'"
    )


# ---------------------------------------------------------------------------
# T08: Instance names
# ---------------------------------------------------------------------------

def test_T08_mem_ctrl_instance_name(hierarchy):
    """T08: mem_ctrl node has instance_name == 'u_mem'."""
    mem = find_child(hierarchy, "u_mem")
    assert mem is not None
    assert mem["instance_name"] == "u_mem"
    assert mem["name"] == "mem_ctrl"


# ---------------------------------------------------------------------------
# T09: Missing module
# ---------------------------------------------------------------------------

def test_T09_missing_module_gets_null_file():
    """T09: Instantiated but unfound module gets file:null, children:[]."""
    fake_map = {}  # empty: no module will be found
    node = extract_hierarchy("nonexistent", fake_map, FIXTURES_SRC)
    assert node["file"] is None
    assert node["children"] == []


# ---------------------------------------------------------------------------
# T10: Keyword filtering
# ---------------------------------------------------------------------------

def test_T10_keyword_filtering(hierarchy):
    """T10: always_comb, assign, etc. do not create false children."""
    cpu = find_child(hierarchy, "u_cpu")
    alu = find_child(cpu, "u_alu")
    # alu contains 'always_comb begin ... end' - must not appear as a child
    child_names = {c["name"] for c in alu["children"]}
    false_positives = child_names & {
        "always_comb", "always", "assign", "begin", "end", "always_ff"
    }
    assert not false_positives, f"Keyword false positives: {false_positives}"


# ---------------------------------------------------------------------------
# T11: Circular reference
# ---------------------------------------------------------------------------

def test_T11_circular_reference_no_infinite_loop():
    """T11: A->B->A does not infinite loop; circular:true flag set."""
    # Build a minimal module map with two files in-memory via tmp files
    import tempfile, os

    sv_a = "module mod_a();\n    mod_b u_b();\nendmodule\n"
    sv_b = "module mod_b();\n    mod_a u_a();\nendmodule\n"

    with tempfile.TemporaryDirectory() as tmpdir:
        path_a = Path(tmpdir) / "mod_a.sv"
        path_b = Path(tmpdir) / "mod_b.sv"
        path_a.write_text(sv_a)
        path_b.write_text(sv_b)

        circ_map = {"mod_a": path_a, "mod_b": path_b}
        root = extract_hierarchy("mod_a", circ_map, Path(tmpdir))

    # mod_b is a child of mod_a
    assert len(root["children"]) == 1
    child_b = root["children"][0]
    assert child_b["name"] == "mod_b"

    # mod_a appears again under mod_b but should be cut with circular:true
    assert len(child_b["children"]) == 1
    child_a2 = child_b["children"][0]
    assert child_a2["name"] == "mod_a"
    assert child_a2.get("circular") is True
    assert child_a2["children"] == []


# ---------------------------------------------------------------------------
# T12: Deep nesting
# ---------------------------------------------------------------------------

def test_T12_deep_nesting(hierarchy):
    """T12: top -> mem_ctrl -> cache is 3 levels deep."""
    mem = find_child(hierarchy, "u_mem")
    assert mem is not None, "mem_ctrl not found at level 1"
    cache = find_child(mem, "u_cache")
    assert cache is not None, "cache not found at level 2"
    # cache is a leaf (level 3 exists and has no children)
    assert cache["children"] == []


# ---------------------------------------------------------------------------
# T13-T16: Connections
# ---------------------------------------------------------------------------

def test_T13_cpu_connection_data_bus(hierarchy):
    """T13: u_cpu connections contains {port:'data', signal:'data_bus'}."""
    cpu = find_child(hierarchy, "u_cpu")
    assert cpu is not None
    conn_map = {c["port"]: c["signal"] for c in cpu["connections"]}
    assert conn_map.get("data") == "data_bus"


def test_T13_cpu_full_connections(hierarchy):
    """T13 (full): u_cpu has all 4 expected connections."""
    cpu = find_child(hierarchy, "u_cpu")
    conn_map = {c["port"]: c["signal"] for c in cpu["connections"]}
    assert conn_map == {
        "clk": "clk",
        "rst_n": "rst_n",
        "data": "data_bus",
        "addr": "addr_bus",
    }


def test_T14_shared_signal_data_bus(hierarchy):
    """T14: u_cpu and u_mem both have signal 'data_bus' in their connections."""
    cpu = find_child(hierarchy, "u_cpu")
    mem = find_child(hierarchy, "u_mem")

    cpu_signals = {c["signal"] for c in cpu["connections"]}
    mem_signals = {c["signal"] for c in mem["connections"]}

    assert "data_bus" in cpu_signals
    assert "data_bus" in mem_signals


def test_T15_signal_expression_preserved(hierarchy):
    """T15: u_cache connection preserves 'addr[11:0]' signal expression."""
    mem = find_child(hierarchy, "u_mem")
    cache = find_child(mem, "u_cache")
    assert cache is not None

    conn_map = {c["port"]: c["signal"] for c in cache["connections"]}
    assert conn_map.get("addr") == "addr[11:0]", (
        f"Expected 'addr[11:0]', got '{conn_map.get('addr')}'"
    )


def test_T16_top_has_no_connections(hierarchy):
    """T16: top module has connections=[] (no parent)."""
    assert hierarchy["connections"] == []
