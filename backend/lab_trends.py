"""Lab biomarker trend aggregation for Aida 2.0.

Only numeric values already stored from real lab reports are plotted. Reference
strings and statuses are preserved verbatim; this module does not invent or
normalize medical reference ranges.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter


_NUM_RE = re.compile(r"[-+]?\d+(?:[\.,]\d+)?")


def _name_key(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _numeric(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if not isinstance(value, str):
        return None
    text = value.strip().replace("\u00a0", " ")
    match = _NUM_RE.search(text)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def build_lab_trends_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/labs", tags=["lab-trends"])

    @router.get("/trends")
    async def lab_trends(profile_id: str):
        labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", 1).to_list(500)
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        display_names: Dict[str, str] = {}

        for lab in labs:
            lab_date = str(lab.get("date") or "")
            for biomarker in lab.get("biomarkers") or []:
                name = str(biomarker.get("name") or "").strip()
                if not name:
                    continue
                numeric_value = _numeric(biomarker.get("value"))
                if numeric_value is None:
                    continue

                key = _name_key(name)
                display_names.setdefault(key, name)
                grouped[key].append({
                    "lab_id": lab.get("id"),
                    "lab_title": lab.get("title"),
                    "date": lab_date,
                    "value": numeric_value,
                    "raw_value": biomarker.get("value"),
                    "unit": biomarker.get("unit"),
                    "reference": biomarker.get("reference"),
                    "status": biomarker.get("status") or "unknown",
                    "verification_status": lab.get("verification_status") or "unverified",
                })

        series = []
        for key, points in grouped.items():
            points.sort(key=lambda p: (p.get("date") or "", p.get("lab_id") or ""))
            if len(points) < 2:
                continue

            units = [p.get("unit") for p in points if p.get("unit")]
            unit = units[-1] if units else None
            compatible_points = [p for p in points if not unit or not p.get("unit") or p.get("unit") == unit]
            if len(compatible_points) < 2:
                continue

            latest = compatible_points[-1]
            previous = compatible_points[-2]
            delta = latest["value"] - previous["value"]
            percent_change = None
            if previous["value"] != 0:
                percent_change = round(delta / abs(previous["value"]) * 100, 1)

            series.append({
                "key": key,
                "name": display_names[key],
                "unit": unit,
                "points": compatible_points,
                "count": len(compatible_points),
                "latest": latest,
                "delta": round(delta, 4),
                "percent_change": percent_change,
            })

        series.sort(key=lambda item: (item["name"] or "").lower())
        return {
            "profile_id": profile_id,
            "series": series,
            "series_count": len(series),
            "lab_count": len(labs),
        }

    return router
