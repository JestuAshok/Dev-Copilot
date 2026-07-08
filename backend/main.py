import os
import sys
import zipfile
import shutil
import asyncio
import logging
import psutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config.settings import settings
from database.connection import (
    init_db, get_db_setting, set_db_setting, create_conversation, 
    list_conversations, delete_conversation, get_conversation_history, 
    add_message, get_execution_history, get_latest_metrics, record_metrics
)
from tools.file_ops import list_files_tree, read_file_content, write_file_content, delete_file_or_folder, rename_file_or_folder, get_workspace_dir
from tools.terminal_runner import TerminalSession
from agent.orchestrator import run_agent_loop

# Initialize Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("copilot.main")

# Initialize SQLite tables
init_db()

app = FastAPI(title="AI Software Development Copilot Backend")

# Setup CORS for Vite dev server communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background task to refresh system metrics (CPU/RAM/Files/Repo size)
def update_system_metrics_job(chat_id: Optional[str] = None):
    try:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        
        # Calculate workspace size and file count
        file_count = 0
        total_size_bytes = 0
        workspace_dir = get_workspace_dir(chat_id)
        for root, dirs, files in os.walk(str(workspace_dir)):
            # Skip hidden dirs
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for f in files:
                if not f.startswith('.'):
                    file_count += 1
                    fp = os.path.join(root, f)
                    try:
                        total_size_bytes += os.path.getsize(fp)
                    except Exception:
                        pass
        
        repo_size_mb = round(total_size_bytes / (1024 * 1024), 2)
        
        # Fetch AI Requests count from SQLite database
        import sqlite3
        conn = sqlite3.connect(str(settings.db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM messages WHERE role='assistant'")
        ai_requests = cursor.fetchone()[0]
        conn.close()
        
        record_metrics(cpu, mem, file_count, repo_size_mb, ai_requests)
    except Exception as e:
        logger.error(f"Failed to update metrics: {e}")

# Base Models
class ConfigUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    theme: Optional[str] = None

class ChatRequest(BaseModel):
    chat_id: str
    message: str
    mode: Optional[str] = "build"

class FileWriteRequest(BaseModel):
    rel_path: str
    content: str
    chat_id: Optional[str] = None

class RenameRequest(BaseModel):
    rel_path: str
    new_rel_path: str
    chat_id: Optional[str] = None

# ----------------- CONFIG API -----------------
@app.get("/api/config")
def get_config():
    return {
        "gemini_api_key": get_db_setting("gemini_api_key", settings.gemini_api_key),
        "gemini_model": get_db_setting("gemini_model", settings.gemini_model),
        "temperature": float(get_db_setting("temperature", str(settings.temperature))),
        "max_tokens": int(get_db_setting("max_tokens", str(settings.max_tokens))),
        "theme": get_db_setting("theme", "dark"),
        "workspace_path": str(settings.workspace_dir)
    }

@app.post("/api/config")
def update_config(cfg: ConfigUpdate):
    if cfg.gemini_api_key is not None:
        set_db_setting("gemini_api_key", cfg.gemini_api_key)
    if cfg.gemini_model is not None:
        set_db_setting("gemini_model", cfg.gemini_model)
    if cfg.temperature is not None:
        set_db_setting("temperature", str(cfg.temperature))
    if cfg.max_tokens is not None:
        set_db_setting("max_tokens", str(cfg.max_tokens))
    if cfg.theme is not None:
        set_db_setting("theme", cfg.theme)
    return {"success": True, "message": "Settings updated successfully."}


# ----------------- CONVERSATIONS API -----------------
@app.get("/api/conversations")
def get_chats():
    return list_conversations()

@app.post("/api/conversations")
def create_chat(chat_id: str = Form(...), title: str = Form(...)):
    create_conversation(chat_id, title)
    return {"success": True, "chat_id": chat_id}

@app.delete("/api/conversations/{chat_id}")
def delete_chat(chat_id: str):
    delete_conversation(chat_id)
    return {"success": True}

@app.get("/api/conversations/{chat_id}/history")
def get_chat_history(chat_id: str):
    return get_conversation_history(chat_id)


# ----------------- AGENT CHAT API -----------------
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    # Record user message in local DB
    import uuid
    msg_id = str(uuid.uuid4())
    create_conversation(req.chat_id, req.message[:30] + "...")
    add_message(msg_id, req.chat_id, "user", req.message)
    
    # Refresh hardware metrics in background
    background_tasks.add_task(update_system_metrics_job)
    
    # Return Event Stream yielding progress updates
    async def event_generator():
        async for event in run_agent_loop(req.chat_id, req.message, mode=req.mode):
            yield f"data: {event}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ----------------- WORKSPACE FILES API -----------------
@app.get("/api/workspace/files")
def get_workspace_files(background_tasks: BackgroundTasks, chat_id: Optional[str] = None):
    background_tasks.add_task(update_system_metrics_job, chat_id)
    return list_files_tree(chat_id=chat_id)

@app.get("/api/workspace/file")
def get_file(rel_path: str, chat_id: Optional[str] = None):
    try:
        content = read_file_content(rel_path, chat_id=chat_id)
        return {"success": True, "content": content}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/workspace/file")
def save_file(req: FileWriteRequest, background_tasks: BackgroundTasks):
    try:
        msg = write_file_content(req.rel_path, req.content, chat_id=req.chat_id)
        background_tasks.add_task(update_system_metrics_job, req.chat_id)
        return {"success": True, "message": msg}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/workspace/file")
def delete_file(rel_path: str, chat_id: Optional[str] = None, background_tasks: BackgroundTasks = None):
    try:
        msg = delete_file_or_folder(rel_path, chat_id=chat_id)
        background_tasks.add_task(update_system_metrics_job, chat_id)
        return {"success": True, "message": msg}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/workspace/rename")
def rename_file(req: RenameRequest):
    try:
        msg = rename_file_or_folder(req.rel_path, req.new_rel_path, chat_id=req.chat_id)
        return {"success": True, "message": msg}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/workspace/download")
def download_workspace(chat_id: Optional[str] = None):
    """Zips the session-specific workspace directory and returns it as a download."""
    workspace_dir = get_workspace_dir(chat_id)
    zip_path = settings.uploads_dir / f"workspace_{chat_id or 'default'}.zip"
    if zip_path.exists():
        zip_path.unlink()
        
    try:
        shutil.make_archive(
            str(zip_path.with_suffix("")), # shutil appends .zip automatically
            'zip',
            str(workspace_dir)
        )
        return FileResponse(path=str(zip_path), filename=f"workspace_{chat_id or 'default'}.zip", media_type="application/zip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create workspace ZIP: {e}")

@app.post("/api/workspace/upload")
async def upload_to_workspace(
    chat_id: Optional[str] = None,
    file: UploadFile = File(...), 
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Supports file uploads, extraction if zip, and saves to session workspace."""
    workspace_dir = get_workspace_dir(chat_id)
    target_path = workspace_dir / file.filename
    try:
        with open(target_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        # If it is a ZIP archive, extract it and delete the zip file
        if file.filename.endswith(".zip"):
            with zipfile.ZipFile(target_path, "r") as zip_ref:
                zip_ref.extractall(workspace_dir)
            target_path.unlink() # remove the zip file itself
            msg = "ZIP project uploaded and extracted successfully."
        else:
            msg = f"File {file.filename} uploaded successfully."
            
        background_tasks.add_task(update_system_metrics_job, chat_id)
        return {"success": True, "message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


# ----------------- DASHBOARD METRICS API -----------------
@app.get("/api/dashboard/metrics")
def get_dashboard_metrics(chat_id: Optional[str] = None):
    # Update latest metrics
    update_system_metrics_job(chat_id)
    metrics = get_latest_metrics()
    logs = get_execution_history(15)
    return {
        "metrics": metrics,
        "execution_history": logs
    }


# ----------------- TERMINAL WEBSOCKET -----------------
@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    chat_id = websocket.query_params.get("chat_id")
    loop = asyncio.get_running_loop()
    session = TerminalSession(websocket, loop, chat_id=chat_id)
    session.start()
    
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "input":
                session.write_input(data.get("data", ""))
    except WebSocketDisconnect:
        session.close()
    except Exception as e:
        logger.error(f"Terminal Websocket error: {e}")
        session.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
