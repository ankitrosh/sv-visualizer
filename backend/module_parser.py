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

# Matches .port(signal) pairs — signal may contain nested parens/braces
_PORT_CONN_RE = re.compile(r'\.(\w+)\s*\(')


def _extract_conn_signal(text: str, start: int) -> tuple[str, int]:
    """
    Starting just after the opening '(' of .port(...), collect the signal
    expression respecting nested parens/braces/brackets.
    Returns (signal_text, index_after_closing_paren).
    """
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        if text[i] in '([{':
            depth += 1
        elif text[i] in ')]}':
            depth -= 1
        i += 1
    return text[start:i - 1].strip(), i


def _split_balanced(text: str) -> list[str]:
    """Split text by top-level commas, respecting (), {}, []."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in text:
        if ch in '([{':
            depth += 1
            current.append(ch)
        elif ch in ')]}':
            depth -= 1
            current.append(ch)
        elif ch == ',' and depth == 0:
            s = ''.join(current).strip()
            if s:
                parts.append(s)
            current = []
        else:
            current.append(ch)
    s = ''.join(current).strip()
    if s:
        parts.append(s)
    return parts

# ANSI style: direction keyword followed by optional type/signed keywords, optional width, port name
_PORT_DECL_RE = re.compile(
    r'(input|output|inout)\s+(?:(?:wire|reg|logic|var|signed|unsigned)\s+)*(\[[^\]]*\])?\s*(\w+)',
)

# Non-ANSI style: full port declaration line ending with ';'
# Captures direction, optional width, and the comma-separated name list
_PORT_LINE_RE = re.compile(
    r'^\s*(input|output|inout)\s+(?:(?:wire|reg|logic|var|signed|unsigned)\s+)*(\[[^\]]*\])?\s*([^\n;]+?)\s*;',
    re.MULTILINE,
)

# Detect where body non-port declarations begin (stop scanning for ports here)
_STOP_BODY_RE = re.compile(
    r'^\s*(wire|reg|logic|assign|always|initial|generate|genvar|localparam|typedef|endmodule)\b',
    re.MULTILINE,
)

# Last (...) group in a module declaration — the non-ANSI port name list
_PORT_NAME_LIST_RE = re.compile(r'\(([^()]*)\)\s*$')


def _strip_comments(text: str) -> str:
    """Remove // line comments."""
    return re.sub(r'//[^\n]*', '', text)


def _extract_module_body(text: str, module_name: str) -> str | None:
    """Return the text from 'module <name>' up to and including its 'endmodule'."""
    pattern = re.compile(
        r'\bmodule\s+' + re.escape(module_name) + r'\b.*?endmodule',
        re.DOTALL,
    )
    m = pattern.search(text)
    return m.group(0) if m else None


def _extract_ports(module_body: str) -> list[dict]:
    """
    Extract port declarations. Handles both ANSI and non-ANSI styles.

    ANSI: ports declared with direction keywords inside the module header
    (before the first ';').

    Non-ANSI: port names listed in the header, direction/width declared in
    the module body as separate statements after the first ';'.
    """
    header_end = module_body.find(';')
    header = module_body[:header_end] if header_end != -1 else module_body
    header_clean = _strip_comments(header)

    # ── ANSI style ─────────────────────────────────────────────────────────────
    ports: list[dict] = []
    for m in _PORT_DECL_RE.finditer(header_clean):
        port: dict = {"direction": m.group(1), "name": m.group(3)}
        width = m.group(2)
        if width:
            port["width"] = width.strip()
        ports.append(port)

    if ports or header_end == -1:
        return ports

    # ── Non-ANSI style ─────────────────────────────────────────────────────────
    # 1. Extract port names in declared order from the last (...) in the header.
    nm = _PORT_NAME_LIST_RE.search(header_clean)
    if not nm:
        return ports
    port_names_ordered = [
        n.strip() for n in nm.group(1).split(',')
        if n.strip() and re.match(r'^\w+$', n.strip())
    ]

    # 2. Scan body up to the first non-port keyword to build name→(dir,width) map.
    body = module_body[header_end + 1:]
    body_clean = _strip_comments(body)
    stop = _STOP_BODY_RE.search(body_clean)
    scan = body_clean[:stop.start()] if stop else body_clean

    port_info: dict[str, tuple[str, str | None]] = {}
    for m in _PORT_LINE_RE.finditer(scan):
        direction = m.group(1)
        width_s = m.group(2)
        names_raw = m.group(3)
        for name in re.split(r'\s*,\s*', names_raw.strip()):
            name = name.strip()
            if name and re.match(r'^\w+$', name):
                port_info[name] = (direction, width_s.strip() if width_s else None)

    # 3. Emit ports in header-declared order.
    for name in port_names_ordered:
        if name in port_info:
            direction, width = port_info[name]
            port: dict = {"direction": direction, "name": name}
            if width:
                port["width"] = width
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

        # Try named connections (.port(signal)) first
        connections = []
        pos = 0
        for m in _PORT_CONN_RE.finditer(block):
            sig, _ = _extract_conn_signal(block, m.end())
            connections.append({"port": m.group(1), "signal": sig})

        positional = False
        if not connections:
            # No named connections — try positional: strip outer parens of block
            inner = block.strip().lstrip('(')
            if inner.endswith(';'):
                inner = inner[:-1]
            if inner.endswith(')'):
                inner = inner[:-1]
            signals = _split_balanced(inner.strip())
            if signals:
                connections = [{"port": f"__pos_{i}", "signal": s} for i, s in enumerate(signals)]
                positional = True

        instantiations.append({
            "module_type": mod_type,
            "instance_name": inst_name,
            "connections": connections,
            "positional": positional,
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
        child_conns = inst["connections"]

        # Resolve positional connections to real port names using the child's port list
        if inst.get("positional") and inst["module_type"] in module_map:
            child_text = module_map[inst["module_type"]].read_text(encoding="utf-8", errors="replace")
            child_body = _extract_module_body(child_text, inst["module_type"])
            if child_body:
                child_ports = _extract_ports(child_body)
                child_conns = [
                    {"port": child_ports[i]["name"] if i < len(child_ports) else c["port"],
                     "signal": c["signal"]}
                    for i, c in enumerate(child_conns)
                ]

        child = extract_hierarchy(
            top_name=inst["module_type"],
            module_map=module_map,
            src_dir=src_dir,
            _visited=_visited,
            instance_name=inst["instance_name"],
            connections=child_conns,
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
