import sys
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Optional
from config.settings import settings
from database.connection import log_execution
from .file_ops import get_safe_path, write_file_content, get_workspace_dir

def execute_python_file(rel_path: str, timeout_sec: int = 15, chat_id: Optional[str] = None) -> Dict[str, Any]:
    """Runs a Python file located in the workspace inside a subprocess."""
    start_time = time.time()
    try:
        safe_path = get_safe_path(rel_path, chat_id)
    except ValueError as e:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "execution_time_ms": 0,
            "success": False
        }
        
    if not safe_path.exists():
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Error: File '{rel_path}' does not exist.",
            "execution_time_ms": 0,
            "success": False
        }

    # Run script using current Python interpreter inside the workspace directory
    cmd = [sys.executable, str(safe_path)]
    
    try:
        result = subprocess.run(
            cmd,
            cwd=str(get_workspace_dir(chat_id)),

            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_sec,
            encoding="utf-8",
            errors="replace"
        )
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Log to SQLite db
        log_execution(
            command=f"python {rel_path}",
            exit_code=result.returncode,
            stdout=result.stdout,
            stderr=result.stderr,
            execution_time_ms=execution_time_ms
        )
        
        return {
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "execution_time_ms": execution_time_ms,
            "success": result.returncode == 0
        }
        
    except subprocess.TimeoutExpired as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        stderr_msg = f"Execution Timed Out after {timeout_sec} seconds."
        
        log_execution(
            command=f"python {rel_path}",
            exit_code=-2,
            stdout="",
            stderr=stderr_msg,
            execution_time_ms=execution_time_ms
        )
        
        return {
            "exit_code": -2,
            "stdout": "",
            "stderr": stderr_msg,
            "execution_time_ms": execution_time_ms,
            "success": False
        }
        
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        stderr_msg = f"Unexpected execution error: {str(e)}"
        
        log_execution(
            command=f"python {rel_path}",
            exit_code=-3,
            stdout="",
            stderr=stderr_msg,
            execution_time_ms=execution_time_ms
        )
        
        return {
            "exit_code": -3,
            "stdout": "",
            "stderr": stderr_msg,
            "execution_time_ms": execution_time_ms,
            "success": False
        }

def execute_python_code_block(code_content: str, temp_filename: str = "temp_run.py", timeout_sec: int = 15) -> Dict[str, Any]:
    """Writes dynamic code content to a temporary workspace file and runs it."""
    try:
        # Write to temp file
        write_file_content(temp_filename, code_content)
        # Execute it
        res = execute_python_file(temp_filename, timeout_sec)
        return res
    except Exception as e:
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Failed to write/execute code block: {e}",
            "execution_time_ms": 0,
            "success": False
        }
