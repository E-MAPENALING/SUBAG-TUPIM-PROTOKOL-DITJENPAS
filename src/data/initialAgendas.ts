import { AgendaItem } from '../types/agenda';

// Minimal valid PDF string encoded as Base64 for sample preview
const SAMPLE_PDF_BASE64 = `data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCjEgMCBvYmoKPDwKL1RpdGxlIChTdXJhdCBVbmRhbmdhbiBSYWtvciBQaW1waW5hbikKL0NyZWF0b3IgKEFnZW5kYSBQaW1waW5hbikKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbNCAwIFJdCi9Db3VudCAxCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMyAwIFIKL01lZGlhQm94IFswIDAgNTk1IDg0Ml0KL0NvbnRlbnRzIDUgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+Pgo+Pgo+Pgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDE0NQo+PgpzdHJlYW0KQlQKL0YxIDIwIFRmCjc0IDc1MCBUZAooU1VSQVRVTkRBTkdBTiBSQUtPUiBQSU1QSU5BTikgVGoKL0YxIDEyIFRmCjc0IDcxMCBUZAooQWdlbmRhOiBSYXBhdCBLb29yZGluYXNpIEV2YWx1YXNpIEtvdW50ZXJwYXJ0IFRyaXd1bGFuIElWKSBUago3NCA2ODAgVGsKKEhhcmkvVGFuZ2dhbDogTm92ZW1iZXIgMjAyNikgVGoKRFQgY2xvc2VlbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDk5IDAwMDAwIG4gCjAwMDAwMDAxNDggMDAwMDAgbiAKMDAwMDAwMDIwNSAwMDAwMCBuIAowMDAwMDAwMzY4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAyIDAgUgo+PgpzdGFydHhyZWYKNTY0CiUlRU9GCg==`;

// Sample SVG Diagram rendered as image data URL
const SAMPLE_IMAGE_BASE64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="%23f8fafc"/><rect x="40" y="40" width="720" height="80" rx="12" fill="%231e3a8a"/><text x="400" y="88" fill="white" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">RUNDOWN &amp; DENAH LOKASI ACARA PROTOKOLER</text><rect x="60" y="160" width="200" height="120" rx="8" fill="%23e0e7ff" stroke="%234338ca" stroke-width="2"/><text x="160" y="200" fill="%23312e81" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">08.30 - 09.00</text><text x="160" y="230" fill="%234b5563" font-family="sans-serif" font-size="13" text-anchor="middle">Registrasi &amp; Penyambutan VIP</text><rect x="300" y="160" width="200" height="120" rx="8" fill="%23dbeafe" stroke="%232563eb" stroke-width="2"/><text x="400" y="200" fill="%231e40af" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">09.00 - 10.30</text><text x="400" y="230" fill="%234b5563" font-family="sans-serif" font-size="13" text-anchor="middle">Sambutan &amp; Paparan Utama</text><rect x="540" y="160" width="200" height="120" rx="8" fill="%23dcfce7" stroke="%2316a34a" stroke-width="2"/><text x="640" y="200" fill="%23166534" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">10.30 - 11.30</text><text x="640" y="230" fill="%234b5563" font-family="sans-serif" font-size="13" text-anchor="middle">Sesi Tanya Jawab &amp; Ramah Tamah</text><rect x="60" y="320" width="680" height="120" rx="8" fill="%23fef3c7" stroke="%23d97706" stroke-width="2"/><text x="80" y="360" fill="%2392400e" font-family="sans-serif" font-size="15" font-weight="bold">Catatan Khusus Protokoler Pimpinan:</text><text x="80" y="390" fill="%2378350f" font-family="sans-serif" font-size="13">- Pakaian: Batik Lengan Panjang Motif Daerah</text><text x="80" y="415" fill="%2378350f" font-family="sans-serif" font-size="13">- Pejabat Pendamping: Asisten I, Kadis Kominfo, Kabag Humas &amp; Protokol</text></svg>`;

export const INITIAL_AGENDAS: AgendaItem[] = [
  {
    id: 'agenda-2026-11-05-1',
    title: 'Rapat Koordinasi Evaluasi Anggaran & Kinerja Triwulan IV',
    category: 'Rapat Koordinasi',
    leader: 'Pimpinan Utama',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    companions: 'Sekretaris Daerah, Asisten Administrasi, Kepala Bappeda & BPKAD',
    date: '2026-11-05',
    startTime: '09:00',
    endTime: '11:30',
    location: 'Ruang Rapat Graha Pimpinan, Lantai 3',
    virtualMeetingUrl: 'https://meet.google.com/rakor-kinerja-tw4',
    dressCode: 'Batik Lengan Panjang / PSH',
    priority: 'VIP',
    status: 'Terjadwal',
    notes: 'Pimpinan meminta seluruh kepala OPD membawa laporan realisasi fisik dan serapan keuangan hingga Oktober 2026. Bahan paparan ringkas maksimal 5 menit per instansi.',
    reminder: {
      enabled: true,
      minutesBefore: 60,
      soundEnabled: true,
      triggered: false
    },
    documents: [
      {
        id: 'doc-1',
        name: 'Surat_Undangan_Rakor_Evaluasi_TW4.pdf',
        size: 245760,
        type: 'application/pdf',
        dataUrl: SAMPLE_PDF_BASE64,
        uploadedAt: '2026-11-01T08:30:00Z'
      },
      {
        id: 'doc-2',
        name: 'Rundown_dan_Denah_Ruang_Rakor.svg',
        size: 153600,
        type: 'image/svg+xml',
        dataUrl: SAMPLE_IMAGE_BASE64,
        uploadedAt: '2026-11-01T08:32:00Z'
      }
    ],
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:32:00Z'
  },
  {
    id: 'agenda-2026-11-05-2',
    title: 'Audiensi Kunjungan Kerja Delegasi Kemenpan-RB & Ombudsman RI',
    category: 'Audiensi & Tamu VVIP',
    leader: 'Pimpinan Utama',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    companions: 'Wakil Pimpinan, Kabag Organisasi, Tim Pelayanan Publik',
    date: '2026-11-05',
    startTime: '13:30',
    endTime: '15:00',
    location: 'Ruang Tamu Utama VIP / Holding Room',
    dressCode: 'Pakaian Sipil Lengkap (PSL) / Batik Formal',
    priority: 'VIP',
    status: 'Terjadwal',
    notes: 'Agenda pembahasan kepatuhan standar pelayanan publik dan inovasi sistem digitalisasi perizinan terpadu.',
    reminder: {
      enabled: true,
      minutesBefore: 30,
      soundEnabled: true,
      triggered: false
    },
    documents: [
      {
        id: 'doc-3',
        name: 'Surat_Pengantar_Audiensi_Ombudsman.pdf',
        size: 312000,
        type: 'application/pdf',
        dataUrl: SAMPLE_PDF_BASE64,
        uploadedAt: '2026-11-02T10:15:00Z'
      }
    ],
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:15:00Z'
  },
  {
    id: 'agenda-2026-11-06-1',
    title: 'Penandatanganan Nota Kesepahaman (MoU) Integrasi Layanan Satu Pintu',
    category: 'Penandatanganan MoU',
    leader: 'Pimpinan Utama',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    companions: 'Asisten Pemerintahan, Kabag Hukum, Kadis PTSP',
    date: '2026-11-06',
    startTime: '10:00',
    endTime: '11:45',
    location: 'Ballroom Hotel Arya Duta, Grand Hall',
    dressCode: 'Jas Resmi / PSH Gelap',
    priority: 'VIP',
    status: 'Terjadwal',
    notes: 'Penandatanganan disaksikan oleh perwakilan Kementerian Dalam Negeri. Protokol harap siapkan map piagam beludru dan cinderamata plakat.',
    reminder: {
      enabled: true,
      minutesBefore: 120,
      soundEnabled: true,
      triggered: false
    },
    documents: [
      {
        id: 'doc-4',
        name: 'Draft_Naskah_MoU_Layanan_Terpadu.pdf',
        size: 512000,
        type: 'application/pdf',
        dataUrl: SAMPLE_PDF_BASE64,
        uploadedAt: '2026-11-03T11:20:00Z'
      }
    ],
    createdAt: '2026-11-03T11:00:00Z',
    updatedAt: '2026-11-03T11:20:00Z'
  },
  {
    id: 'agenda-2026-11-09-1',
    title: 'Kunjungan Kerja Lapangan & Peninjauan Proyek Infrastruktur Terpadu',
    category: 'Kunjungan Kerja (Kunker)',
    leader: 'Pimpinan Utama',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    companions: 'Kadis Bina Marga, Kadis Perkim, Camat Wilayah Timur, Staf Walpri',
    date: '2026-11-09',
    startTime: '08:00',
    endTime: '13:00',
    location: 'Kawasan Pembangunan Jembatan Poros Utara & Sentra Logistik',
    dressCode: 'Rompi Lapangan / Kemeja PDH Putih + Sepatu Safety',
    priority: 'Tinggi',
    status: 'Terjadwal',
    notes: 'Titik kumpul keberangkatan di Pendopo Kantor jam 07.45 WIB. Siapkan kendaraan roda 4 tangguh medan proyek.',
    reminder: {
      enabled: true,
      minutesBefore: 1440,
      soundEnabled: true,
      triggered: false
    },
    documents: [
      {
        id: 'doc-5',
        name: 'Denah_Progres_Fisik_Jembatan.svg',
        size: 180000,
        type: 'image/svg+xml',
        dataUrl: SAMPLE_IMAGE_BASE64,
        uploadedAt: '2026-11-03T14:00:00Z'
      }
    ],
    createdAt: '2026-11-03T13:45:00Z',
    updatedAt: '2026-11-03T14:00:00Z'
  },
  {
    id: 'agenda-2026-11-12-1',
    title: 'Seremonial Pembukaan Gelar Pameran UMKM Mandiri & Pesta Rakyat',
    category: 'Seremonial & Protokoler',
    leader: 'Wakil Pimpinan',
    leaderName: 'Hj. Siti Rahmawati, S.E., M.M.',
    companions: 'Kadis Koperasi & UKM, Kadis Pariwisata, Pengurus Dekranasda',
    date: '2026-11-12',
    startTime: '08:30',
    endTime: '11:00',
    location: 'Alun-alun Sentra Kota / Panggung Utama',
    dressCode: 'Batik Motif Khas Pesisir',
    priority: 'Tinggi',
    status: 'Terjadwal',
    notes: 'Wakil Pimpinan mewakili Pimpinan Utama memberikan sambutan kunci dan pemukulan gong tanda peresmian.',
    reminder: {
      enabled: true,
      minutesBefore: 60,
      soundEnabled: true,
      triggered: false
    },
    documents: [],
    createdAt: '2026-11-04T09:00:00Z',
    updatedAt: '2026-11-04T09:00:00Z'
  },
  {
    id: 'agenda-2026-11-17-1',
    title: 'Rapat Terbatas Dewan Pengawas & Pembahasan Rencana Kerja 2027',
    category: 'Rapat Terbatas / Internal',
    leader: 'Sekretaris Daerah / Utama',
    leaderName: 'Ir. Hendro Wicaksono, M.T.',
    companions: 'Inspektur Wilayah, Kabag Hukum, Kabag Organisasi',
    date: '2026-11-17',
    startTime: '14:00',
    endTime: '16:30',
    location: 'Ruang Rapat Pimpinan lt. 2',
    dressCode: 'PDH Khaki Rapi',
    priority: 'Sedang',
    status: 'Terjadwal',
    notes: 'Pemaparan hasil audit kepatuhan internal dan tindak lanjut rekomendasi BPK.',
    reminder: {
      enabled: true,
      minutesBefore: 30,
      soundEnabled: true,
      triggered: false
    },
    documents: [],
    createdAt: '2026-11-04T10:00:00Z',
    updatedAt: '2026-11-04T10:00:00Z'
  },
  {
    id: 'agenda-2026-11-23-1',
    title: 'Dinas Luar Daerah: Rakornas Pengendalian Inflasi Daerah (TPID)',
    category: 'Dinas Luar Daerah',
    leader: 'Pimpinan Utama',
    leaderName: 'Dr. H. Ahmad Fauzi, M.Si',
    companions: 'Kepala Bappeda, Kadis Perdagangan, Walpri',
    date: '2026-11-23',
    startTime: '08:30',
    endTime: '17:00',
    location: 'Istana Negara / Hotel Kempinski Jakarta Pusat',
    dressCode: 'Pakaian Sipil Lengkap (PSL) Hitam',
    priority: 'VIP',
    status: 'Terjadwal',
    notes: 'Dihadiri langsung oleh Presiden RI dan Menteri Keuangan. Tiket dan akomodasi telah dikoordinasikan oleh Bagian Protokol.',
    reminder: {
      enabled: true,
      minutesBefore: 1440,
      soundEnabled: true,
      triggered: false
    },
    documents: [
      {
        id: 'doc-6',
        name: 'Surat_Tugas_dan_Tiket_Perjalanan.pdf',
        size: 420000,
        type: 'application/pdf',
        dataUrl: SAMPLE_PDF_BASE64,
        uploadedAt: '2026-11-04T14:00:00Z'
      }
    ],
    createdAt: '2026-11-04T13:30:00Z',
    updatedAt: '2026-11-04T14:00:00Z'
  }
];
