"""Production entrypoint for Aida 2.0.

This module keeps the current API surface intact while replacing the legacy
Mongo client with Google Sheets storage. It also disables the legacy demo-data
auto-seed on startup.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import os
import sys
import types

from google_storage import build_storage_from_env


# Fail closed: if Google credentials are missing, medical-data access errors
# instead of silently falling back to local/Mongo storage.
_google_db = build_storage_from_env()


class _GoogleCompatClient:
    def __init__(self, *args, **kwargs):
        self.db = _google_db

    def __getitem__(self, name):
        return self.db

    def close(self):
        return None


# server.py still uses a small subset of Motor's collection API. Inject the
# compatibility client before importing it so every db.* operation is backed by
# Google Sheets while endpoints are migrated incrementally.
_motor_pkg = types.ModuleType("motor")
_motor_asyncio = types.ModuleType("motor.motor_asyncio")
_motor_asyncio.AsyncIOMotorClient = _GoogleCompatClient
_motor_pkg.motor_asyncio = _motor_asyncio
sys.modules["motor"] = _motor_pkg
sys.modules["motor.motor_asyncio"] = _motor_asyncio

# Compatibility placeholders only; no Mongo connection is created.
os.environ.setdefault("MONGO_URL", "google-sheets://aida")
os.environ.setdefault("DB_NAME", "aida")

import server as legacy_server  # noqa: E402
from candidate_records import build_candidate_router  # noqa: E402


# Production must never populate empty medical storage with demo profiles,
# analyses, pressure, symptoms, medications or tasks.
legacy_server.app.router.on_startup = [
    handler
    for handler in legacy_server.app.router.on_startup
    if getattr(handler, "__name__", "") != "_startup"
]

app = legacy_server.app
app.include_router(build_candidate_router(_google_db))
