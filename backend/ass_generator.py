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
    font_family = style.get("fontFamily", "Inter")
    
    # CSS-to-ASS rendering scale factor based on TTF OS/2 vertical metrics
    # Formula: (usWinAscent + usWinDescent) / unitsPerEm
    ass_scales = {
        "Instrument Serif": 1.3000,
        "Inter": 1.4302,
        "Oswald": 1.7020,
        "Poppins": 1.7620
    }
    ass_scale = ass_scales.get(font_family, 1.48)
    
    # Directly use the raw pixel values defined by the user for a 1920 reference height
    font_size = int(float(style.get("fontSize", 96)) * ass_scale)
    
    primary_color = hex_to_ass_color(style.get("textColor", "#ffffff"))
    
    # Optional highlight color for current word (default yellow)
    highlight_color_hex = style.get("highlightColor", "#ffff00")
    highlight_color = hex_to_ass_color(highlight_color_hex)
    
    stroke_enabled = style.get("strokeEnabled", False)
    stroke_color = hex_to_ass_color(style.get("strokeColor", "#000000"))
    stroke_width = int(float(style.get("strokeWidth", 6))) if stroke_enabled else 0
    
    shadow_enabled = style.get("shadowEnabled", False)
    shadow_3d_enabled = style.get("shadow3DEnabled", False)
    shadow_color = hex_to_ass_color(style.get("shadowColor", "#000000"))
    shadow_offset_max = max(abs(float(style.get("shadowOffsetX", 0))), abs(float(style.get("shadowOffsetY", 8))))
    shadow_depth = int(shadow_offset_max) if shadow_enabled and not shadow_3d_enabled else 0
    
    font_weight_str = str(style.get("fontWeight", "400"))
    weight_suffixes = {
        "300": " Light",
        "400": "",
        "500": " Medium",
        "600": " SemiBold",
        "700": " Bold",
        "800": " ExtraBold",
        "900": " Black"
    }
    suffix = weight_suffixes.get(font_weight_str, "")
    font_name = f"{font_family}{suffix}"
    is_bold = 0

    horiz_map = {"left": 1, "center": 2, "right": 3}
    vert_map = {"bottom": 0, "middle": 4, "top": 8}
    
    h_align = style.get("alignment", "center")
    v_align = style.get("alignmentVertical", "bottom")
    
    ass_align = horiz_map.get(h_align, 2)
    
    if v_align == "middle":
        ass_align = horiz_map.get(h_align, 2) + 3
    elif v_align == "top":
        ass_align = horiz_map.get(h_align, 2) + 6
    
    position_y_pct = float(style.get("positionY", 10))
    margin_v = int(video_height * (position_y_pct / 100.0))
    
    max_width_pct = float(style.get("maxWidth", 90))
    margin_l = margin_r = int(video_width * ((100 - max_width_pct) / 2) / 100)

    animation_style = style.get("animationStyle", "color")
    animation_in = style.get("animationIn", "none")
    animation_out = style.get("animationOut", "none")
    scale_factor = int(float(style.get("scaleFactor", 1.2)) * 100)
    
    text_transform = style.get("textTransform", "none")
    def apply_transform(t: str) -> str:
        if text_transform == "uppercase": return t.upper()
        if text_transform == "lowercase": return t.lower()
        if text_transform == "capitalize": return " ".join(w.capitalize() for w in t.split(" "))
        return t
    highlight_bg_color = hex_to_ass_color(style.get("highlightBackgroundColor", "#ff0000"))
    background_color_bgr = highlight_bg_color[4:-1]
    background_opacity_hex = "80"

    ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{stroke_color},{shadow_color},{is_bold},0,0,0,100,100,0,0,1,{stroke_width},{shadow_depth},{ass_align},{margin_l},{margin_r},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    
    def append_events(layer, start, end, text):
        if shadow_enabled and shadow_3d_enabled:
            shadow_bgr = shadow_color[4:10]
            max_steps = max(abs(float(style.get("shadowOffsetX", 0))), abs(float(style.get("shadowOffsetY", 8))))
            steps = max(1, int(max_steps))
            
            for i in range(1, steps + 1):
                dx = (float(style.get("shadowOffsetX", 0)) / steps) * i
                dy = (float(style.get("shadowOffsetY", 8)) / steps) * i
                shadow_tags = f"{{\\1c&H{shadow_bgr}&\\3c&H{shadow_bgr}&\\xshad{dx:.1f}\\yshad{dy:.1f}}}"
                events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{shadow_tags}{text}")
                
        # Main text layer
        actual_layer = layer if not shadow_3d_enabled else max(layer, 1)
        events.append(f"Dialogue: {actual_layer},{start},{end},Default,,0,0,0,,{text}")
    
    for segment in segments:
        words = segment.get("words", [])
        seg_start = segment.get("start", 0)
        seg_end = segment.get("end", 0)

        first_word_dur = int((words[0].get("end", seg_start) - words[0].get("start", seg_start)) * 1000) if words else int((seg_end - seg_start) * 1000)
        last_word_dur = int((words[-1].get("end", seg_end) - words[-1].get("start", seg_end)) * 1000) if words else int((seg_end - seg_start) * 1000)
        
        if len(words) <= 1:
            t_in = min(200, max(0, first_word_dur // 2))
            t_out = min(200, max(0, first_word_dur // 2))
        else:
            t_in = min(200, max(0, first_word_dur))
            t_out = min(200, max(0, last_word_dur))

        def get_prefix_tags(is_first, is_last, event_dur):
            local_t_in = t_in if is_first else 0
            local_t_out = t_out if is_last else 0
            p_tags = ""
            
            do_fade_in = (animation_in != "none" and is_first and local_t_in > 0)
            do_fade_out = (animation_out != "none" and is_last and local_t_out > 0)
            
            if do_fade_in or do_fade_out:
                f_in = local_t_in if do_fade_in else 0
                f_out = local_t_out if do_fade_out else 0
                p_tags += f"\\fad({f_in},{f_out})"
                
            if do_fade_in:
                if animation_in == "zoomIn":
                    p_tags += f"\\fscx80\\fscy80\\t(0,{local_t_in},\\fscx100\\fscy100)"
                elif animation_in == "zoomOut":
                    p_tags += f"\\fscx120\\fscy120\\t(0,{local_t_in},\\fscx100\\fscy100)"
                    
            if do_fade_out:
                if animation_out == "zoomIn":
                    p_tags += f"\\t({max(0, event_dur - local_t_out)},{event_dur},\\fscx80\\fscy80)"
                elif animation_out == "zoomOut":
                    p_tags += f"\\t({max(0, event_dur - local_t_out)},{event_dur},\\fscx120\\fscy120)"
                    
            return f"{{{p_tags}}}" if p_tags else ""

        if not words:
            # Fallback if no word-level timestamps
            start_time = format_ass_time(seg_start)
            end_time = format_ass_time(seg_end)
            text = segment.get("text", "")
            append_events(0, start_time, end_time, text)
            continue

        if animation_style == "none" or animation_style == "box":
            # Single event for the whole segment's text
            event_start = format_ass_time(seg_start)
            event_end = format_ass_time(seg_end)
            
            line_parts = []
            for w in words:
                clean_word = apply_transform(w.get("word", "").strip())
                line_parts.append(clean_word)
                    
            event_dur = int((seg_end - seg_start) * 1000)
            prefix = get_prefix_tags(True, True, event_dur)
            full_text = prefix + " ".join(line_parts)
            layer = 1 if animation_style == "box" else 0
            append_events(layer, event_start, event_end, full_text)
            
            if animation_style == "none":
                continue
                
            # For box, generate Layer 0 background box events
            for i, target_word in enumerate(words):
                word_start = target_word.get("start", target_word.get("end", seg_start))
                word_end = target_word.get("end", target_word.get("start", seg_end))
                
                event_start = format_ass_time(word_start)
                
                if i < len(words) - 1:
                    next_word_start = words[i+1].get("start", word_end)
                    event_end_s = next_word_start
                else:
                    event_end_s = seg_end
                event_end = format_ass_time(event_end_s)
                
                if word_start == word_end and i < len(words) - 1:
                    continue
                
                line_parts = []
                for j, w in enumerate(words):
                    clean_word = apply_transform(w.get("word", "").strip())
                    if j == i:
                        line_parts.append(f"{{\\1a&HFF&\\3a&H00&\\3c{highlight_bg_color}\\bord12\\4a&HFF&}}{clean_word}{{\\alpha&HFF&}}")
                    else:
                        line_parts.append(clean_word)
                
                event_dur = int((event_end_s - word_start) * 1000)
                prefix = get_prefix_tags(i == 0, i == len(words) - 1, event_dur)
                full_text = prefix + f"{{\\alpha&HFF&}}" + " ".join(line_parts)
                events.append(f"Dialogue: 0,{event_start},{event_end},Default,,0,0,0,,{full_text}") # keep direct append for background box
            continue

        # Overlapping events for word-by-word highlights
        for i, target_word in enumerate(words):
            word_start = target_word.get("start", target_word.get("end", seg_start))
            word_end = target_word.get("end", target_word.get("start", seg_end))
            
            event_start = format_ass_time(word_start)
            
            if i < len(words) - 1:
                next_word_start = words[i+1].get("start", word_end)
                event_end_s = next_word_start
            else:
                event_end_s = seg_end
            event_end = format_ass_time(event_end_s)
            
            if word_start == word_end and i < len(words) - 1:
                continue

            line_parts = []
            for j, w in enumerate(words):
                clean_word = apply_transform(w.get("word", "").strip())
                
                if animation_style == "karaoke":
                    if j <= i:
                        line_parts.append(f"{{\\c{highlight_color}}}{clean_word}{{\\c{primary_color}}}")
                    else:
                        line_parts.append(clean_word)
                elif animation_style == "reveal":
                    if j <= i:
                        line_parts.append(clean_word)
                    else:
                        line_parts.append(f"{{\\alpha&HFF&}}{clean_word}{{\\alpha&H00&}}")
                else:
                    if j == i:
                        if animation_style == "color":
                            line_parts.append(f"{{\\c{highlight_color}}}{clean_word}{{\\c{primary_color}}}")
                        elif animation_style == "scale":
                            line_parts.append(f"{{\\fscx{scale_factor}\\fscy{scale_factor}\\c{highlight_color}}}{clean_word}{{\\fscx100\\fscy100\\c{primary_color}}}")
                    else:
                        line_parts.append(clean_word)
            
            event_dur = int((event_end_s - word_start) * 1000)
            prefix = get_prefix_tags(i == 0, i == len(words) - 1, event_dur)
            full_text = prefix + " ".join(line_parts)
            append_events(0, event_start, event_end, full_text)

    return ass_header + "\n".join(events) + "\n"
