import re

with open('/tmp/oil.html', encoding='utf-8') as f:
    html = f.read()

# Find each row: image src + all price columns
rows = re.findall(
    r"oil_price_colum_name'><img[^>]+src='([^']+)'[^<]*</div>(.*?)(?=<div class='oil_price_colum_name_|<div style='clear:both)",
    html, re.DOTALL
)
for img, rest in rows:
    prices = re.findall(r"oil_price_colum'>([\d.]+)<", rest)
    first = prices[0] if prices else '-'
    print(f"{img.split('/')[-1]:<25} PTT={first}")
