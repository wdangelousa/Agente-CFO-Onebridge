/**
 * Browser-native PDF export helper.
 *
 * The most reliable PDF output for our print-ready A4 layouts is the browser's
 * own "Save as PDF" via window.print() — it keeps vector text sharp, honours
 * the @media print CSS, and respects page breaks. Rasterizing libraries
 * (html2canvas/jsPDF) would distort the tuned layout, so we deliberately avoid
 * them.
 *
 * Browsers default the suggested PDF filename to document.title. We temporarily
 * swap the title to a clean name (without extension — the browser appends
 * ".pdf"), trigger printing, then restore the original title.
 */

/** Strips characters that are unsafe/awkward in filenames. */
export const sanitizeFileName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();

/**
 * Prints the current document, suggesting `fileBaseName` (no extension) as the
 * saved PDF filename. Restores the previous document.title afterwards.
 */
export const printWithSuggestedFileName = (fileBaseName: string): void => {
  if (typeof window === 'undefined') return;

  const cleanName = sanitizeFileName(fileBaseName);
  const previousTitle = document.title;

  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };

  if (cleanName) {
    document.title = cleanName;
  }

  // Restore once the print dialog closes; also schedule a fallback in case the
  // afterprint event does not fire in some browsers.
  window.addEventListener('afterprint', restore);
  setTimeout(restore, 1500);

  window.print();
};
