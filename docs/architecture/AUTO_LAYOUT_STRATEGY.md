# Auto-layout Strategy

The prototype intentionally compares two engines.

## Transparent heuristic

1. Classify parts into power, control, auxiliary, and terminal groups.
2. Bin DIN parts onto deterministic rail rows, large parts first.
3. Reserve edge ducts and corridors before assigning coordinates.
4. Place terminal rows at the service side and backplate parts in a reserved
   region.
5. Snap to a millimetre grid and emit metrics (overlap pairs, utilization,
   elapsed time).

This is fast and inspectable, but it needs explicit capacity handling when a
group needs multiple rails.

## CP-SAT spike

`solver_layout` seeds from the heuristic, uses integer millimetres,
`AddNoOverlap2D`, plate bounds, allowed rail baselines, locked placements, and
an objective combining distance from the seed with approximate connection
length. It has a bounded time limit and reports `OPTIMAL`, `FEASIBLE`, or an
explicit fallback status. It is not yet a full thermal/EMC/serviceability
solver.

## Scale evidence

`evidence/test-logs/layout_benchmark.json` records synthetic 2/10/32-motor runs
with 13/61/193 components. In the captured Windows run the 13-part solve was
`OPTIMAL`; the 61- and 193-part solves were `FEASIBLE` within the bounded time,
all with zero reported validation errors and overlap pairs. These are single
runs, not a statistically stable performance benchmark or proof that all
approximately 100-part cabinets are tractable. The benchmark is deliberately
allowed to expose infeasibility or timeout; a production planner should
partition by zone and return a capacity issue rather than overlap components
silently. Target limits for this spike remain near-instant 10 parts, practical
30 parts, and measured (not guaranteed) behavior around 100 parts.

## Next constraints

- separate duct occupancy from component no-overlap;
- thermal/EMC zones and service clearance;
- terminal accessibility and wire-bend radius;
- rail compatibility and accessory locking;
- connection-aware channel routing and wire-length objective;
- explainable repair suggestions when a model is infeasible.
