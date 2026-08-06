import json

parsed_video_segments = [
    {"sourceStart": 0, "sourceEnd": 2, "timelineStart": 0, "timelineEnd": 2, "deleted": True},
    {"sourceStart": 2, "sourceEnd": 5, "timelineStart": 0, "timelineEnd": 3, "deleted": False}
]

total_duration = 5.0
kept_ranges = []
if parsed_video_segments:
    active_video_segs = [s for s in parsed_video_segments if not s.get("deleted")]
    if active_video_segs:
        for s in sorted(active_video_segs, key=lambda x: x.get("timelineStart", 0)):
            src_s = max(0.0, float(s.get("sourceStart", 0)))
            src_e = float(s.get("sourceEnd", total_duration))
            if src_e > src_s + 0.01:
                kept_ranges.append((src_s, src_e))

if not kept_ranges:
    kept_ranges = [(0.0, total_duration)]

print("KEPT RANGES:", kept_ranges)
