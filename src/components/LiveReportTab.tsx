/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AttendanceRecord } from "../types";
import { formatIndonesianDate } from "../utils/dateUtils";
import * as XLSX from "xlsx";
import { Search, Filter, Download, ListRestart, HelpCircle, CheckCircle2, Clock3, AlertTriangle, Trash2, Calendar } from "lucide-react";

interface LiveReportTabProps {
  records: AttendanceRecord[];
  onClearAllRecords?: () => void;
  onDeleteRecordsByDate?: (dateStr: string) => void;
}

export default function LiveReportTab({
  records,
  onClearAllRecords,
  onDeleteRecordsByDate,
}: LiveReportTabProps) {
  // Helper to get today's date in local YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayStr();

  // Search, class, status, and date filters (Default to today so yesterday's logs don't clutter today's live report)
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Dialog state for clearing logs safely in sandboxed iframe
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [showDeleteDateConfirm, setShowDeleteDateConfirm] = useState(false);
  const [selectedDeleteDate, setSelectedDeleteDate] = useState<string>("");

  // Extract unique dates that have attendance records
  const uniqueDates = Array.from(
    new Set(records.map((r) => r.waktuAbsensi.split(" ")[0]))
  ).sort().reverse();

  // Combine todayStr with unique dates so today is always accessible in the selector
  const allDateOptions = Array.from(new Set([todayStr, ...uniqueDates])).sort().reverse();

  // Active chosen date for delete action (defaults to currently selectedDate if valid date)
  const activeDeleteDate = uniqueDates.includes(selectedDate)
    ? selectedDate
    : (uniqueDates.includes(selectedDeleteDate) ? selectedDeleteDate : (uniqueDates[0] || ""));

  // Get distinct classes from logs list
  const classesList = Array.from(new Set(records.map((r) => r.kelas))).sort();

  // Filter logs by selected date, search term, class, and status.
  // Order must match criteria: "setiap siswa yang berhasil absen urutannya sesuaikan dengan waktu masuk. siswa yang baru absen urutannya ada diatas."
  // Which means sorted descending by waktuAbsensi.
  const filteredRecords = records
    .filter((r) => {
      const matchDate =
        selectedDate === "Semua" || r.waktuAbsensi.startsWith(selectedDate);
      const matchSearch =
        r.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.nis.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = classFilter === "Semua" || r.kelas === classFilter;
      const matchStatus =
        statusFilter === "Semua" ||
        (statusFilter === "H" && r.keterangan === "H") ||
        (statusFilter === "DT" && r.keterangan === "DT");
      return matchDate && matchSearch && matchClass && matchStatus;
    })
    .sort((a, b) => b.waktuAbsensi.localeCompare(a.waktuAbsensi));

  // Download filtered live report in XLS format using SheetsJS
  const handleDownloadReport = () => {
    const reportData = filteredRecords.map((r, idx) => ({
      "No": idx + 1,
      "NIS": r.nis,
      "Nama Siswa": r.nama,
      "Kelas": r.kelas,
      "Waktu Absen": r.waktuAbsensi,
      "Keterangan": r.keterangan === "H" ? "Hadir Tepat Waktu" : "Terlambat Hadir",
      "Keterlambatan (Menit)": r.menitTerlambat
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(reportData);
    
    // Header widths setting
    ws["!cols"] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 25 },
      { wch: 10 },
      { wch: 22 },
      { wch: 20 },
      { wch: 22 }
    ];

    const dateSuffix = selectedDate === "Semua" ? "Semua_Tanggal" : selectedDate;
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Absensi Live");
    XLSX.writeFile(wb, `Laporan_Absensi_Live_${dateSuffix}.xlsx`);
  };

  return (
    <div className="space-y-6" id="live-report-tab">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800">📸 Laporan Real-Time Absensi (Live Report)</h2>
            {selectedDate === todayStr ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Hari Ini ({formatIndonesianDate(todayStr)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-extrabold shadow-2xs">
                <Calendar className="w-3 h-3 text-blue-600" />
                <span>{selectedDate === "Semua" ? "Semua Tanggal (Arsip Total)" : formatIndonesianDate(selectedDate)}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Daftar rekam masuk kehadiran siswa sesuai hari absen. Saat pergantian hari, laporan otomatis memperbarui dan menampilkan data hari ini.
          </p>
        </div>

        {/* Clear Option & Download Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {onDeleteRecordsByDate && (
            <div className={`flex items-center gap-1 bg-rose-50/50 border border-rose-100 rounded-xl px-2 py-1 select-none transition-opacity ${uniqueDates.length === 0 ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}>
              <span className="text-[10px] font-bold text-rose-700/80 uppercase px-1">Per Hari:</span>
              <select
                id="delete-date-select"
                value={activeDeleteDate}
                onChange={(e) => setSelectedDeleteDate(e.target.value)}
                disabled={uniqueDates.length === 0}
                className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pr-1 py-0.5 disabled:cursor-not-allowed"
              >
                {uniqueDates.length === 0 ? (
                  <option value="">Tidak ada data</option>
                ) : (
                  uniqueDates.map((d) => {
                    let display = d;
                    try {
                      display = formatIndonesianDate(d);
                    } catch (e) {}
                    return (
                      <option key={d} value={d}>
                        {d === todayStr ? `Hari Ini (${display})` : display}
                      </option>
                    );
                  })
                )}
              </select>
              <button
                id="btn-delete-date-logs"
                onClick={() => {
                  if (activeDeleteDate) {
                    setShowDeleteDateConfirm(true);
                  }
                }}
                disabled={uniqueDates.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 disabled:hover:bg-rose-300 text-white rounded-lg text-[10px] font-extrabold shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Hapus semua log absensi pada tanggal terpilih ini"
              >
                <Trash2 className="w-3 h-3" /> Hapus
              </button>
            </div>
          )}

          {onClearAllRecords && (
            <button
              id="btn-clear-logs"
              onClick={() => setShowClearLogsConfirm(true)}
              disabled={records.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 border border-rose-250 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-xl text-xs font-semibold cursor-pointer"
            >
              <ListRestart className="w-3.5 h-3.5" /> Kosongkan Log
            </button>
          )}

          <button
            id="btn-download-live-report"
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            disabled={filteredRecords.length === 0}
          >
            <Download className="w-3.5 h-3.5" /> Unduh Laporan Live (.xlsx)
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-100 p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input field */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            id="search-live-report"
            type="text"
            placeholder="Cari Nama Siswa atau NIS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700"
          />
        </div>

        {/* Filters Select boxes */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Date / Tanggal Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-bold text-slate-600">Tanggal:</span>
            <select
              id="filter-tanggal-live-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs font-extrabold focus:ring-1 focus:ring-blue-500 text-blue-900 cursor-pointer"
            >
              {allDateOptions.map((d) => {
                const isToday = d === todayStr;
                let dateLabel = d;
                try {
                  dateLabel = formatIndonesianDate(d);
                } catch (e) {}
                return (
                  <option key={d} value={d}>
                    {isToday ? `🗓️ Hari Ini (${dateLabel})` : `📅 ${dateLabel}`}
                  </option>
                );
              })}
              <option value="Semua">🌐 Semua Tanggal (Arsip)</option>
            </select>
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Kelas:</span>
            <select
              id="filter-kelas-live-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700 cursor-pointer"
            >
              <option value="Semua">Semua Kelas</option>
              {classesList.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Status Keterangan Filter */}
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Keterangan:</span>
            <select
              id="filter-status-live-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700 cursor-pointer"
            >
              <option value="Semua">Semua Status</option>
              <option value="H">Tepat Waktu (H)</option>
              <option value="DT">Terlambat (DT)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Real-time Ticker Grid List */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5 text-center w-16">No</th>
                <th className="py-3 px-4 w-32">NIS</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Waktu Absensi</th>
                <th className="py-3 px-4 text-center w-48">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <ListRestart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">
                      {selectedDate === todayStr
                        ? "Belum ada riwayat absensi masuk untuk Hari Ini."
                        : selectedDate === "Semua"
                        ? "Belum ada riwayat aktivitas absensi terdaftar."
                        : `Belum ada riwayat absensi pada tanggal ${formatIndonesianDate(selectedDate)}.`}
                    </p>
                    {selectedDate === todayStr && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Siswa yang memindai kartu QR hari ini akan langsung muncul di sini secara teratas.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-center font-semibold text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{log.nis}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{log.nama}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-700 text-[10px]">
                        Kelas {log.kelas}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                      {log.waktuAbsensi}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {log.keterangan === "H" ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-extrabold shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Hadir Tepat Waktu</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10.5px] font-extrabold shadow-2xs">
                          <Clock3 className="w-3.5 h-3.5 text-amber-500" />
                          <span>Terlambat (+{log.menitTerlambat} m)</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Stats footer in list view */}
        <div className="bg-slate-50/50 px-5 py-3 border-t border-slate-100 flex justify-between text-xs font-semibold text-slate-500 items-center">
          <span>Menampilkan {filteredRecords.length} catatan scan barcode {selectedDate === todayStr ? "(Hari Ini)" : ""}</span>
          <span className="font-mono text-[10px] text-slate-400">Total logs: {records.length}</span>
        </div>
      </div>

      {/* CUSTOM SAFE CLEAR LOGS CONFIRMATION MODAL FOR SANDBOX ENVIRONMENT */}
      {showClearLogsConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-md font-bold text-slate-800">Kosongkan Riwayat Log</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin mengosongkan semua riwayat absensi log harian? Rekap bulanan dan spreadsheet juga akan dikosongkan. Tindakan ini tidak bisa dibatalkan.
            </p>

            <div className="flex justify-end gap-3">
              <button
                id="btn-cancel-clear"
                onClick={() => setShowClearLogsConfirm(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-clear"
                onClick={() => {
                  onClearAllRecords?.();
                  setShowClearLogsConfirm(false);
                }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SAFE DELETE BY DATE CONFIRMATION MODAL */}
      {showDeleteDateConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-md font-bold text-slate-800">Hapus Absensi Per Hari</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus seluruh log absensi untuk tanggal <strong className="text-rose-600 font-extrabold">{
                (() => {
                  try {
                    return formatIndonesianDate(activeDeleteDate);
                  } catch (e) {
                    return activeDeleteDate;
                  }
                })()
              }</strong>? Rekap data absensi pada hari terpilih akan disesuaikan.
            </p>

            <div className="flex justify-end gap-3">
              <button
                id="btn-cancel-delete-date"
                onClick={() => setShowDeleteDateConfirm(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-date"
                onClick={() => {
                  if (activeDeleteDate && onDeleteRecordsByDate) {
                    onDeleteRecordsByDate(activeDeleteDate);
                  }
                  setShowDeleteDateConfirm(false);
                }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Ya, Hapus Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

