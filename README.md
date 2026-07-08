# Dev-Copilot – Professional AI Software Development Copilot Studio

Dev-Copilot is a production-quality AI software development copilot inspired by modern coding environments like Cursor and Kiro. It features an agentic reasoning engine, persistent vector memory, automated file execution, real-time command streaming, and a monitoring dashboard.

---

## Technical Stack & Features

- **Frontend**: React, Vite, Tailwind CSS, TypeScript, Monaco Editor (`@monaco-editor/react`), React Markdown, Framer Motion, and Lucide Icons.
- **Backend**: Python 3.10+, FastAPI, SQLite (persisting chats and telemetry), and Pydantic Settings.
- **AI Engine**: Gemini API (`gemini-2.5-flash` or `gemini-2.5-pro`).
- **Memory Store**: Dual-mode Vector Database. Runs native `chromadb` persistent stores, and automatically falls back to an embedded JSON-numpy semantic database if nativeHNWSLib cannot compile.
- **Terminal Execution**: Streams PowerShell (Windows) or Bash (macOS/Linux) directly to/from the frontend using persistent subprocess WebSockets.
- **Agent Loop**: Iterative ReAct flow (Understand -> Plan -> Choose Tool -> Execute -> Observe/Self-Heal -> Reason -> Respond).

---

## Directory Layout

```
dev-copilot/
├── backend/
│   ├── main.py                 # FastAPI Application Server
│   ├── config/
│   │   └── settings.py         # System directory paths and defaults
│   ├── database/
│   │   └── connection.py       # SQLite metrics, settings, and logs database
│   ├── memory/
│   │   └── chroma_store.py     # Vector Memory with fallback mechanism
│   ├── agent/
│   │   ├── orchestrator.py     # ReAct cycle execution manager
│   │   └── prompts.py          # System prompt directives
│   ├── tools/
│   │   ├── file_ops.py         # Sandbox-safe read/write/delete operations
│   │   ├── executor.py         # Subprocess Python runner with error catching
│   │   ├── terminal_runner.py  # WebSocket command shell manager
│   │   ├── repo_reviewer.py    # Git clone and code reviewer tool
│   │   └── code_gen.py         # Multi-file project scaffolding writer
│   ├── workspace/              # Isolation directory for code generation
│   ├── uploads/                # Directory for cloned git repos and ZIP files
│   └── logs/                   # System debug logs
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx             # Global application state and streaming parser
│       ├── components/
│       │   ├── LeftSidebar.tsx  # Chats panel, dashboard and settings triggers
│       │   ├── CenterPanel.tsx  # Chat workspace with collapsible thoughts trail
│       │   ├── RightPanel.tsx   # Workspace file-explorer and Monaco Editor
│       │   ├── BottomPanel.tsx  # WebSocket powered shell terminal console
│       │   ├── DashboardView.tsx# CPU/RAM metrics and run executions table
│       │   └── SettingsView.tsx # Gemini keys & model weights parameters
└── run.py                      # Multi-process orchestrator launcher script
```

---

## Setup & Execution

### Prerequisites
1. **Python 3.10+** (added to environment PATH)
2. **Node.js 18+ & npm** (added to environment PATH)

### Quick Start
To launch both the FastAPI backend server and Vite frontend server, run the launcher script from the project root:

```bash
python run.py
```

This script will:
1. Auto-install Python modules in your virtual/global environment.
2. Auto-run `npm install` inside the `frontend/` folder.
3. Boot the FastAPI server (port `8000`) and the Vite client (port `3000`).
4. Keep child processes running and terminate them cleanly if you press `Ctrl+C`.

Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## Design Choices

1. **Self-Healing Loop**: If a Python command fails to compile or execute inside the subprocess runner, the orchestrator redirects the stderr back to Gemini. The model designs a code patch, writes it using `file_ops`, and runs it again.
2. **Dual-Mode Vector Db**: Fallback JSON stores prevent the application from crashing on Windows environments that lack Microsoft C++ compiler tools.
3. **PowerShell WebSockets**: Subprocess IO is piped to WebSocket threads char-by-char, enabling standard terminal interactions on the GUI.
