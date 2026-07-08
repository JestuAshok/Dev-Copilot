import logging
from typing import Dict, List, Any, Optional
from .file_ops import write_file_content

logger = logging.getLogger("copilot.codegen")

def generate_project_files(files_map: Dict[str, str], chat_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Writes multiple files in the workspace.
    files_map: A dictionary mapping relative file paths to their code content.
    """
    results = []
    errors = []
    
    for rel_path, content in files_map.items():
        try:
            write_file_content(rel_path, content, chat_id=chat_id)
            results.append(rel_path)
        except Exception as e:
            logger.error(f"Error generating file {rel_path} for chat {chat_id}: {e}")
            errors.append(f"{rel_path}: {e}")

            
    return {
        "success": len(errors) == 0,
        "files_created": results,
        "errors": errors,
        "message": f"Successfully created {len(results)} files. Errors: {len(errors)}."
    }
