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
  includeJournal
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

  // Emblem shield icon (crisp vector badge on left of Kop)
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
