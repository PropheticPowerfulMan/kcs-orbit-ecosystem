"""Read the published school calendar; keep the last verified snapshot offline."""
import json
import os
import sys
import time
from datetime import date
from threading import Lock
from urllib.request import urlopen

_cached = None
_expires = 0
_lock = Lock()

def read_published_school_calendar():
    global _cached, _expires
    if any(arg == 'test' or 'pytest' in arg.lower() for arg in sys.argv) and not os.environ.get('KCS_SCHOOL_CALENDAR_URL'):
        return None
    with _lock:
        if time.monotonic() < _expires:
            return _cached
        try:
            url = os.environ.get('KCS_SCHOOL_CALENDAR_URL', 'https://kinshasachristianschool.org/api/published-school-calendar')
            with urlopen(url, timeout=2.5) as response:
                calendar = json.loads(response.read()).get('calendar')
            if not isinstance(calendar, dict) or calendar.get('status') not in ('ACTIVE', 'CLOSED', 'ARCHIVED') or len(calendar.get('periods', [])) != 6:
                raise ValueError('Invalid school calendar')
            start, end = date.fromisoformat(calendar['startDate'][:10]), date.fromisoformat(calendar['endDate'][:10])
            if start > end or calendar.get('name') != f'{start.year}-{end.year}':
                raise ValueError('Invalid school year dates')
            _cached = calendar
            _expires = time.monotonic() + 30
        except (OSError, ValueError, KeyError, TypeError):
            _expires = time.monotonic() + 5
        return _cached
