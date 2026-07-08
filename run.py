import os
import sys
import subprocess
import time
import threading

def log_stream(process, prefix):
    """Print the stdout/stderr stream from a subprocess with a prefix."""
    for line in iter(process.stdout.readline, ''):
        if not line:
            break
        print(f"[{prefix}] {line.strip()}", flush=True)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 60)
    print("      LAUNCHING AI SOFTWARE DEVELOPMENT COPILOT STUDIO      ")
    print("=" * 60)

    # 1. Installing Backend Dependencies
    print("\n--> Verifying Python dependencies...")
    req_file = os.path.join(backend_dir, "requirements.txt")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", req_file],
            check=True
        )
        print("Backend dependencies validated successfully.")
    except Exception as e:
        print(f"Warning: Failed to install Python dependencies automatically: {e}")

    # 2. Installing Frontend Dependencies
    print("\n--> Verifying Frontend dependencies (npm install)...")
    try:
        # On Windows, npm commands require shell=True
        use_shell = sys.platform == "win32"
        subprocess.run(
            ["npm", "install"],
            cwd=frontend_dir,
            shell=use_shell,
            check=True
        )
        print("Frontend dependencies validated successfully.")
    except Exception as e:
        print(f"Warning: Failed to run npm install automatically: {e}")
        print("Please run 'npm install' inside the frontend/ folder manually.")

    # 3. Start Backend FastAPI Server
    print("\n--> Launching FastAPI Backend on http://127.0.0.1:8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # Start backend logging thread
    backend_logger = threading.Thread(target=log_stream, args=(backend_proc, "Backend"), daemon=True)
    backend_logger.start()

    # Wait a moment for backend to initialize ports
    time.sleep(2)

    # 4. Start Frontend Vite Server
    print("\n--> Launching React + Vite Frontend on http://localhost:3000...")
    use_shell = sys.platform == "win32"
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        shell=use_shell,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # Start frontend logging thread
    frontend_logger = threading.Thread(target=log_stream, args=(frontend_proc, "Frontend"), daemon=True)
    frontend_logger.start()

    print("\n" + "=" * 60)
    print("  Application running! Open http://localhost:3000 in your browser.")
    print("  Press Ctrl+C to terminate both servers.")
    print("=" * 60 + "\n")

    try:
        while True:
            # Monitor process statuses
            if backend_proc.poll() is not None:
                print("[System] Backend crashed or exited.")
                break
            if frontend_proc.poll() is not None:
                print("[System] Frontend crashed or exited.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[System] Shutting down subprocess servers...")
    finally:
        # Graceful terminate
        try:
            backend_proc.terminate()
            backend_proc.wait(timeout=3)
        except Exception:
            backend_proc.kill()

        try:
            frontend_proc.terminate()
            frontend_proc.wait(timeout=3)
        except Exception:
            frontend_proc.kill()

        print("[System] Done. Goodbye!")

if __name__ == "__main__":
    main()
