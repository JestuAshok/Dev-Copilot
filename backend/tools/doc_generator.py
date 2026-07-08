import logging
import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
import google.generativeai as genai
from config.settings import settings
from database.connection import get_db_setting
from .file_ops import list_files_tree, write_file_content, get_workspace_dir

logger = logging.getLogger("copilot.docgen")

def generate_workspace_docs(doc_type: str = "README", api_key: Optional[str] = None, chat_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Scans the session workspace, generates documentation using Gemini, and saves it.
    doc_type: 'README', 'API_DOCS', 'INSTALL_GUIDE', or 'PROJECT_SUMMARY'.
    """
    try:
        # 1. Get the current workspace structure
        tree = list_files_tree(chat_id=chat_id)
        
        # 2. Extract some file headers or content for context (first few lines of main files)
        file_samples = []
        workspace_root = get_workspace_dir(chat_id)
        
        # Check files in root directory
        for entry in os.scandir(workspace_root):
            if entry.is_file() and not entry.name.startswith('.'):
                if entry.name.endswith(('.py', '.js', '.ts', '.tsx', '.json', '.txt', '.md')):
                    try:
                        with open(entry.path, "r", encoding="utf-8", errors="replace") as f:
                            head = f.read(2000) # Read first 2k chars
                            file_samples.append(f"File: {entry.name}\n```\n{head}\n```")
                    except Exception:
                        pass
        
        # 3. Setup Gemini prompt
        key = api_key or get_db_setting("gemini_api_key") or settings.gemini_api_key
        if not key:
            raise ValueError("Gemini API Key is not configured.")
            
        genai.configure(api_key=key)
        model_name = get_db_setting("gemini_model") or settings.gemini_model
        model = genai.GenerativeModel(model_name)
        
        doc_filename_map = {
            "README": "README.md",
            "API_DOCS": "API_REFERENCE.md",
            "INSTALL_GUIDE": "INSTALL.md",
            "PROJECT_SUMMARY": "SUMMARY.md"
        }
        
        filename = doc_filename_map.get(doc_type.upper(), "README.md")
        
        prompt = f"""
        You are a Technical Writer.
        Analyze the current directory structure and file contents of this project workspace.
        
        Directory Structure:
        {json.dumps(tree, indent=2)}
        
        File Samples (Truncated):
        {"\n\n".join(file_samples)}
        
        Generate a professional, fully-featured, comprehensive documentation of type: '{doc_type}'.
        Target Filename: {filename}
        
        Ensure you cover:
        - Project Overview and Purpose
        - Project Structure explanation
        - Prerequisites and detailed Setup/Installation guide (if README or INSTALL_GUIDE)
        - Endpoint descriptions or Code Usage details (if API_DOCS)
        - How to run and test instructions
        
        Write in clear, standard Markdown. Return ONLY the Markdown contents, do not wrap in backticks or markdown headers of your own.
        """
        
        logger.info(f"Generating documentation ({doc_type}) with Gemini...")
        response = model.generate_content(prompt)
        doc_content = response.text
        
        # Write to the file in workspace
        write_file_content(filename, doc_content, chat_id=chat_id)
        
        return {
            "success": True,
            "filename": filename,
            "message": f"Successfully generated {doc_type} and saved to workspace as {filename}."
        }
        
    except Exception as e:
        logger.error(f"Failed to generate documentation: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to generate documentation: {e}"
        }

