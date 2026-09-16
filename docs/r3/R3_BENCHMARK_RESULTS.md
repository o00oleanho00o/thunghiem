# R3 Benchmark Results

The benchmark is `benchmarks/r3-engineering-truth-cabinet/` and contains eight review-verified Phoenix Contact products, BOM, product resolution, source manifest, canonical EIR, heuristic layout, CP-SAT layout, manual-review layout and regenerated layout.

On the recorded run, heuristic and OR-Tools CP-SAT both produced zero overlap pairs and passed Python validation. CP-SAT completed as `ortools-cp-sat-optimal`; heuristic completed in approximately 4 ms and CP-SAT in approximately 21 ms. One manual correction was made to PS1 and its lock survived regeneration exactly. The final DXF reopened with ezdxf (`AC1009`, 126 modelspace entities, zero audit errors).

The comparison does not claim that CP-SAT is universally better: this small cabinet is already solved by the deterministic heuristic, while CP-SAT adds objective control and a measurable solve cost.
