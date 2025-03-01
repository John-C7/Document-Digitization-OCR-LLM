"""
pdf_generator.py
Generates downloadable, beautifully styled multi-page PDF documents
for digitized handwritten text outputs using ReportLab.
"""

import os
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors


def generate_digitized_pdf(
    text: str,
    output_path: str,
    doc_title: str = "Digitized Handwritten Document",
    confidence_score: float = None,
    model_info: str = "Ensemble OCR + LLM Enhancement"
) -> str:
    """
    Creates a styled multi-page PDF report with headers, metadata, and recognized text.
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 54
    printable_width = width - 2 * margin

    # Header styling
    c.setFillColor(colors.HexColor("#1A202C"))
    c.rect(0, height - 70, width, 70, fill=True, stroke=False)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, height - 36, "DOCUMENT DIGITIZATION SYSTEM")

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#CBD5E0"))
    c.drawString(margin, height - 52, f"Architecture: {model_info} | Date: {datetime.date.today().strftime('%B %d, %Y')}")

    # Metadata bar
    c.setFillColor(colors.HexColor("#EDF2F7"))
    c.roundRect(margin, height - 110, printable_width, 28, 4, fill=True, stroke=False)
    c.setFillColor(colors.HexColor("#2D3748"))
    c.setFont("Helvetica-Bold", 10)
    score_str = f"Consensus Confidence: {confidence_score:.1f}%" if confidence_score else "Processing: Verified"
    c.drawString(margin + 12, height - 97, f"Title: {doc_title}")
    c.drawRightString(width - margin - 12, height - 97, score_str)

    # Document body
    start_y = height - 135
    line_height = 16
    max_lines_first_page = int((start_y - margin) / line_height)
    max_lines_subsequent = int((height - 2 * margin) / line_height)

    lines = text.split('\n')
    current_line = 0
    page_num = 1

    # First page text
    c.setFillColor(colors.HexColor("#1A202C"))
    c.setFont("Times-Roman", 11)
    textobject = c.beginText(margin, start_y)
    textobject.setFont("Times-Roman", 11)
    textobject.setLeading(line_height)

    for _ in range(max_lines_first_page):
        if current_line >= len(lines):
            break
        textobject.textLine(lines[current_line])
        current_line += 1

    c.drawText(textobject)

    # Page number
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#718096"))
    c.drawRightString(width - margin, 25, f"Page {page_num}")
    c.showPage()

    # Subsequent pages
    while current_line < len(lines):
        page_num += 1
        textobject = c.beginText(margin, height - margin)
        textobject.setFont("Times-Roman", 11)
        textobject.setLeading(line_height)

        for _ in range(max_lines_subsequent):
            if current_line >= len(lines):
                break
            textobject.textLine(lines[current_line])
            current_line += 1

        c.drawText(textobject)
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#718096"))
        c.drawRightString(width - margin, 25, f"Page {page_num}")
        c.showPage()

    c.save()
    return output_path
