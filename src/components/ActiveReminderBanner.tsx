import React from 'react';
import { BellRing, Clock, MapPin, X, Calendar, Volume2, User } from 'lucide-react';
import { ActiveAlert } from '../utils/notifications';
import { generateGoogleCalendarUrl } from '../utils/calendarSync';
import { playExecutiveChime } from '../utils/audioAlarm';

interface ActiveReminderBannerProps {
  alerts: ActiveAlert[];
  onDismiss: (agendaId: string) => void;
  onSnooze: (agendaId: string, minutes: number) => void;
  onOpenAgenda: (agendaId: string) => void;
}

export const ActiveReminderBanner: React.FC<ActiveReminderBannerProps> = ({
  alerts,
  onDismiss,
  onSnooze,
  onOpenAgenda
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full px-3 sm:px-0 animate-in slide-in-from-top-4 duration-300">
      {alerts.slice(0, 3).map(({ agenda, remainingMinutes, isHappeningNow }) => {
        const googleCalUrl = generateGoogleCalendarUrl(agenda);

        return (
          <div
            key={agenda.id}
            className={`rounded-2xl p-4 shadow-2xl border backdrop-blur-md transition-all ${
              isHappeningNow
                ? 'bg-red-950/95 text-white border-red-700/60 shadow-red-950/50'
                : 'bg-slate-900/95 text-white border-amber-500/60 shadow-amber-950/40 ring-2 ring-amber-500/40'
            }`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl flex items-center justify-center animate-pulse ${
                  isHappeningNow ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950 font-bold'
                }`}>
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isHappeningNow ? 'bg-red-800 text-red-200' : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  }`}>
                    {isHappeningNow ? 'SEDANG BERLANGSUNG' : `PENGINGAT: ${remainingMinutes} MENIT LAGI`}
                  </span>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{agenda.startTime} - {agenda.endTime} WIB</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => playExecutiveChime()}
                  className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-white/10 transition"
                  title="Bunyikan Suara Ulang"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDismiss(agenda.id)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                  title="Tutup Pengingat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Agenda Title */}
            <h4 className="font-bold text-sm sm:text-base text-slate-100 mt-2.5 line-clamp-2">
              {agenda.title}
            </h4>

            {/* Leader & Location */}
            <div className="text-xs text-slate-300 space-y-1 mt-1.5">
              <div className="flex items-center gap-1.5 text-slate-300">
                <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{agenda.leader}: {agenda.leaderName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{agenda.location}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onSnooze(agenda.id, 5)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition"
                >
                  Tunda 5 mnt
                </button>
                <button
                  onClick={() => onSnooze(agenda.id, 15)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg transition"
                >
                  Tunda 15 mnt
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg transition text-[11px] flex items-center gap-1"
                  title="Buka Kalender"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kalender</span>
                </a>
                <button
                  onClick={() => {
                    onOpenAgenda(agenda.id);
                    onDismiss(agenda.id);
                  }}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition shadow-sm"
                >
                  Buka Detail
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
