"""Data acquisition with reproducible snapshots.

Both upstream files are release assets that are overwritten in place
(play-by-play weekly in season; nfl4th's precomputed values on its own
schedule). Every download is therefore written to a dated snapshot and
recorded in ``data/snapshots.json`` with its SHA-256, so a report can name the
exact bytes it was built from.
"""
from __future__ import annotations

import hashlib
import json
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

PBP_URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
NFL4TH_URL = (
    "https://github.com/nflverse/nfl4th/releases/download/"
    "nfl4th_infrastructure/pre_computed_go_boost.rds"
)

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
RAW_DIR = DATA_DIR / "raw"
MANIFEST = DATA_DIR / "snapshots.json"


@dataclass(frozen=True)
class Snapshot:
    name: str
    url: str
    path: str
    sha256: str
    bytes: int
    retrieved_at: str


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_manifest() -> dict:
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}


def _record(snap: Snapshot) -> None:
    manifest = _load_manifest()
    manifest[snap.name] = snap.__dict__
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def fetch(name: str, url: str, filename: str, refresh: bool = False) -> Path:
    """Download ``url`` into the raw dir (unless already present) and record it."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / filename
    if refresh or not dest.exists():
        tmp = dest.with_suffix(dest.suffix + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(dest)
        _record(Snapshot(
            name=name, url=url, path=str(dest.relative_to(DATA_DIR)),
            sha256=_sha256(dest), bytes=dest.stat().st_size,
            retrieved_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        ))
    return dest


def load_pbp(season: int, refresh: bool = False) -> pd.DataFrame:
    path = fetch(f"pbp_{season}", PBP_URL.format(season=season), f"play_by_play_{season}.parquet", refresh)
    return pd.read_parquet(path)


def load_nfl4th(refresh: bool = False) -> pd.DataFrame:
    """nfl4th's precomputed per-play option values (2014 onward).

    Columns: game_id, play_id, go_boost, go_wp, punt_wp, fg_wp, boot_pct,
    boot_go_pct, go_boost_lo, go_boost_hi. ``*_wp`` are probabilities (0-1);
    ``go_boost`` and its interval are percentage points.
    """
    import pyreadr

    path = fetch("nfl4th_pre_computed", NFL4TH_URL, "pre_computed_go_boost.rds", refresh)
    df = next(iter(pyreadr.read_r(str(path)).values()))
    df["play_id"] = df["play_id"].astype(float)
    return df


def snapshot_info() -> dict:
    return _load_manifest()
