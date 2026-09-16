"""Record retrieval status without promoting a blocked endpoint to vendor proof."""
from __future__ import annotations
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / "catalog/r3/products.json").read_text(encoding="utf-8"))
results = []
for product in catalog["products"]:
    request = Request(product["source_url"], headers={"User-Agent": "cnb-electrical-lab-evidence/1.0"}, method="HEAD")
    try:
        with urlopen(request, timeout=15) as response:
            results.append({"id": product["id"], "url": product["source_url"], "status": response.status, "retrievable": True})
    except HTTPError as error:
        results.append({"id": product["id"], "url": product["source_url"], "status": error.code, "retrievable": False, "error": "http"})
    except (URLError, TimeoutError, OSError) as error:
        results.append({"id": product["id"], "url": product["source_url"], "status": None, "retrievable": False, "error": error.__class__.__name__})
out = root / "evidence/r3/source-retrieval.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"policy": "retrieval status is evidence only; review_verified records are not vendor_verified", "results": results}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps(results, indent=2))
