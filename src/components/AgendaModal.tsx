import React, { useState, useRef } from 'react';
import { 
  X, Upload, FileText, Image as ImageIcon, Trash2, Calendar, 
  Clock, MapPin, User, Shield, Bell, AlertTriangle, Link as LinkIcon,
  Shirt, CheckCircle2
} from 'lucide-react';
import { AgendaItem, AgendaCategory, LeaderRole, Priority, AgendaStatus, DocumentAttachment } from '../types/agenda';

interface AgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agenda: AgendaItem) => void;
  agendaToEdit?: AgendaItem | null;
  initialDate?: string;
}

const CATEGORIES: AgendaCategory[] = [
  'Rapat Koordinasi',
  'Audiensi & Tamu VVIP',
  'Kunjungan Kerja (Kunker)',
  'Seremonial & Protokoler',
  'Penandatanganan MoU',
  'Rapat Terbatas / Internal',
  'Dinas Luar Daerah',
  'Seminar & Paparan',
  'Konferensi Pers / Media'
];

const LEADERS: LeaderRole[] = [
  'Pimpinan Utama',
  'Wakil Pimpinan',
  'Sekretaris Daerah / Utama',
  'Asisten / Staf Khusus',
  'Delegasi Pejabat Ditunjuk'
];

const PRIORITIES: { label: string; value: Priority; color: string }[] = [
  { label: 'VIP / Sangat Penting', value: 'VIP', color: 'bg-red-50 text-red-700 border-red-300' },
  { label: 'Tinggi', value: 'Tinggi', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { label: 'Sedang', value: 'Sedang', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { label: 'Rutin / Normal', value: 'Rutin', color: 'bg-slate-50 text-slate-700 border-slate-300' }
];

const STATUSES: { label: string; value: AgendaStatus }[] = [
  { label: 'Terjadwal', value: 'Terjadwal' },
  { label: 'Sedang Berlangsung', value: 'Berlangsung' },
  { label: 'Selesai', value: 'Selesai' },
  { label: 'Ditunda', value: 'Ditunda' },
  { label: 'Dibatalkan', value: 'Dibatalkan' }
];

const REMINDER_OPTIONS = [
  { label: '15 Menit Sebelumnya', minutes: 15 },
  { label: '30 Menit Sebelumnya', minutes: 30 },
  { label: '1 Jam Sebelumnya', minutes: 60 },
  { label: '2 Jam Sebelumnya', minutes: 120 },
  { label: '1 Hari (24 Jam) Sebelumnya', minutes: 1440 }
];

export const AgendaModal: React.FC<AgendaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  agendaToEdit,
  initialDate
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(agendaToEdit?.title || '');
  const [category, setCategory] = useState<AgendaCategory>(agendaToEdit?.category || 'Rapat Koordinasi');
  const [leader, setLeader] = useState<LeaderRole>(agendaToEdit?.leader || 'Pimpinan Utama');
  const [leaderName, setLeaderName] = useState(agendaToEdit?.leaderName || 'Dr. H. Ahmad Fauzi, M.Si');
  const [companions, setCompanions] = useState(agendaToEdit?.companions || '');
  const [date, setDate] = useState(agendaToEdit?.date || initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(agendaToEdit?.startTime || '09:00');
  const [endTime, setEndTime] = useState(agendaToEdit?.endTime || '10:30');
  const [location, setLocation] = useState(agendaToEdit?.location || 'Ruang Rapat Graha Pimpinan, Lt. 3');
  const [virtualMeetingUrl, setVirtualMeetingUrl] = useState(agendaToEdit?.virtualMeetingUrl || '');
  const [dressCode, setDressCode] = useState(agendaToEdit?.dressCode || 'Batik Lengan Panjang');
  const [priority, setPriority] = useState<Priority>(agendaToEdit?.priority || 'Tinggi');
  const [status, setStatus] = useState<AgendaStatus>(agendaToEdit?.status || 'Terjadwal');
  const [notes, setNotes] = useState(agendaToEdit?.notes || '');
  
  const [reminderEnabled, setReminderEnabled] = useState(agendaToEdit?.reminder?.enabled ?? true);
  const [reminderMinutes, setReminderMinutes] = useState(agendaToEdit?.reminder?.minutesBefore || 30);
  const [soundEnabled, setSoundEnabled] = useState(agendaToEdit?.reminder?.soundEnabled ?? true);
  
  const [documents, setDocuments] = useState<DocumentAttachment[]>(agendaToEdit?.documents || []);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState('');

  // Update default leaderName when leader role changes if editing empty
  const handleLeaderRoleChange = (role: LeaderRole) => {
    setLeader(role);
    if (!agendaToEdit) {
      if (role === 'Pimpinan Utama') setLeaderName('Dr. H. Ahmad Fauzi, M.Si');
      else if (role === 'Wakil Pimpinan') setLeaderName('Hj. Siti Rahmawati, S.E., M.M.');
      else if (role === 'Sekretaris Daerah / Utama') setLeaderName('Ir. Hendro Wicaksono, M.T.');
      else if (role === 'Asisten / Staf Khusus') setLeaderName('Drs. M. Taufik, M.AP');
      else setLeaderName('Pejabat Ditunjuk');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newDocs: DocumentAttachment[] = [];
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

    let processedCount = 0;
    Array.from(files).forEach((file) => {
      // Validate type
      const isValid = allowedTypes.includes(file.type) || 
                      /\.(pdf|png|jpe?g|webp|svg)$/i.test(file.name);

      if (!isValid) {
        alert(`Format berkas "${file.name}" tidak didukung. Mohon unggah dokumen PDF atau gambar (PNG, JPG, WEBP).`);
        processedCount++;
        if (processedCount === files.length) setIsUploading(false);
        return;
      }

      // Max size: 25MB per file
      if (file.size > 25 * 1024 * 1024) {
        alert(`Ukuran berkas "${file.name}" terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maksimal 25 MB.`);
        processedCount++;
        if (processedCount === files.length) setIsUploading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        newDocs.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png'),
          dataUrl,
          uploadedAt: new Date().toISOString()
        });

        processedCount++;
        if (processedCount === files.length) {
          setDocuments((prev) => [...prev, ...newDocs]);
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      reader.onerror = () => {
        console.error('File read error:', reader.error);
        processedCount++;
        if (processedCount === files.length) setIsUploading(false);
      };

      reader.readAsDataURL(file);
    });
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Nama/judul kegiatan pimpinan wajib diisi.');
      return;
    }
    if (!date) {
      setFormError('Tanggal kegiatan wajib dipilih.');
      return;
    }
    if (!startTime || !endTime) {
      setFormError('Waktu mulai dan selesai wajib diisi.');
      return;
    }

    const agendaItem: AgendaItem = {
      id: agendaToEdit?.id || `agenda-${Date.now()}`,
      title: title.trim(),
      category,
      leader,
      leaderName: leaderName.trim() || 'Pimpinan',
      companions: companions.trim(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      virtualMeetingUrl: virtualMeetingUrl.trim(),
      dressCode: dressCode.trim(),
      priority,
      status,
      notes: notes.trim(),
      documents,
      reminder: {
        enabled: reminderEnabled,
        minutesBefore: reminderMinutes,
        soundEnabled,
        triggered: false,
        snoozedUntil: null
      },
      createdAt: agendaToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(agendaItem);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100">
                {agendaToEdit ? 'Ubah Agenda Pimpinan' : 'Tambah Agenda Pimpinan Baru'}
              </h3>
              <p className="text-xs text-slate-300">
                Lengkapi rincian kegiatan, pimpinan yang ditugaskan, dokumen pendukung & pengingat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Tutup Form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Informasi Utama Kegiatan</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Judul / Nama Kegiatan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFormError(''); }}
                placeholder="Contoh: Rapat Koordinasi Evaluasi Realisasi Anggaran Triwulan IV"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kategori Agenda
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AgendaCategory)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Prioritas Kegiatan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      type="button"
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition flex items-center justify-center gap-1.5 ${
                        priority === p.value
                          ? `${p.color} ring-2 ring-blue-500 font-semibold shadow-xs`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {priority === p.value && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Leader & Companions */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Pimpinan & Pendamping yang Ditugaskan</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jabatan Pimpinan
                </label>
                <select
                  value={leader}
                  onChange={(e) => handleLeaderRoleChange(e.target.value as LeaderRole)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {LEADERS.map((ldr) => (
                    <option key={ldr} value={ldr}>{ldr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Pejabat / Pimpinan
                </label>
                <input
                  type="text"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="Nama Lengkap beserta Gelar"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Pejabat Pendamping / Tim Protokol / Ajudan
              </label>
              <input
                type="text"
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
                placeholder="Contoh: Asisten Pemerintahan, Kadis Kominfo, Kabag Humas, Walpri"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Section 3: Date, Time, Location & Dresscode */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Waktu, Lokasi & Protokoler</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jam Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jam Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Tempat / Lokasi Kegiatan
                  </span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Ruang Rapat Pimpinan lt. 3 / Hotel Aryaduta"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Shirt className="w-3.5 h-3.5 text-slate-400" />
                    Pakaian / Dress Code
                  </span>
                </label>
                <input
                  type="text"
                  value={dressCode}
                  onChange={(e) => setDressCode(e.target.value)}
                  placeholder="Contoh: Batik Lengan Panjang, PDH Khaki, PSH, Sipil Rapi"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                    Tautan Pertemuan Virtual (Zoom / GMeet)
                  </span>
                </label>
                <input
                  type="url"
                  value={virtualMeetingUrl}
                  onChange={(e) => setVirtualMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/... atau https://zoom.us/..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Agenda
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AgendaStatus)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Automatic Reminder Settings */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>Fitur Pengingat Otomatis (Automatic Reminder)</span>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Aktifkan Notifikasi Pengingat</h4>
                  <p className="text-xs text-slate-600">
                    Sistem akan memicu alarm suara dan notifikasi desktop browser sebelum acara dimulai
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {reminderEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Waktu Pemberitahuan:
                    </label>
                    <select
                      value={reminderMinutes}
                      onChange={(e) => setReminderMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {REMINDER_OPTIONS.map((opt) => (
                        <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="soundToggle"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <label htmlFor="soundToggle" className="text-xs text-slate-700 select-none">
                      Bunyikan alarm lonceng eksekutif (Harmonic Chime)
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Document Uploads (PDF & Images) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Dokumen Pendukung (PDF atau Gambar)</span>
              </div>
              <span className="text-xs bg-purple-50 text-purple-700 font-medium px-2 py-0.5 rounded-full border border-purple-200">
                {documents.length} Berkas Terlampir
              </span>
            </div>

            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="p-3 bg-white rounded-full shadow-sm text-blue-600 group-hover:scale-110 group-hover:text-blue-700 transition mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {isUploading ? 'Sedang memproses dokumen...' : 'Klik atau Tarik Berkas Dokumen ke Sini'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Mendukung format <span className="font-semibold text-slate-700">PDF</span> (Surat undangan, disposisi, rundown) dan <span className="font-semibold text-slate-700">Gambar</span> (PNG, JPG, WEBP, SVG).
              </p>
            </div>

            {/* Attached Documents List */}
            {documents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {documents.map((doc) => {
                  const isPdf = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
                  const isImg = doc.type.startsWith('image/');
                  const sizeInKb = (doc.size / 1024).toFixed(0);

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {isImg && doc.dataUrl ? (
                          <img
                            src={doc.dataUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                            {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isPdf ? 'Dokumen PDF' : 'Gambar Lampiran'} • {sizeInKb} KB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                        title="Hapus Berkas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 6: Notes / Initial Minutes */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Catatan Khusus Pimpinan / Pokok Bahasan
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Tambahkan catatan khusus, pointers pembahasan, atau instruksi pimpinan..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {agendaToEdit ? 'Simpan Perubahan' : 'Jadwalkan Agenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
