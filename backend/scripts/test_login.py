"""
Test login API
"""
import requests
import json

def test_login():
    """Test login endpoint"""
    url = "http://localhost:8888/api/v1/auth/login"
    
    payload = {
        "email": "admin@art.com",
        "password": "admin@123",
        "session_id": "test_session_123",
        "user_agent": "Python Test Client",
        "device_label": "Desktop"
    }
    
    print("Testing login API...")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("\n" + "="*60 + "\n")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print("\nResponse Body:")
        
        if response.text:
            try:
                data = response.json()
                print(json.dumps(data, indent=2, ensure_ascii=False))
                
                if data.get("result") == "success":
                    print("\n✓ Login successful!")
                    print(f"  Access Token: {data['data']['access_token'][:50]}...")
                    print(f"  User: {data['data']['user']}")
                else:
                    print("\n✗ Login failed!")
            except:
                print(response.text)
        else:
            print("(Empty response)")
            
    except requests.exceptions.ConnectionError:
        print("✗ Connection Error: Cannot connect to backend server")
        print("  Make sure the backend server is running on port 8888")
    except Exception as e:
        print(f"✗ Error: {str(e)}")

if __name__ == "__main__":
    test_login()
