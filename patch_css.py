import re

with open('frontend/src/app/globals.css', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'/\* Error state.*?\n}\n', re.DOTALL)
new_content = pattern.sub('', content)

if len(new_content) < len(content):
    with open('frontend/src/app/globals.css', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success")
else:
    print("Pattern not found")
