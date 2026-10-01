import re

def patch(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the `) : null;` part of `const allowedPages = ... : null;`
    pattern = r'(const allowedPages = user\?\.accessible_pages \?\s*\([\s\S]*?\)\s*) : null;'
    new_content = re.sub(pattern, r"\1 : ['dashboard', 'profile'];", content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Success {filepath}")
    else:
        print(f"No changes {filepath}")

patch('frontend/src/components/Layout/Sidebar.tsx')
patch('frontend/src/app/(main)/profile/page.tsx')
