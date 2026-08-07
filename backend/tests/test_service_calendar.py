from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import patch

import pandas as pd

from app.data.processor import (
    build_checkpoint_message,
    build_member_table,
    eligible_service_week_starts,
    normalize_impacts,
    service_calendar,
)
from app.settings import AppConfig, BreakPeriod, CheckpointConfig, Cohort, RuntimeCheckpoint


def config_with_breaks(*breaks: BreakPeriod) -> AppConfig:
    return AppConfig(
        program_start=date(2026, 1, 5),
        break_periods=list(breaks),
        cohorts=[Cohort(id="all", label="All", is_default=True)],
        checkpoints=[CheckpointConfig(name="Final", date=date(2026, 2, 8), requirements={"all": 40})],
    )


def one_member() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "email": "student@example.edu",
                "cohort_id": "all",
                "class_sort": 0,
                "last_name": "Student",
                "first_name": "Test",
                "display_name": "Test Student",
            }
        ]
    )


class ServiceCalendarTests(unittest.TestCase):
    def test_outreach_template_supports_pace_variables(self) -> None:
        config = config_with_breaks()
        config.message_templates = {
            "Red": (
                "GivePulse currently shows {approved_hours} approved hours. Over the last "
                "{recent_weeks} service weeks, you averaged about {recent_avg} hours per week; "
                "reaching the semester goal would require about {pace_needed} hours per remaining service week."
            )
        }
        row = pd.Series(
            {
                "required": 69.0,
                "hours": 62.0,
                "approved_hours": 62.0,
                "recent_avg": 6.5,
                "recent_weeks": 3,
                "pace_needed": 10.14,
                "weeks_remaining_to_cp4": 7,
                "final_required": 133.0,
                "final_still_needed": 71.0,
                "projected_final_hours": 118.5,
            }
        )
        checkpoint = RuntimeCheckpoint(name="Midpoint", date=date(2026, 1, 31), requirements={"all": 69})

        message = build_checkpoint_message("Red", row, checkpoint, config)

        self.assertIn("62.0 approved hours", message)
        self.assertIn("last 3 service weeks", message)
        self.assertIn("6.5 hours per week", message)
        self.assertIn("10.14 hours per remaining service week", message)

    def test_zero_hour_weeks_remain_in_average(self) -> None:
        config = config_with_breaks()
        impacts = pd.DataFrame(
            [
                {
                    "email": "student@example.edu",
                    "Start Date": pd.Timestamp("2026-01-06"),
                    "Hours Served": 10.0,
                    "Verified": "Verified",
                }
            ]
        )
        checkpoint = RuntimeCheckpoint(name="Final", date=date(2026, 2, 8), requirements={"all": 40})

        with (
            patch("app.data.processor.db.get_exemptions", return_value={}),
            patch("app.data.processor.get_effective_reference_date", return_value=date(2026, 2, 8)),
        ):
            result = build_member_table(one_member(), impacts, checkpoint, config).iloc[0]

        self.assertEqual(result["eligible_weeks_elapsed"], 5)
        self.assertEqual(result["active_weeks"], 1)
        self.assertEqual(result["avg_week"], 2.0)
        self.assertEqual(result["pace_label"], "Behind pace")

    def test_break_week_is_removed_from_average_and_projection(self) -> None:
        config = config_with_breaks(BreakPeriod(label="Spring break", start=date(2026, 1, 19), end=date(2026, 1, 25)))
        impacts = pd.DataFrame(
            [
                {"email": "student@example.edu", "Start Date": pd.Timestamp("2026-01-06"), "Hours Served": 10.0, "Verified": "Verified"},
                {"email": "student@example.edu", "Start Date": pd.Timestamp("2026-01-20"), "Hours Served": 20.0, "Verified": "Verified"},
            ]
        )
        checkpoint = RuntimeCheckpoint(name="Midpoint", date=date(2026, 1, 31), requirements={"all": 10})

        with (
            patch("app.data.processor.db.get_exemptions", return_value={}),
            patch("app.data.processor.get_effective_reference_date", return_value=date(2026, 1, 31)),
        ):
            result = build_member_table(one_member(), impacts, checkpoint, config).iloc[0]

        self.assertEqual(result["eligible_weeks_elapsed"], 3)
        self.assertEqual(result["hours"], 30.0)
        self.assertEqual(result["approved_hours"], 30.0)
        self.assertEqual(result["avg_week"], 3.33)
        self.assertEqual(result["weeks_remaining_to_cp4"], 1)
        self.assertEqual(result["projected_final_hours"], 33.33)

    def test_calendar_partitions_remaining_eligible_weeks(self) -> None:
        config = config_with_breaks(BreakPeriod(label="Spring break", start=date(2026, 1, 19), end=date(2026, 1, 25)))
        self.assertEqual(
            eligible_service_week_starts(config.program_start, config.program_end, config),
            [date(2026, 1, 5), date(2026, 1, 12), date(2026, 1, 26), date(2026, 2, 2)],
        )
        calendar = service_calendar(date(2026, 1, 18), config)
        self.assertEqual(calendar["elapsed"], [date(2026, 1, 5), date(2026, 1, 12)])
        self.assertEqual(calendar["remaining"], [date(2026, 1, 26), date(2026, 2, 2)])

    def test_pace_needed_uses_only_remaining_eligible_weeks(self) -> None:
        config = AppConfig(
            program_start=date(2026, 1, 5),
            break_periods=[BreakPeriod(label="Spring break", start=date(2026, 1, 19), end=date(2026, 1, 25))],
            cohorts=[Cohort(id="all", label="All", is_default=True)],
            checkpoints=[CheckpointConfig(name="Final", date=date(2026, 3, 8), requirements={"all": 100})],
        )
        impacts = pd.DataFrame(
            [{"email": "student@example.edu", "Start Date": pd.Timestamp("2026-01-06"), "Hours Served": 40.0, "Verified": "Verified"}]
        )
        checkpoint = RuntimeCheckpoint(name="Final", date=date(2026, 3, 8), requirements={"all": 100})

        with (
            patch("app.data.processor.db.get_exemptions", return_value={}),
            patch("app.data.processor.get_effective_reference_date", return_value=date(2026, 1, 18)),
        ):
            result = build_member_table(one_member(), impacts, checkpoint, config).iloc[0]

        self.assertEqual(result["weeks_remaining_to_cp4"], 6)
        self.assertEqual(result["pace_needed"], 10.0)

    def test_post_break_reentry_flag_clears_when_service_resumes(self) -> None:
        config = config_with_breaks(BreakPeriod(label="Spring break", start=date(2026, 1, 19), end=date(2026, 1, 25)))
        checkpoint = RuntimeCheckpoint(name="Final", date=date(2026, 2, 8), requirements={"all": 40})
        before_only = pd.DataFrame(
            [{"email": "student@example.edu", "Start Date": pd.Timestamp("2026-01-06"), "Hours Served": 10.0, "Verified": "Verified"}]
        )
        resumed = pd.concat(
            [
                before_only,
                pd.DataFrame(
                    [{"email": "student@example.edu", "Start Date": pd.Timestamp("2026-02-03"), "Hours Served": 2.0, "Verified": "Verified"}]
                ),
            ],
            ignore_index=True,
        )

        with (
            patch("app.data.processor.db.get_exemptions", return_value={}),
            patch("app.data.processor.get_effective_reference_date", return_value=date(2026, 2, 8)),
        ):
            flagged = build_member_table(one_member(), before_only, checkpoint, config).iloc[0]
            cleared = build_member_table(one_member(), resumed, checkpoint, config).iloc[0]

        self.assertTrue(flagged["post_break_reentry_flag"])
        self.assertIn("after Spring break", flagged["post_break_reentry_reason"])
        self.assertFalse(cleared["post_break_reentry_flag"])

    def test_start_month_toggle_credits_earlier_impacts_without_adding_expected_weeks(self) -> None:
        config = AppConfig(
            program_start=date(2026, 8, 20),
            include_full_start_month_impacts=True,
            cohorts=[Cohort(id="all", label="All", is_default=True)],
            checkpoints=[CheckpointConfig(name="Final", date=date(2026, 9, 30), requirements={"all": 40})],
        )
        raw = pd.DataFrame(
            [
                {"Email": "student@example.edu", "Start Date": "07/31/2026", "Hours Served": 1, "Verified": "Verified"},
                {"Email": "student@example.edu", "Start Date": "08/05/2026", "Hours Served": 2, "Verified": "Verified"},
                {"Email": "student@example.edu", "Start Date": "08/22/2026", "Hours Served": 3, "Verified": "Verified"},
            ]
        )
        checkpoint = RuntimeCheckpoint(name="Final", date=date(2026, 9, 30), requirements={"all": 40})

        included = normalize_impacts(raw, checkpoint, config)
        eligible = eligible_service_week_starts(config.program_start, config.program_end, config)
        config.include_full_start_month_impacts = False
        default = normalize_impacts(raw, checkpoint, config)

        self.assertEqual(included["Hours Served"].sum(), 5.0)
        self.assertEqual(default["Hours Served"].sum(), 3.0)
        self.assertEqual(eligible[0], date(2026, 8, 17))


if __name__ == "__main__":
    unittest.main()
