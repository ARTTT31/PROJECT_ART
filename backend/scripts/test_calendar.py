#!/usr/bin/env python3
"""
Google Calendar Connectivity Test Script

This script tests if your Google Calendar is properly configured and accessible.
Run this before deploying to catch configuration issues early.

Usage:
    python scripts/test_calendar.py [CALENDAR_ID]

If no CALENDAR_ID is provided, it will use the one from frontend/.env.local
"""

import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch
import httpx
from icalendar import Calendar

# ---------------------------------------------------------------------------
# Minimal valid iCal payload used by the unit test mock
# ---------------------------------------------------------------------------
MOCK_ICAL_CONTENT = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ART Workspace//Test//EN
BEGIN:VEVENT
UID:test-event-001@art-workspace
SUMMARY:Mock Test Event
DTSTART:20260701T090000Z
DTEND:20260701T100000Z
END:VEVENT
END:VCALENDAR
"""


# ---------------------------------------------------------------------------
# Core connectivity helpers (used both by tests and by main())
# ---------------------------------------------------------------------------

def fetch_ical(calendar_id: str) -> httpx.Response:
    """Fetch the iCal feed for the given Google Calendar ID."""
    ical_url = (
        f"https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics"
    )
    return httpx.get(ical_url, timeout=10.0, follow_redirects=True)


def check_calendar_response(response: httpx.Response) -> None:
    """
    Inspect an HTTP response from Google Calendar.
    Raises AssertionError with a descriptive message on failure.
    """
    if response.status_code == 200:
        try:
            calendar = Calendar.from_ical(response.content)
        except Exception as exc:
            raise AssertionError(
                f"Calendar data is invalid or corrupted: {exc}"
            ) from exc

        event_count = sum(
            1 for component in calendar.walk() if component.name == "VEVENT"
        )
        print(f"  📊 Found {event_count} event(s) in calendar")
        return  # success

    if response.status_code == 404:
        raise AssertionError("Calendar not found (HTTP 404). Check the Calendar ID and public visibility settings.")
    if response.status_code == 403:
        raise AssertionError("Access denied (HTTP 403). Set the calendar to 'Make available to public'.")
    raise AssertionError(f"Unexpected HTTP status: {response.status_code}")


def get_calendar_id_from_env() -> str | None:
    """Try to read calendar ID from frontend/.env.local"""
    possible_paths = [
        Path(__file__).parent.parent.parent / "frontend" / ".env.local",
        Path.cwd() / "frontend" / ".env.local",
    ]
    for env_path in possible_paths:
        if env_path.exists():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("NEXT_PUBLIC_GOOGLE_CALENDAR_ID="):
                            value = line.split("=", 1)[1].strip()
                            if value:
                                return value
            except Exception as exc:
                print(f"⚠️  Could not read .env.local: {exc}")
    return None


# ---------------------------------------------------------------------------
# Pytest-compatible unit tests (no live network calls)
# ---------------------------------------------------------------------------

def test_calendar_success_mock() -> None:
    """
    Unit test: mocks httpx.get to return HTTP 200 with valid iCal content.
    Validates that check_calendar_response parses the mocked iCal without errors.
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = MOCK_ICAL_CONTENT

    with patch("scripts.test_calendar.httpx.get", return_value=mock_response):
        fetch_ical("mock-calendar-id@group.calendar.google.com")

    # Should not raise
    check_calendar_response(mock_response)


def test_calendar_404_raises() -> None:
    """
    Unit test: mocks a HTTP 404 response and asserts that check_calendar_response
    raises AssertionError containing '404'.
    """
    mock_response = MagicMock()
    mock_response.status_code = 404

    try:
        check_calendar_response(mock_response)
        assert False, "Expected AssertionError for HTTP 404"
    except AssertionError as exc:
        assert "404" in str(exc)


def test_calendar_403_raises() -> None:
    """
    Unit test: mocks a HTTP 403 response and asserts that check_calendar_response
    raises AssertionError containing '403'.
    """
    mock_response = MagicMock()
    mock_response.status_code = 403

    try:
        check_calendar_response(mock_response)
        assert False, "Expected AssertionError for HTTP 403"
    except AssertionError as exc:
        assert "403" in str(exc)


# ---------------------------------------------------------------------------
# CLI entry point (live run — not executed by pytest)
# ---------------------------------------------------------------------------

def main() -> None:
    """Main entry point for running as a standalone script."""
    print("\n" + "=" * 80)
    print("🧪 Google Calendar Configuration Test")
    print("=" * 80 + "\n")

    calendar_id = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.environ.get("TEST_CALENDAR_ID") or get_calendar_id_from_env()
    )

    if not calendar_id:
        print("❌ ERROR: No Calendar ID provided.")
        print(f"  Usage: python {sys.argv[0]} <CALENDAR_ID>")
        print("  Or set NEXT_PUBLIC_GOOGLE_CALENDAR_ID in frontend/.env.local")
        sys.exit(1)

    print(f"📅 Calendar ID : {calendar_id}")

    try:
        response = fetch_ical(calendar_id)
        print(f"📡 HTTP Status : {response.status_code}")
        check_calendar_response(response)
        print("🎉 SUCCESS! Calendar is properly configured.")
        sys.exit(0)
    except AssertionError as exc:
        print(f"⚠️  FAILED: {exc}")
        sys.exit(1)
    except httpx.TimeoutException:
        print("⚠️  FAILED: Connection timeout")
        sys.exit(1)
    except Exception as exc:
        print(f"⚠️  FAILED: Unexpected error — {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
