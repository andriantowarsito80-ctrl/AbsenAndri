/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Student } from "../types";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { 
  Plus, Upload, Search, Filter, SortAsc, Edit2, Trash2, X, Download, ShieldAlert, Check, RefreshCw, Printer, AlertTriangle
} from "lucide-react";

interface DatabaseTabProps {
  students: Student[];
  onAddStudent: (student: Student) => boolean; // returns false if NIS already exists
  onBulkAddStudents: (students: Student[]) => void;
  onUpdateStudent: (oldNis: string, updated: Student) => void;
  onDeleteStudent: (nis: string) => void;
  onClearAllStudents?: () => void;
  onDeleteClassStudents?: (className: string) => void;
}

export default function DatabaseTab({
  students,
  onAddStudent,
  onBulkAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onClearAllStudents,
  onDeleteClassStudents,
}: DatabaseTabProps) {
  // Filters and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [sortOrder, setSortOrder] = useState<"A-Z" | "Z-A">("A-Z");

  // Manual input form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [formNis, setFormNis] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formKelas, setFormKelas] = useState("");
  const [formError, setFormError] = useState("");

  // Excel Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // QR Code Modal popup for single student
  const [selectedQrStudent, setSelectedQrStudent] = useState<Student | null>(null);

  // Student deletion confirmation state (safe delete inside sandboxed iframe)
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Bulk deletion confirmation state
  const [bulkDeleteType, setBulkDeleteType] = useState<"all" | "class" | null>(null);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  // Bulk QR Code Print Modal
  const [isBulkPrintOpen, setIsBulkPrintOpen] = useState(false);
  const [bulkPrintClass, setBulkPrintClass] = useState("Semua");

  // Get list of distinct classes
  const classesList = Array.from(new Set(students.map((s) => s.kelas))).sort();

  // Handle opening Manual Form
  const openForm = (student?: Student) => {
    if (student) {
      setEditingNis(student.nis);
      setFormNis(student.nis);
      setFormNama(student.nama);
      setFormKelas(student.kelas);
    } else {
      setEditingNis(null);
      setFormNis("");
      setFormNama("");
      setFormKelas("");
    }
    setFormError("");
    setIsFormOpen(true);
  };

  // Submit manual input form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formNis.trim() || !formNama.trim() || !formKelas.trim()) {
      setFormError("Semua formulir input harus diisi.");
      return;
    }

    const compiledStudent: Student = {
      nis: formNis.trim(),
      nama: formNama.trim(),
      kelas: formKelas.trim().toUpperCase(),
    };

    if (editingNis) {
      // Editing Mode
      onUpdateStudent(editingNis, compiledStudent);
      setIsFormOpen(false);
    } else {
      // Add Mode
      const success = onAddStudent(compiledStudent);
      if (!success) {
        setFormError(`Siswa dengan NIS ${compiledStudent.nis} sudah terdaftar.`);
        return;
      }
      setIsFormOpen(false);
    }
  };

  // Process Excel File Upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        
        // Parse raw array of arrays
        const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        
        if (rawRows.length < 2) {
          setUploadError("Berkas Excel kosong atau tidak sesuai templat.");
          return;
        }

        // Detect columns from first header row
        // Looking for NIS, Nama, Kelas
        const headerRow = rawRows[0].map(h => String(h).toLowerCase().trim());
        const nisIndex = headerRow.findIndex(h => h.includes("nis"));
        const namaIndex = headerRow.findIndex(h => h.includes("nama"));
        const kelasIndex = headerRow.findIndex(h => h.includes("kelas"));

        if (nisIndex === -1 || namaIndex === -1 || kelasIndex === -1) {
          setUploadError("Kolom tidak terdeteksi. Berkas harus memiliki kolom: NIS, Nama, Kelas.");
          return;
        }

        const newStudents: Student[] = [];
        let duplicateCount = 0;
        let invalidCount = 0;

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const nis = String(row[nisIndex] ?? "").trim();
          const nama = String(row[namaIndex] ?? "").trim();
          const kelas = String(row[kelasIndex] ?? "").toUpperCase().trim();

          if (!nis || !nama || !kelas) {
            invalidCount++;
            continue;
          }

          // Check for duplicates in current uploads and existing db
          const alreadyExists = students.some(s => s.nis === nis) || newStudents.some(s => s.nis === nis);
          if (alreadyExists) {
            duplicateCount++;
            continue;
          }

          newStudents.push({ nis, nama, kelas });
        }

        if (newStudents.length > 0) {
          onBulkAddStudents(newStudents);
          setUploadSuccess(
            `Berhasil mengunggah ${newStudents.length} siswa baru.` + 
            (duplicateCount > 0 ? ` (${duplicateCount} NIS sudah terdaftar diabaikan)` : "") +
            (invalidCount > 0 ? ` (${invalidCount} baris tidak lengkap diabaikan)` : "")
          );
        } else {
          setUploadError("Tidak ada data siswa baru yang dapat diimpor (NIS duplikat atau kolom kosong).");
        }
      } catch (err) {
        console.error(err);
        setUploadError("Gagal membaca file Excel. Pastikan format berkas benar.");
      }
    };
    reader.readAsBinaryString(file);
    
    // Clear input so it can trigger change again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Download excel Template file
  const handleDownloadTemplate = () => {
    const wsData = [
      ["NIS", "Nama Siswa", "Kelas"],
      ["10201", "Ahmad Budiman", "X-A"],
      ["10202", "Benni Kurniawan", "X-A"],
      ["10203", "Citra Kirana", "XI-IPA-1"],
      ["10204", "Dewi Sartika", "XII-IPS-2"]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto column widths
    const columnWidths = [
      { wch: 10 },
      { wch: 25 },
      { wch: 15 }
    ];
    ws["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Templat Siswa");
    
    // Export file
    XLSX.writeFile(wb, "Templat_Database_Siswa.xlsx");
  };

  // Export current students to Excel
  const handleExportToExcel = () => {
    const exportData = students.map((s) => ({
      "NIS": s.nis,
      "Nama Siswa": s.nama,
      "Kelas": s.kelas
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Database Siswa");
    XLSX.writeFile(wb, `Database_Siswa_Sekolah_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Download individual QR Code as SVG
  const handleDownloadQrItem = (student: Student) => {
    const svgEl = document.getElementById(`qr-svg-${student.nis}`);
    if (!svgEl) return;
    
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `QRCode_${student.nis}_${student.nama.replace(/\s+/g, "_")}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Filter and Sort Database list
  const filteredStudents = students
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
    });

  // Print bulk QR codes
  const handlePrintQrs = () => {
    const printContent = document.getElementById("printable-qrs-area");
    if (!printContent) return;
    
    const windowToPrint = window.open("", "_blank");
    if (!windowToPrint) {
      alert("Popup terblokir! Izinkan popup untuk mencetak QR Code.");
      return;
    }

    const printableHtml = `
      <html>
        <head>
          <title>Cetak QR Code Siswa - ${bulkPrintClass}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 25px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .nama { font-weight: bold; font-size: 14px; margin-top: 10px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 180px; }
            .nis { font-family: monospace; font-size: 12px; color: #666; margin-top: 2px; }
            .kelas { font-size: 11px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; margin-top: 6px; display: inline-block; }
            @media print {
              body { padding: 0; }
              .card { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>QR Code Attendance Card - Kelas: ${bulkPrintClass}</h1>
          <div class="grid">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    windowToPrint.document.write(printableHtml);
    windowToPrint.document.close();
  };

  return (
    <div className="space-y-6" id="database-tab">
      
      {/* Top action controls bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🗂️ Database Siswa Terdaftar</h2>
          <p className="text-xs text-slate-500">Kelola informasi siswa, unggah massal melalui file Excel, dan unduh data QR Code.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Print Bulk QR Codes Button */}
          <button
            id="btn-bulk-qr"
            onClick={() => setIsBulkPrintOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Massal QR
          </button>

          {/* Download Template Excel */}
          <button
            id="btn-download-template"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors border border-blue-200 cursor-pointer"
            title="Download file Excel template untuk bulk upload siswa"
          >
            <Download className="w-3.5 h-3.5" /> Templat Excel
          </button>

          {/* Upload Button */}
          <button
            id="btn-upload-trigger"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Excel
          </button>
          
          <input
            id="excel-file-uploader"
            type="file"
            ref={fileInputRef}
            onChange={handleExcelUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          {/* Add Manual Student Button */}
          <button
            id="btn-add-manual"
            onClick={() => openForm()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Siswa
          </button>
        </div>
      </div>

      {/* Notifications banner */}
      {uploadSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 bg-emerald-500 rounded-full text-white p-0.5" />
            {uploadSuccess}
          </span>
          <button onClick={() => setUploadSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            {uploadError}
          </span>
          <button onClick={() => setUploadError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Database control filters area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            id="search-database"
            type="text"
            placeholder="Cari NIS atau Nama Siswa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Kelas:</span>
            <select
              id="filter-kelas-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="Semua">Semua Kelas</option>
              {classesList.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Sort Alphabetic Filter */}
          <div className="flex items-center gap-1.5">
            <SortAsc className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Urut Nama:</span>
            <select
              id="sort-db-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "A-Z" | "Z-A")}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 text-slate-700"
            >
              <option value="A-Z">A s/d Z</option>
              <option value="Z-A">Z s/d A</option>
            </select>
          </div>

          {/* Download spreadsheet XLS */}
          <button
            id="btn-export-db-xls"
            onClick={handleExportToExcel}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-colors border border-slate-200 cursor-pointer"
          >
            <Download className="w-3 h-3 text-slate-500" /> Unduh XLS
          </button>

          {/* Bulk Delete All Students */}
          <button
            id="btn-bulk-delete-all"
            onClick={() => setBulkDeleteType("all")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700/90 rounded-lg text-xs font-semibold transition-colors border border-rose-200 cursor-pointer"
            title="Hapus semua murid di semua kelas"
          >
            <Trash2 className="w-3 h-3 text-rose-500" /> Hapus Semua Kelas
          </button>

          {/* Bulk Delete Selected Class */}
          {classFilter !== "Semua" && (
            <button
              id="btn-bulk-delete-class"
              onClick={() => {
                setBulkDeleteType("class");
                setClassToDelete(classFilter);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-55/75 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-semibold transition-colors border border-rose-250 cursor-pointer animate-none"
              title={`Hapus semua murid di kelas ${classFilter}`}
            >
              <Trash2 className="w-3 h-3 text-rose-500" /> Hapus Kelas {classFilter}
            </button>
          )}
        </div>
      </div>

      {/* Students Data Grid/Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5 text-center w-16">No</th>
                <th className="py-3 px-4 w-32">NIS</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-center w-36">Absensi QR Code</th>
                <th className="py-3 px-4 text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Siswa tidak ditemukan atau database kosong.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((siswa, idx) => (
                  <tr key={siswa.nis} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{siswa.nis}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{siswa.nama}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 font-bold text-blue-600 text-[10px]">
                        Kelas {siswa.kelas}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1 select-none">
                        {/* Interactive trigger QR Code SVG */}
                        <div 
                          className="p-1 border border-slate-200 bg-white rounded shadow-sm hover:border-blue-400 transition-colors cursor-zoom-in"
                          onClick={() => setSelectedQrStudent(siswa)}
                          title="Klik untuk memperbesar QR Code"
                        >
                          <QRCodeSVG 
                            id={`qr-svg-${siswa.nis}`}
                            value={siswa.nis} 
                            size={44}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Ketuk QR</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          id={`btn-edit-${siswa.nis}`}
                          onClick={() => openForm(siswa)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all cursor-pointer"
                          title="Edit Siswa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          id={`btn-delete-${siswa.nis}`}
                          onClick={() => setStudentToDelete(siswa)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table footer count */}
        <div className="bg-slate-50/50 px-5 py-3 border-t border-slate-100 flex justify-between text-xs font-semibold text-slate-500 items-center">
          <span>Menampilkan {filteredStudents.length} dari total {students.length} siswa</span>
        </div>
      </div>

      {/* MANUAL INPUT MODAL (Form) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-none">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-md">{editingNis ? "📝 Sunting Data Siswa" : "👤 Tambah Siswa Baru"}</h3>
                <p className="text-[11px] text-slate-300">Tambahkan atau sesuaikan data siswa individual secara manual.</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-300 hover:bg-slate-800 rounded-lg p-1 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {formError && (
                <div className="text-xs bg-rose-50 border border-rose-200 rounded-lg text-rose-800 p-3 font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Input NIS */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Nomor Induk Siswa (NIS)</label>
                <input
                  id="form-nis"
                  type="text"
                  placeholder="Contoh: 10231"
                  value={formNis}
                  disabled={!!editingNis} // NIS acts as primary key
                  onChange={(e) => setFormNis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 font-mono"
                />
              </div>

              {/* Form Input Nama */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Nama Lengkap Siswa</label>
                <input
                  id="form-nama"
                  type="text"
                  placeholder="Contoh: Ahmad Budiman"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Form Input Kelas */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Kelas</label>
                <input
                  id="form-kelas"
                  type="text"
                  placeholder="Contoh: X-A atau XI-IPA-1"
                  value={formKelas}
                  onChange={(e) => setFormKelas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-300"
                />
              </div>

              {/* Action Submit */}
              <div className="pt-2 flex justify-end gap-3.5">
                <button
                  id="btn-cancel-form"
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  id="btn-save-form"
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE QR CODE PREVIEW MODAL */}
      {selectedQrStudent && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-center transform transition-all">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center text-left">
              <div>
                <h3 className="font-bold text-md">Kartu QR Code Absensi</h3>
                <p className="text-[10px] text-slate-300">Pindai kode QR untuk mencatat kehadiran harian.</p>
              </div>
              <button 
                onClick={() => setSelectedQrStudent(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center space-y-4">
              {/* ID Card visual style */}
              <div className="w-full border border-slate-200 rounded-xl bg-slate-55/65 p-6 shadow-sm border-dashed flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold pb-3 block">ABSENSI DIGITAL SISWA</span>
                
                {/* Large QR */}
                <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-inner">
                  <QRCodeSVG 
                    value={selectedQrStudent.nis} 
                    size={160}
                    level="Q"
                    includeMargin={true}
                  />
                </div>
                
                <h4 className="text-md font-bold mt-4 text-slate-800 leading-tight">{selectedQrStudent.nama}</h4>
                <p className="text-xs font-mono font-bold text-blue-600 mt-1">NIS: {selectedQrStudent.nis}</p>
                <span className="bg-blue-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold mt-2.5">
                  KELAS {selectedQrStudent.kelas}
                </span>
              </div>

              {/* Download link button */}
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <button
                  id="btn-close-qr-preview"
                  onClick={() => setSelectedQrStudent(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Tutup
                </button>
                <button
                  id="btn-download-qr-item"
                  onClick={() => handleDownloadQrItem(selectedQrStudent)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK QR CODE PRINT MODAL */}
      {isBulkPrintOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center whitespace-nowrap">
              <div>
                <h3 className="font-bold text-md">🖨️ Cetak Massal QR Absensi</h3>
                <p className="text-[10px] text-slate-400">Pilih rentang kelas untuk ditransfer ke format cetak label.</p>
              </div>
              <button 
                onClick={() => setIsBulkPrintOpen(false)}
                className="text-slate-400 hover:text-white rounded-lg p-1 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-xs font-bold text-slate-600">Pilih Filter Kelas:</span>
                <select
                  id="bulk-print-class"
                  value={bulkPrintClass}
                  onChange={(e) => setBulkPrintClass(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                  <option value="Semua">Semua Kelas ({students.length} Siswa)</option>
                  {classesList.map((cls) => {
                    const count = students.filter(s => s.kelas === cls).length;
                    return (
                      <option key={cls} value={cls}>Kelas {cls} ({count} Siswa)</option>
                    );
                  })}
                </select>
              </div>

              {/* Fake hidden printing preview that will be copied to print window */}
              <div id="printable-qrs-area" className="hidden">
                {students
                  .filter(s => bulkPrintClass === "Semua" || s.kelas === bulkPrintClass)
                  .map(s => (
                    <div key={s.nis} className="card">
                      <div style={{ padding: "10px", background: "#white", border: "1px solid #eee", borderRadius: "6px" }}>
                        {/* We use double-sized render for printing crispness */}
                        <QRCodeSVG value={s.nis} size={110} level="M" />
                      </div>
                      <div className="nama">${s.nama}</div>
                      <div className="nis">NIS: ${s.nis}</div>
                      <div className="kelas">KELAS ${s.kelas}</div>
                    </div>
                  ))
                }
              </div>

              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Tip Pencetakan: Pop-up cetak akan terbuka di halaman baru. Di dialog printer Anda, pastikan untuk mengaktifkan cetak gambar latar belakang (Background Graphics) untuk visual kartu yang maksimal.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  id="btn-close-bulk-print"
                  onClick={() => setIsBulkPrintOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Tutup
                </button>
                <button
                  id="btn-execute-print"
                  onClick={handlePrintQrs}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Mulai Cetak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SAFE DELETE CONFIRMATION MODAL FOR SANDBOX ENVIRONMENT */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-md font-bold text-slate-800">Konfirmasi Hapus Siswa</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus siswa bernama <strong className="text-slate-900">{studentToDelete.nama}</strong> (NIS: <span className="font-mono font-bold text-slate-800">{studentToDelete.nis}</span>, Kelas: <strong className="text-slate-900">{studentToDelete.kelas}</strong>)? Data kehadiran siswa juga tidak akan tercatat dalam pencarian database lokal.
            </p>

            <div className="flex justify-end gap-3">
              <button
                id="btn-cancel-delete"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete"
                onClick={() => {
                  onDeleteStudent(studentToDelete.nis);
                  setStudentToDelete(null);
                }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SAFE BULK DELETE CONFIRMATION MODAL */}
      {bulkDeleteType && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-2 bg-rose-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-md font-bold text-slate-800">
                {bulkDeleteType === "all" ? "Hapus Semua Kelas/Siswa" : `Hapus Siswa Kelas ${classToDelete}`}
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {bulkDeleteType === "all" ? (
                <>
                  Apakah Anda yakin ingin menghapus <strong className="text-rose-600">SEMUA SISWA</strong> dari database? Seluruh data kesiswaan serta log absensi historis yang terafiliasi akan terhapus secara permanen.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus seluruh data siswa di <strong className="text-slate-900">Kelas {classToDelete}</strong>? Seluruh siswa di kelas ini beserta log absensi mereka akan terhapus dari sistem kesiswaan lokal.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3">
              <button
                id="btn-cancel-bulk-delete"
                onClick={() => {
                  setBulkDeleteType(null);
                  setClassToDelete(null);
                }}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-150 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-bulk-delete"
                onClick={() => {
                  if (bulkDeleteType === "all") {
                    onClearAllStudents?.();
                  } else if (bulkDeleteType === "class" && classToDelete) {
                    onDeleteClassStudents?.(classToDelete);
                    setClassFilter("Semua");
                  }
                  setBulkDeleteType(null);
                  setClassToDelete(null);
                }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
