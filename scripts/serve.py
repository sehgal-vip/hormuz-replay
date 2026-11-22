# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Serve the replay app on http://localhost:8770 (static files plus /api/ask)."""
import gzip
import http.server
import json
import os
import pathlib
import time
import threading
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "app"


# Extra hostnames allowed when the app is exposed through a tunnel, e.g. PUBLIC_HOSTS=abc.ngrok-free.app
PUBLIC_HOSTS = {h.strip() for h in os.environ.get("PUBLIC_HOSTS", "").split(",") if h.strip()}
ASK_LOG = {}
GZ = {}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP), **kw)

    MAX_BODY = 64 * 1024
    _ask_lock = threading.Lock()  # one model call at a time: a flood cannot pile up requests

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def _local(self):
        """Refuse requests whose Host or Origin is not this machine (blocks DNS rebinding and
        cross-site POSTs from other web pages to the local chat endpoint)."""
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        local = ("localhost", "127.0.0.1", "::1")
        if host not in local and host not in PUBLIC_HOSTS:
            return False
        origin = self.headers.get("Origin")
        if origin:
            o = urllib.parse.urlparse(origin)
            if o.hostname in local:
                return o.port == self.server.server_address[1]
            return o.hostname in PUBLIC_HOSTS and o.hostname == host
        return True

    def _rate_ok(self):
        """At most 6 chat questions a minute per client when exposed through a tunnel."""
        ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
        now = time.time()
        hits = [t for t in ASK_LOG.get(ip, []) if now - t < 60]
        if len(hits) >= 6:
            ASK_LOG[ip] = hits
            return False
        ASK_LOG[ip] = hits + [now]
        return True

    def _json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self._local():
            return self.send_error(403)
        # Compress text files for slow links (the flights file is 11 MB raw); cached after the first use.
        path = pathlib.Path(self.translate_path(self.path))
        if ("gzip" in (self.headers.get("Accept-Encoding") or "") and path.is_file()
                and path.suffix in (".json", ".js", ".css", ".html")):
            key = (str(path), path.stat().st_mtime)
            if key not in GZ:
                GZ[key] = gzip.compress(path.read_bytes(), 6)
            data = GZ[key]
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(path)) + ("; charset=utf-8" if path.suffix != ".json" else ""))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(data)))
            # Big, rarely changing files may be cached briefly; the page, script and styles are always rechecked.
            static = "/data/" in self.path or "/vendor/" in self.path
            self.send_header("Cache-Control", "public, max-age=300" if static else "no-cache")
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._local():
            return self.send_error(403)
        super().do_HEAD()

    def do_POST(self):
        if not self._local():
            return self.send_error(403)
        if self.path != "/api/ask":
            return self.send_error(404)
        if "json" not in (self.headers.get("Content-Type") or ""):
            return self._json(415, {"error": "Send JSON."})
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if not 0 < n <= self.MAX_BODY:
            return self._json(413, {"error": "Request too large or empty."})
        try:
            body = json.loads(self.rfile.read(n))
            if not isinstance(body, dict):
                raise ValueError
        except ValueError:
            return self._json(400, {"error": "Bad request."})
        if not self._rate_ok():
            return self._json(429, {"error": "Too many questions. Wait a minute."})
        if not self._ask_lock.acquire(timeout=120):
            return self._json(429, {"error": "The agent is busy. Try again."})
        try:
            import agent
            self._json(200, {"answer": agent.answer(body)})
        except ImportError:
            self._json(503, {"error": "The agent is not available."})
        except Exception as e:  # log detail here; the panel gets a short message only
            print(f"agent error: {type(e).__name__}: {e}", flush=True)
            self._json(500, {"error": "The agent could not answer. Is LM Studio running with the model loaded?"})
        finally:
            self._ask_lock.release()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 8770), Handler)
    except OSError:
        print("Port 8770 is already in use: the app is probably already running. Open http://localhost:8770")
        raise SystemExit(0)
    def keep_warm():
        # Load the local model and cache the evidence prefix now, then every 5 minutes,
        # so a demo question is answered in seconds, not minutes (the model unloads after an idle hour).
        import time
        while True:
            try:
                import agent
                t0 = time.time()
                agent.warm()
                print(f"chat model warm ({time.time() - t0:.1f} s)", flush=True)
            except Exception as e:  # LM Studio not running or model not loaded: try again later
                print(f"chat warm-up skipped: {e}", flush=True)
            time.sleep(300)

    import threading
    threading.Thread(target=keep_warm, daemon=True).start()
    print("Serving http://localhost:8770 (Ctrl+C to stop)")
    server.serve_forever()
