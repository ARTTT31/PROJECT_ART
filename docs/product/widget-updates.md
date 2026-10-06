# Widget Updates Summary

> [!NOTE]
> **Current Dashboard Active Widgets:**
> - 🌤️ `WeatherWidget` - Real-time weather, forecast & GPS
> - 🇹🇭 `HolidayWidget` - Thai official holidays for the current year
> - ⛽ `OilPriceWidget` - Fuel prices from Bangchak with cached fallback
> - 📱 `QRCodeWidget` - Dynamic QR code & barcode generator
> 
> *Note: Legacy Calendar and SharePoint-based TaskList widgets have been removed.*

## 🌤️ Weather Widget  
### Changes:
- ✅ **Reduced M/L buttons size** - From `w-7 h-7` to `w-6 h-6`
- ✅ **Reduced font size** - From `text-[10px]` to `text-[9px]`
- ✅ **Disabled Hover Color Effect** - Removed `hover:text-white hover:bg-white/10`
- ✅ **Added CSS Override** - Force button not to change color on hover

### Button States:
- **Active (selected)**: `bg-white text-sky-600 shadow-sm`
- **Inactive**: `text-white/80` (Doesn't change on hover)
- **Hover**: No color change

### Features Retained:
- ✅ Location selector
- ✅ GPS button
- ✅ Refresh button (Has hover effect)
- ✅ Drag handle
- ✅ M/L buttons for resizing (does not change color on hover)
- ✅ Weather animations
- ✅ Forecast display

---

## 📋 TaskList Widget — REMOVED

> ❌ **This widget no longer exists.** Personal tasks were dropped (Alembic
> `20260921_2300_remove_personal_tasks`), the component is gone from
> `frontend/src/components/Widgets/`, and `useDashboardLayout` filters the retired
> `tasks` id out of any saved layout. Everything below is kept as history.

### Changes:
- ✅ **Kept Refresh button**
- ✅ **Kept Filter badges**
- ⚠️ **No S/M/L buttons** - Removed in a previous update

### Features (as they were before removal):
- ✅ Refresh button
- ✅ Filter (All, IMACD, Thanyapong)
- ✅ Search functionality
- ✅ Calendar events display

---

## 🎨 CSS Updates

### Added to globals.css:
```css
/* Weather Widget - Disable hover color change on resize buttons */
.weather-card button[aria-label*="Resize"]:not(:disabled) {
  background-color: transparent !important;
}

.weather-card button[aria-label*="Resize"]:not(:disabled):hover {
  background-color: transparent !important;
  transform: none !important;
}

.weather-card button[aria-label*="Resize"].bg-white:not(:disabled) {
  background-color: white !important;
}

.weather-card button[aria-label*="Resize"].bg-white:not(:disabled):hover {
  background-color: white !important;
}
```

---

## 🎯 Summary

| Widget | Fullscreen Button | Resize Buttons (M/L) | Hover Effect on Resize |
|--------|-------------------|----------------------|------------------------|
| Calendar | ❌ Removed | ✅ Kept | ✅ Has hover |
| Weather | N/A | ✅ Kept (smaller) | ❌ No hover |
| ~~TaskList~~ | N/A | ❌ Widget removed from the app | N/A |

---

## ✅ Testing Checklist

- [ ] Calendar widget: Fullscreen button is gone
- [ ] Calendar widget: M/L buttons are still usable
- [ ] Weather widget: M/L buttons are smaller
- [ ] Weather widget: Hovering on M/L buttons does not change color
- [ ] Weather widget: Selected button displays normally in white
- [ ] All widgets display correctly on desktop and mobile

---

**Last Updated**: October 6, 2026 (TaskList marked as removed)  
**Version**: 2.1
