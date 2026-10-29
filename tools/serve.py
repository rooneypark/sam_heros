"""Static dev server for the web port with caching disabled (python tools/serve.py [port]).

/samguk/...            -> the collaboration repo (SAMGUK_REPO, default sam_heros2/samguk)
POST /api/maps/<name>  -> writes the body (map JSON) to <repo>/content/samguk/maps/<name>.map.json (map maker 저장)
"""
import json
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

SAMGUK = Path(os.environ.get('SAMGUK_REPO', Path(__file__).resolve().parents[1]))

def map_file(name):
    catalog = SAMGUK / 'maps' / 'catalog.json'
    entries = json.loads(catalog.read_text(encoding='utf-8')) if catalog.exists() else {}
    safe = re.sub(r'[\\/:*?"<>|]', '_', name).strip() or 'map'
    return SAMGUK / entries.get(name, f'maps/custom/{safe}/map.json')


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def translate_path(self, path):
        p = unquote(urlparse(path).path)
        match = re.fullmatch(r'/api/maps/([^/]+)', p)
        if match:
            return str(map_file(match.group(1)))
        if p == '/samguk' or p.startswith('/samguk/'):
            rel = Path(*[s for s in p[len('/samguk'):].split('/') if s and s not in ('.', '..')])
            return str(SAMGUK / rel)
        return super().translate_path(path)

    def do_POST(self):
        m = re.fullmatch(r'/api/maps/([^/]+)', unquote(urlparse(self.path).path))
        if not m or not SAMGUK.is_dir():
            self.send_error(404)
            return
        name = re.sub(r'[\\/:*?"<>|]', '_', m.group(1)).strip() or 'map'
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        try:
            doc = json.loads(body)
        except ValueError:
            self.send_error(400, 'invalid json')
            return
        out = map_file(name)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
        res = json.dumps({'path': str(out.relative_to(SAMGUK)).replace('\\', '/')}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(res)))
        self.end_headers()
        self.wfile.write(res)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    root = Path(__file__).resolve().parents[1]
    ThreadingHTTPServer(('127.0.0.1', port), partial(NoCache, directory=str(root))).serve_forever()
