import re
import json
import logging
import asyncio
from typing import Dict, Any, List, AsyncGenerator, Optional
import google.generativeai as genai
from config.settings import settings
from database.connection import get_db_setting, add_message, get_conversation_history
from memory.chroma_store import memory_db
from .prompts import SYSTEM_INSTRUCTION


def build_system_prompt(mode: str, context: Dict[str, Any], memories: List[Dict[str, Any]]) -> str:
    """Build a Kiro-style system prompt that adapts to planning, implementation, or review mode."""
    mode = (mode or "build").lower()
    base_context = json.dumps(context, indent=2)
    memory_context = json.dumps(memories, indent=2)

    if mode == "plan":
        return f"""{SYSTEM_INSTRUCTION}

You are operating in Kiro-style planning mode. Create a clear implementation spec, identify risks, and write a concrete plan before changing files.
- Produce a concise spec in docs/kiro-spec.md when the request implies a feature or substantial change.
- Prefer discussing architecture, acceptance criteria, and edge cases over making code changes immediately.
- Ask for clarification only when the request is ambiguous.

### Workspace Context
{base_context}

### Related Project Context (Memories)
{memory_context}
"""

    if mode == "review":
        return f"""{SYSTEM_INSTRUCTION}

You are operating in Kiro-style review mode. Inspect the current workspace, identify issues, and propose improvements or fixes.
- Review architecture, correctness, tests, and maintainability.
- Suggest concrete patches or follow-up actions.
- Validate changes before claiming success.

### Workspace Context
{base_context}

### Related Project Context (Memories)
{memory_context}
"""

    return f"""{SYSTEM_INSTRUCTION}

You are operating in Kiro-style implementation mode. Build features incrementally, validate them, and keep the user informed.
- Make the smallest meaningful change that satisfies the request.
- When implementing, update docs/kiro-spec.md if a plan was created.
- Validate the result with available commands and explain any blockers.

### Workspace Context
{base_context}

### Related Project Context (Memories)
{memory_context}
"""

# Import tools
from tools.file_ops import list_files_tree, read_file_content, write_file_content, delete_file_or_folder, rename_file_or_folder
from tools.code_gen import generate_project_files
from tools.executor import execute_python_file
from tools.terminal_runner import run_command_get_output
from tools.repo_reviewer import review_repository
from tools.doc_generator import generate_workspace_docs

logger = logging.getLogger("copilot.orchestrator")

def parse_agent_response(text: str) -> Dict[str, Any]:
    """Parse Gemini output into structural elements: Thought, Plan, Tool, Args, Response."""
    thought = ""
    plan = ""
    tool = ""
    args_str = ""
    response = ""
    
    # regex extractors
    thought_match = re.search(r"\[THOUGHT\](.*?)(?=\[(?:PLAN|TOOL|RESPONSE)\]|$)", text, re.DOTALL)
    if thought_match:
        thought = thought_match.group(1).strip()
        
    plan_match = re.search(r"\[PLAN\](.*?)(?=\[(?:TOOL|RESPONSE)\]|$)", text, re.DOTALL)
    if plan_match:
        plan = plan_match.group(1).strip()
        
    tool_match = re.search(r"\[TOOL\](.*?)(?=\[ARGS\]|$)", text, re.DOTALL)
    if tool_match:
        tool = tool_match.group(1).strip()
        
    args_match = re.search(r"\[ARGS\](.*?)(?=\[RESPONSE\]|$)", text, re.DOTALL)
    if args_match:
        args_str = args_match.group(1).strip()
        
    response_match = re.search(r"\[RESPONSE\](.*)", text, re.DOTALL)
    if response_match:
        response = response_match.group(1).strip()
        
    # If no structured tags are matched, fallback: treat the whole thing as response
    if not tool and not response and text:
        # Check if there is some text that looks like a chat response
        response = text.strip()
        
    args = {}
    if args_str:
        try:
            args = json.loads(args_str)
        except Exception:
            # Attempt to extract JSON using regex if parsing failed (e.g. trailing characters)
            json_match = re.search(r"\{.*\}", args_str, re.DOTALL)
            if json_match:
                try:
                    args = json.loads(json_match.group(0))
                except Exception:
                    pass
            
    return {
        "thought": thought,
        "plan": plan,
        "tool": tool,
        "args": args,
        "response": response
    }

async def execute_tool_async(tool_name: str, args: Dict[str, Any], api_key: str, chat_id: Optional[str] = None) -> Any:
    """Executes backend tasks inside an executor thread to keep FastAPI non-blocking."""
    loop = asyncio.get_running_loop()
    
    def sync_run():
        if tool_name == "list_workspace_files":
            return list_files_tree(chat_id=chat_id)
        elif tool_name == "read_file":
            return read_file_content(args.get("rel_path", ""), chat_id=chat_id)
        elif tool_name == "write_file":
            return write_file_content(args.get("rel_path", ""), args.get("content", ""), chat_id=chat_id)
        elif tool_name == "delete_file":
            return delete_file_or_folder(args.get("rel_path", ""), chat_id=chat_id)
        elif tool_name == "rename_file":
            return rename_file_or_folder(args.get("rel_path", ""), args.get("new_rel_path", ""), chat_id=chat_id)
        elif tool_name == "generate_project_files":
            return generate_project_files(args.get("files_map", {}), chat_id=chat_id)
        elif tool_name == "run_python_file":
            return execute_python_file(args.get("rel_path", ""), args.get("timeout_sec", 15), chat_id=chat_id)
        elif tool_name == "run_command":
            return run_command_get_output(args.get("cmd", ""), args.get("timeout_sec", 60), chat_id=chat_id)
        elif tool_name == "review_github_repo":
            return review_repository(args.get("repo_url", ""), api_key=api_key)
        elif tool_name == "generate_docs":
            return generate_workspace_docs(args.get("doc_type", "README"), api_key=api_key, chat_id=chat_id)
        elif tool_name == "search_memory":
            return memory_db.search_memory(args.get("query", ""), limit=args.get("limit", 5), api_key=api_key)
        elif tool_name == "add_memory":
            memory_db.add_memory(
                doc_id=args.get("doc_id", ""),
                content=args.get("content", ""),
                metadata=args.get("metadata", {}),
                api_key=api_key
            )
            return "Memory added successfully."
        else:
            return f"Unknown tool: {tool_name}"

    try:
        # Run synchronous file and subprocess IO in background threadpool
        return await loop.run_in_executor(None, sync_run)
    except Exception as e:
        logger.error(f"Error executing tool '{tool_name}': {e}")
        return f"Tool Execution Error: {e}"

async def run_agent_loop(chat_id: str, user_message: str, custom_api_key: Optional[str] = None, mode: str = "build") -> AsyncGenerator[str, None]:
    """
    Main Orchestrator Loop.
    Retrieves history, context, and runs iterative ReAct flow, yielding JSON events.
    """
    # 1. Setup API key
    api_key = custom_api_key or get_db_setting("gemini_api_key") or settings.gemini_api_key
    if not api_key:
        yield json.dumps({"type": "error", "message": "Gemini API Key is not configured. Please add it in Settings."})
        return
        
    model_name = get_db_setting("gemini_model") or settings.gemini_model
    
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        yield json.dumps({"type": "error", "message": f"Failed to configure Gemini: {e}"})
        return

    # 2. Retrieve history and memories
    history = get_conversation_history(chat_id)
    memories = memory_db.search_memory(user_message, limit=3, api_key=api_key)
    
    # 3. Add workspace snapshot to system prompt
    current_workspace_files = list_files_tree(chat_id=chat_id)
    
    system_prompt = build_system_prompt(mode, {"workspace_files": current_workspace_files}, memories)

    # 4. Construct execution conversation history
    gemini_history = []
    
    # Add older SQLite history to Gemini context window
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [{"text": msg["content"]}]})
        
    # Append the current user prompt
    gemini_history.append({"role": "user", "parts": [{"text": user_message}]})

    # Prepare model
    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt
        )
    except Exception as e:
        yield json.dumps({"type": "error", "message": f"Error creating Gemini model: {e}"})
        return

    max_iterations = 6
    iteration = 0
    
    while iteration < max_iterations:
        iteration += 1
        yield json.dumps({"type": "status", "status_text": "Thinking..."})
        
        try:
            # Query Gemini (non-streaming in-loop, as we need to parse tools)
            response = await asyncio.to_thread(
                model.generate_content,
                contents=gemini_history
            )
            
            ai_text = response.text
            logger.info(f"Gemini raw response (iteration {iteration}):\n{ai_text}")
            
            # Parse output
            parsed = parse_agent_response(ai_text)
            
            # Yield Thought & Plan to UI for modern developer experience
            if parsed["thought"]:
                yield json.dumps({"type": "thought", "text": parsed["thought"]})
            if parsed["plan"]:
                yield json.dumps({"type": "plan", "text": parsed["plan"]})
                
            # If a tool call is requested:
            if parsed["tool"]:
                tool_name = parsed["tool"]
                tool_args = parsed["args"]
                
                yield json.dumps({"type": "tool_call", "tool": tool_name, "args": tool_args})
                
                # Execute tool
                tool_result = await execute_tool_async(tool_name, tool_args, api_key, chat_id)
                
                # Yield result to UI
                yield json.dumps({"type": "tool_result", "tool": tool_name, "result": tool_result})
                
                # Append tool call and output to model history
                # We format this as intermediate model content & user content
                gemini_history.append({"role": "model", "parts": [{"text": ai_text}]})
                
                result_str = f"TOOL_RESULT ({tool_name}):\n"
                if isinstance(tool_result, (dict, list)):
                    result_str += json.dumps(tool_result, indent=2)
                else:
                    result_str += str(tool_result)
                    
                gemini_history.append({"role": "user", "parts": [{"text": result_str}]})
                
            else:
                # No tool call. This is the final response.
                yield json.dumps({"type": "content", "delta": parsed["response"]})
                
                # Record final assistant response in database
                # Generate a message ID
                import uuid
                msg_id = str(uuid.uuid4())
                add_message(msg_id, chat_id, "assistant", parsed["response"])
                break
                
        except Exception as e:
            logger.error(f"Error in orchestrator iteration {iteration}: {e}")
            yield json.dumps({"type": "error", "message": f"Error in thinking loop: {e}"})
            break
            
    if iteration >= max_iterations:
        yield json.dumps({"type": "error", "message": "Reached maximum tool execution cycles. Stopped to avoid runaway loop."})
