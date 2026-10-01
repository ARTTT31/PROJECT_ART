import sys

with open('frontend/src/app/layout.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import NextTopLoader from 'nextjs-toploader';\n", "")
content = content.replace("          <NextTopLoader color=\"#0071e3\" showSpinner={false} />\n", "")

with open('frontend/src/app/layout.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
