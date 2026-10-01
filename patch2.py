import sys

with open('frontend/src/components/Admin/UserManagement.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """            {/* Role */}
            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                สิทธิ์การใช้งาน (Role)
              </label>
              <div className="relative">
                <select 
                  value={editRole} 
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full appearance-none rounded-2xl bg-[#f8fafc] px-4 py-3.5 text-[14px] font-semibold text-[#1d1d1f] ring-1 ring-black/[0.04] transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                >
                  <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>"""

new_block = """            {/* Role */}
            <div>
              <label className="mb-2 block text-[12px] font-bold tracking-wide uppercase text-[#6e6e73]">
                สิทธิ์การใช้งาน (Role)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* User Role Card */}
                <div 
                  onClick={() => setEditRole('user')}
                  className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-all duration-200 ${
                    editRole === 'user' 
                      ? 'bg-white ring-2 ring-[#0071e3] shadow-[0_4px_12px_rgba(0,113,227,0.12)]' 
                      : 'bg-[#f8fafc] ring-1 ring-black/[0.04] hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    editRole === 'user' ? 'bg-[#0071e3] text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                  }`}>
                    <User size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className={`block text-[14px] font-semibold transition-colors ${
                      editRole === 'user' ? 'text-[#0071e3]' : 'text-[#1d1d1f]'
                    }`}>ผู้ใช้งานทั่วไป (User)</span>
                    <span className="block mt-0.5 text-[12px] text-[#6e6e73] leading-relaxed">เข้าถึงเฉพาะฟีเจอร์ที่ได้รับอนุญาต</span>
                  </div>
                  {editRole === 'user' && (
                    <div className="absolute right-4 top-4 text-[#0071e3] animate-in zoom-in duration-200">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>

                {/* Admin Role Card */}
                <div 
                  onClick={() => setEditRole('admin')}
                  className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-all duration-200 ${
                    editRole === 'admin' 
                      ? 'bg-white ring-2 ring-purple-600 shadow-[0_4px_12px_rgba(147,51,234,0.12)]' 
                      : 'bg-[#f8fafc] ring-1 ring-black/[0.04] hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    editRole === 'admin' ? 'bg-purple-600 text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'
                  }`}>
                    <ShieldAlert size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className={`block text-[14px] font-semibold transition-colors ${
                      editRole === 'admin' ? 'text-purple-700' : 'text-[#1d1d1f]'
                    }`}>ผู้ดูแลระบบ (Admin)</span>
                    <span className="block mt-0.5 text-[12px] text-[#6e6e73] leading-relaxed">มีสิทธิ์สูงสุดในการจัดการระบบทั้งหมด</span>
                  </div>
                  {editRole === 'admin' && (
                    <div className="absolute right-4 top-4 text-purple-600 animate-in zoom-in duration-200">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>
              </div>
            </div>"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('frontend/src/components/Admin/UserManagement.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Block not found")
