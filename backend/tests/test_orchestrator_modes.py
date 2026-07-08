import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from agent.orchestrator import build_system_prompt
from database.connection import log_execution


class OrchestratorModePromptTests(unittest.TestCase):
    def test_plan_mode_prompt_contains_spec_guidance(self):
        prompt = build_system_prompt("plan", {}, [])
        self.assertIn("Kiro-style planning mode", prompt)
        self.assertIn("docs/kiro-spec.md", prompt)

    def test_build_mode_prompt_contains_validation_guidance(self):
        prompt = build_system_prompt("build", {}, [])
        self.assertIn("Kiro-style implementation mode", prompt)
        self.assertIn("validate", prompt.lower())

    def test_log_execution_accepts_execution_time_ms_keyword(self):
        fake_conn = MagicMock()
        fake_cursor = fake_conn.cursor.return_value

        with patch("database.connection.get_db_connection", return_value=fake_conn):
            log_execution("python calculator.py", 0, "ok", "", execution_time_ms=42)

        fake_conn.commit.assert_called_once()
        fake_conn.close.assert_called_once()
        self.assertEqual(fake_cursor.execute.call_args[0][1][4], 42)


if __name__ == "__main__":
    unittest.main()
