import React, { useState, useRef, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Calendar, Clock, MapPin, User, FileText,
  Image as ImageIcon, Upload, Trash2, Edit2, CheckCircle2, AlertTriangle,
  Share2, Paperclip, ExternalLink, Download, X, ClipboardCheck, Link2, Loader2
} from 'lucide-react';
import {
  AgendaItem, DailyJournalEntry, DocumentAttachment, JournalOutcome
} from '../types/agenda';
import { formatDateIndo } from '../utils/calendarSync';

interface DailyJournalViewProps {
  journals: DailyJournalEntry[];
  monthAgendas: AgendaItem[];
  selectedMonthName: string;
  selectedYear: number;
  selectedMonth: number;
  onSaveJournal: (entry: DailyJournalEntry) => void;
  onDeleteJournal: (id: string) => void;
  onPreviewDocument: (doc: DocumentAttachment) => void;
  onDownloadDocumentPdf: (doc: DocumentAttachment, context?: { title?: string; subtitle?: string; date?: string }) => Promise<void>;
  onDownloadJournalPdf: (entry: DailyJournalEntry) => Promise<void>;
}

const OUTCOMES: JournalOutcome[] = [
  'Lancar & Kondusif',
  'Perlu Tindak Lanjut',
  'Ada Kendala',
  'Selesai Dilaporkan'
];

function getOutcomeStyle(outcome: JournalOutcome) {
  switch (outcome) {
    case 'Lancar & Kondusif':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Perlu Tindak Lanjut':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    case 'Ada Kendala':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Selesai Dilaporkan':
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function generateJournalWhatsAppUrl(entry: DailyJournalEntry): string {
  let msg = `*JURNAL HARIAN KEGIATAN — SUBAG TU PIM & PROTOKOL DITJENPAS*\n\n`;
  msg += `🗓 *Hari/Tanggal:* ${formatDateIndo(entry.date)}\n`;
  msg += `⏰ *Waktu Catat:* ${entry.time} WIB\n`;
  msg += `📌 *Kegiatan:* ${entry.title}\n`;
  msg += `👤 *Pimpinan:* ${entry.leaderName}\n`;
  msg += `📍 *Lokasi:* ${entry.location}\n`;
  msg += `✅ *Status Lapangan:* ${entry.outcome}\n\n`;
  msg += `📝 *Uraian Pelaksanaan:*\n${entry.summary}\n`;
  if (entry.followUp) {
    msg += `\n🎯 *Arahan / Tindak Lanjut:*\n${entry.followUp}\n`;
  }
  msg += `\n✍️ *Pelapor:* ${entry.reporterName} (${entry.reporterRole})`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export const DailyJournalView: React.FC<DailyJournalViewProps> = ({
  journals,
  monthAgendas,
  selectedMonthName,
  selectedYear,
  selectedMonth,
  onSaveJournal,
  onDeleteJournal,
  onPreviewDocument,
  onDownloadDocumentPdf,
  onDownloadJournalPdf
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [downloadingJournalId, setDownloadingJournalId] = useState<string | null>(null);

  const handleDownloadAttachmentPdf = async (doc: DocumentAttachment, entry?: DailyJournalEntry) => {
    setDownloadingDocId(doc.id);
    try {
      await onDownloadDocumentPdf(doc, {
        title: entry?.title || title || 'Dokumentasi Jurnal Harian',
        subtitle: entry ? `Pelapor: ${entry.reporterName}` : undefined,
        date: entry?.date || date
      });
    } finally {
      setDownloadingDocId((curr) => (curr === doc.id ? null : curr));
    }
  };

  const handleDownloadFullJournalPdf = async (entry: DailyJournalEntry) => {
    setDownloadingJournalId(entry.id);
    try {
      await onDownloadJournalPdf(entry);
    } finally {
      setDownloadingJournalId((curr) => (curr === entry.id ? null : curr));
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyJournalEntry | null>(null);
  const [formError, setFormError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const defaultDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(
    Math.min(new Date().getDate(), new Date(selectedYear, selectedMonth + 1, 0).getDate())
  ).padStart(2, '0')}`;

  const [date, setDate] = useState(defaultDateStr);
  const [time, setTime] = useState('16:00');
  const [relatedAgendaId, setRelatedAgendaId] = useState('');
  const [title, setTitle] = useState('');
  const [leaderName, setLeaderName] = useState('Dr. H. Ahmad Fauzi, M.Si');
  const [location, setLocation] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterRole, setReporterRole] = useState('Petugas Protokol & Notulis');
  const [summary, setSummary] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [outcome, setOutcome] = useState<JournalOutcome>('Lancar & Kondusif');
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);

  const openNewModal = (prefillAgenda?: AgendaItem) => {
    setEditingEntry(null);
    setFormError('');
    setUploadError('');
    if (prefillAgenda) {
      setDate(prefillAgenda.date);
      setTime(prefillAgenda.endTime || '16:00');
      setRelatedAgendaId(prefillAgenda.id);
      setTitle(`Laporan Pelaksanaan: ${prefillAgenda.title}`);
      setLeaderName(prefillAgenda.leaderName);
      setLocation(prefillAgenda.location);
      setReporterName('');
      setReporterRole('Petugas Protokol & Notulis');
      setSummary('');
      setFollowUp('');
      setOutcome('Lancar & Kondusif');
      setDocuments([]);
    } else {
      setDate(defaultDateStr);
      setTime(new Date().toTimeString().slice(0, 5));
      setRelatedAgendaId('');
      setTitle('');
      setLeaderName('Dr. H. Ahmad Fauzi, M.Si');
      setLocation('Ruang Rapat Graha Pimpinan');
      setReporterName('');
      setReporterRole('Petugas Protokol & Notulis');
      setSummary('');
      setFollowUp('');
      setOutcome('Lancar & Kondusif');
      setDocuments([]);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (entry: DailyJournalEntry) => {
    setEditingEntry(entry);
    setFormError('');
    setUploadError('');
    setDate(entry.date);
    setTime(entry.time);
    setRelatedAgendaId(entry.relatedAgendaId || '');
    setTitle(entry.title);
    setLeaderName(entry.leaderName);
    setLocation(entry.location);
    setReporterName(entry.reporterName);
    setReporterRole(entry.reporterRole);
    setSummary(entry.summary);
    setFollowUp(entry.followUp || '');
    setOutcome(entry.outcome);
    setDocuments(entry.documents || []);
    setIsModalOpen(true);
  };

  const handleSelectRelatedAgenda = (agendaId: string) => {
    setRelatedAgendaId(agendaId);
    const matched = monthAgendas.find((a) => a.id === agendaId);
    if (matched) {
      setDate(matched.date);
      setTime(matched.endTime || matched.startTime);
      setLeaderName(matched.leaderName);
      setLocation(matched.location);
      if (!title.trim()) {
        setTitle(`Laporan Pelaksanaan: ${matched.title}`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError('');
    setIsUploading(true);
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const newDocs: DocumentAttachment[] = [];
    let processed = 0;

    Array.from(files).forEach((file) => {
      const isValid = allowedTypes.includes(file.type) || /\.(pdf|png|jpe?g|webp|svg)$/i.test(file.name);
      if (!isValid) {
        setUploadError(`Berkas "${file.name}" tidak didukung. Gunakan format PDF atau gambar.`);
        processed++;
        if (processed === files.length) setIsUploading(false);
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setUploadError(`Berkas "${file.name}" melebihi batas 25 MB.`);
        processed++;
        if (processed === files.length) setIsUploading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const inferredType =
          file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');
        let dataUrl = reader.result as string;
        if (dataUrl.startsWith('data:application/octet-stream;') || dataUrl.startsWith('data:;')) {
          dataUrl = dataUrl.replace(/^data:[^;]*;/, `data:${inferredType};`);
        }
        newDocs.push({
          id: `jdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          type: inferredType,
          dataUrl,
          uploadedAt: new Date().toISOString()
        });
        processed++;
        if (processed === files.length) {
          setDocuments((prev) => [...prev, ...newDocs]);
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        processed++;
        if (processed === files.length) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !reporterName.trim()) {
      setFormError('Judul kegiatan, nama petugas pelapor, dan uraian pelaksanaan wajib diisi.');
      return;
    }

    const linkedAgenda = monthAgendas.find((a) => a.id === relatedAgendaId);

    const entry: DailyJournalEntry = {
      id: editingEntry?.id || `journal-${Date.now()}`,
      date,
      time,
      title: title.trim(),
      relatedAgendaId: relatedAgendaId || undefined,
      relatedAgendaTitle: linkedAgenda?.title || editingEntry?.relatedAgendaTitle,
      leaderName: leaderName.trim() || 'Pimpinan',
      location: location.trim() || '-',
      reporterName: reporterName.trim(),
      reporterRole: reporterRole.trim() || 'Petugas Protokol',
      summary: summary.trim(),
      followUp: followUp.trim() || undefined,
      outcome,
      documents,
      createdAt: editingEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveJournal(entry);
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  // Filtered & sorted journals
  const filteredJournals = useMemo(() => {
    return journals
      .filter((item) => {
        if (selectedDateFilter && item.date !== selectedDateFilter) return false;
        if (selectedOutcome && item.outcome !== selectedOutcome) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const match =
            item.title.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q) ||
            (item.followUp?.toLowerCase().includes(q) ?? false) ||
            item.reporterName.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q) ||
            item.leaderName.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [journals, searchQuery, selectedOutcome, selectedDateFilter]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, DailyJournalEntry[]>();
    filteredJournals.forEach((j) => {
      const arr = map.get(j.date) || [];
      arr.push(j);
      map.set(j.date, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredJournals]);

  // Agendas in this month that do not yet have a journal entry
  const unloggedAgendas = useMemo(() => {
    const loggedIds = new Set(journals.map((j) => j.relatedAgendaId).filter(Boolean));
    return monthAgendas
      .filter((a) => !loggedIds.has(a.id) && a.status !== 'Dibatalkan')
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      .slice(0, 4);
  }, [monthAgendas, journals]);

  const stats = useMemo(() => ({
    total: journals.length,
    lancar: journals.filter((j) => j.outcome === 'Lancar & Kondusif' || j.outcome === 'Selesai Dilaporkan').length,
    tindakLanjut: journals.filter((j) => j.outcome === 'Perlu Tindak Lanjut').length,
    kendala: journals.filter((j) => j.outcome === 'Ada Kendala').length
  }), [journals]);

  return (
    <div className="space-y-6">
      {/* Header Summary Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-200 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Jurnal Harian Kegiatan Pimpinan
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Catatan pelaksanaan harian, laporan lapangan protokol, arahan pimpinan & dokumentasi {selectedMonthName} {selectedYear}
              </p>
            </div>
          </div>

          <button
            onClick={() => openNewModal()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Jurnal Harian</span>
          </button>
        </div>

        {/* Mini KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Catatan</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.total}</p>
          </div>
          <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Lancar / Terlapor</p>
            <p className="text-xl font-extrabold text-emerald-800 mt-0.5">{stats.lancar}</p>
          </div>
          <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Perlu Tindak Lanjut</p>
            <p className="text-xl font-extrabold text-amber-800 mt-0.5">{stats.tindakLanjut}</p>
          </div>
          <div className="bg-red-50/70 rounded-xl p-3 border border-red-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Catatan Kendala</p>
            <p className="text-xl font-extrabold text-red-800 mt-0.5">{stats.kendala}</p>
          </div>
        </div>
      </div>

      {/* Quick Create from Unlogged Agendas */}
      {unloggedAgendas.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-slate-50 rounded-2xl border border-indigo-200/70 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3">
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            <span>Buat Cepat Jurnal dari Agenda Bulan Ini</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {unloggedAgendas.map((ag) => (
              <button
                key={ag.id}
                onClick={() => openNewModal(ag)}
                className="text-left p-3 bg-white hover:bg-indigo-50/50 rounded-xl border border-indigo-100 hover:border-indigo-300 shadow-2xs transition group"
              >
                <div className="flex items-center justify-between text-[11px] text-indigo-600 font-semibold mb-1">
                  <span>{ag.date}</span>
                  <span>{ag.startTime} WIB</span>
                </div>
                <p className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-indigo-700">
                  {ag.title}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-semibold mt-2">
                  <Plus className="w-3 h-3" /> Catat Jurnal
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari isi jurnal, nama pelapor, arahan pimpinan, lokasi..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Filter per tanggal"
          />

          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Status Laporan</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          {(searchQuery || selectedOutcome || selectedDateFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedOutcome('');
                setSelectedDateFilter('');
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition"
            >
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Journal Timeline List */}
      {groupedByDate.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum Ada Catatan Jurnal Harian</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto mb-5">
            Catat perkembangan pelaksanaan kegiatan pimpinan, hasil lapangan, serta arahan tindak lanjut harian di sini.
          </p>
          <button
            onClick={() => openNewModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Catatan Pertama</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([dateStr, items]) => (
            <div key={dateStr} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-xl text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  {formatDateIndo(dateStr)}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {items.length} catatan jurnal
                </span>
                <div className="flex-1 border-b border-slate-200"></div>
              </div>

              <div className="space-y-4">
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-3 flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            {entry.time} WIB
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getOutcomeStyle(entry.outcome)}`}>
                            {entry.outcome}
                          </span>
                          {entry.relatedAgendaTitle && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 max-w-xs truncate">
                              <Link2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">Agenda: {entry.relatedAgendaTitle}</span>
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-base font-bold text-slate-900">{entry.title}</h4>

                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <strong className="text-slate-800">Pimpinan:</strong> {entry.leaderName}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            <strong className="text-slate-800">Lokasi:</strong> {entry.location}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <strong className="text-slate-800">Pelapor:</strong> {entry.reporterName} ({entry.reporterRole})
                          </span>
                        </div>

                        {/* Summary */}
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {entry.summary}
                        </div>

                        {/* Follow-up directive */}
                        {entry.followUp && (
                          <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/80 text-xs sm:text-sm text-amber-950">
                            <span className="font-bold text-amber-900 block mb-0.5">
                              Arahan Pimpinan / Tindak Lanjut:
                            </span>
                            {entry.followUp}
                          </div>
                        )}

                        {/* Attached Documentation (Photos & Report Documents with Download PDF) */}
                        {entry.documents && entry.documents.length > 0 && (
                          <div className="pt-1 space-y-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                              Bukti Foto &amp; Dokumen Laporan ({entry.documents.length} berkas):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {entry.documents.map((doc) => {
                                const isPdf =
                                  doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
                                const isImg =
                                  doc.type.startsWith('image/') ||
                                  /\.(png|jpe?g|webp|svg|gif)$/i.test(doc.name);
                                const sizeInKb = Math.max(1, Math.round(doc.size / 1024));
                                const isBusy = downloadingDocId === doc.id;

                                return (
                                  <div
                                    key={doc.id}
                                    className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2 p-1.5 pr-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-2xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {isImg && doc.dataUrl ? (
                                        <img
                                          src={doc.dataUrl}
                                          alt=""
                                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div
                                          className={`p-1.5 rounded-lg shrink-0 ${
                                            isPdf ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                                          }`}
                                        >
                                          {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                        </div>
                                      )}

                                      <div className="text-left min-w-0">
                                        <p
                                          className="text-xs font-semibold text-slate-800 truncate max-w-[150px] sm:max-w-[190px]"
                                          title={doc.name}
                                        >
                                          {doc.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {isPdf ? 'Dokumen PDF' : 'Bukti Foto'} • {sizeInKb} KB
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => onPreviewDocument(doc)}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-white transition"
                                        title="Pratinjau Berkas"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => {
                                          void handleDownloadAttachmentPdf(doc, entry);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[11px] font-semibold shadow-2xs transition whitespace-nowrap"
                                        title={
                                          isPdf
                                            ? 'Download Dokumen PDF'
                                            : 'Konversi Bukti Foto & Download sebagai PDF'
                                        }
                                      >
                                        {isBusy ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Download className="w-3 h-3" />
                                        )}
                                        <span>{isBusy ? 'Mengunduh...' : 'Download PDF'}</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Actions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col items-stretch gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-4 lg:w-[155px]">
                        <button
                          type="button"
                          disabled={downloadingJournalId === entry.id}
                          onClick={() => {
                            void handleDownloadFullJournalPdf(entry);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs transition whitespace-nowrap"
                          title="Unduh Laporan Jurnal Harian beserta Bukti Foto dalam format PDF"
                        >
                          {downloadingJournalId === entry.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{downloadingJournalId === entry.id ? 'Menyusun...' : 'Download PDF'}</span>
                        </button>

                        <a
                          href={generateJournalWhatsAppUrl(entry)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition whitespace-nowrap"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Lapor WA</span>
                        </a>

                        <button
                          onClick={() => openEditModal(entry)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition whitespace-nowrap"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Ubah</span>
                        </button>

                        {confirmDeleteId === entry.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                onDeleteJournal(entry.id);
                                setConfirmDeleteId(null);
                              }}
                              className="flex-1 px-2.5 py-2 bg-red-600 text-white rounded-lg text-[11px] font-bold hover:bg-red-700 transition"
                            >
                              Hapus
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex-1 px-2 py-2 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-medium hover:bg-slate-200 transition"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(entry.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl text-xs font-medium transition whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Journal Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">
                    {editingEntry ? 'Ubah Catatan Jurnal Harian' : 'Tambah Jurnal Harian Kegiatan'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Dokumentasikan pelaksanaan lapangan, arahan pimpinan, dan berkas pendukung
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 max-h-[78vh] overflow-y-auto space-y-5">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Link to existing agenda */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tautkan ke Agenda Terjadwal (Opsional)
                </label>
                <select
                  value={relatedAgendaId}
                  onChange={(e) => handleSelectRelatedAgenda(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Kegiatan Harian Mandiri / Tidak Terkait Agenda --</option>
                  {monthAgendas.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.date} • {a.startTime}] {a.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date, Time & Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Waktu (WIB) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kondisi / Status
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as JournalOutcome)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {OUTCOMES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Judul / Pokok Kegiatan Harian <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setFormError(''); }}
                  placeholder="Contoh: Laporan Pendampingan Kunjungan Kerja Pimpinan"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Leader & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pimpinan yang Dihadiri / Didampingi
                  </label>
                  <input
                    type="text"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="Nama Pimpinan"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Lokasi Pelaksanaan
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Tempat kegiatan"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Reporter Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Petugas Pelapor / Notulis <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => { setReporterName(e.target.value); setFormError(''); }}
                    placeholder="Contoh: Raka Pratama, S.STP"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jabatan / Tugas Petugas
                  </label>
                  <input
                    type="text"
                    value={reporterRole}
                    onChange={(e) => setReporterRole(e.target.value)}
                    placeholder="Contoh: Petugas Protokol & Notulis"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Uraian Pelaksanaan Kegiatan Harian <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => { setSummary(e.target.value); setFormError(''); }}
                  rows={4}
                  placeholder="Tuliskan jalannya acara, pejabat yang hadir, situasi lapangan, dan hasil kegiatan..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Follow Up */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Arahan Pimpinan / Rencana Tindak Lanjut (Opsional)
                </label>
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  rows={2}
                  placeholder="Catat disposisi, tenggat waktu tindak lanjut, atau OPD yang ditugaskan..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Document Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lampiran Dokumentasi Foto / Berita Acara (PDF atau Gambar)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/30 rounded-xl p-4 text-center cursor-pointer transition"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Upload className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700">
                    {isUploading ? 'Memproses berkas...' : 'Klik untuk unggah foto dokumentasi atau PDF notula'}
                  </p>
                </div>

                {uploadError && (
                  <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>
                )}

                {documents.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
                    {documents.map((doc) => {
                      const isPdf = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
                      const isBusy = downloadingDocId === doc.id;
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isPdf ? (
                              <FileText className="w-4 h-4 text-red-500 shrink-0" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                            )}
                            <span className="text-xs font-medium text-slate-800 truncate">{doc.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                void handleDownloadAttachmentPdf(doc, editingEntry || undefined);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-semibold transition"
                              title="Download sebagai PDF"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocuments((prev) => prev.filter((d) => d.id !== doc.id))}
                              className="p-1 text-slate-400 hover:text-red-600"
                              title="Hapus Lampiran"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingEntry ? 'Simpan Perubahan' : 'Simpan Jurnal Harian'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
