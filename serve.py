"""Local web server for the viewer that tells the browser never to cache, so a plain refresh always shows the latest
scene data and code.   python serve.py [port]"""
import sys, http.server, functools, os


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *a):   # keep the window quiet
        pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
here = os.path.dirname(os.path.abspath(__file__))
print(f"viewer: http://127.0.0.1:{port}/web/   (close this window to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=here)).serve_forever()
