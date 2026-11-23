"""Command line entry point.

    nfldi build --season 2025 --season 2026:live
    nfldi refresh            # re-download upstream files (new snapshot)
"""
from __future__ import annotations

import argparse


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="nfldi")
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build web/data JSON from the current snapshots")
    b.add_argument("--season", action="append", required=True,
                   help="season year; append ':live' for an in-progress season, e.g. 2026:live")
    r = sub.add_parser("refresh", help="re-download play-by-play and nfl4th values")
    r.add_argument("--season", type=int, action="append", required=True)
    args = p.parse_args(argv)

    from .nfl import export, sources

    if args.cmd == "refresh":
        for s in args.season:
            sources.load_pbp(s, refresh=True)
        sources.load_nfl4th(refresh=True)
    elif args.cmd == "build":
        seasons = {}
        for s in args.season:
            year, _, mode = s.partition(":")
            seasons[int(year)] = mode != "live"
        export.build(seasons)
        print("built", ", ".join(args.season))


if __name__ == "__main__":
    main()
