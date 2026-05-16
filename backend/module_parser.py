"""Phase 2-3: Recursive module hierarchy extraction with ports and connections."""

import re
from pathlib import Path

KEYWORDS = {
    'module', 'endmodule', 'input', 'output', 'inout',
    'wire', 'reg', 'logic', 'assign', 'always',
    'always_ff', 'always_comb', 'always_latch',
    'initial', 'if', 'else', 'for', 'while',
    'case', 'casex', 'casez', 'begin', 'end',
    'function', 'task', 'generate', 'genvar',
    'parameter', 'localparam', 'typedef', 'enum',
    'struct', 'union', 'interface', 'class',
    'assert', 'assume', 'cover', 'property',
}

# Matches: module_type [#(...)] instance_name (
# The parameter block handles one level of nested parens, e.g. #(.W(32))
_INST_START_RE = re.compile(
    r'^\s*(\w+)\s+(?:#\s*\((?:[^()]*|\([^)]*\))*\)\s+)?(\w+)\s*\(',
    re.MULTILINE,
)

# Matches .port(signal) pairs inside a port map block
_PORT_CONN_RE = re.compile(r'\.(\w+)\s*\(\s*([^)]+?)\s*\)')

# Matches port declarations in a module header
_PORT_DECL_RE = re.compile(
    r'(input|output|inout)\s+(?:wire|reg|logic)?\s*(\[.*?\])?\s*(\w+)',
)


def _extract_module_body(text: str, module_name: str) -> str | None:
    """Return the text from 'module <name>' up to and including its 'endmodule'."""
    pattern = re.compile(
        r'\bmodule\s+' + re.escape(module_name) + r'\b.*?endmodule',
        re.DOTALL,
    )
    m = pattern.search(text)
    return m.group(0) if m else None


def _extract_ports(module_body: str) -> list[dict]:
    """Extract port declarations from the module header (before the first ';')."""
    # Grab text from module declaration to the first semicolon (end of port list)
    header_end = module_body.find(';')
    header = module_body[:header_end] if header_end != -1 else module_body

    ports = []
    for m in _PORT_DECL_RE.finditer(header):
        port: dict = {"direction": m.group(1), "name": m.group(3)}
        width = m.group(2)
        if width:
            port["width"] = width.strip()
        ports.append(port)
    return ports


def _collect_instantiation_block(text: str, start: int) -> str:
    """
    Starting at 'start' (the opening '(' of the port map), collect all text
    up to the matching closing ');' handling nested parentheses.
    Returns the full instantiation text from start to the closing ');'.
    """
    depth = 0
    i = start
    while i < len(text):
        ch = text[i]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                # Consume optional ';' after ')'
                j = i + 1
                while j < len(text) and text[j] in ' \t\n\r':
                    j += 1
                if j < len(text) and text[j] == ';':
                    return text[start:j + 1]
                return text[start:i + 1]
        i += 1
    return text[start:]


def _extract_instantiations(module_body: str) -> list[dict]:
    """
    Find all module instantiations within module_body.
    Returns list of {module_type, instance_name, connections}.
    """
    instantiations = []

    for m in _INST_START_RE.finditer(module_body):
        mod_type = m.group(1)
        inst_name = m.group(2)

        if mod_type in KEYWORDS or inst_name in KEYWORDS:
            continue

        # The '(' that opens the port map is the last char of the match
        paren_start = m.end() - 1
        block = _collect_instantiation_block(module_body, paren_start)

        connections = []
        for conn in _PORT_CONN_RE.finditer(block):
            connections.append({"port": conn.group(1), "signal": conn.group(2).strip()})

        instantiations.append({
            "module_type": mod_type,
            "instance_name": inst_name,
            "connections": connections,
        })

    return instantiations


def extract_hierarchy(
    top_name: str,
    module_map: dict[str, Path],
    src_dir: Path,
    _visited: set[str] | None = None,
    instance_name: str | None = None,
    connections: list[dict] | None = None,
) -> dict:
    """
    Recursively build the hierarchy node for top_name.

    _visited tracks modules currently in the call stack to detect circular refs.
    """
    if _visited is None:
        _visited = set()

    src_dir = Path(src_dir)
    inst_name = instance_name if instance_name is not None else top_name
    conns = connections if connections is not None else []

    # Module not found in the index
    if top_name not in module_map:
        return {
            "name": top_name,
            "instance_name": inst_name,
            "file": None,
            "ports": [],
            "connections": conns,
            "children": [],
        }

    file_path = module_map[top_name]
    try:
        rel_path = str(file_path.relative_to(Path.cwd()))
    except ValueError:
        rel_path = str(file_path)

    # Circular reference guard
    if top_name in _visited:
        return {
            "name": top_name,
            "instance_name": inst_name,
            "file": rel_path,
            "ports": [],
            "connections": conns,
            "children": [],
            "circular": True,
        }

    _visited = _visited | {top_name}  # immutable update so siblings don't see each other's path

    text = file_path.read_text(encoding="utf-8", errors="replace")
    body = _extract_module_body(text, top_name)
    if body is None:
        return {
            "name": top_name,
            "instance_name": inst_name,
            "file": rel_path,
            "ports": [],
            "connections": conns,
            "children": [],
        }

    ports = _extract_ports(body)
    instantiations = _extract_instantiations(body)

    children = []
    for inst in instantiations:
        child = extract_hierarchy(
            top_name=inst["module_type"],
            module_map=module_map,
            src_dir=src_dir,
            _visited=_visited,
            instance_name=inst["instance_name"],
            connections=inst["connections"],
        )
        children.append(child)

    return {
        "name": top_name,
        "instance_name": inst_name,
        "file": rel_path,
        "ports": ports,
        "connections": conns,
        "children": children,
    }
