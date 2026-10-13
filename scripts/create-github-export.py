#!/usr/bin/env python3
import os
import zipfile
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "apps" / "web" / "public"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TARGET_ZIP = OUTPUT_DIR / "qooqnos-phoenix-github.zip"
LEGACY_ZIP = OUTPUT_DIR / "qooqnos-phoenix-project.zip"

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "coverage",
    ".wrangler",
    ".wrangler-dry-run",
    ".wrangler-dry-run-production",
    ".idea",
    ".vscode",
    "__pycache__",
}

EXCLUDE_EXTENSIONS = {
    ".tsbuildinfo",
    ".zip",
    ".log",
}

EXCLUDE_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "ehthumbs.db",
}

def should_include(rel_path: Path) -> bool:
    parts = rel_path.parts
    for part in parts:
        if part in EXCLUDE_DIRS:
            return False
    if rel_path.name in EXCLUDE_FILES:
        return False
    if rel_path.suffix in EXCLUDE_EXTENSIONS:
        return False
    return True

def build_zip():
    print(f"Creating GitHub export archive from {ROOT_DIR}...")
    temp_zip = OUTPUT_DIR / "temp_export.zip"
    if temp_zip.exists():
        temp_zip.unlink()

    included_count = 0
    with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(ROOT_DIR):
            # filter directories in-place to avoid descending into excluded dirs
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                abs_path = Path(root) / file
                rel_path = abs_path.relative_to(ROOT_DIR)
                
                if should_include(rel_path):
                    # Write with forward slash relative path for cross-platform compatibility
                    archive_name = str(rel_path).replace("\\", "/")
                    zf.write(abs_path, arcname=archive_name)
                    included_count += 1

    # Move temp_zip to target names
    shutil.copy2(temp_zip, TARGET_ZIP)
    shutil.copy2(temp_zip, LEGACY_ZIP)
    temp_zip.unlink()

    size_mb = TARGET_ZIP.stat().st_size / (1024 * 1024)
    print(f"Export created successfully: {included_count} files, {size_mb:.2f} MB")
    print(f"Saved to: {TARGET_ZIP} and {LEGACY_ZIP}")

if __name__ == "__main__":
    build_zip()
