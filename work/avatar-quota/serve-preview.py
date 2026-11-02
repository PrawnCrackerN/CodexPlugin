from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

base = Path(__file__).parent
paths = {'/preview-reset.html': ('preview-reset.html', 'text/html; charset=utf-8'), '/renderer.js': ('install-usage-badge.js', 'text/javascript; charset=utf-8')}

class Preview(BaseHTTPRequestHandler):
    def do_GET(self):
        item = paths.get(self.path)
        if item is None:
            self.send_error(404)
            return
        filename, content_type = item
        data = (base / filename).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

ThreadingHTTPServer(('127.0.0.1', 8767), Preview).serve_forever()
