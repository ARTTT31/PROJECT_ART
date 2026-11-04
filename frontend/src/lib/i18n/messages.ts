/**
 * UI copy for the two interface languages.
 *
 * Keys are grouped by surface so a page can be translated in one block. Both
 * languages must define the same keys — `messages.test.ts` enforces that, so a
 * missing English string fails the build instead of silently falling back to
 * Thai on an English screen.
 */

export type Locale = 'th' | 'en';

const th = {
  'nav.section.main': 'เมนูหลัก',
  'nav.section.quickLinks': 'ควิกลิ้งค์',
  'nav.logout': 'ออกจากระบบ',
  'nav.suggestion': 'คุณเปิด {path} {count} ครั้งแล้ว — เก็บเป็นควิกลิ้งค์?',
  'nav.keep': 'เก็บไว้',
  'nav.dismiss': 'ไม่ต้อง',
  'nav.environment.aria': 'สลับสภาพแวดล้อมของ {name} (ตอนนี้ {label})',
  'nav.environment.title': 'สลับสภาพแวดล้อม',
  'nav.menuToggle.open': 'เปิดแถบเมนูด้านข้าง',
  'nav.menuToggle.close': 'พับแถบเมนูด้านข้าง',
  'nav.search.aria': 'ค้นหาทั่วทั้งระบบ (Ctrl+K)',
  'nav.search.title': 'ค้นหา (Ctrl+K)',
  'nav.search.label': 'ค้นหา',

  'breadcrumb.home': 'หน้าหลัก',

  'page.dashboard': 'หน้าหลัก',
  'page.dashboard.title': 'แดชบอร์ด',
  'page.dashboard.desc': 'ศูนย์รวมแดชบอร์ด วิดเจ็ต และข้อมูลประจำวัน',
  'page.camera': 'กล้องวงจรปิด',
  'page.camera.desc': 'ระบบมอนิเตอร์กล้อง CCTV สดและ Snapshot',
  'page.admin': 'จัดการระบบ',
  'page.admin.desc': 'รวมเครื่องมือจัดการระบบไว้ที่เดียว',
  'page.profile': 'โปรไฟล์',
  'page.profile.desc': 'จัดการข้อมูลส่วนตัว ความปลอดภัย และการตั้งค่า',
  'page.audit': 'บันทึกกิจกรรม',

  'palette.title': 'ค้นหาทั่วทั้งระบบ',
  'palette.placeholder': 'ค้นหาหน้า โน้ต รายการติดตาม เตือนของฉัน หรือผู้ใช้…',
  'palette.close': 'ปิดการค้นหา',
  'palette.empty': 'ไม่พบผลลัพธ์สำหรับ “{query}”',
  'palette.hint': '↑↓ เลือก · Enter เปิด',
  'palette.kind.page': 'หน้า',
  'palette.kind.note': 'โน้ต',
  'palette.kind.watchlist': 'ติดตาม',
  'palette.kind.reminder': 'เตือน',
  'palette.kind.user': 'ผู้ใช้',
  'palette.action.profileSettings': 'ตั้งค่าโปรไฟล์',
  'palette.action.profileSettings.sub': 'ธีม สี ลิงก์ด่วน และเมนูหลัก',
  'palette.result.audit': 'บันทึกกิจกรรม',
  'palette.result.audit.sub': 'ประวัติการใช้งานทั้ง workspace',
  'palette.note.subtitle': 'โน้ตด่วนในแดชบอร์ด',
  'palette.watch.subtitle': 'รายการติดตาม',
  'palette.reminder.subtitle': 'เตือนของฉัน',
  'palette.reminder.subtitle.dated': 'เตือนของฉัน · {date}',
  'palette.user.subtitle': 'ผู้ใช้ในระบบ',
} as const;

const en: Record<keyof typeof th, string> = {
  'nav.section.main': 'Main menu',
  'nav.section.quickLinks': 'Quick links',
  'nav.logout': 'Sign out',
  'nav.suggestion': 'You opened {path} {count} times — save it as a quick link?',
  'nav.keep': 'Save',
  'nav.dismiss': 'Not now',
  'nav.environment.aria': 'Switch environment for {name} (now {label})',
  'nav.environment.title': 'Switch environment',
  'nav.menuToggle.open': 'Open sidebar',
  'nav.menuToggle.close': 'Collapse sidebar',
  'nav.search.aria': 'Search the whole workspace (Ctrl+K)',
  'nav.search.title': 'Search (Ctrl+K)',
  'nav.search.label': 'Search',

  'breadcrumb.home': 'Home',

  'page.dashboard': 'Home',
  'page.dashboard.title': 'Dashboard',
  'page.dashboard.desc': 'Your dashboard, widgets and daily highlights',
  'page.camera': 'CCTV cameras',
  'page.camera.desc': 'Live and snapshot camera monitoring',
  'page.admin': 'Admin console',
  'page.admin.desc': 'All workspace administration in one place',
  'page.profile': 'Profile',
  'page.profile.desc': 'Personal details, security and settings',
  'page.audit': 'Activity log',

  'palette.title': 'Search the whole workspace',
  'palette.placeholder': 'Search pages, notes, watchlist, reminders or people…',
  'palette.close': 'Close search',
  'palette.empty': 'No results for “{query}”',
  'palette.hint': '↑↓ select · Enter open',
  'palette.kind.page': 'Page',
  'palette.kind.note': 'Note',
  'palette.kind.watchlist': 'Watchlist',
  'palette.kind.reminder': 'Reminder',
  'palette.kind.user': 'User',
  'palette.action.profileSettings': 'Profile settings',
  'palette.action.profileSettings.sub': 'Theme, colour, quick links and main menu',
  'palette.result.audit': 'Activity log',
  'palette.result.audit.sub': 'Workspace-wide activity history',
  'palette.note.subtitle': 'Dashboard note',
  'palette.watch.subtitle': 'Watchlist',
  'palette.reminder.subtitle': 'My reminders',
  'palette.reminder.subtitle.dated': 'My reminders · {date}',
  'palette.user.subtitle': 'Workspace member',
};

export const messages = { th, en };

export type MessageKey = keyof typeof th;

/** Sidebar/palette label for each menu page. */
export const MENU_LABEL_KEYS: Record<string, MessageKey> = {
  dashboard: 'page.dashboard',
  camera: 'page.camera',
  admin: 'page.admin',
  profile: 'page.profile',
  audit: 'page.audit',
};
