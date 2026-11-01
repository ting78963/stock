"""Daily and weekly MA20/MA100 near-cross historical backtest.
Input CSV columns: date,close (ascending, one trading day per row).
Matches index.html's 5-trading-day weekly grouping, including the final partial week.
Run: python research/backtest_weekly_near_cross.py prices.csv
"""
import csv
import json
import sys
from pathlib import Path

THRESHOLDS = (0.5, 1.0, 1.5)

def ma(a, n):
    return sum(a[-n:]) / n if len(a) >= n else None

def weekly(daily):
    return [daily[i:min(i+5,len(daily))][-1] for i in range(0,len(daily),5)]

def signals(daily):
    # Only complete five-day blocks for historical evaluation: no look-ahead.
    out = []
    for end in range(5, len(daily)+1, 5):
        w = weekly(daily[:end])
        if len(w) < 101:
            continue
        a, b = ma(w,20), ma(w,100)
        pa, pb = ma(w[:-1],20), ma(w[:-1],100)
        gap, pgap = (b-a)/b*100, (pb-pa)/pb*100
        cross = pa <= pb and a > b
        approaching = a < b and pa < pb and a > pa and 0 < gap < pgap
        tier = next((t for t in THRESHOLDS if approaching and gap <= t), None)
        out.append(dict(week=end//5, day_index=end-1, gap_pct=round(gap,4),
                        cross=cross, tier=tier))
    return out

def daily_signals(daily):
    """Daily signals using only data available at each day close."""
    out = []
    for end in range(101, len(daily)+1):
        prices = daily[:end]
        a, b = ma(prices,20), ma(prices,100)
        pa, pb = ma(prices[:-1],20), ma(prices[:-1],100)
        gap, pgap = (b-a)/b*100, (pb-pa)/pb*100
        cross = pa <= pb and a > b
        approaching = a < b and pa < pb and a > pa and 0 < gap < pgap
        tier = next((t for t in THRESHOLDS if approaching and gap <= t), None)
        out.append(dict(week=end, day_index=end-1, gap_pct=round(gap,4),
                        cross=cross, tier=tier))
    return out

def report(rows, horizon=12):
    events = [x for x in rows if x["cross"]]
    result = {}
    for threshold in THRESHOLDS:
        alerts = [x for x in rows if x["tier"] is not None and x["tier"] <= threshold]
        matched = []
        for alert in alerts:
            future = [e for e in events if 0 < e["week"]-alert["week"] <= horizon]
            matched.append(future[0]["week"]-alert["week"] if future else None)
        result[str(threshold)] = dict(alert_weeks=len(alerts),
            crossed_within_horizon=sum(x is not None for x in matched),
            unmatched=sum(x is None for x in matched),
            lead_weeks=matched)
    return dict(weeks_evaluated=len(rows), actual_crosses=len(events),
                horizon_weeks=horizon, thresholds=result)

def test():
    # Validates direction, not empirical accuracy.
    def eligible(prev20, cur20, prev100=100, cur100=100):
        gap=(cur100-cur20)/cur100*100
        pgap=(prev100-prev20)/prev100*100
        return cur20<cur100 and prev20<prev100 and cur20>prev20 and 0<gap<pgap
    assert eligible(98.6,99.6)
    assert eligible(98.5,99.2)
    assert not eligible(102,100.4)
    assert not eligible(99,98.8)
    assert not eligible(99,98.9)
    assert not eligible(99.6,100.3)
    print("direction tests passed")

if __name__ == "__main__":
    if len(sys.argv)==1:
        test()
    else:
        path=Path(sys.argv[1])
        with path.open(encoding="utf-8-sig",newline="") as f:
            data=sorted(((r["date"],float(r["close"])) for r in csv.DictReader(f)),key=lambda x:x[0])
        # Use only closed five-session blocks, matching the original calculation.
        prices = [x[1] for x in data]
        print(json.dumps({
            "symbol_file": path.name,
            "daily": report(daily_signals(prices), horizon=60),
            "weekly": report(signals(prices), horizon=12),
        }, ensure_ascii=False, indent=2))
