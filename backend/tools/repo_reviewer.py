import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import git
import google.generativeai as genai
from config.settings import settings
from database.connection import get_db_setting

logger = logging.getLogger("copilot.reviewer")

def clone_repo(repo_url: str, clone_name: str) -> Path:
    """Clones a Git repository into the uploads directory."""
    target_dir = settings.uploads_dir / clone_name
    
    # If the directory already exists, clear it first
    if target_dir.exists():
        try:
            shutil.rmtree(target_dir)
        except Exception as e:
            # On Windows, read-only files in .git folders can cause issues
            os.system(f'rmdir /S /Q "{target_dir}"')
            
    target_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Cloning repository {repo_url} to {target_dir}...")
    git.Repo.clone_from(repo_url, str(target_dir))
    logger.info("Cloning complete.")
    return target_dir

def list_files_for_review(dir_path: Path, max_depth: int = 4) -> List[str]:
    """Lists files recursively, filtering out non-code directories/files."""
    code_extensions = {
        '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', 
        '.java', '.go', '.rs', '.cpp', '.h', '.cs', '.md', '.json', '.yml', '.yaml'
    }
    exclude_dirs = {
        '.git', 'node_modules', 'venv', '.venv', '__pycache__', 'dist', 'build', 'out'
    }
    
    file_list = []
    
    def _traverse(current_path: Path, depth: int):
        if depth > max_depth:
            return
        try:
            for entry in os.scandir(current_path):
                entry_path = Path(entry.path)
                if entry.is_dir():
                    if entry.name not in exclude_dirs and not entry.name.startswith('.'):
                        _traverse(entry_path, depth + 1)
                elif entry.is_file():
                    if entry_path.suffix.lower() in code_extensions:
                        file_list.append(str(entry_path.relative_to(dir_path)))
        except Exception:
            pass

    _traverse(dir_path, 1)
    return file_list

def review_repository(repo_url: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Clones, scans, and analyzes a repository, returning a professional markdown review."""
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    clone_dir = None
    
    try:
        # 1. Clone repo
        clone_dir = clone_repo(repo_url, repo_name)
        
        # 2. Get file list
        files = list_files_for_review(clone_dir)
        
        # 3. Read important code context
        code_context = []
        token_count = 0
        max_tokens_limit = 20000 # Read up to 20k chars of sample files to prevent API congestion
        
        # Priority: README, main files, controllers/views, config
        priority_files = ["readme.md", "package.json", "requirements.txt", "main.py", "app.js", "index.js"]
        sorted_files = sorted(files, key=lambda f: (f.lower() not in priority_files, f.lower()))
        
        for rel_file_path in sorted_files:
            if token_count > max_tokens_limit:
                break
            abs_path = clone_dir / rel_file_path
            try:
                with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                    code_context.append(f"--- File: {rel_file_path} ---\n{content}\n")
                    token_count += len(content)
            except Exception:
                pass
                
        # 4. Invoke Gemini for architecture/review report
        key = api_key or get_db_setting("gemini_api_key") or settings.gemini_api_key
        if not key:
            raise ValueError("Gemini API Key is not configured.")
            
        genai.configure(api_key=key)
        model_name = get_db_setting("gemini_model") or settings.gemini_model
        model = genai.GenerativeModel(model_name)
        
        prompt = f"""
        You are a Principal Software Architect and Cybersecurity Specialist.
        Analyze the repository structure and file contents listed below:
        
        Repository URL: {repo_url}
        Repository Files scanned:
        {json.dumps(files, indent=2)}
        
        Code Content Snapshot:
        {"".join(code_context)}
        
        Generate a professional, extensive repository review report containing:
        1. Executive Summary: High-level architectural overview & tech stack.
        2. Architecture & Code Quality: Review patterns, readability, maintainability.
        3. Security Audit: Check for static security risks, hardcoded secrets, injection vulnerabilities.
        4. Performance & Scalability: Identify potential bottlenecks.
        5. Best Practices & Actionable Recommendations: Specific fixes and steps to improve the code.
        
        Format the review beautifully using GitHub Markdown. Write like an expert.
        """
        
        logger.info("Requesting repo review report from Gemini...")
        response = model.generate_content(prompt)
        report_text = response.text
        
        # 5. Clean up cloned repository
        try:
            shutil.rmtree(clone_dir)
        except Exception:
            os.system(f'rmdir /S /Q "{clone_dir}"')
            
        return {
            "success": True,
            "repo_name": repo_name,
            "files_scanned": len(files),
            "report": report_text
        }
        
    except Exception as e:
        logger.error(f"Error reviewing repository: {e}")
        # Clean up in case of failure
        if clone_dir and clone_dir.exists():
            try:
                shutil.rmtree(clone_dir)
            except Exception:
                os.system(f'rmdir /S /Q "{clone_dir}"')
        return {
            "success": False,
            "error": str(e),
            "report": f"### Repository Review Failed\nAn error occurred while reviewing the repository: {e}"
        }
