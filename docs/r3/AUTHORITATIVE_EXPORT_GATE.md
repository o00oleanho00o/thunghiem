# Authoritative Export Gate

`POST /api/export` now runs CAD approval and an engineering gate before DXF, SVG or audit output. Blocking errors include E001 outside plate, E002 overlap, E003 invalid DIN attachment, E004 clearance, E005 blocked service access, E006 duct collision, E007 duplicate tag, E008 broken topology, E009 unknown part and E010 missing footprint.

The gate returns HTTP 422 with machine-readable `validation.errors`. A deliberately invalid fixture is covered by `tests/test_r3_engineering_truth.py` and the browser API test. Preview-only CAD is still blocked independently of geometry validation.
