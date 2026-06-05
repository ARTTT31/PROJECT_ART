"""
Synchronous HTTP server for Calendar API
No asyncio - pure synchronous to avoid Windows compatibility issues
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import urllib.request
from datetime import datetime, timezone
from icalendar import Calendar

class CalendarHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed_path = urlparse(self.path)
            path = parsed_path.path
            
            if path == '/':
                response = {
                    'message': 'Calendar API Server (Sync)',
                    'status': 'running',
                    'endpoints': {
                        'calendar': '/api/v1/calendar/events'
                    }
                }
                self._send_json_response(200, response)
                
            elif path == '/api/v1/calendar/events':
                try:
                    # Parse query parameters
                    query_params = parse_qs(parsed_path.query)
                    calendar_id = query_params.get('calendar_id', [None])[0]
                    time_min = query_params.get('time_min', [None])[0]
                    time_max = query_params.get('time_max', [None])[0]
                    
                    if not calendar_id:
                        self._send_json_response(400, {'error': 'calendar_id required'})
                        return
                    
                    # Fetch calendar events synchronously
                    events = self.fetch_calendar_events_sync(calendar_id, time_min, time_max)
                    self._send_json_response(200, events)
                    
                except Exception as e:
                    print(f"❌ Error processing request: {e}")
                    import traceback
                    traceback.print_exc()
                    self._send_json_response(500, {'error': str(e)})
            else:
                self._send_json_response(404, {'error': 'Not found'})
                
        except Exception as e:
            print(f"❌ Fatal error in do_GET: {e}")
            import traceback
            traceback.print_exc()
            try:
                self._send_json_response(500, {'error': 'Internal server error'})
            except:
                pass
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Content-Length', '0')
        self.end_headers()
    
    def _send_json_response(self, status_code, data):
        """Send JSON response with proper headers"""
        response_data = json.dumps(data).encode('utf-8')
        
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()
        self.wfile.write(response_data)
        self.wfile.flush()
    
    def fetch_calendar_events_sync(self, calendar_id, time_min=None, time_max=None):
        """Fetch and parse calendar events synchronously"""
        ical_url = f"https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics"
        
        print(f"📍 Fetching: {ical_url}")
        
        # Fetch iCal data using urllib (synchronous)
        try:
            with urllib.request.urlopen(ical_url, timeout=30) as response:
                ical_data = response.read()
        except Exception as e:
            print(f"❌ Error fetching iCal: {e}")
            raise Exception(f"Failed to fetch calendar: {str(e)}")
        
        print(f"✅ Fetched {len(ical_data)} bytes")
        
        # Parse iCal data
        calendar = Calendar.from_ical(ical_data)
        
        # Parse time filters
        time_min_dt = None
        time_max_dt = None
        
        if time_min:
            time_min_dt = datetime.fromisoformat(time_min.replace('Z', '+00:00'))
            if time_min_dt.tzinfo is None:
                time_min_dt = time_min_dt.replace(tzinfo=timezone.utc)
        
        if time_max:
            time_max_dt = datetime.fromisoformat(time_max.replace('Z', '+00:00'))
            if time_max_dt.tzinfo is None:
                time_max_dt = time_max_dt.replace(tzinfo=timezone.utc)
        
        # Extract events
        events = []
        for component in calendar.walk():
            if component.name == "VEVENT":
                try:
                    # Get event properties
                    summary = str(component.get('summary', ''))
                    
                    # Get start time
                    dtstart = component.get('dtstart')
                    if not dtstart:
                        continue
                    start = dtstart.dt
                    
                    # Get end time
                    dtend = component.get('dtend')
                    if dtend:
                        end = dtend.dt
                    else:
                        duration = component.get('duration')
                        if duration:
                            end = start + duration.dt
                        else:
                            end = start
                    
                    description = str(component.get('description', '')) if component.get('description') else None
                    location = str(component.get('location', '')) if component.get('location') else None
                    uid = str(component.get('uid', ''))
                    
                    # Convert to datetime if needed
                    if isinstance(start, datetime):
                        start_dt = start
                        if start_dt.tzinfo is None:
                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                    else:
                        start_dt = datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc)
                    
                    if isinstance(end, datetime):
                        end_dt = end
                        if end_dt.tzinfo is None:
                            end_dt = end_dt.replace(tzinfo=timezone.utc)
                    else:
                        end_dt = datetime.combine(end, datetime.min.time()).replace(tzinfo=timezone.utc)
                    
                    # Apply time range filter
                    if time_min_dt and start_dt < time_min_dt:
                        continue
                    if time_max_dt and start_dt > time_max_dt:
                        continue
                    
                    events.append({
                        'id': uid,
                        'title': summary,
                        'start': start_dt.isoformat(),
                        'end': end_dt.isoformat(),
                        'description': description,
                        'location': location
                    })
                except Exception as e:
                    print(f"⚠️  Skipping event due to error: {e}")
                    continue
        
        # Sort by start time
        events.sort(key=lambda x: x['start'])
        
        print(f"✅ Parsed {len(events)} events")
        
        return events
    
    def log_message(self, format, *args):
        """Override to show request logs"""
        print(f"🌐 {self.address_string()} - {format % args}")

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CalendarHandler)
    httpd.timeout = 60  # Set socket timeout
    
    print(f"=" * 60)
    print(f"🚀 Calendar API Server (Synchronous)")
    print(f"=" * 60)
    print(f"📍 Server running on http://localhost:{port}")
    print(f"📍 API: http://localhost:{port}/api/v1/calendar/events")
    print(f"=" * 60)
    print("✨ Synchronous version - No asyncio issues!")
    print("Press Ctrl+C to stop")
    print()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped")
        httpd.shutdown()

if __name__ == '__main__':
    run_server(8000)
