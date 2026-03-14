#!/usr/bin/env python3
"""Safely remove selected player accounts from the Rotworm Killer SQLite database."""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    static_dir = Path(__file__).parent.resolve()
    default_db_path = Path(os.environ.get("DATA_DIR", str(static_dir))) / "game.db"

    parser = argparse.ArgumentParser(
        description=(
            "Delete one or more player accounts by username from game.db without "
            "affecting other rows."
        )
    )
    parser.add_argument(
        "usernames",
        nargs="+",
        help="One or more usernames to remove.",
    )
    parser.add_argument(
        "--db",
        default=str(default_db_path),
        help=(
            "Path to SQLite database file "
            "(default: DATA_DIR/game.db, or script directory/game.db)."
        ),
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip creating a .bak backup copy before deletion.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without modifying the database.",
    )
    return parser.parse_args()


def ensure_backup(db_path: Path) -> Path:
    backup_path = db_path.with_name(f"{db_path.stem}.bak{db_path.suffix}")
    shutil.copy2(db_path, backup_path)
    return backup_path


def get_players_to_delete(conn: sqlite3.Connection, usernames: list[str]) -> list[sqlite3.Row]:
    placeholders = ",".join("?" for _ in usernames)
    query = (
        f"SELECT id, username, score, level FROM players "
        f"WHERE username IN ({placeholders}) ORDER BY username"
    )
    return conn.execute(query, usernames).fetchall()


def delete_players(conn: sqlite3.Connection, player_ids: list[int]) -> tuple[int, int]:
    placeholders = ",".join("?" for _ in player_ids)

    # Remove sessions explicitly for compatibility with setups where
    # foreign_keys pragma may not be enabled.
    session_result = conn.execute(
        f"DELETE FROM sessions WHERE player_id IN ({placeholders})",
        player_ids,
    )
    player_result = conn.execute(
        f"DELETE FROM players WHERE id IN ({placeholders})",
        player_ids,
    )
    return session_result.rowcount, player_result.rowcount


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).resolve()

    if not db_path.exists():
        print(f"Database not found: {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    try:
        usernames = sorted({u.strip() for u in args.usernames if u.strip()})
        if not usernames:
            print("No valid usernames provided.", file=sys.stderr)
            return 1

        players = get_players_to_delete(conn, usernames)
        found_usernames = {row["username"] for row in players}
        missing = [u for u in usernames if u not in found_usernames]

        if not players:
            print("No matching accounts found. Nothing to delete.")
            return 0

        print("Accounts selected for deletion:")
        for row in players:
            print(
                f"- {row['username']} (id={row['id']}, score={row['score']}, level={row['level']})"
            )

        if missing:
            print("Not found:")
            for username in missing:
                print(f"- {username}")

        if args.dry_run:
            print("\nDry-run mode: no changes were made.")
            return 0

        if not args.no_backup:
            backup_path = ensure_backup(db_path)
            print(f"Backup created: {backup_path}")

        player_ids = [row["id"] for row in players]
        with conn:
            session_count, player_count = delete_players(conn, player_ids)

        print(f"Deleted sessions: {session_count}")
        print(f"Deleted players:  {player_count}")
        print("Done.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
