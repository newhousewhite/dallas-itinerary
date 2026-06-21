"""Run the Dallas itinerary browser verification with the available Node runtime."""

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BUNDLE = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node"


def main() -> int:
    bundled_node = BUNDLE / "bin/node"
    node = str(bundled_node) if bundled_node.exists() else shutil.which("node")
    if not node:
        print("Node.js is required for browser verification.", file=sys.stderr)
        return 2

    env = os.environ.copy()
    bundled_modules = BUNDLE / "node_modules"
    if bundled_modules.exists():
        env["NODE_PATH"] = str(bundled_modules)

    command = [node, "--test", "tests/test_site.js"]
    return subprocess.run(command, cwd=ROOT, env=env, check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
