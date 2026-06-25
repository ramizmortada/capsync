import os
import requests

FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")

# We download static TTF files for each standard weight from Fontsource CDN
# so that libass can easily resolve FontName and Weight natively.
FAMILIES = ["inter", "poppins", "instrument-serif", "oswald"]
WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"]

def ensure_fonts():
    """
    Download Google Fonts to the local fonts/ directory if they are not already present.
    Returns the absolute path to the fonts directory.
    """
    os.makedirs(FONTS_DIR, exist_ok=True)
    
    for family in FAMILIES:
        family_name = family.capitalize()
        family_dir = os.path.join(FONTS_DIR, family_name)
        os.makedirs(family_dir, exist_ok=True)
        
        # Check if we already have all expected weights downloaded
        existing_files = os.listdir(family_dir)
        if sum(1 for f in existing_files if f.endswith('.ttf')) >= len(WEIGHTS):
            continue
            
        print(f"Downloading static fonts for: {family_name}...", flush=True)
        
        for weight in WEIGHTS:
            # Roboto doesn't have an 800 weight in the standard fontsource package, 
            # but we'll try to download it, and fall back if 404.
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
