#!/usr/bin/env python3
"""Fetch the current Microsoft Store direct download link for OpenAI Codex."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from html.parser import HTMLParser


API_URL = "https://store.rg-adguard.net/api/GetFiles"
DEFAULT_STORE_URL = "https://apps.microsoft.com/detail/9plm9xgg6vks?hl=zh-CN"


@dataclass(frozen=True)
class StoreFile:
    name: str
    url: str
    expires: str
    sha1: str
    size: str


class StoreTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.files: list[StoreFile] = []
        self._in_row = False
        self._in_cell = False
        self._current_cells: list[str] = []
        self._current_text: list[str] = []
        self._current_href = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._in_row = True
            self._current_cells = []
            self._current_href = ""
            return

        if not self._in_row:
            return

        if tag == "td":
            self._in_cell = True
            self._current_text = []
        elif tag == "a":
            attr_map = dict(attrs)
            self._current_href = attr_map.get("href") or ""

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._in_cell:
            text = html.unescape("".join(self._current_text)).strip()
            self._current_cells.append(re.sub(r"\s+", " ", text))
            self._in_cell = False
            return

        if tag == "tr" and self._in_row:
            if self._current_href and len(self._current_cells) >= 4:
                self.files.append(
                    StoreFile(
                        name=self._current_cells[0],
                        url=html.unescape(self._current_href),
                        expires=self._current_cells[1],
                        sha1=self._current_cells[2],
                        size=self._current_cells[3],
                    )
                )
            self._in_row = False


def fetch_store_html(
    store_url: str,
    *,
    query_type: str,
    gl: str,
    ring: str,
    lang: str,
    timeout: int,
) -> str:
    form = urllib.parse.urlencode(
        {
            "type": query_type,
            "url": store_url,
            "gl": gl,
            "ring": ring,
            "lang": lang,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        API_URL,
        data=form,
        method="POST",
        headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Encoding": "identity",
            "Accept-Language": f"{lang},zh;q=0.9,en;q=0.8",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://store.rg-adguard.net",
            "Referer": "https://store.rg-adguard.net/",
            "Sec-Ch-Ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0.0.0 Safari/537.36"
            ),
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"request failed: {exc}") from exc


def parse_files(page_html: str) -> list[StoreFile]:
    if "Just a moment" in page_html and "challenge-platform" in page_html:
        raise RuntimeError("request was blocked by Cloudflare challenge")

    parser = StoreTableParser()
    parser.feed(page_html)
    return parser.files


def version_key(name: str) -> tuple[int, ...]:
    match = re.search(r"_([0-9]+(?:\.[0-9]+){1,})_", name)
    if not match:
        return ()
    return tuple(int(part) for part in match.group(1).split("."))


def size_key(size: str) -> float:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*([KMGTP]?B)", size, re.I)
    if not match:
        return 0.0
    value = float(match.group(1))
    unit = match.group(2).upper()
    scale = {"KB": 1, "MB": 2, "GB": 3, "TB": 4, "PB": 5}.get(unit, 0)
    return value * (1024**scale)


def select_files(
    files: list[StoreFile],
    *,
    name_contains: str,
    arch: str,
    extension: str,
) -> list[StoreFile]:
    extension = extension.lower()
    needle = name_contains.lower()
    arch_marker = f"_{arch.lower()}_"

    matches = [
        item
        for item in files
        if item.name.lower().endswith(extension)
        and needle in item.name.lower()
        and arch_marker in item.name.lower()
    ]
    return sorted(matches, key=lambda item: (version_key(item.name), size_key(item.size)), reverse=True)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Get the current direct Microsoft Store download link for OpenAI Codex."
    )
    parser.add_argument("--url", default=DEFAULT_STORE_URL, help="Microsoft Store URL or product id.")
    parser.add_argument("--type", default="url", help="rg-adguard query type, e.g. url or ProductId.")
    parser.add_argument("--gl", default="US", help="Store market/region.")
    parser.add_argument("--ring", default="RP", help="Store ring/channel, e.g. Retail, RP, WIS, WIF.")
    parser.add_argument("--lang", default="zh-CN", help="Response language.")
    parser.add_argument("--name-contains", default="OpenAI.Codex", help="Filename substring to keep.")
    parser.add_argument("--arch", default="x64", help="Architecture marker to keep.")
    parser.add_argument("--extension", default=".msix", help="Package extension to keep.")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds.")
    parser.add_argument("--all", action="store_true", help="Print all matching rows instead of only the best URL.")
    parser.add_argument("--json", action="store_true", help="Print matching rows as JSON.")
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()

    page_html = fetch_store_html(
        args.url,
        query_type=args.type,
        gl=args.gl,
        ring=args.ring,
        lang=args.lang,
        timeout=args.timeout,
    )
    files = parse_files(page_html)
    matches = select_files(
        files,
        name_contains=args.name_contains,
        arch=args.arch,
        extension=args.extension,
    )

    if not matches:
        print("No matching files found.", file=sys.stderr)
        print(f"Parsed {len(files)} files from response.", file=sys.stderr)
        return 2

    if args.json:
        payload = matches if args.all else matches[:1]
        print(json.dumps([asdict(item) for item in payload], ensure_ascii=False, indent=2))
    elif args.all:
        for item in matches:
            print(f"{item.name}\t{item.size}\t{item.expires}\t{item.url}")
    else:
        print(matches[0].url)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
