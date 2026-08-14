"""Storage abstraction for Aida 2.0.

Production storage is Google Sheets. The adapter intentionally exposes the small
Mongo-like surface used by the existing FastAPI code so endpoints can migrate
without a risky all-at-once rewrite.

Required environment variables:
- GOOGLE_SERVICE_ACCOUNT_JSON: full service-account JSON
- GOOGLE_SHEETS_SPREADSHEET_ID: Aida database spreadsheet id

No medical data is persisted locally by this module.
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account


SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

# Existing API collection names -> tabs created in Aida 2.0 — Database.
SHEET_NAMES = {
    "profiles": "profiles",
    "labs": "labs",
    "symptoms": "symptoms",
    "medications": "medications",
    "vitals": "vitals",
    "checkins": "checkins",
    "tasks": "tasks",
    "chat_messages": "chat",
    "puzzle": "puzzle",
    "files": "files",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _encode(value: Any) -> str:
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False, default=str, separators=(",", ":"))


def _decode(value: Any) -> Any:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except Exception:
        # Compatibility with manually edited cells / pre-existing plain values.
        return value


def _matches(doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
    for key, expected in (query or {}).items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op, target in expected.items():
                if op == "$gte" and (actual is None or str(actual) < str(target)):
                    return False
                if op == "$gt" and (actual is None or str(actual) <= str(target)):
                    return False
                if op == "$lte" and (actual is None or str(actual) > str(target)):
                    return False
                if op == "$lt" and (actual is None or str(actual) >= str(target)):
                    return False
                if op == "$in" and actual not in target:
                    return False
        elif actual != expected:
            return False
    return True


class GoogleSheetsClient:
    def __init__(self, spreadsheet_id: str, service_account_json: str):
        self.spreadsheet_id = spreadsheet_id
        info = json.loads(service_account_json)
        self.credentials = service_account.Credentials.from_service_account_info(
            info, scopes=[SHEETS_SCOPE]
        )
        self._auth_request = GoogleAuthRequest()
        self._lock = threading.RLock()

    def _headers(self) -> Dict[str, str]:
        with self._lock:
            if not self.credentials.valid:
                self.credentials.refresh(self._auth_request)
            return {
                "Authorization": f"Bearer {self.credentials.token}",
                "Content-Type": "application/json",
            }

    def _url(self, suffix: str) -> str:
        return f"{SHEETS_API}/{self.spreadsheet_id}/{suffix}"

    def values_get(self, sheet: str) -> List[List[Any]]:
        rng = quote(f"'{sheet}'!A:ZZ", safe="")
        r = requests.get(
            self._url(f"values/{rng}"), headers=self._headers(), timeout=20
        )
        r.raise_for_status()
        return r.json().get("values", [])

    def values_update(self, sheet: str, range_a1: str, values: List[List[Any]]) -> None:
        rng = quote(f"'{sheet}'!{range_a1}", safe="")
        r = requests.put(
            self._url(f"values/{rng}?valueInputOption=RAW"),
            headers=self._headers(),
            json={"range": f"'{sheet}'!{range_a1}", "majorDimension": "ROWS", "values": values},
            timeout=20,
        )
        r.raise_for_status()

    def values_append(self, sheet: str, values: List[List[Any]]) -> None:
        rng = quote(f"'{sheet}'!A:ZZ", safe="")
        r = requests.post(
            self._url(
                f"values/{rng}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"
            ),
            headers=self._headers(),
            json={"majorDimension": "ROWS", "values": values},
            timeout=20,
        )
        r.raise_for_status()

    def clear_row(self, sheet: str, row_number: int, width: int) -> None:
        # Keep row positions stable; blank rows are ignored when reading.
        end_col = _column_letter(max(1, width))
        rng = quote(f"'{sheet}'!A{row_number}:{end_col}{row_number}", safe="")
        r = requests.post(
            self._url(f"values/{rng}:clear"), headers=self._headers(), json={}, timeout=20
        )
        r.raise_for_status()


def _column_letter(index: int) -> str:
    out = ""
    while index:
        index, rem = divmod(index - 1, 26)
        out = chr(65 + rem) + out
    return out or "A"


class SheetsCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs

    def sort(self, field: str, direction: int):
        reverse = direction < 0
        self.docs.sort(
            key=lambda item: (item.get(field) is None, str(item.get(field) or "")),
            reverse=reverse,
        )
        return self

    async def to_list(self, length: int) -> List[Dict[str, Any]]:
        return self.docs[:length]


class SheetsCollection:
    def __init__(self, client: GoogleSheetsClient, name: str):
        self.client = client
        self.name = name
        self.sheet = SHEET_NAMES.get(name, name)
        self._write_lock = asyncio.Lock()

    def _read_sync(self) -> tuple[List[str], List[tuple[int, Dict[str, Any]]]]:
        rows = self.client.values_get(self.sheet)
        if not rows:
            return [], []
        headers = [str(x).strip() for x in rows[0]]
        docs: List[tuple[int, Dict[str, Any]]] = []
        for row_number, row in enumerate(rows[1:], start=2):
            if not any(str(v).strip() for v in row):
                continue
            doc: Dict[str, Any] = {}
            for idx, header in enumerate(headers):
                if header and idx < len(row):
                    value = _decode(row[idx])
                    if value is not None:
                        doc[header] = value
            if doc:
                docs.append((row_number, doc))
        return headers, docs

    async def _read(self):
        return await asyncio.to_thread(self._read_sync)

    async def _ensure_headers(self, headers: List[str], doc: Dict[str, Any]) -> List[str]:
        required = list(headers)
        for key in doc.keys():
            if key not in required:
                required.append(key)
        if not required:
            required = list(doc.keys())
        if required != headers:
            await asyncio.to_thread(
                self.client.values_update, self.sheet, f"A1:{_column_letter(len(required))}1", [required]
            )
        return required

    def find(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None):
        # Mongo returns a cursor synchronously, while data loading is async. The
        # server only chains .sort().to_list(), so use a lazy cursor wrapper.
        return LazySheetsCursor(self, query or {})

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        _, rows = await self._read()
        for _, doc in rows:
            if _matches(doc, query):
                return dict(doc)
        return None

    async def insert_one(self, doc: Dict[str, Any]):
        async with self._write_lock:
            payload = dict(doc)
            payload.setdefault("created_at", _now())
            payload["updated_at"] = _now()
            headers, _ = await self._read()
            headers = await self._ensure_headers(headers, payload)
            row = [_encode(payload.get(h)) for h in headers]
            await asyncio.to_thread(self.client.values_append, self.sheet, [row])
        return {"inserted_id": payload.get("id")}

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        async with self._write_lock:
            headers, rows = await self._read()
            patch = dict(update.get("$set", update))
            for row_number, doc in rows:
                if not _matches(doc, query):
                    continue
                doc.update(patch)
                doc["updated_at"] = _now()
                headers = await self._ensure_headers(headers, doc)
                row = [_encode(doc.get(h)) for h in headers]
                await asyncio.to_thread(
                    self.client.values_update,
                    self.sheet,
                    f"A{row_number}:{_column_letter(len(headers))}{row_number}",
                    [row],
                )
                return {"matched_count": 1, "modified_count": 1}
            if upsert:
                doc = dict(query)
                doc.update(patch)
                await self.insert_one(doc)
                return {"matched_count": 0, "modified_count": 0, "upserted": True}
        return {"matched_count": 0, "modified_count": 0}

    async def delete_one(self, query: Dict[str, Any]):
        async with self._write_lock:
            headers, rows = await self._read()
            for row_number, doc in rows:
                if _matches(doc, query):
                    await asyncio.to_thread(
                        self.client.clear_row, self.sheet, row_number, len(headers)
                    )
                    return {"deleted_count": 1}
        return {"deleted_count": 0}

    async def delete_many(self, query: Dict[str, Any]):
        async with self._write_lock:
            headers, rows = await self._read()
            targets = [row_number for row_number, doc in rows if _matches(doc, query)]
            for row_number in targets:
                await asyncio.to_thread(
                    self.client.clear_row, self.sheet, row_number, len(headers)
                )
            return {"deleted_count": len(targets)}

    async def count_documents(self, query: Dict[str, Any]):
        _, rows = await self._read()
        return sum(1 for _, doc in rows if _matches(doc, query))


class LazySheetsCursor:
    def __init__(self, collection: SheetsCollection, query: Dict[str, Any]):
        self.collection = collection
        self.query = query
        self.sort_field: Optional[str] = None
        self.sort_direction = 1

    def sort(self, field: str, direction: int):
        self.sort_field = field
        self.sort_direction = direction
        return self

    async def to_list(self, length: int):
        _, rows = await self.collection._read()
        docs = [dict(doc) for _, doc in rows if _matches(doc, self.query)]
        if self.sort_field:
            docs.sort(
                key=lambda item: (
                    item.get(self.sort_field) is None,
                    str(item.get(self.sort_field) or ""),
                ),
                reverse=self.sort_direction < 0,
            )
        return docs[:length]


class GoogleSheetsDB:
    def __init__(self, client: GoogleSheetsClient):
        self.client = client
        self._collections: Dict[str, SheetsCollection] = {}

    def __getattr__(self, name: str) -> SheetsCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = SheetsCollection(self.client, name)
        return self._collections[name]


class DisabledStorage:
    """Fails closed when production credentials are not configured."""

    def __getattr__(self, name: str):
        raise RuntimeError(
            "Google storage is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON "
            "and GOOGLE_SHEETS_SPREADSHEET_ID."
        )


def build_storage_from_env():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
    if not raw or not spreadsheet_id:
        return DisabledStorage()
    return GoogleSheetsDB(GoogleSheetsClient(spreadsheet_id, raw))
