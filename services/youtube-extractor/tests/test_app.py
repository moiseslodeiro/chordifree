import importlib
import json

import pytest


@pytest.fixture()
def extractor(monkeypatch):
    monkeypatch.setenv("EXTRACTOR_TOKEN", "secret")
    import app as module

    return importlib.reload(module)


@pytest.fixture()
def client(extractor):
    return extractor.create_app().test_client()


def auth_headers():
    return {"X-Chordifree-Token": "secret"}


def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_endpoints_require_the_token(client):
    response = client.post("/probe", json={"videoId": "dQw4w9WgXcQ"})
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "EXTRACTOR_UNAUTHORIZED"


def test_probe_parses_metadata(client, extractor, monkeypatch):
    monkeypatch.setattr(
        extractor,
        "run_ytdlp",
        lambda args, code: json.dumps({"duration": 213, "title": "Demo"}),
    )
    response = client.post(
        "/probe",
        json={"videoId": "dQw4w9WgXcQ"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.get_json() == {"duration": 213, "title": "Demo"}


def test_probe_rejects_invalid_ids(client):
    response = client.post(
        "/probe",
        json={"videoId": "nope"},
        headers=auth_headers(),
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "INVALID_REQUEST"


def test_search_normalizes_results(client, extractor, monkeypatch):
    payload = {
        "entries": [
            {
                "id": "dQw4w9WgXcQ",
                "title": "Never Gonna Give You Up",
                "uploader": "Rick Astley",
                "duration": 213,
            },
            {"id": "live1234567", "title": "Live", "live_status": "is_live"},
            {"id": "bad", "title": "Bad"},
        ]
    }
    monkeypatch.setattr(extractor, "run_ytdlp", lambda args, code: json.dumps(payload))
    response = client.get("/search?q=rick", headers=auth_headers())
    assert response.status_code == 200
    results = response.get_json()["results"]
    assert len(results) == 1
    assert results[0]["videoId"] == "dQw4w9WgXcQ"
    assert results[0]["thumbnail"].endswith("dQw4w9WgXcQ/mqdefault.jpg")


def test_download_returns_the_audio(client, extractor, monkeypatch):
    def fake_run(args, code):
        out = args[args.index("-o") + 1]
        path = out.replace("%(ext)s", "m4a")
        with open(path, "wb") as handle:
            handle.write(b"audio")
        return ""

    monkeypatch.setattr(extractor, "run_ytdlp", fake_run)
    response = client.post(
        "/download",
        json={"videoId": "dQw4w9WgXcQ"},
        headers=auth_headers(),
    )
    assert response.status_code == 200
    assert response.data == b"audio"
    assert response.headers["X-Filename"] == "dQw4w9WgXcQ.m4a"
