import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';
import { formatDateIndo } from './calendarSync';

export interface MonthlyReportPdfOptions {
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  selectedMonthName: string;
  selectedYear: number;
  includePiket: boolean;
  includeJournal: boolean;
  logoDataUrl?: string | null;
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

export function downloadMonthlyReportPdf({
  agendas,
  journals,
  holidayDuties,
  selectedMonthName,
  selectedYear,
  includePiket,
  includeJournal,
  logoDataUrl
}: MonthlyReportPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  }) as JsPdfWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 269mm

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // ==================== OFFICIAL KOP SURAT ====================
  let y = 14;

  // Official institutional emblem on left of Kop Surat
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX + 10, y - 1.5, 16, 16);
    } catch {
      const emblemCenterX = marginX + 18;
      const emblemCenterY = y + 7;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.6);
      doc.circle(emblemCenterX, emblemCenterY, 7, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('TU PIM', emblemCenterX, emblemCenterY - 0.8, { align: 'center' });
      doc.setFontSize(5.5);
      doc.text('DITJENPAS', emblemCenterX, emblemCenterY + 2.8, { align: 'center' });
    }
  } else {
    const emblemCenterX = marginX + 18;
    const emblemCenterY = y + 7;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.circle(emblemCenterX, emblemCenterY, 7, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TU PIM', emblemCenterX, emblemCenterY - 0.8, { align: 'center' });
    doc.setFontSize(5.5);
    doc.text('DITJENPAS', emblemCenterX, emblemCenterY + 2.8, { align: 'center' });
  }

  // Institutional header lines
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('SUBAG TU PIM & PROTOKOL DITJENPAS', pageWidth / 2, y + 2, { align: 'center' });

  doc.setFontSize(13.5);
  doc.text('AGENDA KEGIATAN RESMI PIMPINAN', pageWidth / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'Direktorat Jenderal Pemasyarakatan  •  Subbagian Tata Usaha Pimpinan dan Protokol',
    pageWidth / 2,
    y + 13.2,
    { align: 'center' }
  );

  // Double horizontal rule under Kop Surat
  y += 17;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 1.3, pageWidth - marginX, y + 1.3);

  // ==================== DOCUMENT TITLE & PERIODE ====================
  y += 8;
  const mainHeading = `JADWAL DAN AGENDA KEGIATAN BULAN ${selectedMonthName.toUpperCase()} ${selectedYear}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(mainHeading, pageWidth / 2, y, { align: 'center' });

  const headingWidth = doc.getTextWidth(mainHeading);
  doc.setLineWidth(0.35);
  doc.line(
    pageWidth / 2 - headingWidth / 2,
    y + 1.1,
    pageWidth / 2 + headingWidth / 2,
    y + 1.1
  );

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Status Pemutakhiran: ${todayFormatted}`, pageWidth / 2, y, { align: 'center' });

  y += 5;

  // ==================== MAIN AGENDA TABLE ====================
  const sortedAgendas = [...agendas].sort((a, b) =>
    (a.date + a.startTime).localeCompare(b.date + b.startTime)
  );

  const agendaRows =
    sortedAgendas.length === 0
      ? [
          [
            {
              content: `Belum ada agenda pimpinan yang tercatat untuk bulan ${selectedMonthName} ${selectedYear}.`,
              colSpan: 8,
              styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: [100, 116, 139] as [number, number, number] }
            }
          ]
        ]
      : sortedAgendas.map((item, idx) => {
          const eventLines = [item.title, `Kategori: ${item.category}`];
          if (item.virtualMeetingUrl) {
            eventLines.push(`Virtual: ${item.virtualMeetingUrl}`);
          }

          const leaderLines: string[] = [item.leader, item.leaderName];
          if (item.companions) {
            leaderLines.push(`Pendamping: ${item.companions}`);
          }

          const noteLines: string[] = [item.status];
          if (item.documents && item.documents.length > 0) {
            noteLines.push(`${item.documents.length} dokumen lampiran`);
          }
          if (item.notes) {
            noteLines.push(item.notes);
          }

          return [
            String(idx + 1),
            formatDateIndo(item.date),
            `${item.startTime} - ${item.endTime}\nWIB`,
            eventLines.join('\n'),
            item.location || '-',
            leaderLines.join('\n'),
            item.dressCode || '-',
            noteLines.join('\n')
          ];
        });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, bottom: 18 },
    tableWidth: contentWidth,
    head: [
      [
        'NO',
        'HARI / TANGGAL',
        'WAKTU',
        'NAMA ACARA / KEGIATAN',
        'TEMPAT / LOKASI',
        'PIMPINAN & PENDAMPING',
        'PAKAIAN',
        'KETERANGAN'
      ]
    ],
    body: agendaRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.4,
      textColor: [15, 23, 42],
      lineColor: [148, 163, 184],
      lineWidth: 0.2,
      valign: 'top',
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [100, 116, 139],
      lineWidth: 0.25
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 34, fontStyle: 'bold' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 59 },
      4: { cellWidth: 38 },
      5: { cellWidth: 44 },
      6: { cellWidth: 25, halign: 'center' },
      7: { cellWidth: 34 }
    }
  });

  let currentY = (doc.lastAutoTable?.finalY ?? y) + 8;

  // ==================== LAMPIRAN I: PIKET HARI LIBUR ====================
  if (includePiket) {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `LAMPIRAN I: DAFTAR PETUGAS PROTOKOL PIKET HARI LIBUR — ${selectedMonthName.toUpperCase()} ${selectedYear}`,
      marginX,
      currentY
    );
    currentY += 3;

    const sortedDuties = [...holidayDuties].sort((a, b) => a.date.localeCompare(b.date));
    const dutyRows =
      sortedDuties.length === 0
        ? [
            [
              {
                content: 'Belum ada jadwal petugas protokol piket hari libur pada bulan ini.',
                colSpan: 6,
                styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: [100, 116, 139] as [number, number, number] }
              }
            ]
          ]
        : sortedDuties.map((duty, idx) => {
            const coordLines = [duty.coordinatorName];
            if (duty.coordinatorPhone) coordLines.push(duty.coordinatorPhone);

            const officersText = duty.officers
              .map((off) => `• ${off.name} (${off.role})${off.phone ? ` — ${off.phone}` : ''}`)
              .join('\n');

            return [
              String(idx + 1),
              formatDateIndo(duty.date),
              `${duty.holidayName}\n${duty.dayType}`,
              duty.shift,
              coordLines.join('\n'),
              officersText || '-'
            ];
          });

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX, bottom: 18 },
      tableWidth: contentWidth,
      head: [
        [
          'NO',
          'HARI / TANGGAL',
          'KETERANGAN LIBUR',
          'SHIFT',
          'KOORDINATOR PIKET',
          'NAMA PETUGAS PROTOKOL PIKET'
        ]
      ],
      body: dutyRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: 2.4,
        textColor: [15, 23, 42],
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
        valign: 'top',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineColor: [100, 116, 139],
        lineWidth: 0.25
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 36, fontStyle: 'bold' },
        2: { cellWidth: 42 },
        3: { cellWidth: 34, halign: 'center' },
        4: { cellWidth: 48 },
        5: { cellWidth: 99 }
      }
    });

    currentY = (doc.lastAutoTable?.finalY ?? currentY) + 8;
  }

  // ==================== LAMPIRAN II: JURNAL HARIAN KEGIATAN ====================
  if (includeJournal) {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `LAMPIRAN II: JURNAL HARIAN KEGIATAN PIMPINAN — ${selectedMonthName.toUpperCase()} ${selectedYear}`,
      marginX,
      currentY
    );
    currentY += 3;

    const sortedJournals = [...journals].sort((a, b) =>
      (a.date + a.time).localeCompare(b.date + b.time)
    );
    const journalRows =
      sortedJournals.length === 0
        ? [
            [
              {
                content: 'Belum ada catatan jurnal harian kegiatan pada bulan ini.',
                colSpan: 5,
                styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: [100, 116, 139] as [number, number, number] }
              }
            ]
          ]
        : sortedJournals.map((entry, idx) => {
            const detailLines = [entry.summary];
            if (entry.followUp) {
              detailLines.push(`Tindak Lanjut: ${entry.followUp}`);
            }

            return [
              String(idx + 1),
              `${formatDateIndo(entry.date)}\n${entry.time} WIB`,
              `${entry.title}\nPelapor: ${entry.reporterName} (${entry.reporterRole})`,
              detailLines.join('\n\n'),
              entry.outcome
            ];
          });

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX, bottom: 18 },
      tableWidth: contentWidth,
      head: [
        [
          'NO',
          'TANGGAL & JAM',
          'KEGIATAN & PELAPOR',
          'URAIAN PELAKSANAAN & TINDAK LANJUT',
          'STATUS'
        ]
      ],
      body: journalRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: 2.4,
        textColor: [15, 23, 42],
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
        valign: 'top',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineColor: [100, 116, 139],
        lineWidth: 0.25
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 36 },
        2: { cellWidth: 58 },
        3: { cellWidth: 133 },
        4: { cellWidth: 32, halign: 'center', fontStyle: 'bold' }
      }
    });

    currentY = (doc.lastAutoTable?.finalY ?? currentY) + 10;
  }

  // ==================== PAGE FOOTERS ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `SUBAG TU PIM & PROTOKOL DITJENPAS  •  Laporan Bulanan ${selectedMonthName} ${selectedYear}`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: 'right'
    });
  }

  const safeMonth = selectedMonthName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Laporan_Bulanan_SUBAG_TU_PIM_${safeMonth}_${selectedYear}.pdf`);
}

// ==================== ATTACHMENT & JOURNAL PDF DOWNLOADS ====================

export interface AttachmentPdfContext {
  title?: string;
  subtitle?: string;
  date?: string;
  logoDataUrl?: string | null;
}

function sanitizePdfFilename(rawName: string, fallback = 'Dokumen'): string {
  const withoutExt = rawName.replace(/\.[^/.]+$/, '').trim();
  const safe = (withoutExt || fallback).replace(/[^a-zA-Z0-9_\-\s]/g, '_').replace(/\s+/g, '_').slice(0, 90);
  return `${safe || fallback}.pdf`;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/pdf'): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const body = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;

  if (header.includes(';base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

async function rasterizeImageDataUrl(
  dataUrl: string
): Promise<{ pngDataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalWidth = img.naturalWidth || img.width || 1200;
      const naturalHeight = img.naturalHeight || img.height || 800;
      const maxDim = 2000;
      const scale = Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight));
      const targetW = Math.max(1, Math.round(naturalWidth * scale));
      const targetH = Math.max(1, Math.round(naturalHeight * scale));

      const canvas = window.document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context tidak tersedia'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve({
        pngDataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: targetW,
        height: targetH
      });
    };
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk konversi PDF'));
    img.src = dataUrl;
  });
}

async function safeLoadLogoForPdf(logoUrl?: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await rasterizeImageDataUrl(logoUrl);
    return res.pngDataUrl;
  } catch {
    return null;
  }
}

/**
 * Downloads any uploaded attachment as a PDF:
 * - If already a PDF: triggers direct reliable Blob download as .pdf
 * - If an image/photo (JPG/PNG/WEBP/SVG): embeds cleanly into an A4 PDF with official header
 */
export async function downloadAttachmentAsPdf(
  docMeta: { name: string; type: string; uploadedAt?: string },
  resolvedDataUrl: string,
  context?: AttachmentPdfContext
): Promise<void> {
  if (!resolvedDataUrl) {
    throw new Error('Isi dokumen belum tersedia untuk diunduh.');
  }

  const filename = sanitizePdfFilename(docMeta.name, 'Lampiran_Dokumen');
  const isPdf =
    docMeta.type === 'application/pdf' ||
    docMeta.name.toLowerCase().endsWith('.pdf') ||
    resolvedDataUrl.startsWith('data:application/pdf');

  if (isPdf) {
    const blob = dataUrlToBlob(resolvedDataUrl, 'application/pdf');
    triggerBlobDownload(blob, filename);
    return;
  }

  // Convert uploaded photo/image into an official A4 PDF document
  const raster = await rasterizeImageDataUrl(resolvedDataUrl);
  const orientation: 'portrait' | 'landscape' = raster.width > raster.height * 1.25 ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  let y = 14;
  const logoImg = await safeLoadLogoForPdf(context?.logoDataUrl);
  if (logoImg) {
    try {
      pdf.addImage(logoImg, 'JPEG', marginX, y - 2, 13, 13);
    } catch {
      // skip logo if invalid
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('SUBAG TU PIM & PROTOKOL DITJENPAS', pageWidth / 2, y + 2, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Lampiran Bukti Foto & Dokumentasi Resmi', pageWidth / 2, y + 7, { align: 'center' });

  y += 12;
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.7);
  pdf.line(marginX, y, pageWidth - marginX, y);
  pdf.setLineWidth(0.25);
  pdf.line(marginX, y + 1.1, pageWidth - marginX, y + 1.1);
  y += 6;

  // Context metadata box
  if (context?.title) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    const titleLines = pdf.splitTextToSize(context.title, contentWidth);
    pdf.text(titleLines, marginX, y);
    y += titleLines.length * 4.5 + 1;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  const metaParts: string[] = [`Berkas: ${docMeta.name}`];
  if (context?.date) metaParts.push(`Tanggal: ${formatDateIndo(context.date)}`);
  if (context?.subtitle) metaParts.push(context.subtitle);
  const metaLines = pdf.splitTextToSize(metaParts.join('  •  '), contentWidth);
  pdf.text(metaLines, marginX, y);
  y += metaLines.length * 4 + 4;

  // Fit image neatly inside remaining page space
  const maxImgW = contentWidth;
  const maxImgH = pageHeight - y - 16;
  const imgRatio = raster.width / raster.height;
  let drawW = maxImgW;
  let drawH = drawW / imgRatio;
  if (drawH > maxImgH) {
    drawH = maxImgH;
    drawW = drawH * imgRatio;
  }
  const drawX = marginX + (contentWidth - drawW) / 2;

  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.rect(drawX - 1, y - 1, drawW + 2, drawH + 2);
  pdf.addImage(raster.pngDataUrl, 'JPEG', drawX, y, drawW, drawH);

  // Footer
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `SUBAG TU PIM & PROTOKOL DITJENPAS  •  Diunduh ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    marginX,
    pageHeight - 8
  );

  pdf.save(filename);
}

/**
 * Exports a single Daily Journal entry together with all uploaded evidence photos
 * and list of attached PDF reports into one official portrait A4 PDF.
 */
export async function downloadJournalEntryPdf(
  entry: DailyJournalEntry,
  resolvedDocs: Array<{ id: string; name: string; type: string; dataUrl: string }>,
  logoDataUrl?: string | null
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  }) as JsPdfWithAutoTable;

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2;

  let y = 15;
  const logoImg = await safeLoadLogoForPdf(logoDataUrl);
  if (logoImg) {
    try {
      pdf.addImage(logoImg, 'JPEG', marginX, y - 2, 15, 15);
    } catch {
      // ignore invalid logo
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('SUBAG TU PIM & PROTOKOL DITJENPAS', pageWidth / 2, y + 2, { align: 'center' });

  pdf.setFontSize(12.5);
  pdf.text('LAPORAN JURNAL HARIAN KEGIATAN', pageWidth / 2, y + 8, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.2);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Direktorat Jenderal Pemasyarakatan  •  Subbagian Tata Usaha Pimpinan & Protokol', pageWidth / 2, y + 13, {
    align: 'center'
  });

  y += 16.5;
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.8);
  pdf.line(marginX, y, pageWidth - marginX, y);
  pdf.setLineWidth(0.25);
  pdf.line(marginX, y + 1.2, pageWidth - marginX, y + 1.2);
  y += 8;

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  const titleLines = pdf.splitTextToSize(entry.title, contentWidth);
  pdf.text(titleLines, marginX, y);
  y += titleLines.length * 5 + 3;

  // Metadata table
  const metaRows: string[][] = [
    ['Hari / Tanggal', `${formatDateIndo(entry.date)}  •  Pukul ${entry.time} WIB`],
    ['Status Lapangan', entry.outcome],
    ['Pimpinan', entry.leaderName || '-'],
    ['Lokasi Kegiatan', entry.location || '-'],
    ['Petugas Pelapor', `${entry.reporterName} (${entry.reporterRole})`]
  ];
  if (entry.relatedAgendaTitle) {
    metaRows.push(['Agenda Terkait', entry.relatedAgendaTitle]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    body: metaRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: contentWidth - 40 }
    }
  });

  y = (pdf.lastAutoTable?.finalY ?? y) + 7;

  // Summary section
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('URAIAN PELAKSANAAN KEGIATAN', marginX, y);
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(30, 41, 59);
  const summaryLines = pdf.splitTextToSize(entry.summary || '-', contentWidth);
  for (const line of summaryLines) {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = 18;
    }
    pdf.text(line, marginX, y);
    y += 4.6;
  }

  if (entry.followUp) {
    y += 4;
    if (y > pageHeight - 26) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(146, 64, 14);
    pdf.text('ARAHAN PIMPINAN / TINDAK LANJUT', marginX, y);
    y += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    const followLines = pdf.splitTextToSize(entry.followUp, contentWidth);
    for (const line of followLines) {
      if (y > pageHeight - 20) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(line, marginX, y);
      y += 4.6;
    }
  }

  // Attached photos & documents
  const photoDocs = resolvedDocs.filter(
    (d) =>
      d.dataUrl &&
      (d.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif)$/i.test(d.name))
  );
  const pdfDocs = resolvedDocs.filter(
    (d) => d.type === 'application/pdf' || d.name.toLowerCase().endsWith('.pdf')
  );

  if (pdfDocs.length > 0) {
    y += 6;
    if (y > pageHeight - 28) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('DAFTAR DOKUMEN LAPORAN TERLAMPIR (PDF)', marginX, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    pdfDocs.forEach((p, idx) => {
      if (y > pageHeight - 18) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(`${idx + 1}. ${p.name}`, marginX + 2, y);
      y += 4.5;
    });
  }

  if (photoDocs.length > 0) {
    y += 7;
    if (y > pageHeight - 85) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`LAMPIRAN BUKTI FOTO DOKUMENTASI (${photoDocs.length} FOTO)`, marginX, y);
    y += 6;

    for (let i = 0; i < photoDocs.length; i++) {
      const photo = photoDocs[i];
      try {
        const raster = await rasterizeImageDataUrl(photo.dataUrl);
        const maxBoxW = contentWidth;
        const maxBoxH = 105;
        const ratio = raster.width / raster.height;
        let drawW = maxBoxW;
        let drawH = drawW / ratio;
        if (drawH > maxBoxH) {
          drawH = maxBoxH;
          drawW = drawH * ratio;
        }

        if (y + drawH + 14 > pageHeight - 16) {
          pdf.addPage();
          y = 18;
        }

        const drawX = marginX + (contentWidth - drawW) / 2;
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.3);
        pdf.rect(drawX - 0.8, y - 0.8, drawW + 1.6, drawH + 1.6);
        pdf.addImage(raster.pngDataUrl, 'JPEG', drawX, y, drawW, drawH);
        y += drawH + 4.5;

        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Foto ${i + 1}: ${photo.name}`, pageWidth / 2, y, { align: 'center' });
        y += 8;
      } catch {
        // skip unreadable photo without aborting PDF
      }
    }
  }

  // Page footers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`SUBAG TU PIM & PROTOKOL DITJENPAS  •  Jurnal Harian ${entry.date}`, marginX, pageHeight - 8);
    pdf.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  pdf.save(sanitizePdfFilename(`Jurnal_Harian_${entry.date}_${entry.title}`, `Jurnal_Harian_${entry.date}`));
}
