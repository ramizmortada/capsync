import json

parsed_segments = [
    {
        "start": 6.0,
        "end": 7.6,
        "text": "The fear of coming to an end",
        "words": [
            {"start": 6.0, "end": 7.6, "word": "The"}
        ]
    }
]

kept_ranges = [(6.0, 34.2)]

def map_source_to_timeline(source_time: float) -> float:
    timeline_offset = 0.0
    for src_start, src_end in kept_ranges:
        if source_time < src_start:
            return timeline_offset
        if src_start <= source_time <= src_end:
            return timeline_offset + (source_time - src_start)
        timeline_offset += (src_end - src_start)
    return timeline_offset

shifted_segments = []
for seg in parsed_segments:
    new_seg = dict(seg)
    new_seg["start"] = map_source_to_timeline(seg.get("start", 0.0))
    new_seg["end"] = map_source_to_timeline(seg.get("end", 0.0))
    if "words" in new_seg:
        shifted_words = []
        for w in new_seg["words"]:
            new_w = dict(w)
            new_w["start"] = map_source_to_timeline(w.get("start", 0.0))
            new_w["end"] = map_source_to_timeline(w.get("end", 0.0))
            shifted_words.append(new_w)
        new_seg["words"] = shifted_words
    shifted_segments.append(new_seg)

print("SHIFTED:", json.dumps(shifted_segments, indent=2))
