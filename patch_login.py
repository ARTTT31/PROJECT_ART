import sys

with open('frontend/src/app/login/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  return (
    <main className="login-page">"""

replacement = """  return (
    <motion.main
      initial={{ opacity: 0, scale: 0.98, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="login-page"
    >"""

if target in content:
    content = content.replace(target, replacement)
    content = content.replace("</main>", "</motion.main>")
    if "import { motion } from 'framer-motion';" not in content:
        content = content.replace("import { useRouter } from 'next/navigation';", "import { useRouter } from 'next/navigation';\nimport { motion } from 'framer-motion';")
    with open('frontend/src/app/login/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")
