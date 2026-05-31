import type jsPDF from "jspdf"

const FONT_FAMILY = "Roboto"
const REGULAR_VFS = "Roboto-Regular.ttf"
const BOLD_VFS = "Roboto-Bold.ttf"

let cachedRegularBase64: string | null = null
let cachedBoldBase64: string | null = null

async function fetchTtfAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load PDF font ${url}: ${response.status}`)
  }
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    )
  }
  return btoa(binary)
}

/**
 * Loads a Unicode-capable font (Roboto) into the given jsPDF document so that
 * Serbian Latin diacritics (č, ć, š, ž, đ) render correctly. Font bytes are
 * cached after the first call so subsequent exports are instant.
 */
export async function registerPdfUnicodeFont(doc: jsPDF): Promise<void> {
  if (!cachedRegularBase64) {
    cachedRegularBase64 = await fetchTtfAsBase64("/fonts/Roboto-Regular.ttf")
  }
  if (!cachedBoldBase64) {
    cachedBoldBase64 = await fetchTtfAsBase64("/fonts/Roboto-Bold.ttf")
  }

  doc.addFileToVFS(REGULAR_VFS, cachedRegularBase64)
  doc.addFont(REGULAR_VFS, FONT_FAMILY, "normal")
  doc.addFileToVFS(BOLD_VFS, cachedBoldBase64)
  doc.addFont(BOLD_VFS, FONT_FAMILY, "bold")
  doc.setFont(FONT_FAMILY, "normal")
}
