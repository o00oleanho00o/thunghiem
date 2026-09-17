# R4.1 device-object closure benchmark

This benchmark is intentionally small and evidence-limited. It references four
clean-crop caches derived from the supplied Siemens DXFs; the original files are
not copied or modified. None is placement-capable until identity, view,
mounting, and physical-envelope review is complete.

Run the data checks with `py -3.10 -m pytest tests/test_r41_device_object.py`
and the browser evidence with `node scripts/test_r41_ui.cjs` while the web
server is available on port 4177.
