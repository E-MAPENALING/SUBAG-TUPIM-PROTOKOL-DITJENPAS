import { AgendaItem } from '../types/agenda';

/**
 * Format a Date object to iCalendar / Google Calendar UTC / local format:
 * YYYYMMDDTHHmmSSZ or YYYYMMDDTHHmmSS
 */
function formatToCalDateTime(dateStr: string, timeStr: string): string {
  // dateStr is 'YYYY-MM-DD', timeStr is 'HH:mm'
  const [year, month, day] = dateStr.split('-');
  const [hours, minutes] = timeStr.split(':');
  
  // Format as YYYYMMDDTHHMMSS
  return `${year}${month}${day}T${hours}${minutes}00`;
}

/**
 * Generates Google Calendar web intent URL
 */
export function generateGoogleCalendarUrl(agenda: AgendaItem): string {
  const startIso = formatToCalDateTime(agenda.date, agenda.startTime);
  const endIso = formatToCalDateTime(agenda.date, agenda.endTime);

  const title = encodeURIComponent(`[SUBAG TU PIM & PROTOKOL DITJENPAS] ${agenda.title}`);
  const location = encodeURIComponent(agenda.location || '');
  
  let detailsText = `SUBAG TU PIM & PROTOKOL DITJENPAS\n`;
  detailsText += `Kegiatan: ${agenda.title}\n`;
  detailsText += `Kategori: ${agenda.category}\n`;
  detailsText += `Pimpinan: ${agenda.leader} (${agenda.leaderName})\n`;
  if (agenda.companions) detailsText += `Pendamping: ${agenda.companions}\n`;
  if (agenda.dressCode) detailsText += `Pakaian: ${agenda.dressCode}\n`;
  if (agenda.virtualMeetingUrl) detailsText += `Link Meeting: ${agenda.virtualMeetingUrl}\n`;
  if (agenda.notes) detailsText += `Catatan: ${agenda.notes}\n`;
  if (agenda.documents && agenda.documents.length > 0) {
    detailsText += `\nDokumen Terlampir (${agenda.documents.length} berkas):\n`;
    agenda.documents.forEach((doc, idx) => {
      detailsText += `- ${idx + 1}. ${doc.name}\n`;
    });
  }

  const details = encodeURIComponent(detailsText);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}

/**
 * Generate RFC 5545 VCALENDAR .ics format string for single or multiple events
 */
export function generateIcsContent(agendas: AgendaItem[]): string {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SUBAG TU PIM & PROTOKOL DITJENPAS//ID//Bulan',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SUBAG TU PIM & PROTOKOL DITJENPAS',
    'X-WR-TIMEZONE:Asia/Jakarta'
  ];

  for (const agenda of agendas) {
    const dtStart = formatToCalDateTime(agenda.date, agenda.startTime);
    const dtEnd = formatToCalDateTime(agenda.date, agenda.endTime);
    const createdStr = formatToCalDateTime(
      agenda.createdAt.slice(0, 10),
      agenda.createdAt.slice(11, 16) || '00:00'
    );

    let desc = `SUBAG TU PIM & PROTOKOL DITJENPAS: ${agenda.title}\\n`;
    desc += `Kategori: ${agenda.category}\\n`;
    desc += `Pimpinan: ${agenda.leader} (${agenda.leaderName})\\n`;
    if (agenda.companions) desc += `Pendamping: ${agenda.companions}\\n`;
    if (agenda.dressCode) desc += `Pakaian / Dresscode: ${agenda.dressCode}\\n`;
    if (agenda.virtualMeetingUrl) desc += `Link Virtual: ${agenda.virtualMeetingUrl}\\n`;
    if (agenda.notes) desc += `Catatan: ${agenda.notes.replace(/\n/g, '\\n')}\\n`;
    if (agenda.documents && agenda.documents.length > 0) {
      desc += `Dokumen Terlampir: ${agenda.documents.map(d => d.name).join(', ')}\\n`;
    }

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:agenda-${agenda.id}@agendapimpinan.local`);
    ics.push(`DTSTAMP:${createdStr}`);
    ics.push(`DTSTART:${dtStart}`);
    ics.push(`DTEND:${dtEnd}`);
    ics.push(`SUMMARY:${agenda.title}`);
    ics.push(`DESCRIPTION:${desc}`);
    ics.push(`LOCATION:${agenda.location || 'Ruang Pimpinan'}`);
    ics.push(`STATUS:${agenda.status === 'Dibatalkan' ? 'CANCELLED' : 'CONFIRMED'}`);
    ics.push(`CLASS:PUBLIC`);

    // Add alarm reminder if enabled
    if (agenda.reminder.enabled) {
      ics.push('BEGIN:VALARM');
      ics.push('ACTION:DISPLAY');
      ics.push(`DESCRIPTION:Pengingat Agenda: ${agenda.title}`);
      ics.push(`TRIGGER:-PT${agenda.reminder.minutesBefore}M`);
      ics.push('END:VALARM');
    }

    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

/**
 * Trigger download of .ics file in browser
 */
export function downloadIcsFile(agenda: AgendaItem): void {
  const content = generateIcsContent([agenda]);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = agenda.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  link.download = `Agenda_${agenda.date}_${safeTitle}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger download of batch .ics file for all agendas in a given month
 */
export function downloadMonthlyIcsFile(agendas: AgendaItem[], monthLabel: string, year: number): void {
  const content = generateIcsContent(agendas);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Kalender_SUBAG_TU_PIM_PROTOKOL_DITJENPAS_${monthLabel}_${year}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date in Indonesian locale (e.g., 'Rabu, 5 November 2026')
 */
export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format short date (e.g. '05 Nov 2026')
 */
export function formatShortDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Generate formatted WhatsApp message for quick notification sharing
 */
export function generateWhatsAppShareText(agenda: AgendaItem): string {
  let msg = `*PEMBERITAHUAN AGENDA — SUBAG TU PIM & PROTOKOL DITJENPAS*\n\n`;
  msg += `📌 *Kegiatan:* ${agenda.title}\n`;
  msg += `🗓 *Hari/Tanggal:* ${formatDateIndo(agenda.date)}\n`;
  msg += `⏰ *Pukul:* ${agenda.startTime} - ${agenda.endTime} WIB\n`;
  msg += `📍 *Tempat:* ${agenda.location}\n`;
  msg += `👤 *Pimpinan:* ${agenda.leader} (${agenda.leaderName})\n`;
  if (agenda.companions) msg += `👥 *Pendamping:* ${agenda.companions}\n`;
  if (agenda.dressCode) msg += `👔 *Pakaian:* ${agenda.dressCode}\n`;
  if (agenda.virtualMeetingUrl) msg += `🔗 *Link Virtual:* ${agenda.virtualMeetingUrl}\n`;
  msg += `🏷 *Status:* ${agenda.status} | *Prioritas:* ${agenda.priority}\n`;
  if (agenda.notes) msg += `📝 *Catatan:* ${agenda.notes}\n`;
  if (agenda.documents && agenda.documents.length > 0) {
    msg += `\n📎 *Dokumen Terlampir (${agenda.documents.length} berkas):*\n`;
    agenda.documents.forEach((doc, idx) => {
      msg += `  ${idx + 1}. ${doc.name} (${(doc.size / 1024).toFixed(0)} KB)\n`;
    });
  }
  msg += `\n_Demikian disampaikan untuk menjadi pedoman dan perhatian bersama._`;

  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
