/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Student, AttendanceRecord, SchoolProfile } from "../types";
import { getDatesForMonth, isWeekend, getHolidayLabel, formatShortDayDate, getDayName, formatIndonesianDate } from "../utils/dateUtils";
import { 
  Search, Calendar, Info, Check, UserCheck, AlertCircle, Sparkles, Filter, 
  ChevronRight, CalendarDays, Edit3, HeartPulse, FileText, Ban, Trash2, CalendarRange, ListFilter,
  UserX, Download, CheckCircle
} from "lucide-react";
import * as XLSX from "xlsx";

interface PresensiKalenderTabProps {
  students: Student[];
  records: AttendanceRecord[];
  profile: SchoolProfile;
  onUpdateAttendanceStatus: (nis: string, dateStr: string, status: "H" | "S" | "I" | "A" | "-") => void;
  onClearAllRecords?: () => void;
}

export default function PresensiKalenderTab({
  students,
  records,
  profile,
  onUpdateAttendanceStatus,
  onClearAllRecords,
}: PresensiKalenderTabProps) {
  // Navigation filters
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Date states - defaults to current system date (or 2026 for preloaded demonstration data, but dynamic is best for years of continuous usage)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  // Sub-tab: "bulanan" (default grid) or "tidak_absen_qr" (non-scanner list)
  const [activeSubTab, setActiveSubTab] = useState<"bulanan" | "tidak_absen_qr">("bulanan");

  // Get days list
  const calendarDatesStr = getDatesForMonth(selectedYear, selectedMonth);

  // Selected single date for "siswa tidak absen qr" sub-tab view (defaults to today or first day of current selection)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local format
    const dates = getDatesForMonth(new Date().getFullYear(), new Date().getMonth());
    return dates.includes(todayStr) ? todayStr : (dates[0] || "");
  });

  // Automatically keep selectedDateStr in bounds of newly selected month/year
  React.useEffect(() => {
    const dates = getDatesForMonth(selectedYear, selectedMonth);
    if (dates.length > 0) {
      const todayStr = new Date().toLocaleDateString("en-CA");
      if (dates.includes(todayStr)) {
        setSelectedDateStr(todayStr);
      } else {
        setSelectedDateStr(dates[0]);
      }
    }
  }, [selectedYear, selectedMonth]);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Dynamic years list starting from 2024 up to 15 years later
  const currentActualYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 15 }, (_, i) => 2024 + i);

  // Active cell edit selector state
  const [activeEditCell, setActiveEditCell] = useState<{ nis: string; dateStr: string } | null>(null);

  // Get distinct classes for the filter dropdown
  const classesList = Array.from(new Set(students.map((s) => s.kelas))).sort();

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

  // Resolve the actual displayed code for a specific student date
  const getCellStatus = (siswaNis: string, dateStr: string) => {
    // 1. Check if weekend
    if (isWeekend(dateStr)) {
      return { code: "✕", label: "Akhir Pekan", type: "WEEKEND", style: "bg-rose-50 text-rose-300 border-rose-100" };
    }

    // 2. Check if holiday
    const holidayLabel = getHolidayLabel(dateStr, profile.holidayRanges);
    if (holidayLabel) {
      return { code: "LBR", label: holidayLabel, type: "HOLIDAY", style: "bg-yellow-50 text-yellow-500 border-yellow-100 font-bold" };
    }

    // 3. Search matched record in pre-processed Map
    const studentMap = recordMap.get(siswaNis);
    const record = studentMap ? studentMap.get(dateStr) : undefined;

    if (record) {
      const ket = record.keterangan;
      if (ket === "H" || ket === "DT") {
        return { 
          code: "H", 
          label: ket === "H" ? "Hadir (Tepat Waktu)" : `Hadir (Terlambat: ${record.menitTerlambat}m)`, 
          type: "HADIR", 
          style: "bg-emerald-500 text-white font-bold border-emerald-600 shadow-xs" 
        };
      } else if (ket === "S") {
        return { code: "S", label: "Sakit", type: "SAKIT", style: "bg-blue-500 text-white font-bold border-blue-600 shadow-xs" };
      } else if (ket === "I") {
        return { code: "I", label: "Izin", type: "IZIN", style: "bg-amber-500 text-white font-bold border-amber-600 shadow-xs" };
      } else if (ket === "A") {
        return { code: "A", label: "Alpa / Tanpa Keterangan", type: "ALPA", style: "bg-rose-500 text-white font-bold border-rose-600 shadow-xs" };
      }
    }

    // Default: Belum absen
    return { code: "-", label: "Belum absen", type: "KOSONG", style: "bg-slate-50 text-slate-350 hover:bg-slate-100 cursor-pointer" };
  };

  // Compile calculations for teachers' easy statistics
  const filteredStudents = students
    .filter((s) => {
      const matchSearch = 
        s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.nis.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = classFilter === "Semua" || s.kelas === classFilter;
      return matchSearch && matchClass;
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  // Determine if a student has scanned QR space on that day
  const isStudentScannedQR = (studentNis: string, dateStr: string) => {
    const studentMap = recordMap.get(studentNis);
    const r = studentMap ? studentMap.get(dateStr) : undefined;
    return r !== undefined && !r.id.startsWith("manual-");
  };

  // Compile students that did NOT scan the QR code for selectedDateStr
  const studentsNotScannedQR = React.useMemo(() => {
    return filteredStudents.filter((student) => {
      return !isStudentScannedQR(student.nis, selectedDateStr);
    });
  }, [filteredStudents, selectedDateStr, recordMap]);

  // Fetch or infer current status in Jurnal Presensi
  const getStatusOfNonScanner = (studentNis: string) => {
    const studentMap = recordMap.get(studentNis);
    const record = studentMap ? studentMap.get(selectedDateStr) : undefined;
    if (!record) {
      return { code: "A", label: "Tanpa Keterangan", type: "ALPA", style: "bg-rose-100 text-rose-850 border-rose-200" };
    }
    const ket = record.keterangan;
    if (ket === "H") {
      return { code: "H", label: "Hadir (Manual)", type: "HADIR", style: "bg-emerald-100 text-emerald-850 border-emerald-200" };
    } else if (ket === "S") {
      return { code: "S", label: "Sakit (S)", type: "SAKIT", style: "bg-blue-100 text-blue-850 border-blue-200" };
    } else if (ket === "I") {
      return { code: "I", label: "Izin (I)", type: "IZIN", style: "bg-amber-100 text-amber-850 border-amber-200" };
    } else if (ket === "A") {
      return { code: "A", label: "Tanpa Keterangan", type: "ALPA", style: "bg-rose-100 text-rose-850 border-rose-200" };
    }
    return { code: "A", label: "Tanpa Keterangan", type: "ALPA", style: "bg-rose-100 text-rose-850 border-rose-200" };
  };

  const statsNonScanners = React.useMemo(() => {
    let total = studentsNotScannedQR.length;
    let countA = 0;
    let countS = 0;
    let countI = 0;
    let countH = 0;

    studentsNotScannedQR.forEach((s) => {
      const studentMap = recordMap.get(s.nis);
      const rec = studentMap ? studentMap.get(selectedDateStr) : undefined;
      if (!rec || rec.keterangan === "A") countA++;
      else if (rec.keterangan === "S") countS++;
      else if (rec.keterangan === "I") countI++;
      else if (rec.keterangan === "H") countH++;
    });

    return { total, A: countA, S: countS, I: countI, H: countH };
  }, [studentsNotScannedQR, recordMap, selectedDateStr]);

  const handleExportNonScanners = () => {
    try {
      const exportData = studentsNotScannedQR.map((s, index) => {
        const stat = getStatusOfNonScanner(s.nis);
        return {
          "No": index + 1,
          "NIS": s.nis,
          "Nama Siswa": s.nama,
          "Kelas": s.kelas,
          "Keterangan": stat.label,
          "Status": stat.code
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tidak Absen QR");

      /* generate file & download */
      XLSX.writeFile(wb, `Siswa_Tidak_Absen_QR_${selectedDateStr}.xlsx`);
    } catch (err) {
      console.error("Gagal mengekspor data siswa tidak absen:", err);
    }
  };

  const handleExportMonthlyJournal = () => {
    try {
      const exportData = filteredStudents.map((siswa, index) => {
        let totalH = 0;
        let totalS = 0;
        let totalI = 0;
        let totalA = 0;

        const rowData: Record<string, string | number> = {
          "No": index + 1,
          "NIS": siswa.nis,
          "Nama Siswa": siswa.nama,
          "Kelas": siswa.kelas,
        };

        calendarDatesStr.forEach((dStr) => {
          const cell = getCellStatus(siswa.nis, dStr);
          const dayNum = dStr.split("-")[2];
          
          let codeValue = cell.code;
          if (cell.type === "WEEKEND") {
            codeValue = "✕";
          } else if (cell.type === "HOLIDAY") {
            codeValue = "LBR";
          } else {
            if (cell.type === "HADIR") totalH++;
            else if (cell.type === "SAKIT") totalS++;
            else if (cell.type === "IZIN") totalI++;
            else if (cell.type === "ALPA") totalA++;
          }
          
          rowData[`Tanggal ${dayNum}`] = codeValue;
        });

        rowData["Total Hadir (H)"] = totalH;
        rowData["Total Sakit (S)"] = totalS;
        rowData["Total Izin (I)"] = totalI;
        rowData["Total Alpa (A)"] = totalA;

        return rowData;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const colWidths = [
        { wch: 6 },   // No
        { wch: 15 },  // NIS
        { wch: 30 },  // Nama Siswa
        { wch: 12 },  // Kelas
      ];
      calendarDatesStr.forEach(() => {
        colWidths.push({ wch: 5 });
      });
      colWidths.push({ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      const monthLabel = monthNames[selectedMonth].toUpperCase();
      const fileClassLabel = classFilter === "Semua" ? "SEMUA_KELAS" : `KELAS_${classFilter.toUpperCase()}`;
      XLSX.utils.book_append_sheet(wb, ws, "Jurnal Presensi");

      XLSX.writeFile(wb, `JURNAL_PRESENSI_${fileClassLabel}_${monthLabel}_${selectedYear}.xlsx`);
    } catch (err) {
      console.error("Gagal mengekspor data jurnal bulanan:", err);
      alert("Gagal melakukan unduhan laporan jurnal.");
    }
  };

  const handleCellClick = (nis: string, dateStr: string) => {
    // Avoid editing holidays or weekend cells
    if (isWeekend(dateStr) || getHolidayLabel(dateStr, profile.holidayRanges)) {
      return;
    }
    setActiveEditCell({ nis, dateStr });
  };

  const handleStatusSelect = (status: "H" | "S" | "I" | "A" | "-") => {
    if (activeEditCell) {
      onUpdateAttendanceStatus(activeEditCell.nis, activeEditCell.dateStr, status);
      setActiveEditCell(null);
    }
  };

  return (
    <div className="space-y-6" id="monitoring-presensi-wali-kelas-tab">
      
      {/* Tab Accent Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-blue-700 to-blue-900 p-6 rounded-3xl text-white shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full text-white/90">Wali Kelas & Seksi Absensi</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black font-display tracking-tight">📝 Jurnal Presensi & Kalender Kelas</h2>
          <p className="text-xs text-blue-100/90 leading-relaxed font-medium">
            Acuan mandiri untuk wali kelas dalam merekap dan mengedit status kesakitan, perizinan, atau ketidakhadiran (S, I, A). Siswa luar jaringan yang memindai QR code otomatis tercatat <strong>H (Hadir)</strong>.
          </p>
        </div>

        {/* Calendar visual widget info */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 px-4 border border-white/20 text-xs flex gap-4 shrink-0 font-medium">
          <div className="space-y-0.5">
            <span className="text-blue-200 block text-[9.5px] uppercase font-bold tracking-wider">Aktif Di Kalender</span>
            <span className="text-white font-bold">{monthNames[selectedMonth]} {selectedYear}</span>
          </div>
          <div className="w-px bg-white/10"></div>
          <div className="space-y-0.5">
            <span className="text-blue-200 block text-[9.5px] uppercase font-bold tracking-wider">Total Terdaftar</span>
            <span className="text-white font-mono font-bold text-center block bg-blue-500/35 px-1.5 rounded">{filteredStudents.length} Siswa</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex bg-slate-100/85 p-1 rounded-2xl max-w-sm border border-slate-200/60 select-none">
        <button
          id="btn-subtab-bulanan"
          onClick={() => setActiveSubTab("bulanan")}
          type="button"
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "bulanan"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-550 hover:text-slate-800 hover:bg-slate-50/50"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Grid Bulanan
        </button>
        <button
          id="btn-subtab-tidak-absen-qr"
          onClick={() => setActiveSubTab("tidak_absen_qr")}
          type="button"
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === "tidak_absen_qr"
              ? "bg-white text-rose-700 shadow-xs"
              : "text-slate-550 hover:text-slate-800 hover:bg-slate-50/50"
          }`}
        >
          <UserX className="w-3.5 h-3.5 text-rose-500" />
          Rekap Tidak Absen QR
        </button>
      </div>

      {activeSubTab === "bulanan" ? (
        <>
          {/* Control Filters Area */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-4 flex flex-wrap gap-4 items-center justify-between">
        
        {/* Search & Class Filtering tools */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Quick search inputs */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              id="search-presensi-kalender"
              type="text"
              placeholder="Cari nama atau NIS siswa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold focus:outline-none text-slate-700 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Class selection dropdown */}
          <div className="flex items-center gap-1.5">
            <ListFilter className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="filter-kelas-kalender-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <option value="Semua">Semua Kelas</option>
              {classesList.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Selector widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Kalender Periode:</span>
            
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <select
                id="kalender-month-select"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value, 10));
                  setActiveEditCell(null);
                }}
                className="bg-transparent border-none text-xs font-extrabold text-slate-700 px-3 py-1 focus:ring-0 cursor-pointer focus:outline-none"
              >
                {monthNames.map((mName, mIdx) => (
                  <option key={mIdx} value={mIdx}>{mName}</option>
                ))}
              </select>

              <select
                id="kalender-year-select"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value, 10));
                  setActiveEditCell(null);
                }}
                className="bg-transparent border-none text-xs font-extrabold text-slate-700 px-2.5 py-1 focus:ring-0 cursor-pointer focus:outline-none"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {onClearAllRecords && (
            <button
              id="btn-presensi-clear-logs"
              onClick={() => setShowClearConfirm(true)}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              title="Hapus seluruh data absensi tersimpan"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Data Absen
            </button>
          )}

          <button
            id="btn-export-jurnal-bulanan"
            onClick={handleExportMonthlyJournal}
            disabled={filteredStudents.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            title="Download dan ekspor laporan jurnal presensi kelas ini"
          >
            <Download className="w-3.5 h-3.5" /> Download Laporan Jurnal (.xlsx)
          </button>
        </div>

      </div>

      {/* Legend Information Row */}
      <div className="bg-slate-55/65 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11px] font-bold text-slate-600">
          <span className="text-slate-800 text-xs font-black">Indikator Presensi:</span>
          
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-5.5 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black shadow-xs font-mono">H</span>
            <span>Hadir (Absen Barcode / Manual)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-6 h-5.5 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black shadow-xs font-mono">S</span>
            <span>Sakit (S)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-6 h-5.5 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black shadow-xs font-mono">I</span>
            <span>Izin (I)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-6 h-5.5 rounded-lg bg-rose-500 text-white flex items-center justify-center font-black shadow-xs font-mono">A</span>
            <span>Alpa / Tanpa Keterangan (A)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-6 h-5.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center font-bold font-mono">-</span>
            <span>Belum Absen</span>
          </div>
        </div>

        <div className="text-[10px] font-bold text-slate-400 bg-white shadow-2xs p-2 rounded-xl border border-slate-100 flex items-center gap-1 shrink-0 self-end md:self-auto leading-none">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Klik sel tanggal biasa untuk mengedit status siswa
        </div>
      </div>

      {/* Master Interactive Table Grid */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto max-h-[550px]">
          <table className="min-w-max border-collapse text-xs text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 select-none">
                <th className="py-3 px-3 border border-slate-200 font-bold text-center sticky left-0 bg-slate-100 w-12 text-[10px]">No</th>
                <th className="py-3 px-3 border border-slate-200 font-bold sticky left-12 bg-slate-100 w-24 text-[10px]">NIS</th>
                <th className="py-3 px-4 border border-slate-200 font-bold sticky left-36 bg-slate-100 w-48 text-[10px]">Nama Siswa</th>
                <th className="py-3 px-3 border border-slate-200 font-bold text-center w-20 text-[10px]">Kelas</th>

                {/* Calendar Dates Headers */}
                {calendarDatesStr.map((dateStr) => {
                  const dayName = getDayName(dateStr);
                  const shortDay = dayName.substring(0, 3); // "Sen", etc.
                  const dayNum = dateStr.split("-")[2];
                  
                  const isWk = isWeekend(dateStr);
                  const isHl = getHolidayLabel(dateStr, profile.holidayRanges) !== null;

                  return (
                    <th 
                      key={dateStr} 
                      className={`text-center p-1.5 border border-slate-200 text-[10px] w-12 font-bold ${
                        isWk 
                          ? "bg-rose-100/80 border-rose-200 text-rose-700" 
                          : isHl 
                            ? "bg-yellow-100/90 border-yellow-200 text-yellow-700" 
                            : "bg-slate-50 text-slate-500"
                      }`}
                      title={`${formatShortDayDate(dateStr)}`}
                    >
                      <div className="text-[7.5px] uppercase tracking-wider leading-none text-slate-425">{shortDay}</div>
                      <div className="text-[11px] font-mono leading-none font-black mt-0.5">{dayNum}</div>
                    </th>
                  );
                })}

                {/* Statistics Columns */}
                <th className="p-1 px-2 border border-slate-200 bg-emerald-50 text-emerald-800 font-black text-center text-[10px] w-14">H</th>
                <th className="p-1 px-2 border border-slate-200 bg-blue-50 text-blue-800 font-black text-center text-[10px] w-14">S</th>
                <th className="p-1 px-2 border border-slate-200 bg-amber-50 text-amber-800 font-black text-center text-[10px] w-14">I</th>
                <th className="p-1 px-2 border border-slate-200 bg-rose-50 text-rose-800 font-black text-center text-[10px] w-14">A</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-mono text-stone-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4 + calendarDatesStr.length + 4} className="text-center py-16 text-slate-400 font-sans">
                    <CalendarRange className="w-12 h-12 mx-auto text-slate-350 mb-3" />
                    <p className="font-bold text-slate-500 text-sm">Siswa Tidak Ditemukan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Sesuaikan kata kunci pencarian atau filter kelas Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((siswa, idx) => {
                  // Compile stats for each student row in the given month
                  let totalHadir = 0;
                  let totalSakit = 0;
                  let totalIzin = 0;
                  let totalAlpa = 0;

                  calendarDatesStr.forEach((dStr) => {
                    const isWk = isWeekend(dStr);
                    const isHl = getHolidayLabel(dStr, profile.holidayRanges) !== null;
                    if (isWk || isHl) return;

                    const info = getCellStatus(siswa.nis, dStr);
                    if (info.type === "HADIR") totalHadir++;
                    else if (info.type === "SAKIT") totalSakit++;
                    else if (info.type === "IZIN") totalIzin++;
                    else if (info.type === "ALPA") totalAlpa++;
                  });

                  return (
                    <tr key={siswa.nis} className="hover:bg-slate-50/50 transition-colors">
                      {/* Identity sticky cells */}
                      <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-400 bg-white sticky left-0">{idx + 1}</td>
                      <td className="py-2.5 px-3 border border-slate-200 font-bold text-slate-800 bg-white sticky left-12 font-mono text-[11px]">{siswa.nis}</td>
                      <td className="py-2.5 px-4 border border-slate-200 font-sans font-bold text-slate-800 bg-white sticky left-36 truncate whitespace-nowrap text-xs">{siswa.nama}</td>
                      <td className="py-2.5 px-3 border border-slate-200 font-sans text-center font-extrabold text-slate-500 bg-slate-50/50">{siswa.kelas}</td>

                      {/* Interactive Calendar columns */}
                      {calendarDatesStr.map((dStr) => {
                        const cell = getCellStatus(siswa.nis, dStr);
                        const isEditable = cell.type !== "WEEKEND" && cell.type !== "HOLIDAY";
                        const isEditingThis = activeEditCell?.nis === siswa.nis && activeEditCell?.dateStr === dStr;

                        return (
                          <td 
                            key={dStr} 
                            onClick={() => isEditable && handleCellClick(siswa.nis, dStr)}
                            className={`p-1 border border-slate-200 text-center align-middle font-mono select-none text-[11px] relative transition-all ${cell.style} ${
                              isEditable ? "cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-inset hover:z-20" : ""
                            }`}
                            title={`${siswa.nama} - ${formatShortDayDate(dStr)}: ${cell.label}`}
                          >
                            {cell.code}

                            {/* Floating cell dropdown overlay on active cell */}
                            {isEditingThis && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl z-50 flex items-center p-1.5 gap-1.5 animate-none min-w-max">
                                <button
                                  id="btn-set-status-h"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusSelect("H");
                                  }}
                                  className="w-7 h-7 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-extrabold flex items-center justify-center cursor-pointer text-xs"
                                  title="Hadir (H)"
                                >
                                  H
                                </button>
                                <button
                                  id="btn-set-status-s"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusSelect("S");
                                  }}
                                  className="w-7 h-7 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-extrabold flex items-center justify-center cursor-pointer text-xs"
                                  title="Sakit (S)"
                                >
                                  S
                                </button>
                                <button
                                  id="btn-set-status-i"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusSelect("I");
                                  }}
                                  className="w-7 h-7 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-extrabold flex items-center justify-center cursor-pointer text-xs"
                                  title="Izin (I)"
                                >
                                  I
                                </button>
                                <button
                                  id="btn-set-status-a"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusSelect("A");
                                  }}
                                  className="w-7 h-7 bg-rose-500 hover:bg-rose-600 rounded-lg text-white font-extrabold flex items-center justify-center cursor-pointer text-xs"
                                  title="Alpa (A)"
                                >
                                  A
                                </button>
                                <div className="w-px h-6 bg-slate-700/80"></div>
                                <button
                                  id="btn-set-status-reset"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusSelect("-");
                                  }}
                                  className="w-7 h-7 bg-slate-750 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 font-extrabold flex items-center justify-center cursor-pointer text-xs"
                                  title="Reset / Kosongkan"
                                >
                                  -
                                </button>
                                <button
                                  id="btn-set-status-close"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEditCell(null);
                                  }}
                                  className="w-5 h-5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/30 rounded-full flex items-center justify-center cursor-pointer text-[10px]"
                                  title="Tutup"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Cumulative Columns values */}
                      <td className="py-2 px-1 border border-slate-200 bg-emerald-50/40 text-emerald-700 font-black text-center text-xs">{totalHadir}</td>
                      <td className="py-2 px-1 border border-slate-200 bg-blue-50/40 text-blue-700 font-black text-center text-xs">{totalSakit}</td>
                      <td className="py-2 px-1 border border-slate-200 bg-amber-50/40 text-amber-700 font-black text-center text-xs">{totalIzin}</td>
                      <td className="py-2 px-1 border border-slate-200 bg-rose-50/40 text-rose-700 font-black text-center text-xs">{totalAlpa}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal-like backdrop if editing cell dropdown is open to allow easy closing by clicking outside */}
        {activeEditCell && (
          <div 
            onClick={() => setActiveEditCell(null)}
            className="fixed inset-0 z-30 bg-transparent"
          />
        )}

        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center text-xs font-bold text-slate-500">
          <div className="flex items-center gap-2 font-sans font-semibold text-slate-500">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Klik pada sel kosong bermateri "-" untuk menentukan status sakit (S), izin (I), alpa (A), atau hadir (H).</span>
          </div>
          <span className="font-mono text-slate-600">
            {monthNames[selectedMonth]} {selectedYear} | {classFilter === "Semua" ? "Seluruh Kelas" : `Kelas ${classFilter}`}
          </span>
        </div>

      </div>
        </>
      ) : (
        <div className="space-y-6 animate-fadeIn" id="rekap-siswa-tidak-absen-qr-view">
          
          {/* Non-Scanner Control Filter Bar */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Left side: search and class select & indicators */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  id="search-tidak-absen"
                  type="text"
                  placeholder="Cari nama atau NIS siswa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-xs font-semibold focus:outline-none text-slate-700 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-none">
                <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  id="filter-kelas-tidak-absen"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer text-stone-700"
                >
                  <option value="Semua">Semua Kelas</option>
                  {classesList.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Month & Year Selectors to scope dates */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 items-center flex-none">
                <select
                  id="ta-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="bg-transparent border-none text-xs font-extrabold text-slate-700 px-2 py-0.5 focus:ring-0 cursor-pointer"
                >
                  {monthNames.map((mName, mIdx) => (
                    <option key={mIdx} value={mIdx}>{mName}</option>
                  ))}
                </select>

                <select
                  id="ta-year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-transparent border-none text-xs font-extrabold text-slate-700 px-1.5 py-0.5 focus:ring-0 cursor-pointer"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right side: choose single day & export */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                <Calendar className="w-4 h-4 text-rose-500 hover:scale-110 transition-transform" />
                <span className="text-[11px] font-extrabold text-slate-500 whitespace-nowrap">Tanggal Terpilih:</span>
                <select
                  id="ta-date-select"
                  value={selectedDateStr}
                  onChange={(e) => setSelectedDateStr(e.target.value)}
                  className="bg-transparent border-none text-xs font-black text-rose-700 focus:outline-none focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  {calendarDatesStr.map((dStr) => {
                    const isWk = isWeekend(dStr);
                    const holidayLabel = getHolidayLabel(dStr, profile.holidayRanges);
                    const dayNum = dStr.split("-")[2];
                    const dayName = getDayName(dStr);
                    
                    let suffix = "";
                    if (isWk) suffix = " (Akhir Pekan)";
                    else if (holidayLabel) suffix = ` (${holidayLabel})`;

                    return (
                      <option key={dStr} value={dStr}>
                        {dayName}, {dayNum} {monthNames[selectedMonth]} {selectedYear}{suffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                id="btn-export-tidak-absen"
                onClick={handleExportNonScanners}
                disabled={studentsNotScannedQR.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Ekspor (.xlsx)
              </button>
            </div>
          </div>

          {/* Quick Stats Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Belum Scan QR</span>
              <span className="text-xl font-black text-slate-800 font-mono mt-0.5">{statsNonScanners.total} Siswa</span>
            </div>
            
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex flex-col justify-center">
              <span className="text-[10px] font-bold text-rose-600/80 uppercase tracking-wider block">Tanpa Keterangan (A)</span>
              <span className="text-xl font-black text-rose-700 font-mono mt-0.5">{statsNonScanners.A} Siswa</span>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col justify-center">
              <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-wider block">Sakit (S)</span>
              <span className="text-xl font-black text-blue-700 font-mono mt-0.5">{statsNonScanners.S} Siswa</span>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col justify-center">
              <span className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider block">Izin (I)</span>
              <span className="text-xl font-black text-amber-700 font-mono mt-0.5">{statsNonScanners.I} Siswa</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col justify-center">
              <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider block">Hadir Manual (H)</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-0.5">{statsNonScanners.H} Siswa</span>
            </div>
          </div>

          {/* Holiday/Weekend Banner Callout */}
          {(isWeekend(selectedDateStr) || getHolidayLabel(selectedDateStr, profile.holidayRanges)) && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs text-amber-800 font-semibold items-center select-none">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
              <span>
                Perhatian: Hari terpilih ({formatIndonesianDate(selectedDateStr)}) adalah <strong>{isWeekend(selectedDateStr) ? "Akhir Pekan (Sabtu/Minggu)" : getHolidayLabel(selectedDateStr, profile.holidayRanges)}</strong>.
              </span>
            </div>
          )}

          {/* Non-Scanners Table Grid */}
          <div className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden relative">
            <div className="overflow-x-auto min-h-[300px]">
              <table className="min-w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 select-none text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 text-center w-14">No</th>
                    <th className="py-3 px-4 w-28">NIS</th>
                    <th className="py-3 px-5">Nama Siswa</th>
                    <th className="py-3 px-4 text-center w-28">Kelas</th>
                    <th className="py-3 px-4 text-center w-48">Keterangan Jurnal</th>
                    <th className="py-3 px-4 text-center w-64">Aksi Fast-Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-stone-700">
                  {studentsNotScannedQR.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 font-sans">
                        <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                        <p className="font-bold text-slate-600 text-sm">Semua Siswa Terdaftar Sudah scan QR!</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Seluruh siswa pada kelas terfilter telah berhasil melakukan aktivitas absensi lewat alat pemindai QR Code hari ini.</p>
                      </td>
                    </tr>
                  ) : (
                    studentsNotScannedQR.map((siswa, idx) => {
                      const stat = getStatusOfNonScanner(siswa.nis);
                      return (
                        <tr key={siswa.nis} className="hover:bg-slate-50/50 transition-colors font-sans">
                          <td className="py-3 px-4 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{siswa.nis}</td>
                          <td className="py-3 px-5 font-bold text-slate-800">{siswa.nama}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-500">{siswa.kelas}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider shadow-2xs ${stat.style}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {stat.label} ({stat.code})
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                id={`btn-nonscan-h-${siswa.nis}`}
                                type="button"
                                onClick={() => onUpdateAttendanceStatus(siswa.nis, selectedDateStr, "H")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                  stat.code === "H"
                                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                                    : "bg-white text-slate-650 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                }`}
                                title="Set manual Hadir (H)"
                              >
                                H
                              </button>
                              
                              <button
                                id={`btn-nonscan-s-${siswa.nis}`}
                                type="button"
                                onClick={() => onUpdateAttendanceStatus(siswa.nis, selectedDateStr, "S")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                  stat.code === "S"
                                    ? "bg-blue-500 text-white border-blue-600 shadow-sm"
                                    : "bg-white text-slate-650 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                }`}
                                title="Set manual Sakit (S)"
                              >
                                S
                              </button>

                              <button
                                id={`btn-nonscan-i-${siswa.nis}`}
                                type="button"
                                onClick={() => onUpdateAttendanceStatus(siswa.nis, selectedDateStr, "I")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                  stat.code === "I"
                                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                                    : "bg-white text-slate-650 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                                }`}
                                title="Set manual Izin (I)"
                              >
                                I
                              </button>

                              <button
                                id={`btn-nonscan-a-${siswa.nis}`}
                                type="button"
                                onClick={() => onUpdateAttendanceStatus(siswa.nis, selectedDateStr, "A")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                  stat.code === "A"
                                    ? "bg-rose-500 text-white border-rose-600 shadow-sm"
                                    : "bg-white text-slate-650 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                                }`}
                                title="Set manual Alpa / Tanpa Keterangan (A)"
                              >
                                A
                              </button>

                              <div className="w-px h-4 bg-slate-200" />

                              <button
                                id={`btn-nonscan-reset-${siswa.nis}`}
                                type="button"
                                onClick={() => onUpdateAttendanceStatus(siswa.nis, selectedDateStr, "-")}
                                className="px-1.5 py-1 text-[10px] font-black text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer bg-slate-100"
                                title="Reset / Kosongkan data harian siswa"
                              >
                                Reset
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center text-xs font-bold text-slate-500">
              <span className="flex items-center gap-2 font-sans font-semibold text-slate-500">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Tekan tombol H, S, I, atau A untuk segera memperbarui jurnal & rekap presensi tanggal ini untuk siswa bersangkutan.</span>
              </span>
              <span className="font-mono text-slate-600">
                Tanggal: {formatIndonesianDate(selectedDateStr)} | total {studentsNotScannedQR.length} siswa belum scan QR
              </span>
            </div>
          </div>
        </div>
      )}

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
                id="btn-cancel-clear-presensi"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-clear-presensi"
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
