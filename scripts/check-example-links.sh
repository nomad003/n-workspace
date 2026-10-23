#!/bin/sh
# Run the vendored checker against examples/life.
# check_links.py takes its root from its own path (parent of tools/), so executing
# the file in examples/tools would scan examples/ instead of the example life repo.
# The source is not modified; only __file__ is pointed at examples/life/tools/.
set -eu
cd "$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
python3 - <<'PY'
import os
src = open("examples/tools/check_links.py", encoding="utf-8").read()
ns = {"__file__": os.path.abspath("examples/life/tools/check_links.py"), "__name__": "__main__"}
exec(compile(src, ns["__file__"], "exec"), ns)
PY
