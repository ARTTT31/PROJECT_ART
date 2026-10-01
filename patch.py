import sys
content = open('frontend/src/app/(main)/profile/page.tsx', encoding='utf-8').read()

if 'import UserManagement' not in content:
    content = content.replace('import { fetchWithAuth }', "import UserManagement from '@/components/Admin/UserManagement'\nimport { fetchWithAuth }")

admin_block = """
        {user?.role === 'admin' && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              การจัดการผู้ใช้งาน (Admin Panel)
            </h2>
            <UserManagement />
          </div>
        )}
"""

content = content.replace('      </div>\n\n      {/* ════════', admin_block + '      </div>\n\n      {/* ════════')
open('frontend/src/app/(main)/profile/page.tsx', 'w', encoding='utf-8').write(content)
