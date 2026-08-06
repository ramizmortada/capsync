import os
import requests

FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")

# We download static TTF files for each standard weight from Fontsource CDN
# so that libass can easily resolve FontName and Weight natively.
FAMILY_WEIGHTS = {
    "inter": ["300", "400", "500", "600", "700", "800", "900"],
    "poppins": ["300", "400", "500", "600", "700", "800", "900"],
    "instrument-serif": ["400"],
    "oswald": ["300", "400", "500", "600", "700"],
}

def ensure_fonts():
    """
    Download Google Fonts to the local fonts/ directory if they are not already present.
    Returns the absolute path to the fonts directory.
    """
    os.makedirs(FONTS_DIR, exist_ok=True)
    
    for family, weights in FAMILY_WEIGHTS.items():
        family_name = "".join(word.capitalize() for word in family.split("-"))
        if family == "instrument-serif":
            family_name = "Instrument-serif"
            
        family_dir = os.path.join(FONTS_DIR, family_name)
        os.makedirs(family_dir, exist_ok=True)
        
        marker_file = os.path.join(family_dir, ".complete")
        if os.path.exists(marker_file):
            continue
            
        print(f"Downloading static fonts for: {family_name}...", flush=True)
        
        for weight in weights:
            url = f"https://cdn.jsdelivr.net/fontsource/fonts/{family}@latest/latin-{weight}-normal.ttf"
            filename = f"{family_name}-{weight}.ttf"
            target_path = os.path.join(family_dir, filename)
            
            if os.path.exists(target_path):
                continue
                
            try:
                resp = requests.get(url, timeout=30, allow_redirects=True)
                if resp.status_code == 200:
                    with open(target_path, 'wb') as f:
                        f.write(resp.content)
                    print(f"  Downloaded: {filename}", flush=True)
                else:
                    print(f"  Warning: No weight {weight} found for {family_name}", flush=True)
            except Exception as e:
                print(f"  Warning: Could not download {family_name} {weight}: {e}", flush=True)
        
        try:
            open(marker_file, 'w').close()
        except:
            pass
    
    return FONTS_DIR

def get_fonts_dir():
    """Returns the fonts directory path, creating it if needed."""
    return ensure_fonts()

if __name__ == "__main__":
    print(f"Fonts directory: {ensure_fonts()}")
    for family in os.listdir(FONTS_DIR):
        family_path = os.path.join(FONTS_DIR, family)
        if os.path.isdir(family_path):
            files = os.listdir(family_path)
            print(f"  {family}: {len(files)} files -> {files}")
