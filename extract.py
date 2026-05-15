#!/usr/bin/env python3
"""Dump character-creation text from EP2 corebook into per-page files.

The downstream step (build_data.py) parses these into structured JSON.
This script just gets clean text out of the PDF in a stable form.
"""
import sys
from pathlib import Path
from pypdf import PdfReader

PDF = Path("/mnt/c/Users/Tze Dean/Downloads/Telegram Desktop/EclipsePhase2_corebook.pdf")
OUT = Path(__file__).parent / "data" / "raw"
OUT.mkdir(parents=True, exist_ok=True)

# Book-page ranges we care about (book numbering, 1-indexed)
RANGES = {
    "chargen-procedure": (38, 49),
    "skills":            (50, 55),
    "morphs":            (54, 69),
    "gear-packs":        (70, 73),
    "traits":            (74, 82),
    "worked-example":    (83, 83),
    "sample-characters": (84, 99),
    "factions-detail":   (152, 174),
    "async-substrains":  (273, 273),
}

def main():
    r = PdfReader(str(PDF))
    n = len(r.pages)
    print(f"PDF has {n} pages")
    for label, (lo, hi) in RANGES.items():
        outdir = OUT / label
        outdir.mkdir(exist_ok=True)
        for book_page in range(lo, hi + 1):
            idx = book_page - 1
            if idx < 0 or idx >= n:
                continue
            text = r.pages[idx].extract_text() or ""
            (outdir / f"p{book_page:03d}.txt").write_text(text, encoding="utf-8")
        print(f"  {label}: pages {lo}-{hi} → {outdir}")
    print("done")

if __name__ == "__main__":
    main()
