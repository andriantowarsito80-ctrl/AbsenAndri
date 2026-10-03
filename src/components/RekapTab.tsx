/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Student, AttendanceRecord, SchoolProfile } from "../types";
import { getDatesForMonth, isWeekend, getHolidayLabel, formatShortDayDate, getDayName } from "../utils/dateUtils";
import * as XLSX from "xlsx";
import { Search, Filter, SortAsc, Download, Calendar, HelpCircle, Info, CalendarDays, Trash2 } from "lucide-react";

interface RekapTabProps {
  students: Student[];
  records: AttendanceRecord[];
  profile: SchoolProfile;
  onClearAllRecords?: () => void;
}

export default function RekapTab({
  students,
  records,
  profile,
  onClearAllRecords,
}: RekapTabProps) {
  // Filters states
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [sortOrder, setSortOrder] = useState<"A-Z" | "Z-A">("A-Z");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Date selection states (Defaulting to current date for long term reliability)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktoter", "November", "Desember"
  ];

  // Dynamic years list starting from 2024 up to 15 years later
  const yearsList = Array.from({ length: 15 }, (_, i) => 2024 + i);

  // Create an O(1) pre-processed double lookup map for attendance records to prevent massive nested loop lag
  const recordMap = React.useMemo(() => {
    const map = new Map<string, Map<string, AttendanceRecord>>();
    records.forEach((r) => {
      const dateKey = r.waktuAbsensi.substring(0, 10); // "YYYY-MM-DD"
      if (!map.has(r.nis)) {
        map.set(r.nis, new Map<string, AttendanceRecord>());
      }
      map.get(r.nis)!.set(dateKey, r);
    });
    return map;
  }, [records]);

  // Dynamic obtain calendar dates for the active month selection
  const calendarDatesStr = getDatesForMonth(selectedYear, selectedMonth);

  // Helper inside loop to check what marker to give a specific student on a specific date
  const getAttendanceMarker = (siswaNis: string, dateStr: string) => {
    // 1. Check if weekend (Sabtu/Minggu)
    if (isWeekend(dateStr)) {
      return { text: "✕", type: "WEEKEND", tooltip: "Hari Libur Akhir Pekan (Sabtu/Minggu)" };
    }

    // 2. Check if general school holiday
    const holidayDesc = getHolidayLabel(dateStr, profile.holidayRanges);
    if (holidayDesc) {
      return { text: "LBR", type: "HOLIDAY", tooltip: `Hari Libur: ${holidayDesc}` };
    }

    // 3. Search attendance record
    const studentMap = recordMap.get(siswaNis);
    const matchRecord = studentMap ? studentMap.get(dateStr) : undefined;

    if (matchRecord) {
      const ket = matchRecord.keterangan;
      const timePart = matchRecord.waktuAbsensi.split(" ")[1] || "00:00:00";
      if (ket === "H") {
        if (matchRecord.id && (matchRecord.id.startsWith("manual-H") || matchRecord.id.startsWith("manual-"))) {
          // Manual input of "Hadir" in the journal should not appear as H in spreadsheet rekap, it remains "TA" (Tidak Absen)
          // So we do not return "HADIR" here, let it fall through to default "TA"
        } else {
          return { text: "H", type: "HADIR", tooltip: `Hadir tepat waktu di jam ${timePart}` };
        }
      } else if (ket === "S") {
        return { text: "S", type: "SAKIT", tooltip: `Sakit (Dengan Keterangan)` };
      } else if (ket === "I") {
        return { text: "I", type: "IZIN", tooltip: `Izin (Dengan Keterangan)` };
      } else if (ket === "A") {
        return { text: "A", type: "ALPA", tooltip: `Alpa (Tanpa Keterangan)` };
      } else if (ket === "DT") {
        return { text: "DT", type: "TERLAMBAT", tooltip: `Datang terlambat: +${matchRecord.menitTerlambat} menit (${timePart})` };
      } else {
        if (matchRecord.id && matchRecord.id.startsWith("manual-H")) {
          // Fall through
        } else {
          return { text: "H", type: "HADIR", tooltip: `Hadir` };
        }
      }
    }

    // 4. Default if not logged is "TA" (Tidak Absen) unless it is in the future
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (dateStr > todayStr) {
      return { text: "", type: "FUTURE", tooltip: "Belum Hari & Tanggal Absensi" };
    }

    return { text: "TA", type: "ABSEN", tooltip: "Tidak hadir / tidak melakukan absensi barcode" };
  };

  // Compile calculations per student for stats summaries and rendering
  const studentRows = students
    .filter((s) => {
      const matchSearch = 
        s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.nis.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = classFilter === "Semua" || s.kelas === classFilter;
      return matchSearch && matchClass;
    })
    .sort((a, b) => {
      if (sortOrder === "A-Z") {
        return a.nama.localeCompare(b.nama);
      } else {
        return b.nama.localeCompare(a.nama);
      }
    })
    .map((siswa) => {
      // Calculate sums over the active month dates
      let onTimeCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      calendarDatesStr.forEach((dateStr) => {
        // Skip weekend & school holidays from "Absent" (TA) penalty points
        const isWknd = isWeekend(dateStr);
        const isHol = getHolidayLabel(dateStr, profile.holidayRanges) !== null;
        
        if (isWknd || isHol) return;

        const stat = getAttendanceMarker(siswa.nis, dateStr);
        if (stat.type === "HADIR") onTimeCount++;
        else if (stat.type === "TERLAMBAT") lateCount++;
        else if (stat.type === "ABSEN" || stat.type === "ALPA") absentCount++;
      });

      return {
        siswa,
        onTimeCount,
        lateCount,
        absentCount,
      };
    });

  // Get distinct classes for filter dropdown
  const classesList = Array.from(new Set(students.map((s) => s.kelas))).sort();

  // Excel exporter of the custom matrix
  const handleDownloadSpreadsheet = () => {
    // Generate header row with dates
    const headers = ["NIS", "Nama Siswa", "Kelas"];
    calendarDatesStr.forEach((dateStr) => {
      const day = getDayName(dateStr);
      const dayNum = dateStr.split("-")[2];
      headers.push(`${day} (${dayNum})`);
    });
    headers.push("Total Tepat (H)", "Total Telat (DT)", "Total Alpa (TA)");

    // Generate rows
    const dataRows = studentRows.map((row) => {
      const compiledRow: any[] = [
        row.siswa.nis,
        row.siswa.nama,
        row.siswa.kelas
      ];
      
      calendarDatesStr.forEach((dateStr) => {
        const marker = getAttendanceMarker(row.siswa.nis, dateStr);
        compiledRow.push(marker.text);
      });

      compiledRow.push(row.onTimeCount);
      compiledRow.push(row.lateCount);
      compiledRow.push(row.absentCount);

      return compiledRow;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    XLSX.utils.book_append_sheet(wb, ws, `Rekap Absensi ${monthNames[selectedMonth]}`);
    XLSX.writeFile(wb, `Rekap_Absensi_Spreadsheet_${monthNames[selectedMonth]}_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6" id="rekap-spreadsheet-tab">
      
      {/* Header Info */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📊 Rekapitulasi Kehadiran (Spreadsheet View)</h2>
          <p className="text-xs text-slate-500">
            Format spreadsheet komparatif yang memetakan aktivitas harian siswa. Kolom Sabtu & Minggu berwarna merah secara otomatis.
          </p>
        </div>

        {/* Downloader & Clear actions */}
        <div className="flex flex-wrap items-center gap-3">
          {onClearAllRecords && (
            <button
              id="btn-rekap-clear-logs"
              onClick={() => setShowClearConfirm(true)}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Data Absen
            </button>
          )}

          <button
            id="btn-download-spreadsheet-rekap"
            onClick={handleDownloadSpreadsheet}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Spreadsheet Rekap (.xlsx)
          </button>
        </div>
      </div>

      {/* Filter and Matrix configuration row */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-4 justify-between items-center">
        
        {/* Search, Class & Year Selection */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search Input field */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
            <input
              id="search-rekap-spreadsheet"
              type="text"
              placeholder="Cari nama / NIS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700"
            />
          </div>

          {/* Class select dropdown */}
          <select
            id="filter-kelas-rekap-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700"
          >
            <option value="Semua">Semua Kelas</option>
            {classesList.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          {/* Sort alphabetic dropdown */}
          <select
            id="sort-rekap-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "A-Z" | "Z-A")}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700"
          >
            <option value="A-Z">Urut A s/d Z</option>
            <option value="Z-A">Urut Z s/d A</option>
          </select>
        </div>

        {/* Date Month & Year Configurator */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Pilih Bulan:</span>
          
          <select
            id="rekap-month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border-none rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
          >
            {monthNames.map((mName, mIdx) => (
              <option key={mIdx} value={mIdx}>{mName}</option>
            ))}
          </select>

          <select
            id="rekap-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border-none rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
          >
            {yearsList.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sheet view matrix legends */}
      <div className="bg-slate-50 rounded-xl p-3 px-4 border border-slate-200/60 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold text-slate-500 justify-between items-center">
        <span className="text-slate-700 font-bold">Inisial Legenda Spreadsheet:</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2 p-1 bg-slate-50 border border-slate-100 rounded-lg">
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-emerald-500 text-white font-mono flex items-center justify-center font-bold text-[9px]">H</span>
            <span>Hadir Tepat Waktu</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-amber-500 text-white font-mono flex items-center justify-center font-bold text-[9px]">DT</span>
            <span>Mangkir Terlambat (DT)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-blue-500 text-white font-mono flex items-center justify-center font-bold text-[9px]">S</span>
            <span>Sakit (S)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-amber-400 text-white font-mono flex items-center justify-center font-bold text-[9px]">I</span>
            <span>Izin (I)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-rose-500 text-white font-mono flex items-center justify-center font-bold text-[9px]">A</span>
            <span>Alpa (A)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-rose-100 border border-rose-200 text-rose-500 font-mono flex items-center justify-center font-bold text-[9px]">TA</span>
            <span>Tanpa Absensi</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-rose-100 border border-rose-200 text-rose-500 font-mono flex items-center justify-center font-bold text-[9px]">✕</span>
            <span>Libur Akhir Pekan</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-4.5 rounded bg-yellow-101 border border-yellow-200 text-yellow-700 font-mono flex items-center justify-center font-bold text-[8px]">LBR</span>
            <span>Hari Libur Sekolah</span>
          </span>
        </div>
      </div>

      {/* Spreadsheet grid display */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          {/* Using table-fixed layout so scrollbars operate cleanly */}
          <table className="min-w-max border-collapse text-xs text-left" id="matrix-spreadsheet-table">
            
            {/* Headers section */}
            <thead className="relative z-10 select-none">
              <tr className="bg-slate-100/90 border-b border-slate-200 text-stone-600">
                {/* Fixed identification headers */}
                <th className="py-2.5 px-3 border border-slate-200 font-bold text-center sticky left-0 bg-slate-100 w-12 text-[10px]">No</th>
                <th className="py-2.5 px-3 border border-slate-200 font-bold sticky left-12 bg-slate-100 w-24 text-[10px]">NIS</th>
                <th className="py-2.5 px-4 border border-slate-200 font-bold sticky left-36 bg-slate-100 w-44 text-[10px]">Nama Siswa</th>
                <th className="py-2.5 px-3 border border-slate-200 font-bold text-center w-20 text-[10px]">Kelas</th>

                {/* Date Columns headers with weekday stacked on date num */}
                {calendarDatesStr.map((dateStr) => {
                  const dayName = getDayName(dateStr);
                  const shortDay = dayName.substring(0, 3); // "Sen", "Rub", "Sab", etc.
                  const dayNum = dateStr.split("-")[2];
                  
                  const isWk = isWeekend(dateStr);
                  const isHl = getHolidayLabel(dateStr, profile.holidayRanges) !== null;

                  return (
                    <th 
                      key={dateStr} 
                      className={`text-center p-1 border border-slate-200 text-[10px] w-12 font-bold select-none ${
                        isWk 
                          ? "bg-rose-100 border-rose-200 text-rose-700" 
                          : isHl 
                            ? "bg-yellow-150 border-yellow-200 text-yellow-700" 
                            : "bg-slate-50 text-slate-500"
                      }`}
                      title={`${formatShortDayDate(dateStr)}`}
                    >
                      <div className="text-[8px] uppercase tracking-tighter leading-none">{shortDay}</div>
                      <div className="text-[11px] font-mono leading-none font-extrabold mt-0.5">{dayNum}</div>
                    </th>
                  );
                })}

                {/* Metrics statistics summarizers headers */}
                <th className="p-1.5 border border-slate-200 bg-emerald-50 text-emerald-700 font-bold text-center text-[10px] w-14">H</th>
                <th className="p-1.5 border border-slate-200 bg-amber-50 text-amber-700 font-bold text-center text-[10px] w-14">DT</th>
                <th className="p-1.5 border border-slate-200 bg-rose-50 text-rose-700 font-bold text-center text-[10px] w-14">TA</th>
              </tr>
            </thead>

            {/* Body contents */}
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {studentRows.length === 0 ? (
                <tr>
                  <td colSpan={4 + calendarDatesStr.length + 3} className="text-center py-12 text-slate-400 font-sans">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Belum ada data siswa untuk ditampilkan.
                  </td>
                </tr>
              ) : (
                studentRows.map((rowRef, idx) => {
                  const { siswa, onTimeCount, lateCount, absentCount } = rowRef;

                  return (
                    <tr key={siswa.nis} className="hover:bg-slate-50 transition-colors">
                      {/* Fixed identifier columns */}
                      <td className="py-2 px-3 border border-slate-200 text-center font-bold text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50">{idx + 1}</td>
                      <td className="py-2 px-3 border border-slate-200 font-bold text-slate-800 sticky left-12 bg-white group-hover:bg-slate-50">{siswa.nis}</td>
                      <td className="py-2 px-4 border border-slate-200 font-sans font-bold text-slate-800 sticky left-36 bg-white truncate group-hover:bg-slate-50 whitespace-nowrap">{siswa.nama}</td>
                      <td className="py-2 px-3 border border-slate-200 font-sans text-center font-semibold text-slate-500 bg-slate-50/20">{siswa.kelas}</td>

                      {/* Render markers for each date */}
                      {calendarDatesStr.map((dateStr) => {
                        const marker = getAttendanceMarker(siswa.nis, dateStr);

                        // Visual styling classes for cells depending on marker type
                        let cellClass = "text-center p-0.5 border border-slate-100 font-bold text-center select-none ";
                        
                        if (marker.type === "WEEKEND") {
                          cellClass += "bg-rose-50 text-rose-300 border-rose-100 text-[10px]";
                        } else if (marker.type === "HOLIDAY") {
                          cellClass += "bg-yellow-50 text-yellow-500 border-yellow-100 text-[10px]";
                        } else if (marker.type === "HADIR") {
                          cellClass += "text-emerald-600 bg-emerald-50 text-[11px]";
                        } else if (marker.type === "TERLAMBAT") {
                          cellClass += "text-amber-600 bg-amber-50 text-[11px]";
                        } else if (marker.type === "SAKIT") {
                          cellClass += "text-blue-600 bg-blue-50 text-[11px]";
                        } else if (marker.type === "IZIN") {
                          cellClass += "text-amber-600 bg-amber-50 text-[11px]";
                        } else if (marker.type === "ALPA") {
                          cellClass += "text-rose-600 bg-rose-50 text-[11px]";
                        } else if (marker.type === "FUTURE") {
                          cellClass += "text-slate-300 bg-slate-50/5 text-[11px]";
                        } else {
                          // Alpa/Absent "TA"
                          cellClass += "text-rose-600 bg-rose-50 text-[11px]";
                        }

                        return (
                          <td 
                            key={dateStr} 
                            className={cellClass}
                            title={`${siswa.nama} (${dateStr}): ${marker.tooltip}`}
                          >
                            {marker.text}
                          </td>
                        );
                      })}

                      {/* Row totals indicators */}
                      <td className="py-2 px-1 border border-slate-200 bg-emerald-50/50 text-emerald-700 font-bold text-center text-xs">{onTimeCount}</td>
                      <td className="py-2 px-1 border border-slate-200 bg-amber-50/50 text-amber-700 font-bold text-center text-xs">{lateCount}</td>
                      <td className="py-2 px-1 border border-slate-200 bg-rose-50/50 text-rose-700 font-bold text-center text-xs">{absentCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Matrix statistics footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200/80 flex flex-col md:flex-row gap-4 justify-between items-center text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5 font-sans">
            <Info className="w-4 h-4 text-slate-400" />
            Arahkan kursor Anda ke kolom tabel penanda kode untuk rincian data absensi individual siswa.
          </span>
          <span className="font-semibold text-slate-600 font-mono">
            Bulan: {monthNames[selectedMonth]} {selectedYear} | Total {studentRows.length} Baris
          </span>
        </div>
      </div>

      {/* CONFIRMATION POPUP */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6 text-left">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-md font-bold text-slate-800">Hapus Semua Absensi?</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda benar-benar yakin ingin menghapus <strong className="text-rose-600">SELURUH DATA ABSENSI</strong> siswa secara keseluruhan? Seluruh data riwayat rekap log masuk harian, status kehadiran, dan statistik kedisiplinan di semua bulan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex justify-end gap-3">
              <button
                id="btn-cancel-clear-rekap"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-clear-rekap"
                onClick={() => {
                  onClearAllRecords?.();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
