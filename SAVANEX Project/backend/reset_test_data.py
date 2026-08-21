import sqlite3
from pathlib import Path


database = Path(__file__).resolve().parent / 'db.sqlite3'
tables = ('attendance', 'grades', 'report_cards', 'students', 'teachers')

with sqlite3.connect(database) as connection:
    connection.execute('PRAGMA foreign_keys = OFF')
    existing = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    before = {
        table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        for table in tables
        if table in existing
    }
    for table in tables:
        if table in existing:
            connection.execute(f'DELETE FROM "{table}"')
    removed_users = connection.execute(
        "DELETE FROM users WHERE role != 'admin'"
    ).rowcount
    connection.execute('PRAGMA foreign_keys = ON')
    after = {
        table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        for table in tables
        if table in existing
    }
    admins = connection.execute(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'"
    ).fetchone()[0]

print({'before': before, 'removed_users': removed_users, 'after': after, 'admins': admins})
