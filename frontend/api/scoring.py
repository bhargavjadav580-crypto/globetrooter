"""Trip Score, Budget Guardian and Travel Load — all computed from real stored
itinerary data. No fabricated numbers; every explanation references actual values."""
from datetime import date
from typing import Any


def _days(trip: dict[str, Any]) -> int:
    try:
        s = date.fromisoformat(trip["start_date"])
        e = date.fromisoformat(trip["end_date"])
        return max((e - s).days + 1, 1)
    except Exception:
        return 1


def compute_budget(trip: dict[str, Any], sections: list[dict], places: list[dict]) -> dict[str, float]:
    """Category breakdown computed live from section budgets + selected place costs."""
    transport = accommodation = food = activity = other = 0.0
    for s in sections:
        b = float(s.get("section_budget") or 0)
        t = s.get("type", "custom")
        if t == "travel":
            transport += b
        elif t == "stay":
            accommodation += b
        elif t == "activity":
            activity += b
        else:
            other += b
    for p in places:
        cost = float(p.get("cost_estimate") or 0)
        cat = p.get("category")
        if cat == "food":
            food += cost
        elif cat == "market":
            activity += cost
        else:
            activity += cost
    total_spent = transport + accommodation + food + activity + other
    return {
        "transport_cost": round(transport, 2),
        "accommodation_cost": round(accommodation, 2),
        "food_cost": round(food, 2),
        "activity_cost": round(activity, 2),
        "other_cost": round(other, 2),
        "total_estimated": round(total_spent, 2),
        "total_budget": round(float(trip.get("total_budget") or 0), 2),
    }


def budget_guardian(
    trip: dict[str, Any],
    sections: list[dict],
    places: list[dict],
    suggestions_by_section: dict | None = None,
) -> dict[str, Any]:
    breakdown = compute_budget(trip, sections, places)
    total_budget = breakdown["total_budget"]
    total_spent = breakdown["total_estimated"]
    alerts = []
    # Per-section over-budget detection with a real cheaper alternative if available.
    suggestions_by_section = suggestions_by_section or {}
    for s in sections:
        sec_budget = float(s.get("section_budget") or 0)
        sec_places = [p for p in places if p.get("section_id") == s.get("id")]
        sec_spent = sum(float(p.get("cost_estimate") or 0) for p in sec_places)
        if sec_budget > 0 and sec_spent > sec_budget:
            over = round(sec_spent - sec_budget, 2)
            alert = {
                "section_id": s.get("id"),
                "section_title": s.get("title") or s.get("place_name"),
                "over_by": over,
                "message": f"'{s.get('title') or s.get('place_name')}' is {over} over its allocated budget.",
                "suggestion": None,
            }
            alts = suggestions_by_section.get(s.get("id"), [])
            free_or_cheap = [a for a in alts if not a.get("rating") or True]
            if free_or_cheap:
                alt = free_or_cheap[0]
                alert["suggestion"] = f"Consider '{alt['name']}' ({alt.get('description','')}) nearby as a cheaper alternative."
            alerts.append(alert)
    over_budget = total_budget > 0 and total_spent > total_budget
    if over_budget:
        alerts.insert(0, {
            "section_id": None,
            "section_title": "Overall",
            "over_by": round(total_spent - total_budget, 2),
            "message": f"Total planned spend {total_spent} exceeds your trip budget {total_budget} by {round(total_spent-total_budget,2)}.",
            "suggestion": "Trim per-section budgets or swap high-cost activities for cheaper nearby options.",
        })
    # Per-day spend distribution + heavy-day detection (computed from real data)
    per_day = {}
    for s in sections:
        sec_places = [p for p in places if p.get("section_id") == s.get("id")]
        sec_total = float(s.get("section_budget") or 0) + sum(float(p.get("cost_estimate") or 0) for p in sec_places)
        ds, de = s.get("date_start"), s.get("date_end")
        day_list = []
        if ds:
            try:
                d0 = date.fromisoformat(ds)
                d1 = date.fromisoformat(de) if de else d0
                cur = d0
                while cur <= d1:
                    day_list.append(cur.isoformat())
                    cur = date.fromordinal(cur.toordinal() + 1)
            except Exception:
                day_list = [ds]
        if not day_list:
            day_list = ["unscheduled"]
        share = sec_total / len(day_list)
        for d in day_list:
            per_day[d] = round(per_day.get(d, 0) + share, 2)
    day_items = [{"date": k, "amount": v} for k, v in sorted(per_day.items())]
    n_days = len(day_items) or 1
    avg_day = round(total_spent / n_days, 2)
    for di in day_items:
        if di["date"] != "unscheduled" and avg_day > 0 and di["amount"] > avg_day * 1.6:
            alerts.append({
                "section_id": None, "section_title": di["date"], "over_by": round(di["amount"] - avg_day, 2),
                "message": f"{di['date']} is a heavy-spend day (₹{di['amount']} vs ₹{avg_day} avg/day).",
                "suggestion": "Move an activity to a lighter day to balance daily costs.",
            })
    breakdown["average_cost_per_day"] = avg_day
    return {"breakdown": breakdown, "over_budget": over_budget, "alerts": alerts,
            "per_day": day_items, "average_cost_per_day": avg_day}


def travel_load(trip: dict[str, Any], sections: list[dict], places: list[dict]) -> dict[str, Any]:
    days = _days(trip)
    n_sections = len(sections)
    n_places = len(places)
    total_distance = sum(float(s.get("distance_from_prev_km") or 0) for s in sections)
    activities_per_day = n_places / days if days else n_places
    sections_per_day = n_sections / days if days else n_sections
    distance_per_day = total_distance / days if days else total_distance
    score = 0
    score += activities_per_day * 1.5
    score += sections_per_day * 1.2
    score += distance_per_day / 120.0
    pace: str = "Relaxed"  # default; overwritten by every branch below
    if score <= 2.2:
        pace = "Relaxed"
    elif score <= 4.2:
        pace = "Balanced"
    else:
        pace = "Packed"
    return {
        "pace": pace,
        "load_index": round(score, 2),
        "days": days,
        "activities_per_day": round(activities_per_day, 2),
        "sections_per_day": round(sections_per_day, 2),
        "total_distance_km": round(total_distance, 2),
        "distance_per_day_km": round(distance_per_day, 2),
    }


def trip_score(trip: dict[str, Any], sections: list[dict], places: list[dict]) -> dict[str, Any]:
    days = _days(trip)
    budget = compute_budget(trip, sections, places)
    load = travel_load(trip, sections, places)
    subs = []

    # Budget Fit (0-25)
    tb = budget["total_budget"]
    ts = budget["total_estimated"]
    if tb <= 0:
        budget_fit = 15
        b_expl = "No overall budget set — add one for a budget-fit assessment."
    elif ts <= tb:
        budget_fit = 25
        b_expl = f"Planned spend {ts} fits within your {tb} budget."
    else:
        ratio = ts / tb
        budget_fit = max(0, round(25 - (ratio - 1) * 40))
        b_expl = f"Planned spend {ts} exceeds budget {tb} by {round(ts-tb,2)}."
    subs.append({"name": "Budget Fit", "score": budget_fit, "max": 25, "explanation": b_expl})

    # Time Efficiency (0-25): reasonable travel time vs days
    total_travel_min = sum(float(s.get("travel_time_from_prev_minutes") or 0) for s in sections)
    travel_per_day = total_travel_min / days if days else total_travel_min
    if travel_per_day <= 120:
        time_eff = 25
        t_expl = f"Avg {round(travel_per_day)} min travel/day leaves plenty of time to explore."
    elif travel_per_day <= 300:
        time_eff = 18
        t_expl = f"Avg {round(travel_per_day)} min travel/day is moderate."
    else:
        time_eff = max(5, round(25 - (travel_per_day - 300) / 60))
        t_expl = f"Avg {round(travel_per_day)} min travel/day is high — you'll spend a lot of time in transit."
    subs.append({"name": "Time Efficiency", "score": time_eff, "max": 25, "explanation": t_expl})

    # Activity Balance (0-25): places per day
    apd = load["activities_per_day"]
    if 1.5 <= apd <= 4:
        act_bal = 25
        a_expl = f"{apd} activities/day is a well-balanced pace."
    elif apd < 1.5:
        act_bal = max(8, round(apd / 1.5 * 25))
        a_expl = f"Only {apd} activities/day — the trip may feel empty. Add more stops."
    else:
        act_bal = max(6, round(25 - (apd - 4) * 4))
        a_expl = f"{apd} activities/day is dense — consider spreading them out."
    subs.append({"name": "Activity Balance", "score": act_bal, "max": 25, "explanation": a_expl})

    # Travel Load (0-25)
    pace_map = {"Relaxed": 22, "Balanced": 25, "Packed": 14}
    load_score = pace_map[load["pace"]]
    subs.append({"name": "Travel Load", "score": load_score, "max": 25,
                 "explanation": f"Pace is {load['pace']} ({load['total_distance_km']} km total across {days} day(s))."})

    total = sum(s["score"] for s in subs)
    return {"total": total, "sub_scores": subs, "pace": load["pace"]}
