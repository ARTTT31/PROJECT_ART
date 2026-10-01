import sys

with open('frontend/src/components/Layout/DashboardLayout.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """            <AnimatePresence>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>"""

replacement = """            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>"""

if target in content:
    content = content.replace(target, replacement)
    with open('frontend/src/components/Layout/DashboardLayout.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found in DashboardLayout")


with open('frontend/src/app/login/page.tsx', 'r', encoding='utf-8') as f:
    login_content = f.read()

target_login = """    <motion.main
      initial={{ opacity: 0, scale: 0.98, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="login-page"
    >"""
replacement_login = """    <main className="login-page">"""

if target_login in login_content:
    login_content = login_content.replace(target_login, replacement_login)
    login_content = login_content.replace("</motion.main>", "</main>")
    # We leave the import there, it's fine.
    with open('frontend/src/app/login/page.tsx', 'w', encoding='utf-8') as f:
        f.write(login_content)
    print("Success login")
else:
    print("Pattern not found in login")
