"""Turns a plain-text audience description into Google dork-style query variants.

Rules-based rather than a full NLP pipeline: strip stopwords, split into
candidate keyword phrases, then generate a few query variants (full phrase,
pairwise combinations) since a single dork often under-returns results.
"""
import itertools
import re

STOPWORDS = {
    "a", "an", "the", "for", "of", "in", "on", "at", "to", "and", "or",
    "with", "who", "that", "targeting", "target", "audience", "people",
    "looking", "interested", "want", "wants",
}


def extract_keywords(description: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z\-]+", description.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 2]


def build_queries(description: str, max_variants: int = 4) -> list[str]:
    """Returns a list of `"kw1" "kw2" site:instagram.com` query strings."""
    keywords = extract_keywords(description)
    if not keywords:
        return []

    queries: list[str] = []

    # Full keyword set first — most specific.
    full = " ".join(f'"{kw}"' for kw in keywords)
    queries.append(f"{full} site:instagram.com")

    # Pairwise combinations as fallback variants for broader recall.
    for combo in itertools.combinations(keywords, 2):
        if len(queries) >= max_variants:
            break
        q = " ".join(f'"{kw}"' for kw in combo)
        candidate = f"{q} site:instagram.com"
        if candidate not in queries:
            queries.append(candidate)

    return queries[:max_variants]
