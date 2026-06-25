import os
import requests
import zipfile
import io

FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")

# Google Fonts families to download - must match the frontend SelectItem values
GOOGLE_FONTS = {
    "Inter": "Inter",
    "Roboto": "Roboto",
    "Outfit": "Outfit",
    "Montserrat": "Montserrat",
}

def ensure_fonts():
    """
    Download Google Fonts to the local fonts/ directory if they are not already present.
    Returns the absolute path to the fonts directory.
    """
    os.makedirs(FONTS_DIR, exist_ok=True)
    
    for family_key, family_name in GOOGLE_FONTS.items():
        # Check if at least one .ttf file exists for this family
        family_dir = os.path.join(FONTS_DIR, family_key)
        if os.path.isdir(family_dir) and any(f.endswith(('.ttf', '.otf')) for f in os.listdir(family_dir)):
            continue
        
        print(f"Downloading font: {family_name}...", flush=True)
        os.makedirs(family_dir, exist_ok=True)
        
        try:
            url = f"https://fonts.google.com/download?family={family_name}"
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            
            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                for member in zf.namelist():
                    if member.endswith(('.ttf', '.otf')) and not member.startswith('__'):
                        filename = os.path.basename(member)
                        target_path = os.path.join(family_dir, filename)
                        with open(target_path, 'wb') as f:
                            f.write(zf.read(member))
                        print(f"  Extracted: {filename}", flush=True)
        except Exception as e:
            print(f"  Warning: Could not download {family_name}: {e}", flush=True)
    
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
            print(f"  {family}: {len(files)} files")
