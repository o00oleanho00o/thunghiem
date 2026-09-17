# CNB Engineering Web

Canonical R5 frontend for the unified engineering workbench. It keeps the
proven panel composer interaction surface and mounts the pinned mlightcad DXF
viewer through `packages/adapters/mlightcad` in the CAD source tab.

The `experiments/oss/*` Vite hosts remain test harnesses only. Production-like
local mode is one frontend on port 4200 and one modular-monolith API on 8200.
