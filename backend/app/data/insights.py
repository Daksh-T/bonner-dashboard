from __future__ import annotations

import pandas as pd

from ..settings import get_config
from .loader import STATE
from .processor import get_effective_reference_date, reflection_text


def _reference_window(days: int) -> tuple[pd.Timestamp, pd.Timestamp]:
    reference_date = get_effective_reference_date(STATE.active_checkpoint, STATE.impacts_df)
    end = pd.Timestamp(reference_date)
    start = end - pd.Timedelta(days=days)
    return start, end


def get_overview() -> dict:
    member_df = STATE.member_df[STATE.member_df["status"] != "Exempt"].copy()
    impacts_df = STATE.impacts_df[STATE.impacts_df["email"].isin(member_df["email"])].copy()
    counts = member_df["status"].value_counts().to_dict()
    recent_cutoff, recent_end = _reference_window(7)
    recent = impacts_df[(impacts_df["Start Date"] >= recent_cutoff) & (impacts_df["Start Date"] <= recent_end)]
    pending = impacts_df[impacts_df["Verified"].str.lower() == "pending"]
    active = member_df[member_df["status"] != "Exempt"]
    cp4_required = active["final_required"].replace(0, pd.NA)
    return {
        "status_counts": {status: int(counts.get(status, 0)) for status in ["Red", "Yellow", "Blue", "Green"]},
        "cohort_pulse": {
            "week_hours": round(float(recent["Hours Served"].sum()), 2),
            "week_members": int(recent["email"].nunique()),
            "pending_hours": round(float(pending["Hours Served"].sum()), 2),
            "pending_members": int(pending["email"].nunique()),
            "avg_progress_pct": round(float((active["hours"] / cp4_required * 100).mean()) if len(active) else 0, 1),
            "on_track_pct": round(float(active["status"].isin(["Green", "Yellow"]).mean() * 100) if len(active) else 0, 1),
        },
    }


def get_class_distribution() -> list[dict]:
    pivot = (
        STATE.member_df[STATE.member_df["status"] != "Exempt"]
        .groupby(["class_label", "status"]).size().unstack(fill_value=0).reset_index()
    )
    for status in ["Green", "Yellow", "Red", "Blue"]:
        if status not in pivot.columns:
            pivot[status] = 0
    return pivot.rename(columns={"class_label": "class"}).to_dict(orient="records")


def get_insights() -> dict:
    member_df = STATE.member_df[STATE.member_df["status"] != "Exempt"].copy()
    impacts_df = STATE.impacts_df[STATE.impacts_df["email"].isin(member_df["email"])].copy()
    concerning = member_df[
        (member_df["status"].isin(["Red", "Blue"])) | (member_df["pending_hours"] >= 5)
    ][["display_name", "email", "status", "hours", "pending_hours", "still_needed"]].sort_values(["status", "still_needed"], ascending=[True, False]).head(8)

    consistent = member_df[
        (member_df["status"] == "Green") & (member_df["active_weeks"] >= 4)
    ][["display_name", "email", "hours", "active_weeks", "avg_week"]].sort_values("hours", ascending=False).head(8)

    recent_cutoff, recent_end = _reference_window(14)
    recent = impacts_df[(impacts_df["Start Date"] >= recent_cutoff) & (impacts_df["Start Date"] <= recent_end)]
    baseline = impacts_df[impacts_df["Start Date"] < recent_cutoff]
    surge = recent.groupby("email")["Hours Served"].sum().rename("recent_hours").reset_index()
    prior = baseline.groupby("email")["Hours Served"].mean().rename("prior_avg").reset_index()
    merged = surge.merge(prior, on="email", how="left").fillna({"prior_avg": 0})
    merged["surge_ratio"] = merged.apply(lambda row: row["recent_hours"] / row["prior_avg"] if row["prior_avg"] else row["recent_hours"], axis=1)
    merged = merged.merge(member_df[["email", "display_name", "status"]], on="email", how="left").sort_values(["recent_hours", "surge_ratio"], ascending=False).head(8)
    return {
        "concerning": concerning.fillna("").to_dict(orient="records"),
        "consistent": consistent.fillna("").to_dict(orient="records"),
        "recent_surge": merged.fillna("").to_dict(orient="records"),
    }


def get_overview_drilldown(kind: str, class_name: str | None = None) -> dict:
    member_df = STATE.member_df[STATE.member_df["status"] != "Exempt"].copy()
    impacts_df = STATE.impacts_df[STATE.impacts_df["email"].isin(member_df["email"])].copy()
    member_lookup = member_df.set_index("email")
    recent_cutoff, recent_end = _reference_window(7)
    recent = impacts_df[(impacts_df["Start Date"] >= recent_cutoff) & (impacts_df["Start Date"] <= recent_end)].copy()

    top_partner_lookup = (
        impacts_df.groupby(["email", "Group"])["Hours Served"]
        .sum()
        .reset_index()
        .sort_values(["email", "Hours Served"], ascending=[True, False])
        .drop_duplicates("email")
        .set_index("email")["Group"]
        .to_dict()
    )
    latest_impact_lookup = (
        impacts_df.groupby("email")["Start Date"]
        .max()
        .dropna()
        .map(lambda value: value.date().isoformat())
        .to_dict()
    )

    if kind == "week-hours":
        if recent.empty:
            return {"kind": kind, "sites": [], "members": [], "impacts": []}
        recent["member_name"] = recent["email"].map(member_lookup["display_name"]).fillna(recent["email"])
        sites = (
            recent.groupby("Group")
            .agg(hours=("Hours Served", "sum"), impacts=("Impact ID", "count"))
            .reset_index()
            .rename(columns={"Group": "partner"})
            .sort_values(["hours", "impacts"], ascending=False)
        )
        members = (
            recent.groupby("email")
            .agg(hours=("Hours Served", "sum"), impacts=("Impact ID", "count"))
            .reset_index()
            .assign(
                display_name=lambda df: df["email"].map(member_lookup["display_name"]).fillna(df["email"]),
                class_label=lambda df: df["email"].map(member_lookup["class_label"]).fillna(""),
                status=lambda df: df["email"].map(member_lookup["status"]).fillna(""),
            )
            .sort_values(["hours", "impacts"], ascending=False)
        )
        impacts = [
            {
                "impact_id": str(row.get("Impact ID", "")),
                "partner": str(row.get("Group") or "(No Group Listed)"),
                "event_name": "" if pd.isna(row.get("Event Name")) else str(row.get("Event Name")).strip(),
                "member_name": str(row.get("member_name") or row.get("email") or ""),
                "email": str(row.get("email") or ""),
                "start_date": row["Start Date"].date().isoformat() if pd.notna(row.get("Start Date")) else "",
                "hours": round(float(row.get("Hours Served", 0) or 0), 2),
                "verified": "" if pd.isna(row.get("Verified")) else str(row.get("Verified")).strip(),
                "organizer": "" if pd.isna(row.get("Organizer")) else str(row.get("Organizer")).strip(),
                "reflection": reflection_text(row, get_config()),
            }
            for _, row in recent.sort_values(["Start Date", "Hours Served"], ascending=[False, False]).iterrows()
        ]
        return {
            "kind": kind,
            "sites": sites.fillna("").to_dict(orient="records"),
            "members": members.fillna("").to_dict(orient="records"),
            "impacts": impacts,
        }

    if kind == "week-members":
        if recent.empty:
            return {"kind": kind, "members": []}
        recent_partner_lookup = (
            recent.groupby(["email", "Group"])["Hours Served"]
            .sum()
            .reset_index()
            .sort_values(["email", "Hours Served"], ascending=[True, False])
            .drop_duplicates("email")
            .set_index("email")["Group"]
            .to_dict()
        )
        members = (
            recent.groupby("email")
            .agg(hours=("Hours Served", "sum"), impacts=("Impact ID", "count"))
            .reset_index()
            .assign(
                display_name=lambda df: df["email"].map(member_lookup["display_name"]).fillna(df["email"]),
                class_label=lambda df: df["email"].map(member_lookup["class_label"]).fillna(""),
                status=lambda df: df["email"].map(member_lookup["status"]).fillna(""),
                required=lambda df: df["email"].map(member_lookup["required"]).fillna(0.0),
                pending_hours=lambda df: df["email"].map(member_lookup["pending_hours"]).fillna(0.0),
                progress_pct=lambda df: df["email"].map(member_lookup["progress_pct"]).fillna(0.0),
                top_partner=lambda df: df["email"].map(recent_partner_lookup).fillna(""),
                latest_date=lambda df: df["email"].map(latest_impact_lookup).fillna(""),
            )
            .sort_values(["hours", "impacts"], ascending=False)
        )
        return {"kind": kind, "members": members.fillna("").to_dict(orient="records")}

    if kind == "avg-progress":
        from ..settings import get_config

        config = get_config()
        active = member_df.copy()
        if active.empty:
            return {"kind": kind, "series": []}
        req = active.set_index("email")["final_required"].replace(0, pd.NA)
        emails = active["email"]
        imp = impacts_df.dropna(subset=["Start Date"]).copy()
        # Weekly cumulative hours per member, averaged into a % of the final goal.
        periods = pd.period_range(
            start=pd.Timestamp(config.program_start), end=pd.Timestamp(recent_end), freq="W"
        )
        weekly_hours = imp.groupby([imp["Start Date"].dt.to_period("W"), "email"])["Hours Served"].sum()
        series = []
        for period in periods:
            upto = weekly_hours[weekly_hours.index.get_level_values(0) <= period]
            cum = upto.groupby("email").sum() if len(upto) else pd.Series(dtype=float)
            hours = emails.map(cum).fillna(0.0).to_numpy()
            denom = emails.map(req).to_numpy(dtype=float)  # NaN where final goal is 0/unknown
            pct = pd.Series(hours / denom * 100).clip(upper=100)
            avg = float(pct.mean()) if pct.notna().any() else 0.0
            start = period.start_time
            series.append(
                {
                    "week": start.date().isoformat(),
                    "label": start.strftime("%b %-d"),
                    "avg_pct": round(avg, 1),
                }
            )
        return {"kind": kind, "series": series, "members": int(len(active))}

    if kind == "class" and class_name:
        subset = member_df[member_df["class_label"].str.lower() == class_name.lower()].copy()
        summary = subset["status"].value_counts().to_dict()
        subset["top_partner"] = subset["email"].map(top_partner_lookup).fillna("")
        subset["latest_date"] = subset["email"].map(latest_impact_lookup).fillna("")
        return {
            "kind": kind,
            "class_name": class_name,
            "summary": {status: int(summary.get(status, 0)) for status in ["Red", "Blue", "Yellow", "Green"]},
            "members": subset.sort_values(["risk_score", "hours"], ascending=[False, False]).fillna("").to_dict(orient="records"),
        }

    return {"kind": kind}
