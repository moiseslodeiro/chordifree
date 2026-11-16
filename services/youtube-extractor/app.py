import hmac
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import threading
from contextlib import contextmanager

from flask import Flask, jsonify, request, send_file
from werkzeug.exceptions import HTTPException

EXTRACTOR_VERSION = "0.1.0"
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
SEARCH_RESULT_LIMIT = 10


class ExtractorError(Exception):
    def __init__(self, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def ytdlp_path() -> str:
    return env("YTDLP_PATH", "yt-dlp")


def base_args() -> list[str]:
    args = ["--no-playlist", "--no-warnings", "--no-progress", "--no-part"]
    proxy = env("YTDLP_PROXY")
    if proxy:
        args.extend(["--proxy", proxy])
    cookies = env("YTDLP_COOKIES_FILE")
    if cookies:
        args.extend(["--cookies", cookies])
    return args


def timeout_seconds() -> int:
    try:
        return max(30, int(env("EXTRACTOR_TIMEOUT_SECONDS", "180")))
    except ValueError:
        return 180


def is_video_id(value: object) -> bool:
    return isinstance(value, str) and bool(VIDEO_ID_PATTERN.fullmatch(value))


def video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def run_ytdlp(args: list[str], error_code: str) -> str:
    command = [ytdlp_path(), *base_args(), *args]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds(),
            check=False,
        )
    except FileNotFoundError as exc:
        raise ExtractorError(
            "EXTRACTOR_UNAVAILABLE",
            "yt-dlp is not installed or YTDLP_PATH is wrong",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise ExtractorError("EXTRACTOR_TIMEOUT", "yt-dlp timed out", 504) from exc

    if completed.returncode != 0:
        lines = [line.strip() for line in (completed.stderr or "").splitlines() if line.strip()]
        message = lines[-1] if lines else "yt-dlp failed"
        lowered = message.lower()
        if "not a bot" in lowered or "sign in to confirm" in lowered or "login_required" in lowered:
            raise ExtractorError(
                "YOUTUBE_BLOCKED",
                "YouTube is blocking this extractor. Try again later or use another network.",
                422,
            )
        raise ExtractorError(error_code, message, 422)

    return completed.stdout


def parse_probe(stdout: str) -> dict:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise ExtractorError("VIDEO_UNAVAILABLE", "yt-dlp returned invalid metadata", 422) from exc

    try:
        duration = float(payload.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0
    if duration <= 0:
        raise ExtractorError("VIDEO_UNAVAILABLE", "The video has no usable duration", 422)

    result = {"duration": duration}
    title = payload.get("title")
    if isinstance(title, str) and title.strip():
        result["title"] = title.strip()
    return result


def parse_search(stdout: str) -> dict:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise ExtractorError("SEARCH_FAILED", "yt-dlp returned invalid search data", 502) from exc

    entries = payload.get("entries") if isinstance(payload, dict) else None
    results = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        video_id = entry.get("id")
        title = entry.get("title")
        if not is_video_id(video_id) or not isinstance(title, str) or not title.strip():
            continue
        if entry.get("live_status") in {"is_live", "is_upcoming"}:
            continue
        result = {
            "videoId": video_id,
            "title": title.strip(),
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
        }
        uploader = entry.get("uploader") or entry.get("channel")
        if isinstance(uploader, str) and uploader.strip():
            result["uploader"] = uploader.strip()
        duration = entry.get("duration")
        if isinstance(duration, (int, float)) and duration > 0:
            result["duration"] = duration
        results.append(result)
    return {"results": results}


def create_app() -> Flask:
    app = Flask(__name__)
    token = env("EXTRACTOR_TOKEN")
    run_lock = threading.Lock()

    @contextmanager
    def exclusive_run():
        if not run_lock.acquire(blocking=False):
            raise ExtractorError(
                "EXTRACTOR_BUSY",
                "The extractor is busy with another video",
                429,
            )
        try:
            yield
        finally:
            run_lock.release()

    @app.before_request
    def authenticate():
        if request.path == "/health":
            return None
        if not token:
            raise ExtractorError(
                "EXTRACTOR_UNAUTHORIZED",
                "EXTRACTOR_TOKEN is not configured",
                503,
            )
        supplied = request.headers.get("X-Chordifree-Token", "")
        if not hmac.compare_digest(supplied, token):
            raise ExtractorError("EXTRACTOR_UNAUTHORIZED", "Invalid extractor token", 401)
        return None

    @app.errorhandler(ExtractorError)
    def handle_extractor_error(error: ExtractorError):
        return (
            jsonify({"error": {"code": error.code, "message": error.message}}),
            error.status,
        )

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return (
            jsonify(
                {
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": error.description or error.name,
                    }
                }
            ),
            error.code or 500,
        )

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "extractorVersion": EXTRACTOR_VERSION})

    @app.post("/probe")
    def probe():
        body = request.get_json(silent=True) or {}
        video_id = body.get("videoId")
        if not is_video_id(video_id):
            raise ExtractorError("INVALID_REQUEST", "A valid videoId is required", 400)
        with exclusive_run():
            stdout = run_ytdlp(
                [
                    "--skip-download",
                    "--dump-single-json",
                    video_url(video_id),
                ],
                "VIDEO_UNAVAILABLE",
            )
        return jsonify(parse_probe(stdout))

    @app.get("/search")
    def search():
        query = (request.args.get("q") or "").strip()
        if not query or len(query) > 120:
            raise ExtractorError("INVALID_REQUEST", "A query between 1 and 120 characters is required", 400)
        with exclusive_run():
            stdout = run_ytdlp(
                [
                    "--skip-download",
                    "--flat-playlist",
                    "--dump-single-json",
                    f"ytsearch{SEARCH_RESULT_LIMIT}:{query}",
                ],
                "SEARCH_FAILED",
            )
        return jsonify(parse_search(stdout))

    @app.post("/download")
    def download():
        body = request.get_json(silent=True) or {}
        video_id = body.get("videoId")
        if not is_video_id(video_id):
            raise ExtractorError("INVALID_REQUEST", "A valid videoId is required", 400)

        workspace = tempfile.mkdtemp(prefix="chordifree-extractor-")
        try:
            with exclusive_run():
                stdout = run_ytdlp(
                    [
                        "-f",
                        "bestaudio[ext=m4a]/bestaudio",
                        "-o",
                        os.path.join(workspace, f"{video_id}.%(ext)s"),
                        video_url(video_id),
                    ],
                    "VIDEO_UNAVAILABLE",
                )
                # yt-dlp writes the file; stdout is only useful for logs.
                _ = stdout
                candidates = sorted(
                    path
                    for path in os.listdir(workspace)
                    if path.startswith(f"{video_id}.") and not path.endswith(".part")
                )
                if not candidates:
                    raise ExtractorError("VIDEO_UNAVAILABLE", "yt-dlp did not produce an audio file", 422)
                filename = candidates[0]
                path = os.path.join(workspace, filename)
                mimetype = mimetypes.guess_type(filename)[0] or "application/octet-stream"

            response = send_file(
                path,
                mimetype=mimetype,
                as_attachment=True,
                download_name=filename,
                max_age=0,
            )
            response.headers["X-Filename"] = filename
            response.call_on_close(lambda: shutil.rmtree(workspace, ignore_errors=True))
            return response
        except Exception:
            shutil.rmtree(workspace, ignore_errors=True)
            raise

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8010, threaded=False)
