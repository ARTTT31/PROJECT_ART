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
import httpx
from icalendar import Calendar


def test_calendar(calendar_id: str) -> bool:
    """Test if a Google Calendar is publicly accessible"""
    
    ical_url = f"https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics"
    
    print(f"🔍 Testing Calendar Access")
    print(f"📅 Calendar ID: {calendar_id}")
    print(f"🔗 iCal URL: {ical_url}")
    print("-" * 80)
    
    try:
        print("⏳ Fetching calendar data...")
        response = httpx.get(ical_url, timeout=10.0, follow_redirects=True)
        
        print(f"📡 HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Calendar is accessible!")
            
            # Try to parse iCal data
            try:
                calendar = Calendar.from_ical(response.content)
                print("✅ iCalendar data is valid!")
                
                # Count events
                event_count = 0
                for component in calendar.walk():
                    if component.name == "VEVENT":
                        event_count += 1
                
                print(f"📊 Found {event_count} event(s) in calendar")
                
                # Show first 3 events as sample
                if event_count > 0:
                    print("\n📋 Sample Events:")
                    count = 0
                    for component in calendar.walk():
                        if component.name == "VEVENT" and count < 3:
                            title = str(component.get("summary", "No title"))
                            start = component.get("dtstart")
                            start_str = str(start.dt) if start else "Unknown"
                            print(f"  {count + 1}. {title} (Start: {start_str})")
                            count += 1
                
                print("\n" + "=" * 80)
                print("🎉 SUCCESS! Your calendar is properly configured.")
                print("=" * 80)
                return True
                
            except Exception as e:
                print(f"❌ ERROR: Calendar data is invalid or corrupted")
                print(f"   Details: {str(e)}")
                print("\n" + "=" * 80)
                print("⚠️  FAILED: Calendar data cannot be parsed")
                print("=" * 80)
                return False
                
        elif response.status_code == 404:
            print("❌ ERROR: Calendar not found (HTTP 404)")
            print("\n🔧 How to fix:")
            print("   1. Verify the Calendar ID is correct")
            print("   2. Make sure the calendar exists in your Google Calendar")
            print("   3. Set calendar to 'Public' in Google Calendar settings:")
            print("      - Open Google Calendar")
            print("      - Click ⋮ (three dots) next to calendar name")
            print("      - Select 'Settings and sharing'")
            print("      - Under 'Access permissions', check 'Make available to public'")
            print("      - Set to 'See all event details'")
            print("\n" + "=" * 80)
            print("⚠️  FAILED: Calendar is not public or doesn't exist")
            print("=" * 80)
            return False
            
        elif response.status_code == 403:
            print("❌ ERROR: Access denied (HTTP 403)")
            print("\n🔧 How to fix:")
            print("   1. Calendar must be set to 'Public'")
            print("   2. Go to Google Calendar settings:")
            print("      - Click ⋮ (three dots) next to calendar name")
            print("      - Select 'Settings and sharing'")
            print("      - Under 'Access permissions', check 'Make available to public'")
            print("      - Set to 'See all event details' (not just free/busy)")
            print("\n" + "=" * 80)
            print("⚠️  FAILED: Calendar is private or restricted")
            print("=" * 80)
            return False
            
        else:
            print(f"❌ ERROR: Unexpected HTTP status code: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            print("\n" + "=" * 80)
            print(f"⚠️  FAILED: Unexpected error (HTTP {response.status_code})")
            print("=" * 80)
            return False
            
    except httpx.TimeoutException:
        print("❌ ERROR: Connection timeout")
        print("   Google Calendar service may be unreachable")
        print("\n" + "=" * 80)
        print("⚠️  FAILED: Timeout")
        print("=" * 80)
        return False
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print("\n" + "=" * 80)
        print("⚠️  FAILED: Unexpected error")
        print("=" * 80)
        return False


def get_calendar_id_from_env() -> str | None:
    """Try to read calendar ID from frontend/.env.local"""
    
    # Try to find frontend/.env.local
    possible_paths = [
        Path(__file__).parent.parent.parent / "frontend" / ".env.local",
        Path.cwd() / "frontend" / ".env.local",
    ]
    
    for env_path in possible_paths:
        if env_path.exists():
            print(f"📁 Found .env.local at: {env_path}")
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.startswith("NEXT_PUBLIC_GOOGLE_CALENDAR_ID="):
                            calendar_id = line.split("=", 1)[1].strip()
                            if calendar_id:
                                print(f"✅ Using Calendar ID from .env.local")
                                return calendar_id
            except Exception as e:
                print(f"⚠️  Could not read .env.local: {e}")
    
    return None


def main():
    """Main entry point"""
    
    print("\n" + "=" * 80)
    print("🧪 Google Calendar Configuration Test")
    print("=" * 80 + "\n")
    
    # Get calendar ID from command line or environment
    calendar_id = None
    
    if len(sys.argv) > 1:
        calendar_id = sys.argv[1]
        print(f"📝 Using Calendar ID from command line argument")
    else:
        print("📝 No Calendar ID provided, trying to read from frontend/.env.local...")
        calendar_id = get_calendar_id_from_env()
    
    if not calendar_id:
        print("\n❌ ERROR: No Calendar ID provided!")
        print("\nUsage:")
        print(f"  python {sys.argv[0]} <CALENDAR_ID>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} your-email@group.calendar.google.com")
        print("\nOr set NEXT_PUBLIC_GOOGLE_CALENDAR_ID in frontend/.env.local")
        sys.exit(1)
    
    print()
    
    # Run test
    success = test_calendar(calendar_id)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
