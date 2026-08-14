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

from storage import build_storage_from_env


# Fail closed: storage.py will raise on data access when Google credentials are
# missing. No local or Mongo fallback is allowed in production.
_google_db = build_storage_from_env()


class _GoogleCompatClient:
    def __init__(self, *args, **kwargs):
        self.db = _google_db

    def __getitem__(self, name):
        return self.db

    def close(self):
        return None


# server.py is still written against a small subset of Motor's collection API.
# Inject a compatibility module before importing it. This is transitional and
# lets us migrate endpoints incrementally without ever persisting to Mongo.
_motor_pkg = types.ModuleType("motor")
_motor_asyncio = types.ModuleType("motor.motor_asyncio")
_motor_asyncio.AsyncIOMotorClient = _GoogleCompatClient
_motor_pkg.motor_asyncio = _motor_asyncio
sys.modules["motor"] = _motor_pkg
sys.modules["motor.motor_asyncio"] = _motor_asyncio

# Legacy server.py reads these eagerly. They are compatibility placeholders;
# no connection is made to MongoDB.
os.environ.setdefault("MONGO_URL", "google-sheets://aida")
os.environ.setdefault("DB_NAME", "aida")

import server as legacy_server  # noqa: E402


# Never populate a production medical database with demo profiles or values.
legacy_server.app.router.on_startup = [
    handler
    for handler in legacy_server.app.router.on_startup
    if getattr(handler, "__name__", "") != "_startup"
]

app = legacy_server.app
