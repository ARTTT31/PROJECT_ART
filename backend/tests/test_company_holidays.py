"""Tests for the company holiday PDF parser and stored calendar format."""

from datetime import date

from app.core.company_holidays import (
    extract_pdf_text,
    normalise_year,
    parse_company_calendar,
    parse_holiday_candidates,
    serialize_company_calendar,
)
from app.core.personal_reminders import (
    parse_personal_reminders,
    serialize_personal_reminders,
)


class TestNormaliseYear:
    def test_buddhist_year_converts(self):
        assert normalise_year(2569) == 2026

    def test_gregorian_year_is_untouched(self):
        assert normalise_year(2026) == 2026


class TestParseHolidayCandidates:
    def test_thai_month_with_title_after_date(self):
        items, warnings = parse_holiday_candidates("1 มกราคม 2569 วันขึ้นปีใหม่")
        assert warnings == []
        assert items == [{"date": "2026-01-01", "title": "วันขึ้นปีใหม่"}]

    def test_weekday_prefix_is_removed(self):
        items, _ = parse_holiday_candidates(
            "วันจันทร์ที่ 13 เมษายน 2569 วันสงกรานต์"
        )
        assert items[0]["date"] == "2026-04-13"
        assert items[0]["title"] == "วันสงกรานต์"

    def test_title_on_the_next_line(self):
        items, _ = parse_holiday_candidates("2 เมษายน 2569\nวันจักรี")
        assert items == [{"date": "2026-04-02", "title": "วันจักรี"}]

    def test_title_before_date(self):
        items, _ = parse_holiday_candidates("วันแรงงานแห่งชาติ 1 พฤษภาคม 2569")
        assert items[0]["date"] == "2026-05-01"
        assert "แรงงาน" in items[0]["title"]

    def test_slash_date_is_day_first(self):
        items, _ = parse_holiday_candidates("05/12/2569 วันพ่อแห่งชาติ")
        assert items[0]["date"] == "2026-12-05"

    def test_iso_date_is_not_read_as_day_first(self):
        items, _ = parse_holiday_candidates("2026-12-31 วันสิ้นปี")
        assert items[0]["date"] == "2026-12-31"

    def test_results_are_sorted_and_deduplicated(self):
        text = "\n".join(
            [
                "31 ธันวาคม 2569 วันสิ้นปี",
                "1 มกราคม 2569 วันขึ้นปีใหม่",
                "1 มกราคม 2569 วันขึ้นปีใหม่ (ซ้ำ)",
            ]
        )
        items, _ = parse_holiday_candidates(text)
        assert [item["date"] for item in items] == ["2026-01-01", "2026-12-31"]
        # The longer label wins, so a duplicated line does not lose detail.
        assert items[0]["title"].endswith("(ซ้ำ)")

    def test_impossible_date_is_skipped_with_a_warning(self):
        items, warnings = parse_holiday_candidates("31 กุมภาพันธ์ 2569 ไม่มีวันนี้")
        assert items == []
        assert warnings

    def test_empty_text_warns(self):
        items, warnings = parse_holiday_candidates("")
        assert items == []
        assert warnings


class TestCalendarStorage:
    def test_round_trip(self):
        raw = serialize_company_calendar(
            {2026: [{"date": "2026-01-01", "title": "วันขึ้นปีใหม่"}]}
        )
        assert parse_company_calendar(raw) == {
            2026: [{"date": "2026-01-01", "title": "วันขึ้นปีใหม่"}]
        }

    def test_invalid_rows_are_dropped(self):
        raw = (
            '{"2026": [{"date": "2026-02-31", "title": "ผิด"},'
            ' {"date": "2026-01-01", "title": ""},'
            ' {"date": "2026-04-13", "title": "สงกรานต์"}]}'
        )
        calendar = parse_company_calendar(raw)
        assert calendar == {
            2026: [{"date": "2026-04-13", "title": "สงกรานต์"}]
        }

    def test_malformed_json_reads_as_empty(self):
        assert parse_company_calendar("{not json") == {}
        assert parse_company_calendar(None) == {}

    def test_empty_years_are_not_persisted(self):
        assert serialize_company_calendar({2026: []}) == "{}"


class TestPdfGuard:
    def test_non_pdf_bytes_raise(self):
        try:
            extract_pdf_text(b"not a pdf")
        except ValueError:
            return
        raise AssertionError("expected ValueError for non-PDF bytes")


class TestPersonalReminders:
    def test_round_trip_keeps_kind_and_note(self):
        raw = serialize_personal_reminders(
            [
                {
                    "id": "r1",
                    "date": "2026-12-01",
                    "title": "ไปธนาคาร",
                    "kind": "errand",
                    "done": False,
                    "note": "ก่อนเที่ยง",
                }
            ]
        )
        parsed = parse_personal_reminders(raw)
        assert parsed[0]["title"] == "ไปธนาคาร"
        assert parsed[0]["kind"] == "errand"
        assert parsed[0]["note"] == "ก่อนเที่ยง"

    def test_unknown_kind_falls_back(self):
        raw = '{"x": 1}'
        assert parse_personal_reminders(raw) == []
        assert parse_personal_reminders('[{"id":"a","date":"2026-01-02","title":"x","kind":"?"}]')[
            0
        ]["kind"] == "errand"

    def test_bad_dates_are_dropped(self):
        raw = '[{"id":"a","date":"2026-13-01","title":"ผิด"}]'
        assert parse_personal_reminders(raw) == []

    def test_today_is_a_parseable_values_only_list(self):
        # Guards the widget's assumption that dates are plain ISO days.
        assert date.fromisoformat("2026-11-04").isoformat() == "2026-11-04"
