"""Phase 1: Build a file tree and module-to-file map from a source directory."""

import os
import re
from pathlib import Path

_MODULE_DECL_RE = re.compile(r'^\s*module\s+(\w+)', re.MULTILINE)


def build_file_tree(src_dir: Path) -> dict:
    """Return a nested dict mirroring the directory tree under src_dir."""
    src_dir = Path(src_dir)

    def _walk(path: Path) -> dict:
        node = {"name": path.name, "path": str(path), "type": "dir", "children": []}
        for entry in sorted(path.iterdir()):
            if entry.is_dir():
                node["children"].append(_walk(entry))
            else:
                node["children"].append(
                    {"name": entry.name, "path": str(entry), "type": "file", "children": []}
                )
        return node

    return _walk(src_dir)


def build_module_map(
    src_dir: Path,
    extensions: tuple[str, ...] = (".sv", ".v", ".svh"),
) -> dict[str, Path]:
    """Return a flat dict mapping module_name -> absolute file Path."""
    src_dir = Path(src_dir)
    module_map: dict[str, Path] = {}

    for root, _dirs, files in os.walk(src_dir):
        for fname in files:
            if any(fname.endswith(ext) for ext in extensions):
                fpath = Path(root) / fname
                try:
                    text = fpath.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                for m in _MODULE_DECL_RE.finditer(text):
                    module_name = m.group(1)
                    module_map[module_name] = fpath

    return module_map
