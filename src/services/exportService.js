export async function exportElementAsJpeg(element, filename, { pixelRatio = 2 } = {}) {
  const { toJpeg } = await import('html-to-image');
  const dataUrl = await toJpeg(element, {
    quality: 0.96,
    pixelRatio,
    backgroundColor: '#ffffff',
    cacheBust: true,
  });
  download(dataUrl, `${filename}.jpg`);
}

export async function exportElementAsPdf(element, filename, { landscape = false } = {}) {
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);
  const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
  const width = landscape ? 297 : 210;
  const height = landscape ? 210 : 297;
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const ratio = Math.min((width - 16) / image.width, (height - 16) / image.height);
  pdf.addImage(dataUrl, 'PNG', 8, 8, image.width * ratio, image.height * ratio, undefined, 'FAST');
  pdf.save(`${filename}.pdf`);
}

function download(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}
