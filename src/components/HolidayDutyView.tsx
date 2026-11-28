import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, Plus, Calendar, Phone, MapPin, Users, Clock,
  Edit2, Trash2, Share2, X, CheckCircle2, AlertTriangle, Sparkles, UserPlus
} from 'lucide-react';
import {
  DutyShift, HolidayDutyEntry, HolidayType, ProtocolOfficer
} from '../types/agenda';
import { formatDateIndo } from '../utils/calendarSync';
import { getLocalDateIso } from '../utils/firestoreSync';

interface HolidayDutyViewProps {
  duties: HolidayDutyEntry[];
  selectedMonth: number;
  selectedYear: number;
  selectedMonthName: string;
  onSaveDuty: (duty: HolidayDutyEntry) => void;
  onDeleteDuty: (id: string) => void;
  onBatchAddDuties: (newDuties: HolidayDutyEntry[]) => void;
}

const HOLIDAY_TYPES: HolidayType[] = [
  'Akhir Pekan (Sabtu/Minggu)',
  'Libur Nasional',
  'Cuti Bersama',
  'Hari Besar Keagamaan'
];

const SHIFTS: DutyShift[] = [
  'Standby Penuh (24 Jam)',
  'Shift Pagi (07:30 - 14:00)',
  'Shift Siang/Sore (14:00 - 20:00)'
];

const OFFICER_ROLES = [
  'Petugas Protokol',
  'Ajudan / Walpri',
  'Dokumentasi & Humas',
  'Driver VIP',
  'Staf Tata Usaha Pimpinan',
  'Pengamanan Dalam (Pamdal)'
];

function getDayTypeBadgeStyle(type: HolidayType) {
  switch (type) {
    case 'Libur Nasional':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Hari Besar Keagamaan':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Cuti Bersama':
      return 'bg-amber-50 text-amber-800 border-amber-300';
    default:
      return 'bg-teal-50 text-teal-800 border-teal-200';
  }
}

function generateDutyWhatsAppUrl(duty: HolidayDutyEntry): string {
  let msg = `*JADWAL PIKET HARI LIBUR — SUBAG TU PIM & PROTOKOL DITJENPAS*\n\n`;
  msg += `🗓 *Hari/Tanggal:* ${formatDateIndo(duty.date)}\n`;
  msg += `🏷 *Keterangan:* ${duty.holidayName} (${duty.dayType})\n`;
  msg += `⏰ *Shift Piket:* ${duty.shift}\n`;
  msg += `📍 *Lokasi Standby:* ${duty.standbyLocation}\n`;
  msg += `⭐ *Koordinator Piket:* ${duty.coordinatorName}${duty.coordinatorPhone ? ` (${duty.coordinatorPhone})` : ''}\n\n`;
  msg += `👥 *Daftar Petugas Piket:*\n`;
  duty.officers.forEach((off, idx) => {
    msg += `${idx + 1}. ${off.name} — ${off.role}${off.phone ? ` (${off.phone})` : ''}\n`;
  });
  if (duty.notes) {
    msg += `\n📝 *Catatan:* ${duty.notes}\n`;
  }
  msg += `\n_Mohon seluruh petugas menjaga kesiapsiagaan komunikasi (HP aktif 24 jam)._`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export const HolidayDutyView: React.FC<HolidayDutyViewProps> = ({
  duties,
  selectedMonth,
  selectedYear,
  selectedMonthName,
  onSaveDuty,
  onDeleteDuty,
  onBatchAddDuties
}) => {
  const [filterType, setFilterType] = useState<string>('');
  const [searchOfficer, setSearchOfficer] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string>('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDuty, setEditingDuty] = useState<HolidayDutyEntry | null>(null);
  const [formError, setFormError] = useState('');

  // Form fields
  const [date, setDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [dayType, setDayType] = useState<HolidayType>('Akhir Pekan (Sabtu/Minggu)');
  const [shift, setShift] = useState<DutyShift>('Standby Penuh (24 Jam)');
  const [coordinatorName, setCoordinatorName] = useState('M. Ridwan Prasetyo, S.STP., M.AP');
  const [coordinatorPhone, setCoordinatorPhone] = useState('0812-3456-7801');
  const [standbyLocation, setStandbyLocation] = useState('Posko Protokol Graha Pimpinan & On-Call');
  const [notes, setNotes] = useState('');
  const [officers, setOfficers] = useState<ProtocolOfficer[]>([
    { id: 'init-1', name: '', role: 'Petugas Protokol', phone: '' }
  ]);

  const todayStr = getLocalDateIso();

  const openNewModal = (prefillDate?: string) => {
    const defaultDate =
      prefillDate ||
      `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    setEditingDuty(null);
    setFormError('');
    setDate(defaultDate);
    setHolidayName('Piket Hari Libur');
    setDayType('Libur Nasional');
    setShift('Standby Penuh (24 Jam)');
    setCoordinatorName('M. Ridwan Prasetyo, S.STP., M.AP');
    setCoordinatorPhone('0812-3456-7801');
    setStandbyLocation('Posko Protokol Graha Pimpinan & On-Call');
    setNotes('');
    setOfficers([
      { id: `off-${Date.now()}-1`, name: '', role: 'Petugas Protokol', phone: '' },
      { id: `off-${Date.now()}-2`, name: '', role: 'Dokumentasi & Humas', phone: '' }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (duty: HolidayDutyEntry) => {
    setEditingDuty(duty);
    setFormError('');
    setDate(duty.date);
    setHolidayName(duty.holidayName);
    setDayType(duty.dayType);
    setShift(duty.shift);
    setCoordinatorName(duty.coordinatorName);
    setCoordinatorPhone(duty.coordinatorPhone || '');
    setStandbyLocation(duty.standbyLocation);
    setNotes(duty.notes || '');
    setOfficers(
      duty.officers.length > 0
        ? duty.officers.map((o) => ({ ...o }))
        : [{ id: `off-${Date.now()}`, name: '', role: 'Petugas Protokol', phone: '' }]
    );
    setIsModalOpen(true);
  };

  const handleAddOfficerRow = () => {
    setOfficers((prev) => [
      ...prev,
      { id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '', role: 'Petugas Protokol', phone: '' }
    ]);
  };

  const handleOfficerChange = (id: string, field: keyof ProtocolOfficer, value: string) => {
    setOfficers((prev) =>
      prev.map((off) => (off.id === id ? { ...off, [field]: value } : off))
    );
  };

  const handleRemoveOfficerRow = (id: string) => {
    setOfficers((prev) => (prev.length > 1 ? prev.filter((off) => off.id !== id) : prev));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOfficers = officers
      .map((o) => ({ ...o, name: o.name.trim(), phone: o.phone.trim() }))
      .filter((o) => o.name.length > 0);

    if (!date || !holidayName.trim() || !coordinatorName.trim()) {
      setFormError('Tanggal, keterangan hari libur, dan nama koordinator piket wajib diisi.');
      return;
    }
    if (validOfficers.length === 0) {
      setFormError('Minimal masukkan 1 nama petugas protokol yang bertugas piket.');
      return;
    }

    const entry: HolidayDutyEntry = {
      id: editingDuty?.id || `duty-${date}-${Date.now()}`,
      date,
      holidayName: holidayName.trim(),
      dayType,
      shift,
      coordinatorName: coordinatorName.trim(),
      coordinatorPhone: coordinatorPhone.trim() || undefined,
      officers: validOfficers,
      standbyLocation: standbyLocation.trim() || 'Posko Protokol & On-Call',
      notes: notes.trim() || undefined,
      createdAt: editingDuty?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveDuty(entry);
    setIsModalOpen(false);
    setEditingDuty(null);
  };

  // Generate remaining weekend slots in the selected month automatically
  const handleAutoGenerateWeekends = () => {
    const existingDates = new Set(duties.map((d) => d.date));
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const generated: HolidayDutyEntry[] = [];

    const rotationPool: { coordinator: string; coordPhone: string; officers: Omit<ProtocolOfficer, 'id'>[] }[] = [
      {
        coordinator: 'M. Ridwan Prasetyo, S.STP., M.AP',
        coordPhone: '0812-3456-7801',
        officers: [
          { name: 'Raka Pratama, S.STP', role: 'Petugas Protokol', phone: '0813-2201-4411' },
          { name: 'Dina Kartika, S.I.Kom', role: 'Dokumentasi & Humas', phone: '0856-4110-7788' }
        ]
      },
      {
        coordinator: 'Hendra Wijaya, S.Sos',
        coordPhone: '0812-3456-7802',
        officers: [
          { name: 'Sinta Wulandari, S.IP', role: 'Petugas Protokol', phone: '0813-9087-2314' },
          { name: 'Bambang Triyono', role: 'Driver VIP', phone: '0815-6721-9045' }
        ]
      },
      {
        coordinator: 'M. Ridwan Prasetyo, S.STP., M.AP',
        coordPhone: '0812-3456-7801',
        officers: [
          { name: 'Bagus Setiawan, S.AP', role: 'Petugas Protokol', phone: '0813-4421-9908' },
          { name: 'Arief Nugroho', role: 'Ajudan / Walpri', phone: '0812-8890-1122' }
        ]
      }
    ];

    let rotIndex = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = dt.getDay(); // 0 = Sun, 6 = Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!existingDates.has(dateStr)) {
          const team = rotationPool[rotIndex % rotationPool.length];
          rotIndex++;
          generated.push({
            id: `duty-${dateStr}-${Date.now()}-${rotIndex}`,
            date: dateStr,
            holidayName: dayOfWeek === 6 ? 'Piket Akhir Pekan (Sabtu)' : 'Piket Akhir Pekan (Minggu)',
            dayType: 'Akhir Pekan (Sabtu/Minggu)',
            shift: 'Standby Penuh (24 Jam)',
            coordinatorName: team.coordinator,
            coordinatorPhone: team.coordPhone,
            officers: team.officers.map((o, idx) => ({
              ...o,
              id: `gen-${dateStr}-${idx}`
            })),
            standbyLocation: 'Posko Protokol Graha Pimpinan & On-Call',
            notes: 'Jadwal piket akhir pekan terotomatisasi. Silakan sesuaikan nama petugas jika ada pergantian.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    if (generated.length === 0) {
      setFeedbackBanner(`Seluruh hari Sabtu & Minggu di bulan ${selectedMonthName} ${selectedYear} sudah memiliki jadwal petugas piket.`);
    } else {
      onBatchAddDuties(generated);
      setFeedbackBanner(`Berhasil menambahkan ${generated.length} jadwal piket akhir pekan untuk ${selectedMonthName} ${selectedYear}.`);
    }
    setTimeout(() => setFeedbackBanner(''), 5000);
  };

  // Filtered & sorted duties
  const filteredDuties = useMemo(() => {
    return duties
      .filter((d) => {
        if (filterType && d.dayType !== filterType) return false;
        if (searchOfficer) {
          const q = searchOfficer.toLowerCase();
          const inCoord = d.coordinatorName.toLowerCase().includes(q);
          const inHoliday = d.holidayName.toLowerCase().includes(q);
          const inOff = d.officers.some(
            (o) => o.name.toLowerCase().includes(q) || o.role.toLowerCase().includes(q)
          );
          if (!inCoord && !inHoliday && !inOff) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [duties, filterType, searchOfficer]);

  // Unique officer count this month
  const uniqueOfficerNames = useMemo(() => {
    const set = new Set<string>();
    duties.forEach((d) => {
      set.add(d.coordinatorName);
      d.officers.forEach((o) => set.add(o.name));
    });
    return set.size;
  }, [duties]);

  // Highlight duty for today if today is a holiday with a duty entry
  const todayDuty = useMemo(() => duties.find((d) => d.date === todayStr), [duties, todayStr]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-200 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Petugas Protokol Piket Hari Libur
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Daftar koordinator & personel protokol siaga pada hari Sabtu, Minggu, dan Hari Libur Nasional — {selectedMonthName} {selectedYear}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleAutoGenerateWeekends}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold transition"
              title="Isi otomatis seluruh tanggal Sabtu & Minggu yang belum terjadwal di bulan ini"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Isi Otomatis Akhir Pekan</span>
            </button>

            <button
              onClick={() => openNewModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Jadwal Piket</span>
            </button>
          </div>
        </div>

        {feedbackBanner && (
          <div className="mt-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-medium flex items-center justify-between">
            <span>{feedbackBanner}</span>
            <button onClick={() => setFeedbackBanner('')} className="text-teal-600 hover:text-teal-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Hari Piket</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{duties.length} hari</p>
          </div>
          <div className="bg-teal-50/70 rounded-xl p-3 border border-teal-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Personel Terjadwal</p>
            <p className="text-xl font-extrabold text-teal-900 mt-0.5">{uniqueOfficerNames} petugas</p>
          </div>
          <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200/70 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Libur Nasional / Cuti</p>
            <p className="text-xl font-extrabold text-amber-900 mt-0.5">
              {duties.filter((d) => d.dayType !== 'Akhir Pekan (Sabtu/Minggu)').length} hari
            </p>
          </div>
        </div>
      </div>

      {/* Active Today Duty Highlight Card */}
      {todayDuty && (
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-teal-700/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/25 text-teal-300 border border-teal-400/40">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                  SEDANG PIKET HARI INI
                </span>
                <span className="text-xs text-slate-300 font-medium">{formatDateIndo(todayDuty.date)}</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {todayDuty.holidayName} — {todayDuty.shift}
              </h3>
              <p className="text-xs text-slate-300">
                Koordinator: <strong className="text-amber-300">{todayDuty.coordinatorName}</strong> • Lokasi: {todayDuty.standbyLocation}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {todayDuty.officers.map((off) => (
                <div
                  key={off.id}
                  className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs"
                >
                  <p className="font-bold text-white">{off.name}</p>
                  <p className="text-[11px] text-teal-300">{off.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="text"
          value={searchOfficer}
          onChange={(e) => setSearchOfficer(e.target.value)}
          placeholder="Cari nama petugas protokol, koordinator, atau hari libur..."
          className="flex-1 px-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Semua Jenis Hari Libur</option>
          {HOLIDAY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Duty Roster Cards */}
      {filteredDuties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum Ada Jadwal Piket Hari Libur</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto mb-5">
            Tambahkan jadwal petugas protokol untuk hari Sabtu, Minggu, atau Libur Nasional di bulan {selectedMonthName} {selectedYear}.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleAutoGenerateWeekends}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Isi Otomatis Akhir Pekan</span>
            </button>
            <button
              onClick={() => openNewModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Manual</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDuties.map((duty) => {
            const isToday = duty.date === todayStr;
            return (
              <div
                key={duty.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between ${
                  isToday ? 'border-teal-400 ring-2 ring-teal-500/20' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-900 text-white">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          {formatDateIndo(duty.date)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${getDayTypeBadgeStyle(duty.dayType)}`}>
                          {duty.dayType}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-teal-600 text-white">
                            Hari Ini
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-base text-slate-900">{duty.holidayName}</h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(duty)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Ubah Jadwal Piket"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === duty.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onDeleteDuty(duty.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-red-600 text-white rounded-md text-[11px] font-bold"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px]"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(duty.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus Jadwal Piket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shift & Standby Location */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      {duty.shift}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      {duty.standbyLocation}
                    </span>
                  </div>

                  {/* Coordinator Box */}
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Koordinator / Perwira Piket
                      </span>
                      <p className="text-sm font-bold text-slate-900">{duty.coordinatorName}</p>
                    </div>
                    {duty.coordinatorPhone && (
                      <a
                        href={`tel:${duty.coordinatorPhone.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 transition shrink-0"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{duty.coordinatorPhone}</span>
                      </a>
                    )}
                  </div>

                  {/* Officers Table/List */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      <span>Nama Petugas Protokol Piket ({duty.officers.length} orang):</span>
                    </div>
                    <div className="space-y-1.5">
                      {duty.officers.map((off, idx) => (
                        <div
                          key={off.id}
                          className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{off.name}</p>
                              <p className="text-[11px] text-slate-500">{off.role}</p>
                            </div>
                          </div>
                          {off.phone && (
                            <a
                              href={`tel:${off.phone.replace(/[^0-9+]/g, '')}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline shrink-0 ml-2"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{off.phone}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {duty.notes && (
                    <p className="text-xs text-slate-500 italic bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-100">
                      Catatan: {duty.notes}
                    </p>
                  )}
                </div>

                {/* Footer Share Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <a
                    href={generateDutyWhatsAppUrl(duty)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Bagikan Jadwal Piket ke WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Holiday Duty Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-400/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">
                    {editingDuty ? 'Ubah Jadwal Piket Hari Libur' : 'Tambah Petugas Protokol Piket Hari Libur'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Tentukan koordinator dan nama petugas protokol yang bersiaga pada hari libur
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Libur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jenis Hari Libur
                  </label>
                  <select
                    value={dayType}
                    onChange={(e) => setDayType(e.target.value as HolidayType)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {HOLIDAY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Shift Piket
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as DutyShift)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {SHIFTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Keterangan / Nama Hari Libur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="Contoh: Piket Akhir Pekan (Sabtu) / Hari Raya"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Lokasi Standby / Posko
                  </label>
                  <input
                    type="text"
                    value={standbyLocation}
                    onChange={(e) => setStandbyLocation(e.target.value)}
                    placeholder="Posko Protokol Graha Pimpinan & On-Call"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Coordinator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70">
                <div>
                  <label className="block text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1.5">
                    Koordinator / Perwira Piket <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={coordinatorName}
                    onChange={(e) => setCoordinatorName(e.target.value)}
                    placeholder="Nama Koordinator Piket"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1.5">
                    No. HP / WhatsApp Koordinator
                  </label>
                  <input
                    type="text"
                    value={coordinatorPhone}
                    onChange={(e) => setCoordinatorPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Dynamic Officers List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Daftar Nama Petugas Protokol Piket <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOfficerRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-semibold transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tambah Petugas</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {officers.map((off, index) => (
                    <div
                      key={off.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 items-center"
                    >
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={off.name}
                          onChange={(e) => handleOfficerChange(off.id, 'name', e.target.value)}
                          placeholder={`Nama Petugas ${index + 1}`}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <select
                          value={off.role}
                          onChange={(e) => handleOfficerChange(off.id, 'role', e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {OFFICER_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={off.phone}
                          onChange={(e) => handleOfficerChange(off.id, 'phone', e.target.value)}
                          placeholder="No. HP / WA"
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveOfficerRow(off.id)}
                          disabled={officers.length === 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded-lg transition"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Catatan Khusus Piket (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Siaga pendampingan tamu mendadak atau persiapan keberangkatan pimpinan..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingDuty ? 'Simpan Perubahan' : 'Simpan Jadwal Piket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
