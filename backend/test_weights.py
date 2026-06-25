import subprocess
import tempfile
import os

VIDEO_W = 1080
VIDEO_H = 1920

# Get the fonts directory
fonts_dir = os.path.join(os.path.dirname(__file__), "fonts")
temp_dir = tempfile.gettempdir()
temp_fonts_dir = os.path.join(temp_dir, "fonts_weight_test")
os.makedirs(temp_fonts_dir, exist_ok=True)

# Copy Inter fonts
inter_dir = os.path.join(fonts_dir, "Inter")
if os.path.isdir(inter_dir):
    import shutil
    for f in os.listdir(inter_dir):
        if f.endswith('.ttf'):
            shutil.copy2(os.path.join(inter_dir, f), os.path.join(temp_fonts_dir, f))

fontsdir_escaped = temp_fonts_dir.replace("\\", "/").replace(":", "\\:")

for weight in [400, 600, 800, 900]:
    # Test setting the Bold field to the actual numeric weight
    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {VIDEO_W}
PlayResY: {VIDEO_H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,150,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,{weight},0,0,0,100,100,0,0,1,0,0,2,0,0,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,TEST WEIGHT {weight} (Style Field)
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,{{\\b{weight}}}TEST WEIGHT {weight} (Inline Tag)
"""
    
    ass_path = os.path.join(temp_dir, f"test_weight_{weight}.ass")
    out_path = os.path.join(temp_dir, f"test_weight_{weight}.png")
    
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
    
    ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s={VIDEO_W}x{VIDEO_H}:d=1",
        "-vf", f"ass='{ass_escaped}':fontsdir='{fontsdir_escaped}'",
        "-frames:v", "1",
        out_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"[OK] Weight {weight} -> {out_path}")
    else:
        print(f"[FAIL] {weight}: {result.stderr[-200:]}")
