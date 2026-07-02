#!/usr/bin/env python3
"""
EPPO Oil Prices Connectivity Test Script

This script tests if the EPPO website is accessible and oil prices can be scraped.
Run this before deploying to catch EPPO connectivity issues early.

Usage:
    python scripts/test_oil_prices.py
"""

import sys
import re
import httpx


EPPO_OIL_URL = (
    "https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php"
)

IMAGE_MAP = [
    ("oil_name2.png", "gasohol_95", "แก๊สโซฮอล์ 95"),
    ("oil_name3.png", "gasohol_91", "แก๊สโซฮอล์ 91"),
    ("oil_name4.png", "gasohol_e20", "แก๊สโซฮอล์ E20"),
    ("oil_name5.png", "gasohol_e85", "แก๊สโซฮอล์ E85"),
    ("oil_name10.png", "benzene_95", "เบนซิน 95"),
    ("oil_name6v2.png", "diesel", "ดีเซล"),
]


def parse_eppo_html(html: str) -> list[dict]:
    """Parse EPPO oil price HTML, return PTT (first) price for each oil type."""
    rows = re.findall(
        r"oil_price_colum_name'>\s*<img[^>]+src='[^']*/([^'/]+)'[^<]*</div>(.*?)"
        r"(?=<div class='oil_price_colum_name_|<div style='clear:both)",
        html,
        re.DOTALL,
    )
    row_map = {}
    for img_file, rest in rows:
        prices = re.findall(r"oil_price_colum'>([\d.]+)<", rest)
        if prices:
            try:
                row_map[img_file] = float(prices[0])
            except ValueError:
                pass

    result = []
    for img_file, key, name in IMAGE_MAP:
        if img_file in row_map:
            result.append(
                {
                    "key": key,
                    "name": name,
                    "price": row_map[img_file],
                    "unit": "บาท/ลิตร",
                }
            )
    return result


def test_eppo_connection() -> None:
    """Test if EPPO website is accessible and oil prices can be scraped"""
    
    print("\n" + "=" * 80)
    print("🧪 EPPO Oil Prices Connection Test")
    print("=" * 80 + "\n")
    
    print(f"🔍 Testing EPPO Website Access")
    print(f"🔗 URL: {EPPO_OIL_URL}")
    print("-" * 80)
    
    try:
        print("⏳ Fetching oil prices from EPPO...")
        
        response = httpx.get(
            EPPO_OIL_URL,
            timeout=10.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ART-Workspace/1.0)"}
        )
        
        print(f"📡 HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ EPPO website is accessible!")
            
            # Try to parse oil prices
            try:
                prices = parse_eppo_html(response.text)
                
                if prices:
                    print("✅ Oil prices parsed successfully!")
                    print(f"📊 Found {len(prices)} fuel types")
                    
                    print("\n📋 Current Oil Prices:")
                    print("-" * 80)
                    for price_data in prices:
                        name = price_data["name"]
                        price = price_data["price"]
                        unit = price_data["unit"]
                        print(f"  • {name:<20} {price:>6.2f} {unit}")
                    
                    print("\n" + "=" * 80)
                    print("🎉 SUCCESS! EPPO oil prices are accessible and valid.")
                    print("=" * 80)
                    
                else:
                    print("❌ ERROR: No oil prices found in HTML")
                    print("\n🔧 Possible causes:")
                    print("   1. EPPO website HTML structure has changed")
                    print("   2. Scraping regex patterns need updating")
                    print("   3. EPPO is showing a different page (maintenance mode)")
                    print("\n" + "=" * 80)
                    print("⚠️  FAILED: No prices found")
                    print("=" * 80)
                    assert False, "No oil prices found"
                    
            except Exception as e:
                print(f"❌ ERROR: Failed to parse EPPO HTML")
                print(f"   Details: {str(e)}")
                print("\n🔧 This likely means EPPO changed their HTML structure.")
                print("   The scraping code needs to be updated.")
                print("\n" + "=" * 80)
                print("⚠️  FAILED: HTML parsing error")
                print("=" * 80)
                assert False, f"HTML parsing error: {str(e)}"
                
        elif response.status_code == 403:
            print("❌ ERROR: Access denied (HTTP 403)")
            print("\n🔧 Possible causes:")
            print("   1. EPPO is blocking our User-Agent")
            print("   2. EPPO requires different headers")
            print("   3. IP-based blocking")
            print("\n" + "=" * 80)
            print("⚠️  FAILED: Access denied")
            print("=" * 80)
            assert False, "Access denied (HTTP 403)"
            
        elif response.status_code == 404:
            print("❌ ERROR: Page not found (HTTP 404)")
            print("\n🔧 Possible causes:")
            print("   1. EPPO changed the URL")
            print("   2. The page has been moved")
            print("   3. EPPO website is down")
            print("\n" + "=" * 80)
            print("⚠️  FAILED: Page not found")
            print("=" * 80)
            assert False, "Page not found (HTTP 404)"
            
        else:
            print(f"❌ ERROR: Unexpected HTTP status code: {response.status_code}")
            print("\n" + "=" * 80)
            print(f"⚠️  FAILED: HTTP {response.status_code}")
            print("=" * 80)
            assert False, f"Unexpected HTTP status code: {response.status_code}"
            
    except httpx.TimeoutException:
        print("❌ ERROR: Connection timeout")
        print("   EPPO website is not responding within 10 seconds")
        print("\n🔧 Possible causes:")
        print("   1. EPPO website is slow or overloaded")
        print("   2. Network connectivity issues")
        print("   3. EPPO server is down")
        print("\n" + "=" * 80)
        print("⚠️  FAILED: Timeout")
        print("=" * 80)
        assert False, "Connection timeout"
        
    except httpx.ConnectError as e:
        print(f"❌ ERROR: Connection failed")
        print(f"   Details: {str(e)}")
        print("\n🔧 Possible causes:")
        print("   1. EPPO website is down")
        print("   2. DNS resolution failed")
        print("   3. Network connectivity issues")
        print("\n" + "=" * 80)
        print("⚠️  FAILED: Connection error")
        print("=" * 80)
        assert False, f"Connection failed: {str(e)}"
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print("\n" + "=" * 80)
        print("⚠️  FAILED: Unexpected error")
        print("=" * 80)
        assert False, f"Unexpected error: {str(e)}"


def main():
    """Main entry point"""
    
    success = test_eppo_connection()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
