import sys

with open('frontend/src/app/(main)/profile/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """        <SectionCard
          icon={<LayoutGrid size={20} aria-hidden="true" />}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          iconRing="ring-violet-200/60"
          title="เมนูหลัก"
          subtitle="เปิด/ปิด และจัดลำดับรายการในแถบเมนูด้านข้าง"
          badge={`${mainMenuConfig.filter((i) => i.enabled).length} รายการ`}
        >
          <div className="space-y-1.5">
            {mainMenuConfig.map((item, idx) => {"""

replacement = """        <SectionCard
          icon={<LayoutGrid size={20} aria-hidden="true" />}
          iconBg="bg-violet-50"
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
            }).map((item, idx, filteredArray) => {"""

if target in content:
    content = content.replace(target, replacement)
    content = content.replace("disabled={idx === mainMenuConfig.length - 1}", "disabled={idx === filteredArray.length - 1}")
    with open('frontend/src/app/(main)/profile/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")
