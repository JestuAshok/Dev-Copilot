import os
import shutil
import re
from pathlib import Path
from typing import List, Dict, Any, Union, Optional
from config.settings import settings

def get_workspace_dir(chat_id: Optional[str] = None) -> Path:
    """Gets the session-specific workspace directory, defaulting to 'default'."""
    if not chat_id:
        chat_id = "default"
    # Keep only alphanumeric and underscore characters in chat_id to prevent directory traversal
    safe_chat_id = re.sub(r'[^a-zA-Z0-9_]', '_', chat_id)
    target_dir = settings.workspace_dir / safe_chat_id
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir

def get_safe_path(rel_path: Union[str, Path], chat_id: Optional[str] = None) -> Path:
    """Resolve and enforce that the path is strictly within the session-specific workspace directory."""
    workspace_root = get_workspace_dir(chat_id).resolve()
    target_path = (workspace_root / rel_path).resolve()
    
    # Check if target_path is relative to workspace_root
    if not str(target_path).startswith(str(workspace_root)):
        raise ValueError(f"Access denied: Path '{rel_path}' is outside the workspace boundary.")
    return target_path

def list_files_tree(base_path: Path = None, chat_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Generates a hierarchical JSON tree representing the session-specific workspace directory."""
    workspace_root = get_workspace_dir(chat_id)
    if base_path is None:
        base_path = workspace_root
        
    base_path = base_path.resolve()
    items = []
    
    try:
        for entry in os.scandir(base_path):
            rel_to_workspace = Path(entry.path).relative_to(workspace_root)
            is_dir = entry.is_dir()
            
            # Skip hidden folders like .git
            if entry.name.startswith("."):
                continue
                
            item = {
                "name": entry.name,
                "path": str(rel_to_workspace).replace("\\", "/"),
                "isDir": is_dir
            }
            
            if is_dir:
                item["children"] = list_files_tree(Path(entry.path), chat_id=chat_id)
            else:
                item["size"] = entry.stat().st_size
                
            items.append(item)
            
        # Sort directories first, then alphabetically
        items.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    except Exception as e:
        # If directory doesn't exist or permission denied
        pass
        
    return items

def read_file_content(rel_path: str, chat_id: Optional[str] = None) -> str:
    """Reads the text contents of a file inside the session workspace safely."""
    safe_path = get_safe_path(rel_path, chat_id)
    if not safe_path.exists():
        raise FileNotFoundError(f"File not found: {rel_path}")
    if safe_path.is_dir():
        raise IsADirectoryError(f"Path is a directory: {rel_path}")
        
    with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def write_file_content(rel_path: str, content: str, chat_id: Optional[str] = None) -> str:
    """Writes content to a file inside the session workspace, creating any parent folders if missing."""
    safe_path = get_safe_path(rel_path, chat_id)
    safe_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(safe_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    return f"Successfully wrote {len(content)} characters to {rel_path}."

def delete_file_or_folder(rel_path: str, chat_id: Optional[str] = None) -> str:
    """Deletes a file or directory inside the session workspace."""
    safe_path = get_safe_path(rel_path, chat_id)
    if not safe_path.exists():
        raise FileNotFoundError(f"Path not found: {rel_path}")
        
    if safe_path.is_dir():
        shutil.rmtree(safe_path)
        return f"Successfully deleted directory: {rel_path}"
    else:
        safe_path.unlink()
        return f"Successfully deleted file: {rel_path}"

def rename_file_or_folder(rel_path: str, new_rel_path: str, chat_id: Optional[str] = None) -> str:
    """Renames or moves a file or folder inside the session workspace."""
    safe_path = get_safe_path(rel_path, chat_id)
    safe_new_path = get_safe_path(new_rel_path, chat_id)
    
    if not safe_path.exists():
        raise FileNotFoundError(f"Source path not found: {rel_path}")
    if safe_new_path.exists():
        raise FileExistsError(f"Destination path already exists: {new_rel_path}")
        
    safe_new_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(safe_path), str(safe_new_path))
    return f"Successfully renamed '{rel_path}' to '{new_rel_path}'."

