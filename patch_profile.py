import sys

with open('frontend/src/app/(main)/profile/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
          <SectionCard
            icon={<LayoutGrid size={18} aria-hidden="true" />}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            iconRing="ring-violet-200/60"
            title="เมนูหลัก"
            subtitle="เปิด/ปิด และจัดลำดับรายการในแถบเมนูด้านข้าง"
            badge={`${mainMenuConfig.filter((item) => {
                const allowedPages = user?.accessible_pages ? (
                  (typeof user.accessible_pages === 'string' 
                    ? (() => { try { return JSON.parse(user.accessible_pages); } catch { return null; } })() 
                    : user.accessible_pages)
                ) : null;
                if (allowedPages && Array.isArray(allowedPages)) {
                  if (user?.role !== 'admin' && !allowedPages.includes(item.id)) return false;
                }
                return true;
            }).filter((i) => i.enabled).length} รายการ`}
          >
            <div className="space-y-1.5">
              {mainMenuConfig.filter((item) => {
                const allowedPages = user?.accessible_pages ? (
                  (typeof user.accessible_pages === 'string' 
                    ? (() => { try { return JSON.parse(user.accessible_pages); } catch { return null; } })() 
                    : user.accessible_pages)
                ) : null;
                if (allowedPages && Array.isArray(allowedPages)) {
                  if (user?.role !== 'admin' && !allowedPages.includes(item.id)) return false;
                }
                return true;
              }).map((item, idx, filteredArray) => {
                const Icon = MAIN_MENU_ICON_MAP[item.icon]
                return (
"""

if "          <SectionCard\n            icon={<LayoutGrid size={18} aria-hidden=\"true\" />}\n            iconBg=\"bg-violet-100\"\n            iconColor=\"text-violet-600\"\n            iconRing=\"ring-violet-200/60\"\n            title=\"เมนูหลัก\"\n            subtitle=\"เปิด/ปิด และจัดลำดับรายการในแถบเมนูด้านข้าง\"\n            badge={`${mainMenuConfig.filter((i) => i.enabled).length} รายการ`}\n          >\n            <div className=\"space-y-1.5\">\n              {mainMenuConfig.map((item, idx) => {" in content:
    content = content.replace(
        "          <SectionCard\n            icon={<LayoutGrid size={18} aria-hidden=\"true\" />}\n            iconBg=\"bg-violet-100\"\n            iconColor=\"text-violet-600\"\n            iconRing=\"ring-violet-200/60\"\n            title=\"เมนูหลัก\"\n            subtitle=\"เปิด/ปิด และจัดลำดับรายการในแถบเมนูด้านข้าง\"\n            badge={`${mainMenuConfig.filter((i) => i.enabled).length} รายการ`}\n          >\n            <div className=\"space-y-1.5\">\n              {mainMenuConfig.map((item, idx) => {",
        replacement.strip('\n')
    )
    # Also replace `disabled={idx === mainMenuConfig.length - 1}` with `disabled={idx === filteredArray.length - 1}`
    content = content.replace("disabled={idx === mainMenuConfig.length - 1}", "disabled={idx === filteredArray.length - 1}")
    with open('frontend/src/app/(main)/profile/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")
