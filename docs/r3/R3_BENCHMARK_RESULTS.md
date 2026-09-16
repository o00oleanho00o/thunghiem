# R3.1b Benchmark Results

The ABB-backed benchmark contains 24 physical device instances across eight exact S201U-C type designations and eight distinct manufacturer order codes. The cabinet metadata is `R3.1 ABB S200 U engineering-truth cabinet`.

Heuristic and OR-Tools CP-SAT both produce zero overlap pairs and zero validation errors. The final validation is Engineering Layout Valid with explicit warnings for policy clearance, unknown terminal model and unknown service access. It is not Manufacturing Ready.

The final DXF reopens with ezdxf as `AC1009`, with 311 modelspace entities (`262 LINE`, `49 TEXT`) and zero audit errors. One manual correction remains locked through regeneration. The comparison does not claim CP-SAT is universally better; this small cabinet is already solved by the deterministic heuristic.
