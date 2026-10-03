/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HolidayRange {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description: string;
}

export interface SchoolProfile {
  namaSekolah: string;
  npsn: string;
  status: string; // "Negeri" | "Swasta"
  namaKepalaSekolah: string;
  semester: "Ganjil" | "Genap";
  tahunPelajaran: string;
  jamMasuk: string; // "HH:MM", e.g., "07:00"
  logo?: string; // base64
  background?: string; // base64 or color / pattern code
  googleSheetsUrl?: string; // URL spreadsheet if user wants to sync
  googleAppsScriptUrl?: string; // URL Web App Apps Script
  holidayRanges: HolidayRange[];
}

export interface Student {
  nis: string; // NIS is unique identification
  nama: string;
  kelas: string;
}

export interface AttendanceRecord {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  waktuAbsensi: string; // ISO string format or YYYY-MM-DD HH:mm:ss
  keterangan: "H" | "DT" | "S" | "I" | "A"; // H = Hadir Tepat Waktu, DT = Datang Terlambat, S = Sakit, I = Izin, A = Alpa / Tanpa Keterangan
  menitTerlambat: number; // 0 if on time, otherwise minutes past jamMasuk
}

export interface DisplaySetting {
  theme: string;
  bgType: "default" | "color" | "custom";
  bgColor: string;
  bgImage?: string;
}
