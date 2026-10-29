"""Portable tools launcher. Python 3 standard library only."""
import json,sys,threading,webbrowser
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
from urllib.parse import quote
from serve import NoCache
ROOT=Path(__file__).resolve().parents[1]
class Handler(NoCache):
    def do_GET(self):
        if self.path == '/api/tool-health':
            b=json.dumps({'root':str(ROOT),'app':'sam-heroes-tools','assetLayout':2}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
        else:super().do_GET()
mode=sys.argv[1] if len(sys.argv)>1 else 'maker'
paths={'maker':'/web/maker.html?samgukMap='+quote('1장_황건소탕'),'motion':'/web/motion.html','maps':'/web/maps.html','game':'/web/index.html?pack=samguk','new-game':'/web/index.html?pack=samguk&profile=review&new=1','ui':'/web/ui-review.html'}
page=paths.get(mode,paths['maker'])
for port in range(8134,8155):
    address=f'http://127.0.0.1:{port}'
    try:
        with urlopen(address+'/api/tool-health',timeout=.3) as response:info=json.load(response)
        if info.get('root')==str(ROOT) and info.get('app')=='sam-heroes-tools' and info.get('assetLayout')==2:
            webbrowser.open(address+page);sys.exit(0)
    except Exception:pass
    try:server=ThreadingHTTPServer(('127.0.0.1',port),partial(Handler,directory=str(ROOT)))
    except OSError:continue
    print('Sam Heroes tools:',address+page,flush=True)
    print('Keep this window open while editing. Ctrl+C stops the server.',flush=True)
    threading.Timer(.5,lambda:webbrowser.open(address+page)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:server.server_close()
    break
else:raise SystemExit('No free port in 8134-8154')
