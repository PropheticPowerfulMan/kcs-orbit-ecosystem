import html2pdf from "html2pdf.js";

export const exportElementToPdf = (element: HTMLElement, filename: string) =>
  html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (documentClone: Document) => {
          documentClone.querySelectorAll(".lesson-print-document").forEach((node) => node.classList.add("pdf-export-capture"));
        }
      },
      pagebreak: { mode: ["css", "legacy"], avoid: [".print-header", "tr", ".signature-block"] },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
    })
    .from(element)
    .save();

export const exportElementToDocx = (element: HTMLElement, filename: string) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${filename}</title></head><body>${element.outerHTML}</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
