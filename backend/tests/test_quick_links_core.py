"""Validation and seeding for ``users.quick_links`` (pure functions)."""

import json
from typing import Any

from app.core.quick_links import (
    MAX_QUICK_LINKS,
    default_quick_links,
    parse_quick_links,
    serialize_quick_links,
)


def _link(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "a",
        "label": "งาน",
        "url": "https://example.com",
        "icon": "link",
    }
    base.update(overrides)
    return base


class TestParseQuickLinks:
    def test_keeps_http_and_in_app_paths(self):
        raw = json.dumps([_link(id="a"), _link(id="b", url="/dashboard")])
        assert [item["url"] for item in parse_quick_links(raw)] == [
            "https://example.com",
            "/dashboard",
        ]

    def test_drops_dangerous_and_relative_schemes(self):
        raw = json.dumps(
            [
                _link(id="a", url="javascript:alert(1)"),
                _link(id="b", url="data:text/html,<script>"),
                _link(id="c", url="//evil.example/x"),
                _link(id="d", url="/ok"),
            ]
        )
        assert [item["id"] for item in parse_quick_links(raw)] == ["d"]

    def test_tolerates_broken_json_and_non_lists(self):
        assert parse_quick_links("not json") == []
        assert parse_quick_links(None) == []
        assert parse_quick_links('{"a": 1}') == []

    def test_drops_duplicate_ids_and_urls(self):
        raw = json.dumps([_link(id="a"), _link(id="a"), _link(id="b")])
        assert [item["id"] for item in parse_quick_links(raw)] == ["a"]

    def test_caps_the_list(self):
        raw = json.dumps(
            [_link(id=f"l{i}", url=f"/p{i}") for i in range(MAX_QUICK_LINKS + 10)]
        )
        assert len(parse_quick_links(raw)) == MAX_QUICK_LINKS

    def test_keeps_only_valid_environment_urls(self):
        raw = json.dumps(
            [
                _link(
                    envs={
                        "staging": "https://stg.example.com",
                        "development": "javascript:x",
                    }
                )
            ]
        )
        assert parse_quick_links(raw)[0]["envs"] == {"staging": "https://stg.example.com"}

    def test_requires_id_label_and_icon(self):
        raw = json.dumps(
            [
                {"id": "", "label": "x", "url": "/a", "icon": "link"},
                {"id": "b", "label": "", "url": "/a", "icon": "link"},
                {"id": "c", "label": "x", "url": "/a", "icon": ""},
            ]
        )
        assert parse_quick_links(raw) == []


class TestSerialize:
    def test_round_trips_through_parse(self):
        raw = serialize_quick_links([_link(envs={"staging": "https://stg.example.com"})])
        assert parse_quick_links(raw)[0]["envs"] == {"staging": "https://stg.example.com"}

    def test_is_compact_and_keeps_thai(self):
        raw = serialize_quick_links([_link(label="น้ำมัน")])
        assert "น้ำมัน" in raw
        assert ", " not in raw

    def test_accepts_a_raw_blob_for_convenience(self):
        raw = json.dumps([_link(url="javascript:x"), _link(id="b", url="/b")])
        assert parse_quick_links(serialize_quick_links(raw))[0]["url"] == "/b"


class TestDefaultQuickLinks:
    def test_seeds_only_pages_the_account_can_open(self):
        seeded = json.loads(default_quick_links("user", '["dashboard","camera"]'))
        assert [item["url"] for item in seeded] == ["/dashboard", "/camera"]

    def test_null_pages_fall_back_to_the_documented_default(self):
        seeded = json.loads(default_quick_links("user", None))
        assert [item["url"] for item in seeded] == ["/dashboard"]

    def test_admin_also_gets_the_admin_console(self):
        seeded = json.loads(default_quick_links("admin", None))
        assert "/admin" in [item["url"] for item in seeded]

    def test_a_user_never_gets_the_admin_console(self):
        seeded = json.loads(default_quick_links("user", '["dashboard","admin"]'))
        assert "/admin" not in [item["url"] for item in seeded]

    def test_seeded_entries_survive_the_validator(self):
        seeded = default_quick_links("admin", None)
        assert len(parse_quick_links(seeded)) == len(json.loads(seeded))
