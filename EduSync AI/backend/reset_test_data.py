import sqlite3
from pathlib import Path


database = Path(__file__).resolve().parent / 'edusync.db'

with sqlite3.connect(database) as connection:
    connection.execute('PRAGMA foreign_keys = ON')
    removable_users = [
        row[0]
        for row in connection.execute(
            "SELECT id FROM users WHERE role != 'ADMIN'"
        )
    ]
    before = len(removable_users)
    if removable_users:
        placeholders = ','.join('?' for _ in removable_users)
        connection.execute(
            f'DELETE FROM notifications WHERE user_id IN ({placeholders})',
            removable_users,
        )
        connection.execute(
            f'DELETE FROM workflow_items WHERE requester_id IN ({placeholders}) OR approver_id IN ({placeholders})',
            removable_users + removable_users,
        )
        connection.execute(
            f'DELETE FROM announcements WHERE created_by IN ({placeholders})',
            removable_users,
        )
        connection.execute(
            f'DELETE FROM users WHERE id IN ({placeholders})',
            removable_users,
        )
    after = connection.execute(
        "SELECT COUNT(*) FROM users WHERE role != 'ADMIN'"
    ).fetchone()[0]
    admins = connection.execute(
        "SELECT COUNT(*) FROM users WHERE role = 'ADMIN'"
    ).fetchone()[0]

print({'removed_non_admin_users': before, 'remaining_non_admin_users': after, 'admins': admins})
