import os
import re

def bump_version_in_html_files():
    directory = "c:\\Users\\reyli\\Desktop\\zyrexweb"
    pattern = re.compile(r'css/style\.css\?v=12')
    
    html_files = [f for f in os.listdir(directory) if f.endswith(".html")]
    print(f"Found {len(html_files)} HTML files to process.")
    
    updated_count = 0
    for filename in html_files:
        filepath = os.path.join(directory, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        if pattern.search(content):
            new_content = pattern.sub("css/style.css?v=13", content)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"[OK] Updated {filename}")
            updated_count += 1
        else:
            print(f"[SKIP] Skipped {filename} (no matching style.css version)")
            
    print(f"Done. Updated {updated_count} files.")

if __name__ == "__main__":
    bump_version_in_html_files()
