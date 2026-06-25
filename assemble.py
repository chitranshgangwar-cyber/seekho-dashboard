import os, re
css = open("output_ncad.css").read()
js  = open("bundle_ncad.js").read()
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"/>'
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
        '<title>Seekho \u00b7 Creative Intelligence</title>'
        f'<style>{css}</style></head><body><div id="root"></div>'
        f'<script>{js.replace("</script>", "<\\/script>")}</script></body></html>')
os.makedirs("dashboard", exist_ok=True)
open("dashboard/index.html", "w").write(html)
real = len(re.findall(r'(src|href)="https?://[^"]+|@import[^;]*https?://|url\(https?://', html)) - len(re.findall(r'w3\.org', html))
print(f"   dashboard/index.html {os.path.getsize('dashboard/index.html')/1e6:.2f} MB \u00b7 external loads: {max(0,real)}")
