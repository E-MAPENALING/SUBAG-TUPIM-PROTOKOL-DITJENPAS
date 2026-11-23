export type Priority = 'VIP' | 'Tinggi' | 'Sedang' | 'Rutin';

export type AgendaStatus = 'Terjadwal' | 'Berlangsung' | 'Selesai' | 'Ditunda' | 'Dibatalkan';

export type AgendaCategory =
  | 'Rapat Koordinasi'
  | 'Audiensi & Tamu VVIP'
  | 'Kunjungan Kerja (Kunker)'
  | 'Seremonial & Protokoler'
  | 'Penandatanganan MoU'
  | 'Rapat Terbatas / Internal'
  | 'Dinas Luar Daerah'
  | 'Seminar & Paparan'
  | 'Konferensi Pers / Media';

export type LeaderRole =
  | 'Pimpinan Utama'
  | 'Wakil Pimpinan'
  | 'Sekretaris Daerah / Utama'
  | 'Asisten / Staf Khusus'
  | 'Delegasi Pejabat Ditunjuk';

export interface DocumentAttachment {
  id: string;
  name: string;
  size: number; // in bytes
  type: string; // 'application/pdf' | 'image/png' | 'image/jpeg' | etc.
  dataUrl: string; // Base64 data URL for preview and download
  uploadedAt: string;
}

export interface ReminderConfig {
  enabled: boolean;
  minutesBefore: number; // 15, 30, 60, 120, 1440
  soundEnabled: boolean;
  triggered?: boolean;
  lastNotified?: string;
  snoozedUntil?: number | null;
}

export interface AgendaItem {
  id: string;
  title: string;
  category: AgendaCategory;
  leader: LeaderRole;
  leaderName: string;
  companions?: string; // Pejabat pendamping / ajudan
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  virtualMeetingUrl?: string;
  dressCode?: string; // e.g. "Batik Lengan Panjang", "PDH Khaki", "PSH Resmi"
  priority: Priority;
  status: AgendaStatus;
  notes?: string;
  documents: DocumentAttachment[];
  reminder: ReminderConfig;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'calendar' | 'list' | 'journal' | 'piket' | 'dashboard' | 'print';

export interface FilterState {
  searchQuery: string;
  category: string;
  priority: string;
  status: string;
  leader: string;
}

export type JournalOutcome =
  | 'Lancar & Kondusif'
  | 'Perlu Tindak Lanjut'
  | 'Ada Kendala'
  | 'Selesai Dilaporkan';

export interface DailyJournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  relatedAgendaId?: string;
  relatedAgendaTitle?: string;
  leaderName: string;
  location: string;
  reporterName: string;
  reporterRole: string;
  summary: string; // Uraian pelaksanaan kegiatan harian
  followUp?: string; // Arahan pimpinan / tindak lanjut
  outcome: JournalOutcome;
  documents: DocumentAttachment[];
  createdAt: string;
  updatedAt: string;
}

export type HolidayType =
  | 'Akhir Pekan (Sabtu/Minggu)'
  | 'Libur Nasional'
  | 'Cuti Bersama'
  | 'Hari Besar Keagamaan';

export type DutyShift =
  | 'Standby Penuh (24 Jam)'
  | 'Shift Pagi (07:30 - 14:00)'
  | 'Shift Siang/Sore (14:00 - 20:00)';

export interface ProtocolOfficer {
  id: string;
  name: string;
  role: string; // e.g., 'Petugas Protokol', 'Ajudan / Walpri', 'Dokumentasi & Humas', 'Driver VIP'
  phone: string;
}

export interface HolidayDutyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  holidayName: string;
  dayType: HolidayType;
  shift: DutyShift;
  coordinatorName: string;
  coordinatorPhone?: string;
  officers: ProtocolOfficer[];
  standbyLocation: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
