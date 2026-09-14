import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { registerPdfUnicodeFont } from "@/utils/pdfFonts"

interface PassengerListPdfOptions {
  heading: string
  headers: string[]
  rows: string[][]
}

/** Builds the printable passenger list used by both exports and the driver link. */
export async function createPassengerListPdf({
  heading,
  headers,
  rows,
}: PassengerListPdfOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  await registerPdfUnicodeFont(doc)

  const margin = 8
  const headerFill: [number, number, number] = [26, 32, 51]
  const groupTextColor: [number, number, number] = [192, 0, 0]

  autoTable(doc, {
    startY: margin,
    margin: { left: margin, right: margin },
    head: [[{ content: heading, colSpan: headers.length }], headers],
    body: rows,
    theme: "grid",
    styles: {
      font: "Roboto",
      fontStyle: "normal",
      fontSize: 8,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: "center",
      valign: "middle",
      overflow: "ellipsize",
    },
    headStyles: {
      font: "Roboto",
      fontStyle: "bold",
      fillColor: headerFill,
      textColor: [255, 255, 255],
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 10, fontStyle: "bold" },
      1: { cellWidth: 10, fontStyle: "bold", textColor: groupTextColor },
      2: { cellWidth: 40 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 28 },
      6: { cellWidth: 30 },
      7: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.row.index === 0) {
        data.cell.styles.fontSize = 11
      }
    },
  })

  return doc
}
