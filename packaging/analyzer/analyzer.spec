# PyInstaller spec for the local analyzer sidecar.
# Run from the repository root:
#   pyinstaller packaging/analyzer/analyzer.spec --noconfirm
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

ROOT = Path(SPECPATH).resolve().parents[1]

datas = []
binaries = []
hiddenimports = [
    "app.main",
    "app.analysis",
    "app.chords",
    "app.vocals",
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]

for package in ("essentia", "onnxruntime", "uvicorn", "fastapi", "starlette", "pydantic"):
    package_datas, package_binaries, package_hidden = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hidden

datas += [(str(ROOT / "services/analyzer/models" / "*.onnx"), "models")]

a = Analysis(
    [str(ROOT / "packaging/analyzer/entrypoint.py")],
    pathex=[str(ROOT / "services/analyzer")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["pytest", "httpx", "onnxruntime.quantization", "onnx"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="analyzer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="analyzer",
)
