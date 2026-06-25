"""
Diagnostic: Compare 3 different font sizes to find the consistent CSS-to-ASS scaling factor.
Renders at PlayResY=1920 with fonts 96, 144, and 192.
Also tries with the Inter font from our fonts dir.
"""
import subprocess
import tempfile
import os

VIDEO_W = 1080
VIDEO_H = 1920

# Check if we have Inter font downloaded
fonts_dir = os.path.join(os.path.dirname(__file__), "fonts")
inter_dir = os.path.join(fonts_dir, "Inter")
has_inter = os.path.isdir(inter_dir) and any(f.endswith('.ttf') for f in os.listdir(inter_dir))

# Create a flat temp fonts dir for FFmpeg
temp_dir = tempfile.gettempdir()
temp_fonts_dir = os.path.join(temp_dir, "fonts_test")
os.makedirs(temp_fonts_dir, exist_ok=True)

if has_inter:
    import shutil
    for f in os.listdir(inter_dir):
        if f.endswith('.ttf'):
            src = os.path.join(inter_dir, f)
            dst = os.path.join(temp_fonts_dir, f)
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
    print(f"Inter font files copied to {temp_fonts_dir}")
    # List the font files
    for f in os.listdir(temp_fonts_dir):
        print(f"  - {f}")
else:
    print("No Inter font found, using Arial")

font_name = "Inter" if has_inter else "Arial"
fontsdir_escaped = temp_fonts_dir.replace("\\", "/").replace(":", "\\:")

for font_pct in [5.0, 7.5, 10.0]:
    font_px = int((font_pct / 100.0) * VIDEO_H)
    
    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {VIDEO_W}
PlayResY: {VIDEO_H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_px},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,2,0,0,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,TEST {font_pct}pct = {font_px}px
"""
    
    ass_path = os.path.join(temp_dir, f"test_{font_pct}.ass")
    out_path = os.path.join(temp_dir, f"test_{font_pct}.png")
    
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
    
    ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
    
    vf = f"ass='{ass_escaped}'"
    if has_inter:
        vf = f"ass='{ass_escaped}':fontsdir='{fontsdir_escaped}'"
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s={VIDEO_W}x{VIDEO_H}:d=1",
        "-vf", vf,
        "-frames:v", "1",
        out_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"[OK] {font_pct}% -> ASS Fontsize={font_px}  output: {out_path}")
    else:
        print(f"[FAIL] {font_pct}%: {result.stderr[-200:]}")

print("\nDone. Open the PNG files to compare rendered sizes.")
print("If ASS Fontsize=96 renders at ~65px visible height,")
print("the CSS-to-ASS ratio is ~1.48x")
