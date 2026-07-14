from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Sequence
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.cache.memory_cache import cache_get
from app.services.data_loader_and_semantics.load_data import AnalysisScope, load_all_data

DEFAULT_USER_MAP_ID = 70697
DEFAULT_START_DATE = "2026-04-01"
DEFAULT_END_DATE = "2026-04-30"
DEFAULT_OUTPUT_DIR = Path("exports")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export cached Metamorphosis billing/analysis data to CSV files.")
    parser.add_argument("--user-map-id", type=int, default=DEFAULT_USER_MAP_ID, help="Clinic user_map_id (default: %(default)s)")
    parser.add_argument("--start-date", default=DEFAULT_START_DATE, help="Range start date, YYYY-MM-DD (default: %(default)s)")
    parser.add_argument("--end-date", default=DEFAULT_END_DATE, help="Range end date, YYYY-MM-DD (default: %(default)s)")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory to write CSVs into (default: %(default)s)")
    return parser.parse_args(argv)


async def run_export(user_map_id: int, start_date: str, end_date: str, *, output_dir: Path) -> list[Path]:
    """Load sales_period plus service_sell/product_sell (both clinic and all-clinics scope) and export 5 CSVs.

    Runs the load and the export in the same process because the in-memory cache is per-process.
    """
    result = await load_all_data(
        user_map_id, start_date, end_date, analysis_scope=AnalysisScope.BOTH, build_semantics=False
    )

    output_dir.mkdir(parents=True, exist_ok=True)

    written_paths: list[Path] = []

    for entry in result["entries"]:
        df = cache_get(entry["cache_key"])
        path = output_dir / f"{entry['dataset']}_{entry['scope']}_{start_date}_{end_date}.csv"
        df.to_csv(path, index=False)
        written_paths.append(path)
        print(f"Wrote {len(df)} row(s) -> {path}")

    return written_paths


def main() -> None:
    args = parse_args()
    written_paths = asyncio.run(run_export(args.user_map_id, args.start_date, args.end_date, output_dir=args.output_dir))
    print(f"\nExported {len(written_paths)} CSV file(s) to {args.output_dir}/")


if __name__ == "__main__":
    main()
