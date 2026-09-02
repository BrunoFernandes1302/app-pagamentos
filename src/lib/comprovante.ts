export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_PDF_LABEL = '20 MB'

export function validarPdf(file: File): string | null {
  if (file.type !== 'application/pdf') return 'Apenas arquivos PDF são aceitos.'
  if (file.size > MAX_PDF_BYTES) return `O PDF deve ter no máximo ${MAX_PDF_LABEL}.`
  return null
}
