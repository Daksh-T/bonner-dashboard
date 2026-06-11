"""Data-source abstraction.

A :class:`DataSource` returns two raw DataFrames using the *canonical* GivePulse
export column names that the processor already understands. CSV and GivePulse-API
sources both conform to this contract, so the rest of the pipeline never needs to
know where the data came from.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import pandas as pd

# The columns the processor reads. Sources must provide at least these (missing
# ones are filled empty). Matches the GivePulse CSV export headers.
CANONICAL_USER_COLUMNS = [
    "Email",
    "First Name",
    "Last Name",
    "Preferred Name",
    "Graduation Term",
    "Last Impacts",
]

CANONICAL_IMPACT_COLUMNS = [
    "Impact ID",
    "Email",
    "Start Date",
    "Date Created",
    "Hours Served",
    "Group",
    "Event Name",
    "Review/Reflection",
    "Verified",
    "Organizer",
]


@runtime_checkable
class DataSource(Protocol):
    name: str

    def describe(self) -> dict: ...

    def fetch_users(self) -> pd.DataFrame: ...

    def fetch_impacts(self) -> pd.DataFrame: ...


def ensure_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        if col not in df.columns:
            df[col] = ""
    return df


def get_source(config) -> DataSource:
    from .csv_source import CsvSource

    return CsvSource(config)
