#!/usr/bin/env python3
"""SV Module Analyzer CLI — Phase 1 backend."""

import argparse
import json
import sys
from pathlib import Path

from file_indexer import build_module_map, build_file_tree
from module_parser import extract_hierarchy


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyze a SystemVerilog codebase and output a hierarchy JSON."
    )
    parser.add_argument("--top", required=True, help="Top-level module name")
    parser.add_argument("--src", default="./src", help="Source directory (default: ./src)")
    parser.add_argument("--out", default="./hierarchy.json", help="Output JSON path (default: ./hierarchy.json)")
    parser.add_argument(
        "--exts",
        nargs="+",
        default=[".sv", ".v", ".svh"],
        help="File extensions to scan (default: .sv .v .svh)",
    )
    args = parser.parse_args()

    src_dir = Path(args.src).resolve()
    if not src_dir.is_dir():
        print(f"Error: source directory '{src_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning {src_dir} ...")
    module_map = build_module_map(src_dir, tuple(args.exts))
    print(f"Found {len(module_map)} module(s): {', '.join(sorted(module_map))}")

    if args.top not in module_map:
        print(f"Warning: top module '{args.top}' not found in source files.", file=sys.stderr)

    hierarchy = extract_hierarchy(
        top_name=args.top,
        module_map=module_map,
        src_dir=src_dir,
    )

    # Also attach file_tree to a wrapper so frontend can use it later
    output = {
        "hierarchy": hierarchy,
        "file_tree": build_file_tree(src_dir),
    }

    out_path = Path(args.out)
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
