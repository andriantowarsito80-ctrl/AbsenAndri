/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Student, AttendanceRecord, SchoolProfile } from "../types";
import { isWeekend, getHolidayLabel } from "../utils/dateUtils";
import * as XLSX from "xlsx";
import { Search, Filter, SortAsc, Download, ShieldAlert, BadgeCheck, Flame, Scale } from "lucide-react";

interface KedisiplinanTabProps {
  students: Student[];
  records: AttendanceRecord[];
  profile: SchoolProfile;
}

export default function KedisiplinanTab({
  students,
  records,
  profile,
}: KedisiplinanTabProps) {
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [sortOrder, setSortOrder] = useState<"A-Z" | "Z-A" | "L-MAX" | "L-MIN">("A-Z");
  
  // Month selection defaults to current system date
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Helper to resolve student disipline status
  const getDisciplineStatus = (incidentCount: number, accumulatedMinutes: number) => {
    if (incidentCount === 0) {
      return { label: "Sangat Disiplin", bg: "bg-emerald-100 text-emerald-800 border-emerald-200", badge: "💚" };
    } else if (incidentCount <= 2) {
      return { label: "Disiplin Baik", bg: "bg-cyan-100 text-cyan-800 border-cyan-200", badge: "💙" };
    } else if (incidentCount <= 5) {
      return { label: "Perlu Peringatan", bg: "bg-amber-100 text-amber-800 border-amber-200", badge: "💛" };
    } else {
      return { label: "Perlu Pembinaan", bg: "bg-rose-100 text-rose-800 border-rose-250", badge: "❤️" };
    }
  };

  // Compile calculations over the selected month for all students
  const studentDisciplineData = students
    .map((siswa) => {
      // Filter records belonging to the student in the selected Year and Month
      const studentMonthRecords = records.filter((r) => {
        if (r.nis !== siswa.nis) return false;
        
        // Match timestamp e.g. YYYY-MM-DD
        const datePart = r.waktuAbsensi.split(" ")[0];
        const [year, month, day] = datePart.split("-").map(Number);
        
        return year === selectedYear && (month - 1) === selectedMonth;
      });

      // Filter only "DT" (Datang Terlambat) logs
      const lateLogs = studentMonthRecords.filter((r) => r.keterangan === "DT");
      const totalIncidentKeterlambatan = lateLogs.length;
      
      // Accumulate minutes late
      const totalMenitKeterlambatan = lateLogs.reduce((acc, curr) => acc + curr.menitTerlambat, 0);

      const status = getDisciplineStatus(totalIncidentKeterlambatan, totalMenitKeterlambatan);

      return {
        siswa,
        totalIncidentKeterlambatan,
        totalMenitKeterlambatan,
        status,
      };
    })
    .filter((row) => {
      // Apply search & class filters
      const matchSearch = 
        row.siswa.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
        row.siswa.nis.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = classFilter === "Semua" || row.siswa.kelas === classFilter;
      return matchSearch && matchClass;
    })
    .sort((a, b) => {
      // Sort logic
      if (sortOrder === "A-Z") {
        return a.siswa.nama.localeCompare(b.siswa.nama);
      } else if (sortOrder === "Z-A") {
        return b.siswa.nama.localeCompare(a.siswa.nama);
      } else if (sortOrder === "L-MAX") {
        // Sort by minutes late descending
        return b.totalMenitKeterlambatan - a.totalMenitKeterlambatan;
      } else {
        // Sort by minutes late ascending
        return a.totalMenitKeterlambatan - b.totalMenitKeterlambatan;
      }
    });

  const classesList = Array.from(new Set(students.map((s) => s.kelas))).sort();

  // Export disciplines review report to Excel
  const handleDownloadDisciplineReport = () => {
    const tableData = studentDisciplineData.map((row, idx) => ({
      "No": idx + 1,
      "NIS": row.siswa.nis,
      "Nama Siswa": row.siswa.nama,
      "Kelas": row.siswa.kelas,
      "Total Terlambat (Kali)": row.totalIncidentKeterlambatan,
      "Total Menit Terlambat (Menit)": row.totalMenitKeterlambatan,
      "Status Kedisiplinan": row.status.label
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(tableData);
    
    ws["!cols"] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 25 },
      { wch: 10 },
      { wch: 22 },
      { wch: 25 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Disiplin Siswa");
    XLSX.writeFile(wb, `Laporan_Kedisiplinan_${monthNames[selectedMonth]}_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6" id="kedisiplinan-tab">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">⚖️ Raport & Dashboard Kedisiplinan Siswa</h2>
          <p className="text-xs text-slate-500">
            Pemantauan tingkat ketertiban siswa berdasarkan akumulasi frekuensi dan total menit keterlambatan dalam satu bulan kalender sekolah.
          </p>
        </div>

        {/* Action button */}
        <button
          id="btn-download-discipline-report"
          onClick={handleDownloadDisciplineReport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          disabled={studentDisciplineData.length === 0}
        >
          <Download className="w-3.5 h-3.5" /> Unduh Laporan Kedisiplinan (.xlsx)
        </button>
      </div>

      {/* Database Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-4 justify-between items-center">
        {/* Search Bar input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            id="search-kedisiplinan"
            type="text"
            placeholder="Cari Nama Siswa / NIS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700"
          />
        </div>

        {/* Filters and controls */}
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
          
          {/* Month control */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500">Bulan:</span>
            <select
              id="disiplin-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              {monthNames.map((mName, mIdx) => (
                <option key={mIdx} value={mIdx}>{mName}</option>
              ))}
            </select>
          </div>

          {/* Class Filter selection */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500">Kelas:</span>
            <select
              id="disiplin-class-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="Semua">Semua Kelas</option>
              {classesList.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Sort order configuration */}
          <div className="flex items-center gap-1">
            <SortAsc className="w-3.5 h-3.5 text-slate-500" />
            <select
              id="disiplin-sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700 cursor-pointer"
            >
              <option value="A-Z">Nama A - Z</option>
              <option value="Z-A">Nama Z - A</option>
              <option value="L-MAX">Terlambat Terlama</option>
              <option value="L-MIN">Terlambat Tersingkat</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistics badges summaries blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 select-none">
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-150 text-center space-y-1">
          <BadgeCheck className="w-6 h-6 mx-auto text-emerald-600" />
          <span className="text-[11px] text-emerald-700 block font-extrabold uppercase tracking-wider">Sangat Disiplin (0x)</span>
          <span className="text-xl font-bold font-mono text-emerald-950">
            {studentDisciplineData.filter(d => d.totalIncidentKeterlambatan === 0).length}
          </span>
          <span className="text-[10px] text-slate-500 block">Siswa Berprestasi</span>
        </div>

        <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-150 text-center space-y-1">
          <Scale className="w-6 h-6 mx-auto text-cyan-600" />
          <span className="text-[11px] text-cyan-700 block font-extrabold uppercase tracking-wider">Disiplin Baik (1-2x)</span>
          <span className="text-xl font-bold font-mono text-cyan-950">
            {studentDisciplineData.filter(d => d.totalIncidentKeterlambatan > 0 && d.totalIncidentKeterlambatan <= 2).length}
          </span>
          <span className="text-[10px] text-slate-500 block">Siswa Cukup Patuh</span>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 border border-amber-150 text-center space-y-1">
          <Flame className="w-6 h-6 mx-auto text-amber-600" />
          <span className="text-[11px] text-amber-700 block font-extrabold uppercase tracking-wider">Peringatan (3-5x)</span>
          <span className="text-xl font-bold font-mono text-amber-950">
            {studentDisciplineData.filter(d => d.totalIncidentKeterlambatan > 2 && d.totalIncidentKeterlambatan <= 5).length}
          </span>
          <span className="text-[10px] text-slate-500 block">Butuh Perhatian</span>
        </div>

        <div className="bg-rose-50 rounded-xl p-4 border border-rose-150 text-center space-y-1">
          <ShieldAlert className="w-6 h-6 mx-auto text-rose-600" />
          <span className="text-[11px] text-rose-700 block font-extrabold uppercase tracking-wider">Pembinaan (&gt;5x)</span>
          <span className="text-xl font-bold font-mono text-rose-950">
            {studentDisciplineData.filter(d => d.totalIncidentKeterlambatan > 5).length}
          </span>
          <span className="text-[10px] text-slate-500 block">Perlu Dibimbing</span>
        </div>
      </div>

      {/* Main Table reports */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5 text-center w-16">No</th>
                <th className="py-3 px-4 w-32">NIS</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-center">Terlambat Kedatangan</th>
                <th className="py-3 px-4 text-center">Akumulasi Menit Telat</th>
                <th className="py-3 px-4 text-center w-48">Status Kedisiplinan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {studentDisciplineData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Scale className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Belum ditemukan data kedisiplinan pada filter aktif.
                  </td>
                </tr>
              ) : (
                studentDisciplineData.map((row, idx) => {
                  const { siswa, totalIncidentKeterlambatan, totalMenitKeterlambatan, status } = row;

                  return (
                    <tr key={siswa.nis} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{siswa.nis}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{siswa.nama}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-150 border border-slate-200 font-bold text-slate-700 text-[10px]">
                          Kelas {siswa.kelas}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {totalIncidentKeterlambatan === 0 ? (
                          <span className="text-emerald-600">0 kali</span>
                        ) : (
                          <span className={`${totalIncidentKeterlambatan > 5 ? "text-rose-600" : "text-slate-800"}`}>
                            {totalIncidentKeterlambatan} kali
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {totalMenitKeterlambatan === 0 ? (
                          <span className="text-emerald-600">0 menit</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded ${totalMenitKeterlambatan > 60 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                            {totalMenitKeterlambatan} menit
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10.5px] font-extrabold shadow-2xs ${status.bg}`}>
                          <span>{status.badge}</span>
                          <span>{status.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info counts */}
        <div className="bg-slate-50/50 px-5 py-3 border-t border-slate-105 flex justify-between text-xs font-semibold text-slate-500 items-center">
          <span>Menampilkan {studentDisciplineData.length} records disiplin siswa</span>
          <span className="text-[11px] font-bold text-slate-600">Periode: {monthNames[selectedMonth]} {selectedYear}</span>
        </div>
      </div>
    </div>
  );
}
