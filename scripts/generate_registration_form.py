import os
import subprocess
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

output_dir = r"D:\Program\Project\PROJECT_ART"

# ==========================================================
# 1. EXCEL (.XLSX) GENERATION WITH A4 LANDSCAPE PRINT SETUP
# ==========================================================
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "แบบลงทะเบียนเข้าปฏิบัติงาน"

# Page Setup: A4 Landscape, 1 page wide x 1 page tall
ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
ws.page_setup.paperSize = ws.PAPERSIZE_A4
ws.page_setup.fitToPage = True
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 1
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.print_options.horizontalCentered = True
ws.print_options.verticalCentered = False
ws.page_margins.left = 0.35
ws.page_margins.right = 0.35
ws.page_margins.top = 0.4
ws.page_margins.bottom = 0.4

font_title = Font(name="Sarabun", size=15, bold=True, color="111827")
font_meta = Font(name="Sarabun", size=10, bold=False, color="1F2937")
font_header = Font(name="Sarabun", size=10, bold=True, color="111827")
font_data = Font(name="Sarabun", size=9.5, bold=False, color="111827")
font_sign = Font(name="Sarabun", size=10, bold=False, color="111827")

fill_header = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
border_thin = Side(border_style="thin", color="374151")
cell_box = Border(left=border_thin, right=border_thin, top=border_thin, bottom=border_thin)

# Title
ws.merge_cells("A1:J1")
ws["A1"] = "แบบลงทะเบียนเข้าปฏิบัติงาน - โครงการติดตั้ง ESL Lotus เชียงใหม่"
ws["A1"].font = font_title
ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 30

# Spacer
ws.row_dimensions[2].height = 6

# Header metadata
ws.row_dimensions[3].height = 22
ws.merge_cells("A3:D3")
ws["A3"] = "สถานที่ (Location): .........................................................................."
ws["A3"].font = font_meta
ws["A3"].alignment = Alignment(horizontal="left", vertical="center")

ws.merge_cells("E3:G3")
ws["E3"] = "วันที่ (Date/Period): ......................................................."
ws["E3"].font = font_meta
ws["E3"].alignment = Alignment(horizontal="left", vertical="center")

ws.merge_cells("H3:J3")
ws["H3"] = "ผู้ควบคุมงาน (Supervisor): ......................................................."
ws["H3"].font = font_meta
ws["H3"].alignment = Alignment(horizontal="left", vertical="center")

ws.row_dimensions[4].height = 6

# Table column definitions (Name, Width)
columns_def = [
    ("ลำดับ\n(No.)", 6),
    ("วันที่\n(Date)", 12),
    ("ชื่อ-นามสกุล\n(Full Name)", 26),
    ("ตำแหน่ง / สังกัด\n(Position / Company)", 24),
    ("เวลาเข้า\n(Time In)", 10),
    ("ลายเซ็นเข้า\n(Sign In)", 16),
    ("เวลาออก\n(Time Out)", 10),
    ("ลายเซ็นออก\n(Sign Out)", 16),
    ("ลายเซ็นผู้ควบคุมงาน\n(Supervisor Sign)", 20),
    ("หมายเหตุ\n(Remarks)", 15),
]

ws.row_dimensions[5].height = 28
for idx, (head_text, width) in enumerate(columns_def, start=1):
    c = ws.cell(row=5, column=idx, value=head_text)
    c.font = font_header
    c.fill = fill_header
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = cell_box
    col_ltr = get_column_letter(idx)
    ws.column_dimensions[col_ltr].width = width

# 20 Data Rows
for r in range(1, 21):
    row_idx = 5 + r
    ws.row_dimensions[row_idx].height = 21
    for c_idx in range(1, 11):
        c = ws.cell(row=row_idx, column=c_idx)
        c.font = font_data
        c.border = cell_box
        if c_idx == 1:
            c.value = r
            c.alignment = Alignment(horizontal="center", vertical="center")
        elif c_idx in [2, 5, 6, 7, 8, 9]:
            c.alignment = Alignment(horizontal="center", vertical="center")
        else:
            c.alignment = Alignment(horizontal="left", vertical="center")

# Spacer
ws.row_dimensions[26].height = 10

# Signature block
ws.row_dimensions[27].height = 22
ws.merge_cells("F27:J27")
ws["F27"] = "ลงชื่อ........................................................................... ผู้ควบคุมงาน"
ws["F27"].font = font_sign
ws["F27"].alignment = Alignment(horizontal="center", vertical="center")

ws.row_dimensions[28].height = 20
ws.merge_cells("F28:J28")
ws["F28"] = "( ............................................................................ )"
ws["F28"].font = font_sign
ws["F28"].alignment = Alignment(horizontal="center", vertical="center")

ws.row_dimensions[29].height = 20
ws.merge_cells("F29:J29")
ws["F29"] = "วันที่ ......... / ......... / ............."
ws["F29"].font = font_sign
ws["F29"].alignment = Alignment(horizontal="center", vertical="center")

xlsx_path = os.path.join(output_dir, "แบบลงทะเบียนเข้าปฏิบัติงาน_ESL_Lotus_เชียงใหม่.xlsx")
wb.save(xlsx_path)
print(f"XLSX saved: {xlsx_path}")

# ==========================================================
# 2. HTML GENERATION (A4 LANDSCAPE PRINT READY)
# ==========================================================
rows_html = ""
for i in range(1, 21):
    rows_html += f"""
        <tr>
          <td class="text-center">{i}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>"""

html_content = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>แบบลงทะเบียนเข้าปฏิบัติงาน - โครงการติดตั้ง ESL Lotus เชียงใหม่</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page {{
    size: A4 landscape;
    margin: 8mm 8mm 6mm 8mm;
  }}
  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}
  body {{
    font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
    color: #111827;
    background-color: #f1f5f9;
    margin: 0;
    padding: 24px 0;
  }}
  .no-print-bar {{
    width: 281mm;
    margin: 0 auto 16px auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 10px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
  }}
  .btn-print {{
    background: #2563eb;
    color: white;
    border: none;
    padding: 9px 22px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s ease, transform 0.1s ease;
  }}
  .btn-print:hover {{
    background: #1d4ed8;
  }}
  .btn-print:active {{
    transform: scale(0.97);
  }}
  .sheet {{
    width: 281mm;
    min-height: 196mm;
    margin: 0 auto;
    background: #ffffff;
    padding: 7mm 8mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}
  .doc-title {{
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 10px 0;
    color: #0f172a;
  }}
  .doc-meta {{
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    margin-bottom: 9px;
    color: #334155;
  }}
  .meta-item {{
    white-space: nowrap;
  }}
  .dotted {{
    border-bottom: 1px dotted #64748b;
    display: inline-block;
    height: 14px;
    vertical-align: bottom;
  }}
  table.reg-table {{
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 8px;
  }}
  table.reg-table th, table.reg-table td {{
    border: 1px solid #334155;
    padding: 2px 4px;
    font-size: 11px;
    line-height: 1.25;
  }}
  table.reg-table th {{
    background-color: #f1f5f9;
    font-weight: 600;
    text-align: center;
    vertical-align: middle;
    height: 30px;
    color: #0f172a;
  }}
  table.reg-table td {{
    height: 6.2mm;
    vertical-align: middle;
  }}
  .text-center {{ text-align: center; }}
  .text-left {{ text-align: left; }}
  .text-right {{ text-align: right; }}

  .footer-sign-wrap {{
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
    padding-right: 25px;
  }}
  .sign-box {{
    text-align: center;
    font-size: 12.5px;
    line-height: 1.65;
    color: #1e293b;
  }}
  .sign-line {{
    border-bottom: 1px dotted #475569;
    display: inline-block;
    width: 180px;
    height: 14px;
    vertical-align: bottom;
    margin: 0 4px;
  }}

  @media print {{
    body {{
      background: none;
      padding: 0;
      margin: 0;
    }}
    .no-print {{
      display: none !important;
    }}
    .sheet {{
      width: 100%;
      min-height: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }}
    table.reg-table td {{
      height: 6.2mm;
    }}
  }}
</style>
</head>
<body>

<div class="no-print-bar no-print">
  <div>
    <div style="font-size: 16px; font-weight: 600;">แบบลงทะเบียนเข้าปฏิบัติงาน (A4 แนวนอน - สั่งพิมพ์ได้ทันที พอดี 1 หน้า)</div>
    <div style="font-size: 13px; color: #94a3b8; margin-top: 2px;">จัดวางกึ่งกลางหน้ากระดาษ ครบทั้ง 10 คอลัมน์ และ 20 ลำดับ ไม่ล้นหน้า</div>
  </div>
  <button class="btn-print" onclick="window.print()">
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
    กดพิมพ์เอกสาร (Print / PDF)
  </button>
</div>

<div class="sheet">
  <div>
    <h1 class="doc-title">แบบลงทะเบียนเข้าปฏิบัติงาน - โครงการติดตั้ง ESL Lotus เชียงใหม่</h1>
    
    <div class="doc-meta">
      <div class="meta-item"><strong>สถานที่ (Location):</strong> <span class="dotted" style="width: 250px;"></span></div>
      <div class="meta-item"><strong>วันที่ (Date/Period):</strong> <span class="dotted" style="width: 200px;"></span></div>
      <div class="meta-item"><strong>ผู้ควบคุมงาน (Supervisor Name):</strong> <span class="dotted" style="width: 200px;"></span></div>
    </div>

    <table class="reg-table">
      <thead>
        <tr>
          <th style="width: 4.5%;">ลำดับ<br>(No.)</th>
          <th style="width: 8.5%;">วันที่<br>(Date)</th>
          <th style="width: 17.5%;">ชื่อ-นามสกุล<br>(Full Name)</th>
          <th style="width: 16.5%;">ตำแหน่ง / สังกัด<br>(Position / Company)</th>
          <th style="width: 7%;">เวลาเข้า<br>(Time In)</th>
          <th style="width: 11%;">ลายเซ็นเข้า<br>(Sign In)</th>
          <th style="width: 7%;">เวลาออก<br>(Time Out)</th>
          <th style="width: 11%;">ลายเซ็นออก<br>(Sign Out)</th>
          <th style="width: 11.5%;">ลายเซ็นผู้ควบคุมงาน<br>(Supervisor Sign)</th>
          <th style="width: 6.5%;">หมายเหตุ<br>(Remarks)</th>
        </tr>
      </thead>
      <tbody>{rows_html}
      </tbody>
    </table>
  </div>

  <div class="footer-sign-wrap">
    <div class="sign-box">
      <div>ลงชื่อ <span class="sign-line"></span> ผู้ควบคุมงาน</div>
      <div style="margin-top: 3px;">( ............................................................................ )</div>
      <div style="margin-top: 3px;">วันที่ ......... / ......... / .............</div>
    </div>
  </div>
</div>

</body>
</html>
"""

html_path = os.path.join(output_dir, "แบบลงทะเบียนเข้าปฏิบัติงาน_ESL_Lotus_เชียงใหม่.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)
print(f"HTML saved: {html_path}")

# ==========================================================
# 3. PDF EXPORT VIA CHROME HEADLESS
# ==========================================================
chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
pdf_path = os.path.join(output_dir, "แบบลงทะเบียนเข้าปฏิบัติงาน_ESL_Lotus_เชียงใหม่.pdf")
if os.path.exists(chrome_exe):
    cmd = [
        chrome_exe,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={pdf_path}",
        "--no-pdf-header-footer",
        f"file:///{os.path.abspath(html_path)}"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
        print(f"PDF successfully created: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")
    else:
        print(f"PDF creation failed: {res.stderr}")
else:
    print("Chrome not found for PDF export")

# ==========================================================
# 4. CSV WITH UTF-8 BOM
# ==========================================================
csv_lines = [
    ",,,,,,,,,",
    "แบบลงทะเบียนเข้าปฏิบัติงาน - โครงการติดตั้ง ESL Lotus เชียงใหม่,,,,,,,,,",
    "สถานที่ (Location): .......................................................,,,วันที่ (Date/Period): .......................................................,,,ผู้ควบคุมงาน (Supervisor Name): .......................................................,,,",
    "ลำดับ (No.),วันที่ (Date),ชื่อ-นามสกุล (Full Name),ตำแหน่ง / สังกัด (Position / Company),เวลาเข้า (Time In),ลายเซ็นเข้า (Check-in Signature),เวลาออก (Time Out),ลายเซ็นออก (Check-out Signature),ลายเซ็นผู้ควบคุมงาน / Supervisor Signature,หมายเหตุ (Remarks)"
]
for i in range(1, 21):
    csv_lines.append(f"{i},,,,,,,,,")
csv_lines.extend([
    ",,,,,,,,,",
    ",,,,,ลงชื่อ.......................................................... ผู้ควบคุมงาน,,,,",
    ",,,,,(                                                            ),,,,",
    ",,,,,วันที่ ......... / ......... / .............,,,,"
])

csv_path = os.path.join(output_dir, "แบบลงทะเบียนเข้าปฏิบัติงาน_ESL_Lotus_เชียงใหม่.csv")
with open(csv_path, "w", encoding="utf-8-sig") as f:
    f.write("\n".join(csv_lines))
print(f"CSV saved: {csv_path}")
