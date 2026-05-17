# SV Visualizer

An interactive block diagram viewer for SystemVerilog designs. Point it at a source directory and a top-level module name, and it parses the hierarchy, draws each module as a block with labeled ports, and routes signal wires between instances. You can click into any module to explore its children, hover wires to highlight signals, search for instances, and pan and zoom around the canvas.

## Requirements

- Python 3.8+
- Node.js 18+

## Setup

1. Clone the repository.

```bash
git clone https://github.com/YOUR_USERNAME/sv-visualizer.git
cd sv-visualizer
```

2. Install frontend dependencies.

```bash
cd frontend && npm install && cd ..
```

## Usage

**macOS / Linux:**
```bash
./run.sh --top <top_module> --src <path/to/rtl>
```

**Windows (PowerShell):**
```powershell
.\run.ps1 -top <top_module> -src <path\to\rtl>
```

Example:

```bash
./run.sh --top my_chip --src ~/projects/asic/rtl
```

This parses your SystemVerilog files, writes a `hierarchy.json` to `frontend/public/`, and starts the dev server. Open the URL shown in the terminal (usually `http://localhost:5173`).

> **Windows note:** if PowerShell blocks the script with an execution policy error, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in an elevated PowerShell prompt.

### Options

| Flag (Mac/Linux) | Flag (Windows) | Description | Default |
|------------------|----------------|-------------|---------|
| `--top` | `-top` | Top-level module name (required) | |
| `--src` | `-src` | Directory containing `.sv` / `.v` files | `backend/tests/fixtures/src` |
| `--exts` | `-exts` | Space-separated list of file extensions to scan | `.sv .v .svh` |

## Without a source directory

You can upload a `hierarchy.json` directly in the UI using the **Load JSON** button in the top-right corner.

## Navigation

- **Click** a block to view its details or drill into its children
- **Breadcrumb** at the top to navigate back up the hierarchy
- **Scroll** to zoom, **drag** to pan
- **Hover** a wire to highlight the signal across all connected ports
- **Search bar** to filter and highlight matching instances or signals
