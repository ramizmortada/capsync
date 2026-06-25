import json

def hex_to_ass_color(hex_color, alpha="00"):
    """
    Convert #RRGGBB to &HAABBGGRR&
    Alpha: 00 is opaque, FF is fully transparent
    """
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
        return f"&H{alpha}{b}{g}{r}&"
    return f"&H{alpha}FFFFFF&" # Default white

def format_ass_time(seconds):
    """
    Convert seconds to H:MM:SS.cs
    """
    if seconds is None:
        return "0:00:00.00"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int(round((seconds % 1) * 100))
    if centisecs == 100:
        secs += 1
        centisecs = 0
    if secs == 60:
        minutes += 1
        secs = 0
    if minutes == 60:
        hours += 1
        minutes = 0
        
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

def generate_ass(segments, style, video_width, video_height):
    """
    Generates ASS subtitle content from segments and styling.
    """
    font_name = style.get("fontFamily", "Arial")
    
    # CSS-to-ASS rendering scale factor.
    # CSS sets the EM square (100%), but libass renders the visual glyphs at ~67% of the EM square.
    # Therefore, we multiply by 1.48 to make the libass visual size match the CSS visual size.
    ass_scale = 1.48
    
    # Compute exact pixels from percentages of video_height
    font_size = int((float(style.get("fontSize", 5.0)) / 100.0) * video_height * ass_scale)
    
    primary_color = hex_to_ass_color(style.get("textColor", "#ffffff"))
    
    # Optional highlight color for current word (default yellow)
    highlight_color_hex = style.get("highlightColor", "#ffff00")
    highlight_color = hex_to_ass_color(highlight_color_hex)
    
    stroke_enabled = style.get("strokeEnabled", False)
    stroke_color = hex_to_ass_color(style.get("strokeColor", "#000000"))
    stroke_width = int((float(style.get("strokeWidth", 0.4)) / 100.0) * video_height * ass_scale) if stroke_enabled else 0
    
    shadow_enabled = style.get("shadowEnabled", False)
    shadow_color = hex_to_ass_color(style.get("shadowColor", "#000000"))
    shadow_offset_max = max(abs(float(style.get("shadowOffsetX", 0))), abs(float(style.get("shadowOffsetY", 0.4))))
    shadow_depth = int((shadow_offset_max / 100.0) * video_height * ass_scale) if shadow_enabled else 0
    
    font_weight_str = str(style.get("fontWeight", "400"))
    try:
        is_bold = int(font_weight_str)
    except ValueError:
        is_bold = -1 if font_weight_str in ["bold", "bolder"] else 400

    alignment_str = style.get("alignment", "center")
    ass_alignment = 1 if alignment_str == "left" else 3 if alignment_str == "right" else 2
    
    position_y_pct = float(style.get("positionY", 10))
    margin_v = int(video_height * (position_y_pct / 100.0))
    margin_l = margin_r = int(video_width * 0.05) # 5% side margins

    animation_style = style.get("animationStyle", "color")
    scale_factor = int(float(style.get("scaleFactor", 1.2)) * 100)
    highlight_bg_hex = style.get("highlightBackgroundColor", "#ff0000")
    highlight_bg_color = hex_to_ass_color(highlight_bg_hex)

    ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{stroke_color},{shadow_color},{is_bold},0,0,0,100,100,0,0,1,{stroke_width},{shadow_depth},{ass_alignment},{margin_l},{margin_r},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    
    for segment in segments:
        words = segment.get("words", [])
        seg_start = segment.get("start", 0)
        seg_end = segment.get("end", 0)

        if not words:
            # Fallback if no word-level timestamps
            start_time = format_ass_time(seg_start)
            end_time = format_ass_time(seg_end)
            text = segment.get("text", "")
            events.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}")
            continue

        if animation_style == "none" or animation_style == "box":
            # Single event for the whole segment's text
            event_start = format_ass_time(seg_start)
            event_end = format_ass_time(seg_end)
            
            line_parts = []
            for w in words:
                clean_word = w.get("word", "").strip()
                line_parts.append(clean_word)
                    
            full_text = " ".join(line_parts)
            layer = 1 if animation_style == "box" else 0
            events.append(f"Dialogue: {layer},{event_start},{event_end},Default,,0,0,0,,{full_text}")
            
            if animation_style == "none":
                continue
                
            # For box, generate Layer 0 background box events
            for i, target_word in enumerate(words):
                word_start = target_word.get("start", target_word.get("end", seg_start))
                word_end = target_word.get("end", target_word.get("start", seg_end))
                
                event_start = format_ass_time(word_start)
                
                if i < len(words) - 1:
                    next_word_start = words[i+1].get("start", word_end)
                    event_end = format_ass_time(next_word_start)
                else:
                    event_end = format_ass_time(seg_end)
                
                if word_start == word_end and i < len(words) - 1:
                    continue
                
                line_parts = []
                for j, w in enumerate(words):
                    clean_word = w.get("word", "").strip()
                    if j == i:
                        line_parts.append(f"{{\\1a&HFF&\\3a&H00&\\3c{highlight_bg_color}\\bord12\\4a&HFF&}}{clean_word}{{\\alpha&HFF&}}")
                    else:
                        line_parts.append(clean_word)
                
                full_text = f"{{\\alpha&HFF&}}" + " ".join(line_parts)
                events.append(f"Dialogue: 0,{event_start},{event_end},Default,,0,0,0,,{full_text}")
            continue

        # Overlapping events for word-by-word highlights
        for i, target_word in enumerate(words):
            word_start = target_word.get("start", target_word.get("end", seg_start))
            word_end = target_word.get("end", target_word.get("start", seg_end))
            
            event_start = format_ass_time(word_start)
            
            if i < len(words) - 1:
                next_word_start = words[i+1].get("start", word_end)
                event_end = format_ass_time(next_word_start)
            else:
                event_end = format_ass_time(seg_end)
            
            if word_start == word_end and i < len(words) - 1:
                continue

            line_parts = []
            for j, w in enumerate(words):
                clean_word = w.get("word", "").strip()
                
                if animation_style == "karaoke":
                    if j <= i:
                        line_parts.append(f"{{\\c{highlight_color}}}{clean_word}{{\\c{primary_color}}}")
                    else:
                        line_parts.append(clean_word)
                else:
                    if j == i:
                        if animation_style == "color":
                            line_parts.append(f"{{\\c{highlight_color}}}{clean_word}{{\\c{primary_color}}}")
                        elif animation_style == "scale":
                            line_parts.append(f"{{\\fscx{scale_factor}\\fscy{scale_factor}\\c{highlight_color}}}{clean_word}{{\\fscx100\\fscy100\\c{primary_color}}}")
                    else:
                        line_parts.append(clean_word)
            
            full_text = " ".join(line_parts)
            events.append(f"Dialogue: 0,{event_start},{event_end},Default,,0,0,0,,{full_text}")

    return ass_header + "\n".join(events) + "\n"
