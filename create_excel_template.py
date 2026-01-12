#!/usr/bin/env python3
"""
Erstellt ein Excel-Muster für die Konsolidierung nach HGB
"""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

# Erstelle Workbook
wb = Workbook()

# Entferne Standard-Sheet
if 'Sheet' in wb.sheetnames:
    wb.remove(wb['Sheet'])

# Stile definieren
header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
header_font = Font(bold=True, color="FFFFFF", size=11)
subheader_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
subheader_font = Font(bold=True, size=10)
border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)

# ===== BLATT 1: Bilanzdaten =====
ws_bilanz = wb.create_sheet("Bilanzdaten", 0)

# Header
headers_bilanz = ["Unternehmen", "Kontonummer", "Kontoname", "Soll", "Haben", "Saldo", "Bemerkung"]
ws_bilanz.append(headers_bilanz)

# Formatierung Header
for col in range(1, len(headers_bilanz) + 1):
    cell = ws_bilanz.cell(row=1, column=col)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border

# Beispiel-Daten
example_data = [
    ["Mutterunternehmen H", "1000", "Kasse", "5000.00", "0.00", "5000.00", ""],
    ["Mutterunternehmen H", "1200", "Forderungen a. LL", "100000.00", "0.00", "100000.00", ""],
    ["Mutterunternehmen H", "1400", "Beteiligung TU1", "500000.00", "0.00", "500000.00", "Beteiligung an Tochterunternehmen"],
    ["Tochterunternehmen TU1", "1000", "Kasse", "2000.00", "0.00", "2000.00", ""],
    ["Tochterunternehmen TU1", "1600", "Verbindlichkeiten a. LL", "0.00", "50000.00", "-50000.00", "Gegenpartei: Mutterunternehmen H"],
]

for row_data in example_data:
    ws_bilanz.append(row_data)
    for col in range(1, len(row_data) + 1):
        cell = ws_bilanz.cell(row=ws_bilanz.max_row, column=col)
        cell.border = border
        if col in [4, 5, 6]:  # Soll, Haben, Saldo
            cell.number_format = '#,##0.00'
            cell.alignment = Alignment(horizontal="right", vertical="center")

# Spaltenbreiten anpassen
ws_bilanz.column_dimensions['A'].width = 25
ws_bilanz.column_dimensions['B'].width = 15
ws_bilanz.column_dimensions['C'].width = 30
ws_bilanz.column_dimensions['D'].width = 15
ws_bilanz.column_dimensions['E'].width = 15
ws_bilanz.column_dimensions['F'].width = 15
ws_bilanz.column_dimensions['G'].width = 40

# Hinweis-Zeile
ws_bilanz.append([])
ws_bilanz.append(["HINWEIS:", "Bitte füllen Sie alle Bilanzpositionen für jedes Unternehmen aus.", "", "", "", "", ""])
ws_bilanz.merge_cells(f'A{ws_bilanz.max_row}:G{ws_bilanz.max_row}')
cell = ws_bilanz.cell(row=ws_bilanz.max_row, column=1)
cell.font = Font(italic=True, color="FF0000")

# ===== BLATT 2: Unternehmensinformationen =====
ws_unternehmen = wb.create_sheet("Unternehmensinformationen", 1)

headers_unternehmen = ["Unternehmensname", "Typ", "Beteiligungs-%", "Erwerbsdatum", "Anschaffungskosten", "Bemerkung"]
ws_unternehmen.append(headers_unternehmen)

for col in range(1, len(headers_unternehmen) + 1):
    cell = ws_unternehmen.cell(row=1, column=col)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border

example_unternehmen = [
    ["Mutterunternehmen H", "Mutterunternehmen (H)", "100.00", "", "", "Hauptunternehmen"],
    ["Tochterunternehmen TU1", "Tochterunternehmen (TU)", "80.00", "2020-01-15", "500000.00", "80% Beteiligung"],
    ["Tochterunternehmen TU2", "Tochterunternehmen (TU)", "60.00", "2021-06-01", "300000.00", "60% Beteiligung"],
]

for row_data in example_unternehmen:
    ws_unternehmen.append(row_data)
    for col in range(1, len(row_data) + 1):
        cell = ws_unternehmen.cell(row=ws_unternehmen.max_row, column=col)
        cell.border = border
        if col == 3:  # Beteiligungs-%
            cell.number_format = '0.00"%"'
        if col == 5:  # Anschaffungskosten
            cell.number_format = '#,##0.00'

ws_unternehmen.column_dimensions['A'].width = 25
ws_unternehmen.column_dimensions['B'].width = 25
ws_unternehmen.column_dimensions['C'].width = 15
ws_unternehmen.column_dimensions['D'].width = 15
ws_unternehmen.column_dimensions['E'].width = 18
ws_unternehmen.column_dimensions['F'].width = 40

# ===== BLATT 3: Beteiligungsverhältnisse =====
ws_beteiligung = wb.create_sheet("Beteiligungsverhältnisse", 2)

headers_beteiligung = ["Mutterunternehmen", "Tochterunternehmen", "Beteiligungs-%", "Anschaffungskosten", "Erwerbsdatum", "Beteiligungsbuchwert", "Bemerkung"]
ws_beteiligung.append(headers_beteiligung)

for col in range(1, len(headers_beteiligung) + 1):
    cell = ws_beteiligung.cell(row=1, column=col)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border

example_beteiligung = [
    ["Mutterunternehmen H", "Tochterunternehmen TU1", "80.00", "500000.00", "2020-01-15", "500000.00", "Nach HGB § 301"],
    ["Mutterunternehmen H", "Tochterunternehmen TU2", "60.00", "300000.00", "2021-06-01", "300000.00", "Nach HGB § 301"],
]

for row_data in example_beteiligung:
    ws_beteiligung.append(row_data)
    for col in range(1, len(row_data) + 1):
        cell = ws_beteiligung.cell(row=ws_beteiligung.max_row, column=col)
        cell.border = border
        if col == 3:  # Beteiligungs-%
            cell.number_format = '0.00"%"'
        if col in [4, 6]:  # Anschaffungskosten, Beteiligungsbuchwert
            cell.number_format = '#,##0.00'

ws_beteiligung.column_dimensions['A'].width = 25
ws_beteiligung.column_dimensions['B'].width = 25
ws_beteiligung.column_dimensions['C'].width = 15
ws_beteiligung.column_dimensions['D'].width = 18
ws_beteiligung.column_dimensions['E'].width = 15
ws_beteiligung.column_dimensions['F'].width = 18
ws_beteiligung.column_dimensions['G'].width = 30

# ===== BLATT 4: Zwischengesellschaftsgeschäfte =====
ws_intercompany = wb.create_sheet("Zwischengesellschaftsgeschäfte", 3)

headers_intercompany = ["Von Unternehmen", "An Unternehmen", "Transaktionstyp", "Betrag", "Kontonummer", "Kontoname", "Gewinnmarge", "Bemerkung"]
ws_intercompany.append(headers_intercompany)

for col in range(1, len(headers_intercompany) + 1):
    cell = ws_intercompany.cell(row=1, column=col)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border

example_intercompany = [
    ["Mutterunternehmen H", "Tochterunternehmen TU1", "Forderung", "50000.00", "1200", "Forderungen a. LL", "", "Zu eliminieren"],
    ["Tochterunternehmen TU1", "Mutterunternehmen H", "Verbindlichkeit", "50000.00", "1600", "Verbindlichkeiten a. LL", "", "Zu eliminieren"],
    ["Mutterunternehmen H", "Tochterunternehmen TU1", "Lieferung", "100000.00", "8000", "Umsatzerlöse", "20.00", "Zwischengewinn zu eliminieren"],
]

for row_data in example_intercompany:
    ws_intercompany.append(row_data)
    for col in range(1, len(row_data) + 1):
        cell = ws_intercompany.cell(row=ws_intercompany.max_row, column=col)
        cell.border = border
        if col in [4, 7]:  # Betrag, Gewinnmarge
            cell.number_format = '#,##0.00'

ws_intercompany.column_dimensions['A'].width = 25
ws_intercompany.column_dimensions['B'].width = 25
ws_intercompany.column_dimensions['C'].width = 20
ws_intercompany.column_dimensions['D'].width = 15
ws_intercompany.column_dimensions['E'].width = 15
ws_intercompany.column_dimensions['F'].width = 30
ws_intercompany.column_dimensions['G'].width = 15
ws_intercompany.column_dimensions['H'].width = 30

# ===== BLATT 5: Eigenkapital-Aufteilung =====
ws_eigenkapital = wb.create_sheet("Eigenkapital-Aufteilung", 4)

headers_eigenkapital = ["Unternehmen", "Gezeichnetes Kapital", "Kapitalrücklagen", "Gewinnrücklagen", "Jahresüberschuss", "Gesamt Eigenkapital", "Anteil Mutter", "Anteil Minderheit"]
ws_eigenkapital.append(headers_eigenkapital)

for col in range(1, len(headers_eigenkapital) + 1):
    cell = ws_eigenkapital.cell(row=1, column=col)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = border

example_eigenkapital = [
    ["Mutterunternehmen H", "1000000.00", "200000.00", "300000.00", "150000.00", "1650000.00", "100.00", "0.00"],
    ["Tochterunternehmen TU1", "500000.00", "100000.00", "80000.00", "50000.00", "730000.00", "80.00", "20.00"],
]

for row_data in example_eigenkapital:
    ws_eigenkapital.append(row_data)
    for col in range(1, len(row_data) + 1):
        cell = ws_eigenkapital.cell(row=ws_eigenkapital.max_row, column=col)
        cell.border = border
        if col in [2, 3, 4, 5, 6]:  # Beträge
            cell.number_format = '#,##0.00'
        if col in [7, 8]:  # Anteile
            cell.number_format = '0.00"%"'

ws_eigenkapital.column_dimensions['A'].width = 25
for col in range(2, 9):
    ws_eigenkapital.column_dimensions[get_column_letter(col)].width = 18

# ===== BLATT 6: Konsolidierungsübersicht =====
ws_konsolidierung = wb.create_sheet("Konsolidierungsübersicht", 5)

# Titel
ws_konsolidierung.merge_cells('A1:D1')
title_cell = ws_konsolidierung.cell(row=1, column=1)
title_cell.value = "Konsolidierungsübersicht nach HGB"
title_cell.font = Font(bold=True, size=14)
title_cell.alignment = Alignment(horizontal="center", vertical="center")
title_cell.fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
title_cell.font = Font(bold=True, color="FFFFFF", size=14)

# Unterabschnitte
sections = [
    ("Zwischenergebniseliminierung", ["Transaktion", "Betrag", "Eliminierter Gewinn", "Bemerkung"]),
    ("Schuldenkonsolidierung", ["Forderung von", "Forderung an", "Betrag", "Status"]),
    ("Kapitalkonsolidierung", ["Tochterunternehmen", "Beteiligungsbuchwert", "Anteiliges EK", "Goodwill/Differenz"]),
    ("Minderheitsanteile", ["Tochterunternehmen", "Minderheitsanteil %", "Minderheitsanteil Betrag", "Bemerkung"]),
]

row = 3
for section_name, headers in sections:
    # Section Header
    ws_konsolidierung.merge_cells(f'A{row}:D{row}')
    section_cell = ws_konsolidierung.cell(row=row, column=1)
    section_cell.value = section_name
    section_cell.font = subheader_font
    section_cell.fill = subheader_fill
    section_cell.alignment = Alignment(horizontal="left", vertical="center")
    section_cell.border = border
    row += 1
    
    # Headers
    for col, header in enumerate(headers, 1):
        cell = ws_konsolidierung.cell(row=row, column=col)
        cell.value = header
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border
    row += 1
    
    # Beispiel-Zeile
    example_row = ["Beispiel", "0.00", "0.00", "Bitte ausfüllen"]
    for col, value in enumerate(example_row, 1):
        cell = ws_konsolidierung.cell(row=row, column=col)
        cell.value = value
        cell.border = border
        if col in [2, 3]:
            cell.number_format = '#,##0.00'
    row += 2

# Spaltenbreiten
for col in range(1, 5):
    ws_konsolidierung.column_dimensions[get_column_letter(col)].width = 25

# Hinweis
ws_konsolidierung.append([])
ws_konsolidierung.append(["HINWEIS:", "Dieses Blatt dient zur Übersicht über alle Konsolidierungsschritte.", "", ""])
ws_konsolidierung.merge_cells(f'A{row}:D{row}')
cell = ws_konsolidierung.cell(row=row, column=1)
cell.font = Font(italic=True, color="FF0000")

# Speichere Datei
filename = "templates/Konsolidierung_Muster.xlsx"
import os
os.makedirs("templates", exist_ok=True)
wb.save(filename)
print(f"Excel-Template erfolgreich erstellt: {filename}")
