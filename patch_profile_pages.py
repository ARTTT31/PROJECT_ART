import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # The block we want to replace
    target = """                const allowedPages = user?.accessible_pages ? (
                  (typeof user.accessible_pages === 'string' 
                    ? (() => { try { return JSON.parse(user.accessible_pages); } catch { return null; } })() 
                    : user.accessible_pages)
                ) : null;"""

    replacement = """                const allowedPages = user?.accessible_pages ? (
                  (typeof user.accessible_pages === 'string' 
                    ? (() => { try { return JSON.parse(user.accessible_pages); } catch { return null; } })() 
                    : user.accessible_pages)
                ) : ['dashboard', 'profile'];"""

    if target in content:
        content = content.replace(target, replacement)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Success for {filepath}")
    else:
        print(f"Pattern not found in {filepath}")

patch_file('frontend/src/app/(main)/profile/page.tsx')
