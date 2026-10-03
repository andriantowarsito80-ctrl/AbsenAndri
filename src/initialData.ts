/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, AttendanceRecord, SchoolProfile } from "./types";

export const INITIAL_SCHOOL_PROFILE: SchoolProfile = {
  namaSekolah: "SMA Negeri 1 Majalaya Kabupaten Karawang",
  npsn: "69915810",
  status: "Negeri",
  namaKepalaSekolah: "Dr. Ratih Komala, M.Pd.",
  semester: "Genap",
  tahunPelajaran: "2025/2026",
  jamMasuk: "07:00",
  holidayRanges: [
    {
      id: "libur-1",
      startDate: "2026-06-15",
      endDate: "2026-06-25",
      description: "Libur Kenaikan Kelas & Akhir Tahun Ajaran"
    },
    {
      id: "libur-2",
      startDate: "2026-03-30",
      endDate: "2026-04-02",
      description: "Libur Khusus Keagamaan"
    }
  ]
};

export const INITIAL_STUDENTS: Student[] = [
  { nis: "10101", nama: "Aditya Pratama", kelas: "X-A" },
  { nis: "10102", nama: "Anissa Rahmawati", kelas: "X-A" },
  { nis: "10103", nama: "Budi Santoso", kelas: "X-A" },
  { nis: "10104", nama: "Citra Lestari", kelas: "X-A" },
  { nis: "10105", nama: "Dimas Anggara", kelas: "X-A" },
  { nis: "10106", nama: "Eka Saputra", kelas: "X-B" },
  { nis: "10107", nama: "Fani Handayani", kelas: "X-B" },
  { nis: "10108", nama: "Gilang Ramadhan", kelas: "X-B" },
  { nis: "10109", nama: "Hana Pertiwi", kelas: "X-B" },
  { nis: "10110", nama: "Indra Wijaya", kelas: "X-B" },
  
  { nis: "20101", nama: "Kevin Sanjaya", kelas: "XI-IPA-1" },
  { nis: "20102", nama: "Larasati Putri", kelas: "XI-IPA-1" },
  { nis: "20103", nama: "Muhammad Rizky", kelas: "XI-IPA-1" },
  { nis: "20104", nama: "Nabila Syakieb", kelas: "XI-IPA-1" },
  { nis: "20105", nama: "Oki Setiana", kelas: "XI-IPA-1" },
  { nis: "20106", nama: "Putra Siregar", kelas: "XI-IPS-1" },
  { nis: "20107", nama: "Qori Sandioriva", kelas: "XI-IPS-1" },
  { nis: "20108", nama: "Rian Ardianto", kelas: "XI-IPS-1" },
  { nis: "20109", nama: "Siti Badriah", kelas: "XI-IPS-1" },
  { nis: "20110", nama: "Taufik Hidayat", kelas: "XI-IPS-1" },
  
  { nis: "30101", nama: "Umar Syarif", kelas: "XII-IPA-2" },
  { nis: "30102", nama: "Vina Panduwinata", kelas: "XII-IPA-2" },
  { nis: "30103", nama: "Wahyu Hidayat", kelas: "XII-IPA-2" },
  { nis: "30104", nama: "Xena Aliyah", kelas: "XII-IPA-2" },
  { nis: "30105", nama: "Yusuf Mansur", kelas: "XII-IPA-2" },
  { nis: "30106", nama: "Zaskia Adya", kelas: "XII-IPS-2" },
  { nis: "30107", nama: "Ahmad Dhani", kelas: "XII-IPS-2" },
  { nis: "30108", nama: "Bella Shofie", kelas: "XII-IPS-2" },
  { nis: "30109", nama: "Cakra Khan", kelas: "XII-IPS-2" },
  { nis: "30110", nama: "Dewi Persik", kelas: "XII-IPS-2" }
];

// Helper to generate some attendance history from Mon May 25, 2026 to Fri May 29, 2026
export const generateInitialAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const dates = [
    "2026-05-25", // Mon
    "2026-05-26", // Tue
    "2026-05-27", // Wed
    "2026-05-28", // Thu
    "2026-05-29"  // Fri
  ];

  // For each date, let some students attend on time, some late, and some not attend (will be calculated in spreadsheet)
  dates.forEach((date, dateIdx) => {
    INITIAL_STUDENTS.forEach((student, studentIdx) => {
      // Deterministic pseudo-random generation based on index
      const val = (studentIdx * 7 + dateIdx * 13) % 100;
      
      if (val < 12) {
        // Did not attend - we don't write an AttendanceRecord, spreadsheet calculates it as "TA"
        return;
      } else if (val < 35) {
        // Late arrival
        const lateMinutes = 5 + (val % 25); // 5 to 29 minutes late
        const hour = 7;
        const minutes = lateMinutes;
        const minuteStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
        const seconds = 10 + (val % 40);
        const secondStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
        
        records.push({
          id: `${student.nis}-${date}`,
          nis: student.nis,
          nama: student.nama,
          kelas: student.kelas,
          waktuAbsensi: `${date} 07:${minuteStr}:${secondStr}`,
          keterangan: "DT",
          menitTerlambat: lateMinutes
        });
      } else {
        // On time arrival
        const earlyMinutes = 10 + (val % 45); // arrives between 06:15 and 06:59
        const minuteVal = 60 - earlyMinutes; // e.g., 60-10 = 50 -> 06:50
        const minuteStr = minuteVal < 10 ? `0${minuteVal}` : `${minuteVal}`;
        const seconds = 12 + (val % 45);
        const secondStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
        
        records.push({
          id: `${student.nis}-${date}`,
          nis: student.nis,
          nama: student.nama,
          kelas: student.kelas,
          waktuAbsensi: `${date} 06:${minuteStr}:${secondStr}`,
          keterangan: "H",
          menitTerlambat: 0
        });
      }
    });
  });

  return records;
};
