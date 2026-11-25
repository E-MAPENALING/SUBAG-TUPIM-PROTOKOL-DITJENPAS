import type { DailyJournalEntry, HolidayDutyEntry } from '../types/agenda.ts';

export const INITIAL_JOURNALS: DailyJournalEntry[] = [
  {
    id: 'journal-2026-11-05-1',
    date: '2026-11-05',
    time: '11:45',
    title: 'Laporan Pelaksanaan Rakor Evaluasi Anggaran & Kinerja Triwulan IV',
    relatedAgendaId: 'agenda-2026-11-05-1',
    relatedAgendaTitle: 'Rapat Koordinasi Evaluasi Anggaran & Kinerja Triwulan IV',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    location: 'Ruang Rapat Graha Pimpinan, Lantai 3',
    reporterName: 'Raka Pratama, S.STP',
    reporterRole: 'Petugas Protokol & Notulis',
    summary:
      'Kegiatan berlangsung tertib dihadiri 28 Kepala OPD. Pimpinan memberikan evaluasi menyeluruh terhadap realisasi serapan anggaran yang telah mencapai 78,4% per Oktober 2026 dan menekankan percepatan lelang kegiatan fisik prioritas sebelum pertengahan Desember.',
    followUp:
      'BPKAD dan Bappeda diminta menyerahkan matriks percepatan serapan paling lambat hari Senin pukul 10.00 WIB ke ruang Pimpinan.',
    outcome: 'Perlu Tindak Lanjut',
    documents: [],
    createdAt: '2026-11-05T11:50:00Z',
    updatedAt: '2026-11-05T11:50:00Z'
  },
  {
    id: 'journal-2026-11-09-1',
    date: '2026-11-09',
    time: '13:15',
    title: 'Jurnal Lapangan Peninjauan Proyek Jembatan Poros Utara',
    relatedAgendaId: 'agenda-2026-11-09-1',
    relatedAgendaTitle: 'Kunjungan Kerja Lapangan & Peninjauan Proyek Infrastruktur Terpadu',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    location: 'Kawasan Pembangunan Jembatan Poros Utara',
    reporterName: 'Dina Kartika, S.I.Kom',
    reporterRole: 'Staf Protokol & Dokumentasi',
    summary:
      'Rombongan Pimpinan tiba di lokasi pukul 08.25 WIB disambut Camat Wilayah Timur dan kontraktor pelaksana. Progres fisik jembatan mencapai 86%. Cuaca cerah dan pengamanan jalur berjalan lancar bersama tim Dishub dan Walpri.',
    followUp:
      'Pimpinan menginstruksikan Dinas Bina Marga menambah penerangan jalan di sisi barat akses jembatan sebelum peresmian akhir bulan.',
    outcome: 'Lancar & Kondusif',
    documents: [],
    createdAt: '2026-11-09T13:20:00Z',
    updatedAt: '2026-11-09T13:20:00Z'
  },
  {
    id: 'journal-2026-11-22-1',
    date: '2026-11-22',
    time: '10:30',
    title: 'Pengecekan Persiapan Keberangkatan Dinas Luar Daerah (Rakornas TPID)',
    relatedAgendaId: 'agenda-2026-11-23-1',
    relatedAgendaTitle: 'Dinas Luar Daerah: Rakornas Pengendalian Inflasi Daerah (TPID)',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    location: 'Posko Protokol Graha Pimpinan',
    reporterName: 'Bagus Setiawan, S.AP',
    reporterRole: 'Petugas Protokol Piket',
    summary:
      'Seluruh kelengkapan perjalanan dinas Pimpinan (boarding pass, surat tugas resmi, bahan paparan inflasi daerah, serta konfirmasi kendaraan jemputan di Jakarta) telah diverifikasi lengkap bersama ajudan.',
    followUp:
      'Keberangkatan rombongan dijadwalkan besok pagi pukul 06.00 WIB dari rumah dinas menuju stasiun/bandara.',
    outcome: 'Selesai Dilaporkan',
    documents: [],
    createdAt: '2026-11-22T10:35:00Z',
    updatedAt: '2026-11-22T10:35:00Z'
  }
];

export const INITIAL_HOLIDAY_DUTIES: HolidayDutyEntry[] = [
  {
    id: 'duty-2026-11-07',
    date: '2026-11-07',
    holidayName: 'Piket Akhir Pekan (Sabtu)',
    dayType: 'Akhir Pekan (Sabtu/Minggu)',
    shift: 'Standby Penuh (24 Jam)',
    coordinatorName: 'M. Ridwan Prasetyo, S.STP., M.AP',
    coordinatorPhone: '0812-3456-7801',
    officers: [
      { id: 'off-1', name: 'Raka Pratama, S.STP', role: 'Petugas Protokol', phone: '0813-2201-4411' },
      { id: 'off-2', name: 'Arief Nugroho', role: 'Ajudan / Walpri', phone: '0812-8890-1122' },
      { id: 'off-3', name: 'Dina Kartika, S.I.Kom', role: 'Dokumentasi & Humas', phone: '0856-4110-7788' }
    ],
    standbyLocation: 'Posko Protokol Graha Pimpinan & On-Call',
    notes: 'Siaga menerima tamu mendadak dan koordinasi persiapan Kunker hari Senin.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z'
  },
  {
    id: 'duty-2026-11-08',
    date: '2026-11-08',
    holidayName: 'Piket Akhir Pekan (Minggu)',
    dayType: 'Akhir Pekan (Sabtu/Minggu)',
    shift: 'Standby Penuh (24 Jam)',
    coordinatorName: 'Hendra Wijaya, S.Sos',
    coordinatorPhone: '0812-3456-7802',
    officers: [
      { id: 'off-4', name: 'Sinta Wulandari, S.IP', role: 'Petugas Protokol', phone: '0813-9087-2314' },
      { id: 'off-5', name: 'Bambang Triyono', role: 'Driver VIP', phone: '0815-6721-9045' }
    ],
    standbyLocation: 'Rumah Dinas Pimpinan & On-Call',
    notes: 'Monitoring undangan masyarakat hari Minggu dan persiapan kendaraan dinas Kunker.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z'
  },
  {
    id: 'duty-2026-11-14',
    date: '2026-11-14',
    holidayName: 'Piket Akhir Pekan (Sabtu)',
    dayType: 'Akhir Pekan (Sabtu/Minggu)',
    shift: 'Shift Pagi (07:30 - 14:00)',
    coordinatorName: 'M. Ridwan Prasetyo, S.STP., M.AP',
    coordinatorPhone: '0812-3456-7801',
    officers: [
      { id: 'off-6', name: 'Dimas Aditya, S.AP', role: 'Petugas Protokol', phone: '0812-7765-3301' },
      { id: 'off-7', name: 'Fajar Ramadhan', role: 'Dokumentasi & Humas', phone: '0857-8891-2204' }
    ],
    standbyLocation: 'Posko Protokol Graha Pimpinan',
    notes: 'Standby pendampingan agenda sosial & resepsi tokoh masyarakat.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z'
  },
  {
    id: 'duty-2026-11-21',
    date: '2026-11-21',
    holidayName: 'Piket Akhir Pekan (Sabtu)',
    dayType: 'Akhir Pekan (Sabtu/Minggu)',
    shift: 'Standby Penuh (24 Jam)',
    coordinatorName: 'Hendra Wijaya, S.Sos',
    coordinatorPhone: '0812-3456-7802',
    officers: [
      { id: 'off-8', name: 'Bagus Setiawan, S.AP', role: 'Petugas Protokol', phone: '0813-4421-9908' },
      { id: 'off-9', name: 'Rizky Mahendra', role: 'Ajudan / Walpri', phone: '0812-5510-6632' }
    ],
    standbyLocation: 'Rumah Dinas Pimpinan & On-Call',
    notes: 'Siaga protokol akhir pekan.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z'
  },
  {
    id: 'duty-2026-11-22',
    date: '2026-11-22',
    holidayName: 'Piket Akhir Pekan (Minggu)',
    dayType: 'Akhir Pekan (Sabtu/Minggu)',
    shift: 'Standby Penuh (24 Jam)',
    coordinatorName: 'M. Ridwan Prasetyo, S.STP., M.AP',
    coordinatorPhone: '0812-3456-7801',
    officers: [
      { id: 'off-10', name: 'Bagus Setiawan, S.AP', role: 'Petugas Protokol', phone: '0813-4421-9908' },
      { id: 'off-11', name: 'Nadia Permata, S.I.Kom', role: 'Dokumentasi & Humas', phone: '0812-9091-4432' },
      { id: 'off-12', name: 'Bambang Triyono', role: 'Driver VIP', phone: '0815-6721-9045' }
    ],
    standbyLocation: 'Posko Protokol Graha Pimpinan & Rumah Dinas',
    notes: 'Finalisasi berkas & koper dinas luar daerah Rakornas TPID Jakarta.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z'
  },
  {
    id: 'duty-2026-11-28',
    date: '2026-11-28',
    holidayName: 'Piket Akhir Pekan (Sabtu)',
    dayType: 'Akhir Pekan (Sabtu/Minggu)',
    shift: 'Standby Penuh (24 Jam)',
    coordinatorName: 'Hendra Wijaya, S.Sos',
    coordinatorPhone: '0812-3456-7802',
    officers: [
      { id: 'off-13', name: 'Raka Pratama, S.STP', role: 'Petugas Protokol', phone: '0813-2201-4411' },
      { id: 'off-14', name: 'Sinta Wulandari, S.IP', role: 'Petugas Protokol', phone: '0813-9087-2314' }
    ],
    standbyLocation: 'Posko Protokol Graha Pimpinan',
    notes: 'Standby akhir bulan dan kompilasi laporan kegiatan November 2026.',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z'
  }
];
