#!/usr/bin/env python3
"""Basic checks for the static site.

Checks local href/src targets, duplicate <body> tags, and duplicate MathJax includes.
External URLs are intentionally ignored.
"""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag
import sys

ROOT = Path(__file__).resolve().parents[1]
EXTERNAL_PREFIXES = ("http://", "https://", "mailto:", "tel:", "data:", "#")


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.links.append((tag, name, value))


def local_target(source: Path, raw_url: str):
    url = urldefrag(raw_url)[0]
    if not url or url.startswith(EXTERNAL_PREFIXES):
        return None
    if url.endswith("/"):
        return (source.parent / url / "index.html").resolve()
    return (source.parent / url).resolve()


def main() -> int:
    errors = []

    for html_file in sorted(ROOT.glob("**/*.html")):
        if ".git" in html_file.parts:
            continue

        text = html_file.read_text(errors="ignore")
        rel_file = html_file.relative_to(ROOT)

        if text.count("<body") > 1:
            errors.append(f"{rel_file}: duplicate <body> tags")

        if text.count("</body>") > 1:
            errors.append(f"{rel_file}: duplicate </body> tags")

        if text.count('id="MathJax-script"') > 1:
            errors.append(f"{rel_file}: duplicate MathJax includes")

        parser = LinkParser()
        parser.feed(text)

        for tag, attr, raw_url in parser.links:
            target = local_target(html_file, raw_url)
            if target is None:
                continue

            try:
                rel_target = target.relative_to(ROOT)
            except ValueError:
                errors.append(f"{rel_file}: {tag} {attr} escapes site root: {raw_url}")
                continue

            if not target.exists():
                errors.append(f"{rel_file}: missing {tag} {attr} target: {raw_url} -> {rel_target}")

    if errors:
        print("Site check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Site check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
