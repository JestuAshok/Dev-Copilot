import sqlite3
import json
from datetime import datetime
from pathlib import Path
from config.settings import settings

def get_db_connection():
    conn = sqlite3.connect(str(settings.db_path))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Settings overrides table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    
    # 2. Conversations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT
    )
    """)
    
    # 3. Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        timestamp TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
    """)
    
    # 4. Command execution logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT,
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        execution_time_ms INTEGER,
        timestamp TEXT
    )
    """)
    
    # 5. Daily/Hourly metrics snapshot
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agent_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cpu_usage REAL,
        memory_usage REAL,
        generated_files INTEGER,
        repo_size REAL,
        ai_requests INTEGER,
        timestamp TEXT
    )
    """)
    
    conn.commit()
    conn.close()

# Helper operations for settings override
def get_db_setting(key: str, default: str = "") -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM system_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default

def set_db_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

# Helper operations for chats
def create_conversation(chat_id: str, title: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("INSERT OR IGNORE INTO conversations (id, title, created_at) VALUES (?, ?, ?)", (chat_id, title, now))
    conn.commit()
    conn.close()

def update_conversation_title(chat_id: str, title: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, chat_id))
    conn.commit()
    conn.close()

def delete_conversation(chat_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (chat_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (chat_id,))
    conn.commit()
    conn.close()

def list_conversations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, created_at FROM conversations ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["id"], "title": r["title"], "created_at": r["created_at"]} for r in rows]

def add_message(msg_id: str, chat_id: str, role: str, content: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
                   (msg_id, chat_id, role, content, now))
    conn.commit()
    conn.close()

def get_conversation_history(chat_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC", (chat_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"], "timestamp": r["timestamp"]} for r in rows]

# Log Execution Run
def log_execution(command: str, exit_code: int, stdout: str, stderr: str, execution_time_ms: int = 0, time_ms: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    elapsed_ms = execution_time_ms if time_ms is None else time_ms
    cursor.execute(
        "INSERT INTO execution_logs (command, exit_code, stdout, stderr, execution_time_ms, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (command, exit_code, stdout, stderr, elapsed_ms, now)
    )
    conn.commit()
    conn.close()

def get_execution_history(limit: int = 15):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, command, exit_code, stdout, stderr, execution_time_ms, timestamp FROM execution_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [{
        "id": r["id"],
        "command": r["command"],
        "exit_code": r["exit_code"],
        "stdout": r["stdout"][:500] + "..." if len(r["stdout"]) > 500 else r["stdout"],
        "stderr": r["stderr"][:500] + "..." if len(r["stderr"]) > 500 else r["stderr"],
        "execution_time_ms": r["execution_time_ms"],
        "timestamp": r["timestamp"]
    } for r in rows]

# Increment/Log Metrics
def record_metrics(cpu: float, memory: float, file_count: int, repo_size_mb: float, ai_reqs: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("INSERT INTO agent_metrics (cpu_usage, memory_usage, generated_files, repo_size, ai_requests, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                   (cpu, memory, file_count, repo_size_mb, ai_reqs, now))
    conn.commit()
    conn.close()

def get_latest_metrics():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT cpu_usage, memory_usage, generated_files, repo_size, ai_requests, timestamp FROM agent_metrics ORDER BY timestamp DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "cpu_usage": row["cpu_usage"],
            "memory_usage": row["memory_usage"],
            "generated_files": row["generated_files"],
            "repo_size": row["repo_size"],
            "ai_requests": row["ai_requests"],
            "timestamp": row["timestamp"]
        }
    return {
        "cpu_usage": 0.0,
        "memory_usage": 0.0,
        "generated_files": 0,
        "repo_size": 0.0,
        "ai_requests": 0,
        "timestamp": datetime.now().isoformat()
    }
