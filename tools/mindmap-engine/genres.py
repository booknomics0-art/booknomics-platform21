"""Genre-adaptive visual identity for Booknomics PNG mind maps."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

GenreKey = Literal[
    "business",
    "psychology",
    "selfhelp",
    "mystery",
    "romance",
    "fantasy",
    "scifi",
    "history",
    "biography",
    "philosophy",
    "productivity",
    "leadership",
    "default",
]


@dataclass(frozen=True)
class GenreTheme:
    key: GenreKey
    label: str
    hero_from: str
    hero_via: str
    hero_to: str
    hero_ink: str
    hero_muted: str
    accent: str
    ink: str
    canvas_from: str
    canvas_to: str
    branches: tuple[str, str, str, str, str, str, str, str]
    motif: str


THEMES: dict[str, GenreTheme] = {
    "business": GenreTheme(
        "business", "Business & Finance",
        "#16224E", "#1E2A5A", "#0E5C46", "#F7F3E6", "#C9CDAE", "#C9A227", "#1B2440",
        "#F4F1E6", "#E9EDF3",
        ("#1E2A5A", "#0E7C5B", "#B8860B", "#2A7F8A", "#475569", "#2F5233", "#8C6A2F", "#3B6EA5"),
        "grid",
    ),
    "psychology": GenreTheme(
        "psychology", "Psychology",
        "#2E4E7E", "#5B5FBF", "#7C6BD6", "#F4F2FB", "#CFC8EA", "#5B5FBF", "#2B2E55",
        "#EFF2FA", "#EDE8F7",
        ("#3B82C4", "#7C6BD6", "#2A9D8F", "#8E6BA8", "#5DA9E9", "#9D8DF1", "#7FB069", "#6C7BD6"),
        "arcs",
    ),
    "selfhelp": GenreTheme(
        "selfhelp", "Self-Help",
        "#8A3B12", "#C2571B", "#D99A2B", "#FFF7EA", "#F3D9B8", "#C2571B", "#3A2412",
        "#FDF5E7", "#FBEEDD",
        ("#D97706", "#E11D48", "#EA580C", "#059669", "#7C3AED", "#0284C7", "#65A30D", "#0D9488"),
        "waves",
    ),
    "mystery": GenreTheme(
        "mystery", "Mystery & Thriller",
        "#191920", "#3A1E28", "#6B1F2A", "#F4EFE6", "#C9B896", "#A8823C", "#26262B",
        "#F1EDE6", "#E4DCD2",
        ("#2B2B2E", "#7A2434", "#A8823C", "#4B5563", "#5C1A24", "#5B7C99", "#9A6B3F", "#4A2545"),
        "lines",
    ),
    "romance": GenreTheme(
        "romance", "Romance",
        "#5C2233", "#7A2E3F", "#A86B7C", "#FBF1EC", "#E4C4BC", "#9D4E5C", "#452530",
        "#FAF1EA", "#F5E6E2",
        ("#7A2E3F", "#D66E7E", "#9D4E5C", "#B99B5F", "#A86B7C", "#C67B5C", "#C99CA5", "#6B4A3A"),
        "arcs",
    ),
    "fantasy": GenreTheme(
        "fantasy", "Fantasy",
        "#1B2A5E", "#27408B", "#0E5C46", "#F2F0E4", "#C4C9A8", "#C9A227", "#232B4E",
        "#EEF0F6", "#E6EFE6",
        ("#27408B", "#0E7C5B", "#B8860B", "#6D4AC8", "#1F8A80", "#9A6B3F", "#3B4CC0", "#7A4A8C"),
        "dots",
    ),
    "scifi": GenreTheme(
        "scifi", "Science Fiction",
        "#0B1B33", "#102A4C", "#0E5E6E", "#EAF6FB", "#A9CFDD", "#0EA5C4", "#16283F",
        "#EDF4F9", "#E2EEF5",
        ("#102A4C", "#0EA5C4", "#2563EB", "#14B8A6", "#4B6B8A", "#7C3AED", "#5EB1E6", "#34D399"),
        "grid",
    ),
    "history": GenreTheme(
        "history", "History",
        "#2F3A24", "#4A3D28", "#6B4A2F", "#F5EDD8", "#D3C29A", "#8C6A2F", "#33301F",
        "#F5EEDC", "#EAE0C8",
        ("#2F5233", "#6B4A2F", "#A8823C", "#8C7A4F", "#6B7C3B", "#9C4A2F", "#5B6570", "#8C5A2B"),
        "lines",
    ),
    "biography": GenreTheme(
        "biography", "Biography",
        "#141414", "#262626", "#4A3D28", "#F7F1E3", "#CFC2A4", "#B8860B", "#1F1F1F",
        "#F4F0E6", "#E9E4D6",
        ("#1A1A1A", "#B8860B", "#3A3A3A", "#8C6A2F", "#4B5563", "#7A5C3E", "#6B6560", "#2B3A55"),
        "lines",
    ),
    "philosophy": GenreTheme(
        "philosophy", "Philosophy",
        "#2B2B2B", "#3D3A33", "#6B5F45", "#FAF7EF", "#CFC6B2", "#8C7A4F", "#2B2B2B",
        "#F7F4EC", "#ECE7D9",
        ("#2B2B2B", "#A8823C", "#6B6560", "#7C8B6F", "#5B6570", "#8C6A2F", "#9C7A5B", "#6B7C5B"),
        "dots",
    ),
    "productivity": GenreTheme(
        "productivity", "Productivity",
        "#1D4ED8", "#2563EB", "#0E7C5B", "#F2F7FF", "#C4DBF5", "#2563EB", "#1E2E4A",
        "#EFF4FD", "#E8F5EC",
        ("#2563EB", "#16A34A", "#0D9488", "#D97706", "#7C3AED", "#0284C7", "#65A30D", "#E11D48"),
        "grid",
    ),
    "leadership": GenreTheme(
        "leadership", "Leadership",
        "#141C44", "#1B2A5C", "#2B3F8C", "#F1F2FA", "#C2C9E4", "#C9A227", "#1B2440",
        "#EFF0F8", "#E6E9F3",
        ("#1B2A5C", "#2B4EFF", "#B8860B", "#3B6EA5", "#475569", "#8C6A2F", "#2A7F8A", "#6B4A6B"),
        "grid",
    ),
    "default": GenreTheme(
        "default", "Booknomics Pick",
        "#3A2E18", "#5C4A24", "#2B3A55", "#FAF5E8", "#D3C8A8", "#B8860B", "#2B2620",
        "#F6F2E7", "#ECE9DF",
        ("#B8860B", "#2B3A55", "#2A7F8A", "#B5651D", "#6B4A6B", "#4A7C59", "#3B6EA5", "#8C6A2F"),
        "waves",
    ),
}

_MATCHERS: list[tuple[GenreKey, re.Pattern[str]]] = [
    ("mystery", re.compile(r"mystery|thriller|crime|detective|suspense|horror|noir|रहस्य|थ्रिलर|जासूस|हत्या", re.I)),
    ("romance", re.compile(r"romance|love story|romantic|प्रेम कथा", re.I)),
    ("fantasy", re.compile(r"fantasy|magic|mytholog|epic|fairy|फंतासी", re.I)),
    ("scifi", re.compile(r"sci[\s-]?fi|science fiction|dystopi|science\b|physics|cosmos|astronomy|विज्ञान कथा", re.I)),
    ("biography", re.compile(r"biograph|memoir|autobiograph|life story|जीवनी|आत्मकथा", re.I)),
    ("history", re.compile(r"histor|ancient|civilization|war\b|empire|इतिहास", re.I)),
    ("philosophy", re.compile(r"philosoph|stoic|ethics|spiritual|meditation|vedanta|upani|दर्शन|अध्यात्म|भक्ति|योग|गीता|पुराण|उपनिषद", re.I)),
    ("psychology", re.compile(r"psycholog|behavior|behaviour|cognitive|emotion|bias|persuasion|influence|मनोविज्ञान", re.I)),
    ("productivity", re.compile(r"productiv|time management|focus|deep work|habit|efficiency|उत्पादकता", re.I)),
    ("leadership", re.compile(r"leadership|leader\b|management|executive|नेतृत्व", re.I)),
    ("business", re.compile(r"business|finance|money|invest|wealth|startup|entrepreneur|econom|strategy|marketing|व्यवसाय|वित्त", re.I)),
    ("selfhelp", re.compile(r"self[\s-]?help|personal development|motivat|discipline|success|आत्म-विकास", re.I)),
]

_FICTION = re.compile(
    r"fiction|novel|romance|mystery|thriller|fantasy|sci[\s-]?fi|horror|drama|poetry|classic literature|play|tragedy|"
    r"हिन्दी साहित्य|हिंदी साहित्य|साहित्य|उपन्यास|कहानी|नाटक|काव्य|कविता|प्रेम कथा|रहस्य",
    re.I,
)


def resolve_genre(category: str | None) -> GenreKey:
    value = (category or "").strip()
    if not value:
        return "default"
    for key, test in _MATCHERS:
        if test.search(value):
            return key
    return "default"


def resolve_theme(category: str | None) -> GenreTheme:
    return THEMES[resolve_genre(category)]


def is_fiction(category: str | None) -> bool:
    return bool(_FICTION.search(category or ""))


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def mix(a: str, b: str, t: float) -> tuple[int, int, int]:
    ar, ag, ab = hex_to_rgb(a)
    br, bg, bb = hex_to_rgb(b)
    return (
        int(ar + (br - ar) * t),
        int(ag + (bg - ag) * t),
        int(ab + (bb - ab) * t),
    )


def rgba(hex_color: str, alpha: float) -> tuple[int, int, int, int]:
    r, g, b = hex_to_rgb(hex_color)
    return r, g, b, int(max(0, min(1, alpha)) * 255)
