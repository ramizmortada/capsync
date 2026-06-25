import os
from fontTools.ttLib import TTFont

fonts_dir = os.path.join(os.path.dirname(__file__), "fonts")

print("Font Scale Factors (ASS = CSS * Factor):")

for family in os.listdir(fonts_dir):
    family_path = os.path.join(fonts_dir, family)
    if not os.path.isdir(family_path):
        continue
    
    # Just check the 400 weight for the family
    ttf_path = os.path.join(family_path, f"{family.capitalize()}-400.ttf")
    if not os.path.exists(ttf_path):
        ttf_path = os.path.join(family_path, f"{family}-400.ttf")
    if not os.path.exists(ttf_path):
        ttf_path = os.path.join(family_path, os.listdir(family_path)[0])
        
    try:
        font = TTFont(ttf_path)
        os2 = font['OS/2']
        head = font['head']
        
        upm = head.unitsPerEm
        ascent = os2.usWinAscent
        descent = os2.usWinDescent
        
        scale_factor = (ascent + descent) / upm
        print(f"  {family}: {scale_factor:.4f} (UPM: {upm}, Ascent: {ascent}, Descent: {descent})")
        
    except Exception as e:
        print(f"  {family}: ERROR {e}")
