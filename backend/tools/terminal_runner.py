import os
import sys
import time
import subprocess
import threading
import asyncio
import logging
from typing import Dict, Any, Optional
from fastapi import WebSocket
from config.settings import settings
from database.connection import log_execution
from .file_ops import get_workspace_dir

logger = logging.getLogger("copilot.terminal")

def run_command_get_output(cmd: str, timeout_sec: int = 60, chat_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes a single CLI command non-interactively in the workspace.
    Used by the Agent to build, install dependencies, run scripts, etc.
    """
    start_time = time.time()
    shell = True # Needed for shell commands and executables on paths
    
    # On Windows, enforce Powershell as shell if available, otherwise default
    executable = None
    if sys.platform == "win32":
        executable = "powershell.exe"
        
    try:
        result = subprocess.run(
            cmd,
            cwd=str(get_workspace_dir(chat_id)),
            shell=shell,
            executable=executable,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_sec,
            encoding="utf-8",
            errors="replace"
        )
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Log command run to SQLite database
        log_execution(
            command=cmd,
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
        stderr_msg = f"Command timed out after {timeout_sec} seconds."
        
        log_execution(command=cmd, exit_code=-2, stdout="", stderr=stderr_msg, execution_time_ms=execution_time_ms)
        return {
            "exit_code": -2,
            "stdout": "",
            "stderr": stderr_msg,
            "execution_time_ms": execution_time_ms,
            "success": False
        }
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        stderr_msg = f"Failed to execute command: {e}"
        
        log_execution(command=cmd, exit_code=-3, stdout="", stderr=stderr_msg, execution_time_ms=execution_time_ms)
        return {
            "exit_code": -3,
            "stdout": "",
            "stderr": stderr_msg,
            "execution_time_ms": execution_time_ms,
            "success": False
        }


class TerminalSession:
    """Manages an active Shell session streaming to/from a Frontend WebSocket."""
    def __init__(self, websocket: WebSocket, loop: asyncio.AbstractEventLoop, chat_id: Optional[str] = None):
        self.websocket = websocket
        self.loop = loop
        self.chat_id = chat_id
        self.proc = None
        self.read_thread = None
        self.active = False
        
    def start(self):
        self.active = True
        shell_cmd = ["powershell.exe", "-NoLogo", "-NoProfile"] if sys.platform == "win32" else ["bash"]
        
        try:
            self.proc = subprocess.Popen(
                shell_cmd,
                cwd=str(get_workspace_dir(self.chat_id)),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, # Merge stderr and stdout
                text=True,
                bufsize=0
            )
            
            # Start background stdout reading thread
            self.read_thread = threading.Thread(target=self._read_output, daemon=True)
            self.read_thread.start()
            logger.info("Terminal session started successfully.")
        except Exception as e:
            logger.error(f"Failed to start terminal shell process: {e}")
            self.active = False
            
    def _read_output(self):
        """Read from shell stdout char-by-char and send to WebSocket."""
        # Read character by character so we stream output smoothly like a real terminal
        while self.active and self.proc and self.proc.poll() is None:
            try:
                char = self.proc.stdout.read(1)
                if not char:
                    # EOF reached
                    break
                
                # Schedule WebSocket send in FastAPI's main event loop
                asyncio.run_coroutine_threadsafe(self._send_to_websocket(char), self.loop)
            except Exception as e:
                logger.error(f"Error reading terminal output: {e}")
                break
                
        self.active = False
        asyncio.run_coroutine_threadsafe(self._send_to_websocket("\r\n[Shell process exited]\r\n"), self.loop)

    async def _send_to_websocket(self, data: str):
        try:
            await self.websocket.send_json({"type": "output", "data": data})
        except Exception:
            # Client disconnected
            self.active = False
            self.close()

    def write_input(self, data: str):
        """Write user input key/commands to shell stdin."""
        if self.proc and self.proc.stdin and self.active:
            try:
                self.proc.stdin.write(data)
                self.proc.stdin.flush()
            except Exception as e:
                logger.error(f"Error writing to shell stdin: {e}")
                self.close()

    def close(self):
        self.active = False
        if self.proc:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=2)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
            self.proc = None
        logger.info("Terminal session closed.")
