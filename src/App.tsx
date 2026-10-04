/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { SchoolProfile, Student, AttendanceRecord } from "./types";
import { INITIAL_SCHOOL_PROFILE, INITIAL_STUDENTS, generateInitialAttendance } from "./initialData";
import { calculateLateness, isWeekend, getHolidayLabel, formatIndonesianDate } from "./utils/dateUtils";
import { safeStorage } from "./utils/storage";

// Import Firebase and Firestore Sync helpers
import { 
  db,
  syncStudentToFirestore,
  deleteStudentFromFirestore,
  syncBulkStudentsToFirestore,
  clearAllStudentsFromFirestore,
  deleteSpecificStudentsFromFirestore,
  syncRecordToFirestore,
  syncBulkRecordsToFirestore,
  deleteRecordFromFirestore,
  deleteSpecificRecordsFromFirestore,
  deleteRecordsByDateFromFirestore,
  clearAllRecordsFromFirestore,
  syncSchoolProfileToFirestore,
  isStudentsCollectionEmpty
} from "./utils/firebase";
import { onSnapshot, collection, doc } from "firebase/firestore";

// Import modular pages/tabs
import DashboardTab from "./components/DashboardTab";
import DatabaseTab from "./components/DatabaseTab";
import LiveReportTab from "./components/LiveReportTab";
import RekapTab from "./components/RekapTab";
import PresensiKalenderTab from "./components/PresensiKalenderTab";
import KedisiplinanTab from "./components/KedisiplinanTab";
import PengaturanTab from "./components/PengaturanTab";
import ScannerTab from "./components/ScannerTab";
import LoginScreen from "./components/LoginScreen";
import { PWAInstallButton } from "./components/PWAInstallButton";
import KartuQRTab from "./components/KartuQRTab";

// Icon imports
import { 
  School, LayoutDashboard, Users, Clock, FileSpreadsheet, Scale, Settings, Camera, Menu, X, CheckSquare, Bell, Volume2, Sparkles, RefreshCw, CalendarCheck, IdCard
} from "lucide-react";

export default function App() {
  // 1. Core States powered by localStorage persistence
  const [profile, setProfile] = useState<SchoolProfile>(() => {
    const saved = safeStorage.getItem("absensi_school_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.namaSekolah === "SMA Negeri 1 Jakarta" || parsed.npsn === "20101234") {
          return {
            ...parsed,
            namaSekolah: "SMA Negeri 1 Majalaya Kabupaten Karawang",
            namaKepalaSekolah: "Dr. Ratih Komala, M.Pd.",
            npsn: "69915810"
          };
        }
        return parsed;
      } catch (e) {
        return INITIAL_SCHOOL_PROFILE;
      }
    }
    return INITIAL_SCHOOL_PROFILE;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = safeStorage.getItem("absensi_students");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal parse absensi_students:", e);
        return INITIAL_STUDENTS;
      }
    }
    return INITIAL_STUDENTS;
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = safeStorage.getItem("absensi_records");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal parse absensi_records:", e);
        return generateInitialAttendance();
      }
    }
    return generateInitialAttendance();
  });

  // Background configurations
  const [bgType, setBgType] = useState<"default" | "color" | "custom">(() => {
    return (safeStorage.getItem("absensi_bg_type") as any) || "color";
  });
  const [bgColor, setBgColor] = useState(() => {
    return safeStorage.getItem("absensi_bg_color") || "bg-gradient-to-tr from-slate-50 via-blue-50/20 to-slate-100/50";
  });
  const [bgImage, setBgImage] = useState<string | null>(() => {
    return safeStorage.getItem("absensi_bg_image") || null;
  });

  // UI Control states
  const [activeTab, setActiveTab] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => safeStorage.getItem("attendance_admin_logged") === "true");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [adminName, setAdminName] = useState(() => {
    return safeStorage.getItem("absensi_admin_name") || "Andrianto Warsito, S.Kom.";
  });
  const [adminPhoto, setAdminPhoto] = useState(() => {
    return safeStorage.getItem("absensi_admin_photo") || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";
  });

  // Global Notification/Toast state (for USB scanner feedback overlay)
  const [globalToast, setGlobalToast] = useState<{
    show: boolean;
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);

  // Sync state indication
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(() => {
    return safeStorage.getItem("absensi_quota_exceeded") === "true";
  });

  const isQuotaExceededError = (err: any): boolean => {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    const code = String(err.code || "").toLowerCase();
    return msg.includes("quota exceeded") || msg.includes("resource_exhausted") || msg.includes("resource-exhausted") || code.includes("resource-exhausted");
  };

  const handleQuotaExceeded = () => {
    setFirestoreQuotaExceeded(true);
    safeStorage.setItem("absensi_quota_exceeded", "true");
  };

  const handleWriteSuccess = () => {
    setFirestoreQuotaExceeded(false);
    safeStorage.removeItem("absensi_quota_exceeded");
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 1b. Real-time Firebase Firestore Sync Listeners
  useEffect(() => {
    setIsSyncing(true);
    // Listen to students collection
    const unsubscribeStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const studentsList: Student[] = [];
      snapshot.forEach((docSnap) => {
        studentsList.push(docSnap.data() as Student);
      });
      if (!snapshot.empty) {
        setStudents(studentsList);
        safeStorage.setItem("absensi_students", JSON.stringify(studentsList));
      } else {
        // If empty because user cleared it or it is a fresh DB, update local state
        setStudents([]);
        safeStorage.setItem("absensi_students", JSON.stringify([]));
      }
      setIsSyncing(false);
      handleWriteSuccess();
    }, (err) => {
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        console.warn("Firestore students sync warning (Quota Exceeded - Safe Local Fallback):", err);
      } else {
        console.error("Firestore students sync error:", err);
      }
      setIsSyncing(false);
    });

    // Listen to records collection
    const unsubscribeRecords = onSnapshot(collection(db, "records"), (snapshot) => {
      const recordsList: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        recordsList.push(docSnap.data() as AttendanceRecord);
      });
      // Sort records descending by time
      recordsList.sort((a, b) => b.waktuAbsensi.localeCompare(a.waktuAbsensi));
      
      if (!snapshot.empty) {
        setRecords(recordsList);
        safeStorage.setItem("absensi_records", JSON.stringify(recordsList));
      } else {
        // If empty because user cleared it or it is a fresh DB, update local state
        setRecords([]);
        safeStorage.setItem("absensi_records", JSON.stringify([]));
      }
      handleWriteSuccess();
    }, (err) => {
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        console.warn("Firestore records sync warning (Quota Exceeded - Safe Local Fallback):", err);
      } else {
        console.error("Firestore records sync error:", err);
      }
    });

    // Listen to school profile document
    const unsubscribeProfile = onSnapshot(doc(db, "school", "config"), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SchoolProfile;
        setProfile(data);
        safeStorage.setItem("absensi_school_profile", JSON.stringify(data));
        handleWriteSuccess();
      } else {
        // Seed config and initial students/records ONLY when database is completely uninitialized (fresh setup)
        // We check if the students collection is empty first to avoid overwriting user-deleted or custom-configured lists
        // CRITICAL: Only perform this seeding logic if we are strictly ONLINE. This prevents offline (luring) states 
        // from failing to fetch the server document, triggering a false-negative snapshot, and accidentally overwriting custom data.
        if (typeof navigator !== "undefined" && navigator.onLine) {
          try {
            const isEmpty = await isStudentsCollectionEmpty();
            if (isEmpty) {
              console.log("Firestore database is empty. Seeding initial profile, students, and records.");
              await syncSchoolProfileToFirestore(profile);
              await syncBulkStudentsToFirestore(students);
              await syncBulkRecordsToFirestore(records);
            } else {
              console.log("Students already exist in Firestore. Syncing profile document only.");
              await syncSchoolProfileToFirestore(profile);
            }
            handleWriteSuccess();
          } catch (e) {
            if (isQuotaExceededError(e)) {
              handleQuotaExceeded();
              console.warn("Gagal memeriksa status koleksi saat seeding (Penyimpanan lokal aktif):", e);
            } else {
              console.error("Gagal memeriksa status koleksi saat seeding:", e);
            }
          }
        } else {
          console.log("Dokumen profil tidak ditemukan dalam cache offline. Mengabaikan seeding otomatis untuk melindungi data pengguna.");
        }
      }
    }, (err) => {
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        console.warn("Firestore profile sync warning (Quota Exceeded - Safe Local Fallback):", err);
      } else {
        console.error("Firestore profile sync error:", err);
      }
    });

    return () => {
      unsubscribeStudents();
      unsubscribeRecords();
      unsubscribeProfile();
    };
  }, []);

  // Buffers for global hardware keyboard scanning
  const scannerBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(Date.now());

  // 2. Persistent saves helpers
  useEffect(() => {
    safeStorage.setItem("absensi_school_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    safeStorage.setItem("absensi_students", JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    safeStorage.setItem("absensi_records", JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    safeStorage.setItem("absensi_admin_name", adminName);
  }, [adminName]);

  useEffect(() => {
    safeStorage.setItem("absensi_admin_photo", adminPhoto);
  }, [adminPhoto]);

  // Audio feedback synthesis using HTML5 Audio element synthesizer
  const playAppSound = (soundType: "success" | "error") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (soundType === "success") {
        osc.type = "sine";
        // If offline, use a louder beep sound
        const freq = isOnline ? 880 : 1000;
        const volume = isOnline ? 0.1 : 0.6; // Much louder beep when offline
        const duration = isOnline ? 0.15 : 0.35; // Longer beep when offline
        
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // low drone buzz
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35); // longer warn
      }
    } catch (e) {
      console.warn("Audio synthesizer unsupported or waiting for initial user interaction thread", e);
    }
  };

  // Warning alarm feedback for duplicate scanning or errors under offline conditions
  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Sequence of rapid sawtooth pulses (like a warning siren alarm)
      const playPulse = (delay: number) => {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(550, audioCtx.currentTime); // Alarm pitch
            gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.18);
          } catch (err) {}
        }, delay);
      };

      // Trigger 3 fast warning pulses
      playPulse(0);
      playPulse(200);
      playPulse(400);
    } catch (e) {
      console.warn("Audio Context error generating alarm:", e);
    }
  };

  // Human voice notification using Web Speech Synthesis API
  const speakText = (text: string) => {
    try {
      if (!window.speechSynthesis) {
        console.warn("Speech Synthesis tidak didukung di browser ini.");
        return;
      }
      // Cancel previous speaking to prevent queues stacking up on fast scans
      window.speechSynthesis.cancel();

      // Normalisasi fonetik agar kata seperti SIMANJA dibaca utuh sebagai satu kata, bukan dieja huruf satu per satu
      const spokenText = text
        .replace(/\bSIMANJA\b/g, "Simanja")
        .replace(/\bQr-Code\b/gi, "QR Code")
        .replace(/\bSMAN\b/g, "SMA Negeri");

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = "id-ID"; // Set to Indonesian
      utterance.rate = 1.05;     // Slightly faster than standard for natural flow
      utterance.pitch = 1.0;    // Standard pitch

      // Try to select an Indonesian voice
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang === "id-ID" || v.lang.startsWith("id-") || v.lang.startsWith("id_"));
      if (idVoice) {
        utterance.voice = idVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Gagal menjalankan Text-To-Speech:", e);
    }
  };



  // 3. Central Attendance Registry Trigger (handles cameras & global USB barcodes alike!)
  const triggerAttendance = (nis: string): { success: boolean; msg: string; label?: string } | null => {
    // Look up student in database
    const matchedSiswa = students.find((s) => s.nis === nis);
    if (!matchedSiswa) {
      speakText("Siswa tidak terdaftar.");
      return null; // Signals student not found in scanner tab
    }

    // Capture standard timestamp variables (Local WIB offset)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const sec = String(now.getSeconds()).padStart(2, "0");
    
    const activeDateStr = `${yyyy}-${mm}-${dd}`;
    const activeTimestamp = `${activeDateStr} ${hh}:${min}:${sec}`;

    // Verify if weekend or holiday
    const isWk = isWeekend(activeDateStr);
    const holidayName = getHolidayLabel(activeDateStr, profile.holidayRanges);
    
    if (isWk || holidayName) {
      const formattedDate = formatIndonesianDate(activeDateStr);
      const customMsg = `Mohon Maaf Untuk Hari Ini, ${formattedDate} Tidak Ada Presensi Kehadiran`;
      speakText(customMsg);
      return {
        success: false,
        msg: `${customMsg} (${isWk ? "Akhir pekan" : holidayName}).`,
        label: matchedSiswa.nama
      };
    }

    // Verify if student has already scanned on the same calendar date
    const isDuplicate = records.some(
      (r) => r.nis === nis && r.waktuAbsensi.startsWith(activeDateStr)
    );

    if (isDuplicate) {
      const todayRecord = records.find(
        (r) => r.nis === nis && r.waktuAbsensi.startsWith(activeDateStr)
      )!;
      if (isOnline) {
        speakText(`Siswa ${matchedSiswa.nama} sudah absen harian.`);
      } else {
        playAlarmSound();
      }
      return {
        success: false,
        msg: `Siswa ini sudah melakukan absensi harian pada jam ${todayRecord.waktuAbsensi.split(" ")[1]}.`,
        label: matchedSiswa.nama
      };
    }

    // Calculate Lateteness in minutes past jamMasuk boundaries
    const latenessMinutes = calculateLateness(activeTimestamp, profile.jamMasuk);
    const keteranganLabel: "H" | "DT" = latenessMinutes > 0 ? "DT" : "H";

    const newRecord: AttendanceRecord = {
      id: `${nis}-${activeDateStr}`,
      nis,
      nama: matchedSiswa.nama,
      kelas: matchedSiswa.kelas,
      waktuAbsensi: activeTimestamp,
      keterangan: keteranganLabel,
      menitTerlambat: latenessMinutes,
    };

    // Prepend to attendance array so most recent appears on top
    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);

    // Sync to Firestore for multi-device real-time sync
    syncRecordToFirestore(newRecord);

    const speechResult = latenessMinutes > 0 
      ? `Absen berhasil, ${matchedSiswa.nama} terlambat ${latenessMinutes} menit.`
      : `Absen berhasil, ${matchedSiswa.nama} hadir tepat waktu.`;
    
    if (isOnline) {
      speakText(speechResult);
    }

    return {
      success: true,
      msg: latenessMinutes > 0 ? `Terlambat hadir +${latenessMinutes} menit` : "Hadir Tepat Waktu (H)",
      label: matchedSiswa.nama,
    };
  };

  // Helper handling feedback alerts for global scans
  const triggerAttendanceWithFeedback = (nis: string) => {
    const outcome = triggerAttendance(nis);
    if (outcome) {
      if (outcome.success) {
        playAppSound("success");
        setGlobalToast({
          show: true,
          type: "success",
          title: "SCAN ABSENSI BERHASIL",
          message: `${outcome.label} (${nis}) - ${outcome.msg} (Pukul ${new Date().toLocaleTimeString("id-ID")})`,
        });
      } else {
        playAppSound("error");
        setGlobalToast({
          show: true,
          type: "error",
          title: "PEMINDAIAN DUPLIKAT",
          message: `${outcome.label} (${nis}) sudah terdaftar: ${outcome.msg}`,
        });
      }
    } else {
      playAppSound("error");
      setGlobalToast({
        show: true,
        type: "error",
        title: "DATA TIDAK ADA",
        message: `Kartu NIS ${nis} tidak terdaftar di database kesiswaan.`,
      });
    }

    // Dismiss overlay after 5 seconds
    setTimeout(() => setGlobalToast(null), 5000);
  };

  // 4. Global Keyboard Listener (hardware USB barcode scanner catcher on any page!)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Do bypass if typing inside standard inputs to allow normal edits
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const potentialNis = scannerBufferRef.current.trim();
        scannerBufferRef.current = ""; // Clean buffer
        
        if (potentialNis.length > 2) {
          triggerAttendanceWithFeedback(potentialNis);
        }
      } else if (e.key.length === 1) {
        // High typing speeds (such as external machinery) will trigger intervals < 65ms
        if (diff < 65 || scannerBufferRef.current === "") {
          scannerBufferRef.current += e.key;
        } else {
          // Reset buffer if delay is too long (human typing speed)
          scannerBufferRef.current = e.key;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [students, records, profile]);

  // 5. Shared state update modifiers
  const handleUpdateProfile = (updated: Partial<SchoolProfile>) => {
    const nextProfile = { ...profile, ...updated };
    setProfile(nextProfile);
    syncSchoolProfileToFirestore(nextProfile)
      .then(() => handleWriteSuccess())
      .catch((err) => {
        if (isQuotaExceededError(err)) {
          handleQuotaExceeded();
        }
      });
  };

  const handleUpdateAppBg = (type: "default" | "color" | "custom", color: string, imageBase64: string | null) => {
    setBgType(type);
    safeStorage.setItem("absensi_bg_type", type);
    if (color) {
      setBgColor(color);
      safeStorage.setItem("absensi_bg_color", color);
    }
    if (imageBase64) {
      setBgImage(imageBase64);
      safeStorage.setItem("absensi_bg_image", imageBase64);
    } else {
      setBgImage(null);
      safeStorage.removeItem("absensi_bg_image");
    }
  };

  const handleAddStudent = (siswa: Student): boolean => {
    const exists = students.some((s) => s.nis === siswa.nis);
    if (exists) return false;

    const newList = [...students, siswa];
    setStudents(newList);
    syncStudentToFirestore(siswa)
      .then(() => handleWriteSuccess())
      .catch((err) => {
        if (isQuotaExceededError(err)) {
          handleQuotaExceeded();
        }
      });
    speakText(`Siswa baru ${siswa.nama} berhasil terdaftar.`);
    return true;
  };

  const handleBulkAddStudents = (list: Student[]) => {
    const newList = [...students, ...list];
    setStudents(newList);
    syncBulkStudentsToFirestore(list)
      .then(() => handleWriteSuccess())
      .catch((err) => {
        if (isQuotaExceededError(err)) {
          handleQuotaExceeded();
        }
      });
    speakText(`Berhasil menambahkan ${list.length} siswa secara massal.`);
  };

  const handleUpdateStudent = (oldNis: string, updated: Student) => {
    const newList = students.map((s) => (s.nis === oldNis ? updated : s));
    setStudents(newList);
    
    // Also denormalize / replace matching names inside historical records!
    const updatedRecords = records.map((r) => 
      r.nis === oldNis 
        ? { ...r, nis: updated.nis, nama: updated.nama, kelas: updated.kelas } 
        : r
    );
    setRecords(updatedRecords);

    // Sync to Firestore
    if (oldNis !== updated.nis) {
      deleteStudentFromFirestore(oldNis).catch((err) => {
        if (isQuotaExceededError(err)) {
          handleQuotaExceeded();
        }
      });
    }
    syncStudentToFirestore(updated)
      .then(() => handleWriteSuccess())
      .catch((err) => {
        if (isQuotaExceededError(err)) {
          handleQuotaExceeded();
        }
      });
    records.forEach((r) => {
      if (r.nis === oldNis) {
        syncRecordToFirestore({ ...r, nis: updated.nis, nama: updated.nama, kelas: updated.kelas })
          .then(() => handleWriteSuccess())
          .catch((err) => {
            if (isQuotaExceededError(err)) {
              handleQuotaExceeded();
            }
          });
      }
    });

    speakText(`Data siswa ${updated.nama} berhasil diperbarui.`);
  };

  const handleDeleteStudent = async (nis: string) => {
    const target = students.find((s) => s.nis === nis);
    const nameLabel = target ? target.nama : "Siswa";
    const originalStudents = [...students];
    const originalRecords = [...records];

    const newList = students.filter((s) => s.nis !== nis);
    setStudents(newList);
    safeStorage.setItem("absensi_students", JSON.stringify(newList));
    
    // Clean outstanding attendance logs of that pupil
    const updatedRecords = records.filter((r) => r.nis !== nis);
    setRecords(updatedRecords);
    safeStorage.setItem("absensi_records", JSON.stringify(updatedRecords));
    
    try {
      // 1. Delete Student profile document from Firestore
      await deleteStudentFromFirestore(nis);
      
      // 2. Safely clean outstanding attendance logs of that pupil using batched delete
      try {
        const studentRecords = records.filter((r) => r.nis === nis);
        if (studentRecords.length > 0) {
          await deleteSpecificRecordsFromFirestore(studentRecords);
        }
      } catch (logErr) {
        // Log log-deletion errors as a warning, do not roll back the student deletion
        console.warn("Pembersihan log absensi siswa gagal, namun data siswa tetap terhapus:", logErr);
      }
      
      handleWriteSuccess();
      speakText(`Data siswa ${nameLabel} berhasil dihapus.`);
    } catch (err) {
      console.error("Gagal menghapus siswa dari Firestore, mengembalikan state lokal:", err);
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        speakText(`Data siswa ${nameLabel} berhasil dihapus lokal.`);
        setGlobalToast({
          show: true,
          type: "success",
          title: "DIPROSES SECARA LOKAL",
          message: `Siswa ${nameLabel} berhasil dihapus (Mode Lokal).`,
        });
        setTimeout(() => setGlobalToast(null), 5000);
      } else {
        setStudents(originalStudents);
        setRecords(originalRecords);
        safeStorage.setItem("absensi_students", JSON.stringify(originalStudents));
        safeStorage.setItem("absensi_records", JSON.stringify(originalRecords));

        setGlobalToast({
          show: true,
          type: "error",
          title: "GAGAL MENGHAPUS SISWA",
          message: `Terjadi kesalahan sinkronisasi cloud saat menghapus ${nameLabel}. Data dikembalikan.`,
        });
        setTimeout(() => setGlobalToast(null), 5000);
        speakText(`Gagal menghapus data siswa ${nameLabel} dari cloud.`);
      }
    }
  };

  const handleClearAllStudents = async () => {
    const originalStudents = [...students];
    const originalRecords = [...records];

    setStudents([]);
    setRecords([]);
    safeStorage.setItem("absensi_students", JSON.stringify([]));
    safeStorage.setItem("absensi_records", JSON.stringify([]));
    
    try {
      await clearAllStudentsFromFirestore();
      await clearAllRecordsFromFirestore();
      handleWriteSuccess();
      speakText(`Seluruh data siswa dan rekam absensi berhasil dibersihkan.`);
    } catch (err) {
      console.error("Gagal membersihkan database di Firestore, mengembalikan state lokal:", err);
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        speakText(`Seluruh data siswa dan rekam absensi berhasil dibersihkan lokal.`);
        setGlobalToast({
          show: true,
          type: "success",
          title: "DIPROSES SECARA LOKAL",
          message: "Seluruh data berhasil dibersihkan di penyimpanan lokal browser.",
        });
        setTimeout(() => setGlobalToast(null), 5000);
      } else {
        setStudents(originalStudents);
        setRecords(originalRecords);
        safeStorage.setItem("absensi_students", JSON.stringify(originalStudents));
        safeStorage.setItem("absensi_records", JSON.stringify(originalRecords));

        setGlobalToast({
          show: true,
          type: "error",
          title: "GAGAL BERSIHKAN DATA",
          message: "Gagal membersihkan data dari cloud database. Data lokal dikembalikan.",
        });
        setTimeout(() => setGlobalToast(null), 5000);
        speakText(`Gagal membersihkan database.`);
      }
    }
  };

  const handleDeleteClassStudents = async (className: string) => {
    const originalStudents = [...students];
    const originalRecords = [...records];

    const newList = students.filter((s) => s.kelas !== className);
    setStudents(newList);
    safeStorage.setItem("absensi_students", JSON.stringify(newList));
    
    // Clean attendance logs belonging to students of that class
    const updatedRecords = records.filter((r) => r.kelas !== className);
    setRecords(updatedRecords);
    safeStorage.setItem("absensi_records", JSON.stringify(updatedRecords));
    
    try {
      // Delete from Firestore
      const classStudents = students.filter((s) => s.kelas === className);
      await deleteSpecificStudentsFromFirestore(classStudents);
      const classRecords = records.filter((r) => r.kelas === className);
      await deleteSpecificRecordsFromFirestore(classRecords);
      handleWriteSuccess();
      speakText(`Data kelas ${className} beserta seluruh siswanya berhasil dihapus.`);
    } catch (err) {
      console.error("Gagal menghapus kelas dari Firestore, mengembalikan state lokal:", err);
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        speakText(`Data kelas ${className} beserta seluruh siswanya berhasil dihapus lokal.`);
        setGlobalToast({
          show: true,
          type: "success",
          title: "DIPROSES SECARA LOKAL",
          message: `Data kelas ${className} berhasil dihapus di penyimpanan lokal browser.`,
        });
        setTimeout(() => setGlobalToast(null), 5000);
      } else {
        setStudents(originalStudents);
        setRecords(originalRecords);
        safeStorage.setItem("absensi_students", JSON.stringify(originalStudents));
        safeStorage.setItem("absensi_records", JSON.stringify(originalRecords));

        setGlobalToast({
          show: true,
          type: "error",
          title: "GAGAL HAPUS KELAS",
          message: `Terjadi kesalahan saat menghapus kelas ${className} dari cloud database.`,
        });
        setTimeout(() => setGlobalToast(null), 5000);
        speakText(`Gagal menghapus data kelas ${className}.`);
      }
    }
  };

  const handleClearAllRecords = async () => {
    const originalRecords = [...records];

    setRecords([]);
    safeStorage.setItem("absensi_records", JSON.stringify([]));
    
    try {
      await clearAllRecordsFromFirestore();
      handleWriteSuccess();
      speakText("Semua riwayat log absensi berhasil dikosongkan.");
    } catch (err) {
      console.error("Gagal mengosongkan log absensi di Firestore, mengembalikan state lokal:", err);
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        speakText("Semua riwayat log absensi berhasil dikosongkan lokal.");
        setGlobalToast({
          show: true,
          type: "success",
          title: "DIPROSES SECARA LOKAL",
          message: "Semua riwayat log absensi berhasil dikosongkan secara lokal.",
        });
        setTimeout(() => setGlobalToast(null), 5000);
      } else {
        setRecords(originalRecords);
        safeStorage.setItem("absensi_records", JSON.stringify(originalRecords));

        setGlobalToast({
          show: true,
          type: "error",
          title: "GAGAL BERSIHKAN LOG",
          message: "Gagal membersihkan riwayat kehadiran dari cloud database.",
        });
        setTimeout(() => setGlobalToast(null), 5000);
        speakText("Gagal mengosongkan riwayat log absensi.");
      }
    }
  };

  const handleDeleteRecordsByDate = async (dateStr: string) => {
    const originalRecords = [...records];

    const updated = records.filter((r) => !r.waktuAbsensi.startsWith(dateStr));
    setRecords(updated);
    safeStorage.setItem("absensi_records", JSON.stringify(updated));
    
    try {
      await deleteRecordsByDateFromFirestore(dateStr);
      handleWriteSuccess();
      const formatted = formatIndonesianDate(dateStr);
      speakText(`Data absensi pada ${formatted} berhasil dihapus.`);
    } catch (err) {
      console.error("Gagal menghapus log absensi tanggal di Firestore, mengembalikan state lokal:", err);
      if (isQuotaExceededError(err)) {
        handleQuotaExceeded();
        const formatted = formatIndonesianDate(dateStr);
        speakText(`Data absensi pada ${formatted} berhasil dihapus lokal.`);
        setGlobalToast({
          show: true,
          type: "success",
          title: "DIPROSES SECARA LOKAL",
          message: `Riwayat absensi tanggal ${dateStr} berhasil dihapus secara lokal.`,
        });
        setTimeout(() => setGlobalToast(null), 5000);
      } else {
        setRecords(originalRecords);
        safeStorage.setItem("absensi_records", JSON.stringify(originalRecords));

        setGlobalToast({
          show: true,
          type: "error",
          title: "GAGAL HAPUS TANGGAL",
          message: `Gagal menghapus riwayat absensi tanggal ${dateStr} dari cloud database.`,
        });
        setTimeout(() => setGlobalToast(null), 5000);
        speakText("Gagal menghapus data absensi tanggal tersebut.");
      }
    }
  };

  const handleUpdateAttendanceStatus = (nis: string, dateStr: string, status: "H" | "S" | "I" | "A" | "-") => {
    const student = students.find((s) => s.nis === nis);
    if (!student) return;

    if (status === "H") speakText(`Presensi ${student.nama} disetel hadir.`);
    else if (status === "S") speakText(`Presensi ${student.nama} disetel sakit.`);
    else if (status === "I") speakText(`Presensi ${student.nama} disetel izin.`);
    else if (status === "A") speakText(`Presensi ${student.nama} disetel alpa.`);
    else if (status === "-") speakText(`Presensi ${student.nama} dikosongkan.`);

    const recordId = status === "H" ? `manual-H-${nis}-${dateStr}` : `manual-${status}-${nis}-${dateStr}`;

    setRecords((prev) => {
      // Remove any existing log for this student on this day
      const withoutTarget = prev.filter(
        (r) => !(r.nis === nis && r.waktuAbsensi.startsWith(dateStr))
      );

      if (status === "-") {
        (async () => {
          try {
            await deleteRecordFromFirestore(`${nis}-${dateStr}`);
            await deleteRecordFromFirestore(`manual-H-${nis}-${dateStr}`);
            await deleteRecordFromFirestore(`manual-S-${nis}-${dateStr}`);
            await deleteRecordFromFirestore(`manual-I-${nis}-${dateStr}`);
            await deleteRecordFromFirestore(`manual-A-${nis}-${dateStr}`);
            const otherMatches = prev.filter((r) => r.nis === nis && r.waktuAbsensi.startsWith(dateStr));
            for (const r of otherMatches) {
              await deleteRecordFromFirestore(r.id);
            }
          } catch (err) {
            console.error(err);
          }
        })();
        return withoutTarget;
      }

      // Create manually inserted status log
      const newRecord: AttendanceRecord = {
        id: recordId,
        nis: student.nis,
        nama: student.nama,
        kelas: student.kelas,
        waktuAbsensi: `${dateStr} 00:00:00`,
        keterangan: status,
        menitTerlambat: 0
      };

      const updated = [...withoutTarget, newRecord];
      
      (async () => {
        try {
          // Sync to Firestore
          await syncRecordToFirestore(newRecord);
        } catch (err) {
          console.error(err);
        }
      })();

      return updated;
    });
  };

  // 6. Navigation tabs structures
  const tabsList = [
    { label: "Dashboard", sub: "Profil & Statistik Utama", icon: LayoutDashboard },
    { label: "Database Siswa", sub: "Kelola List & Absensi QR", icon: Users },
    { label: "Live Report", sub: "Catatan Aktivitas Pemindaian", icon: Clock },
    { label: "Spreadsheet Rekap", sub: "Visualisasi Alur Bulanan", icon: FileSpreadsheet },
    { label: "Jurnal Presensi", sub: "Kalender Wali Kelas", icon: CalendarCheck },
    { label: "Kedisiplinan", sub: "Akumulasi & Sanksi Murid", icon: Scale },
    { label: "Pengaturan", sub: "Sistem & Sinkronisasi Drive", icon: Settings },
    { label: "Scanner Kamera", sub: "Input Portal Lensa", icon: Camera },
    { label: "Kartu QR Siswa", sub: "Cetak Kartu Absensi Siswa", icon: IdCard },
  ];

  // Dynamically resolve custom background layouts styles
  const appContainerStyle: React.CSSProperties = {
    backgroundAttachment: "fixed",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundImage: bgType === "custom" && bgImage ? `url(${bgImage})` : "none",
  };

  const appContainerClass = bgType === "color" ? bgColor : bgType === "default" ? "bg-slate-50" : "";

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);

    try {
      const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const monthsIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const now = new Date();
      const dayName = daysIndo[now.getDay()];
      const dateNum = now.getDate();
      const monthName = monthsIndo[now.getMonth()];
      const yearNum = now.getFullYear();

      speakText(`Selamat Datang di SIMANJA, Aplikasi Absensi Qr-Code Siswa SMAN 1 Majalaya Kabupaten Karawang, Hari ini ${dayName} Tanggal ${dateNum} ${monthName} ${yearNum}`);
    } catch (e) {
      console.error("Gagal memutar notifikasi suara selamat datang:", e);
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} schoolName={profile.namaSekolah} schoolLogo={profile.logo} />;
  }

  return (
    <div 
      className={`min-h-screen text-slate-800 font-sans transition-all flex flex-col`}
      style={appContainerStyle}
    >
      {/* Dynamic base layer backdrop overlay if custom background is used */}
      {bgType === "custom" && bgImage && (
        <div className="fixed inset-0 bg-white/90 mix-blend-overlay pointer-events-none z-0"></div>
      )}

      {/* MOBILE DEVICE TOPNAV HEADER ACCENT */}
      <header className="lg:hidden bg-slate-900 text-white flex items-center justify-between p-4 shadow-md z-30 sticky top-0">
        <div className="flex items-center gap-2.5">
          {profile.logo ? (
            <img src={profile.logo} alt="Logo" className="w-8 h-8 rounded object-contain bg-white p-0.5" />
          ) : (
            <School className="w-7 h-7 text-blue-400" />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight line-clamp-1">{profile.namaSekolah}</h1>
              {isOnline ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Koneksi Online"></span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" title="Koneksi Offline (Luring Aktif)"></span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block whitespace-nowrap font-semibold">Tahun Pelajaran: {profile.tahunPelajaran}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="compact" />
          <button
            id="btn-toggle-sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* DETECT FLOATING HARDWARE BARCODE SUCCESS/ERROR NOTIFICATION */}
      {globalToast?.show && (
        <div className="fixed bottom-6 right-6 max-w-sm w-full z-100 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 p-4 flex gap-3.5 items-start backdrop-blur-md transition-all duration-300 animate-slide-in">
          <div className="shrink-0 mt-0.5 animate-pulse">
            {globalToast.type === "success" ? (
              <div className="p-1.5 rounded-lg bg-emerald-500 text-white">
                <CheckSquare className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-rose-500 text-white">
                <Bell className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black tracking-widest text-blue-400 font-display">{globalToast.title}</h4>
            <p className="text-xs text-slate-200 leading-normal font-semibold font-sans">{globalToast.message}</p>
            <span className="text-[9.5px] text-slate-400 inline-flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-emerald-400" /> Audio Beep Terpicu Global
            </span>
          </div>
          <button 
            onClick={() => setGlobalToast(null)} 
            className="text-slate-400 hover:text-white p-1 ml-auto cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN CONTAINER LAYOUT */}
      <div className={`flex flex-1 relative z-10 ${appContainerClass}`}>
        
        {/* SIDE BAR DASHBOARD CONTROLLER (DESKTOP + RESPONSIVE MOBILE ACCENT) */}
        <aside 
          id="navigation-sidebar"
          className={`fixed lg:sticky top-0 lg:top-4 h-[calc(100vh-16px)] lg:h-[calc(100vh-32px)] bg-slate-900 text-white w-64 lg:m-4 lg:rounded-2xl flex flex-col justify-between shadow-2xl z-40 transform transition-transform duration-300 pointer-events-auto
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Header area */}
          <div className="p-6 border-b border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              {profile.logo ? (
                <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-inner shrink-0">
                  <img src={profile.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 shadow-md">
                  <School className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="overflow-hidden">
                <h2 className="text-sm font-bold font-display tracking-tight text-white line-clamp-1">{profile.namaSekolah}</h2>
                <div className="flex gap-1.5 items-center">
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-extrabold uppercase whitespace-nowrap">NPSN {profile.npsn}</span>
                </div>
              </div>
            </div>


          </div>

          {/* Navigation link elements list */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {tabsList.map((tab, idx) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === idx;

              return (
                <button
                  id={`nav-link-tab-${idx}`}
                  key={idx}
                  onClick={() => {
                    setActiveTab(idx);
                    setIsSidebarOpen(false); // Close mobile sidebar
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group cursor-pointer ${
                    isActive 
                      ? "bg-blue-600 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <IconComponent className={`w-5 h-5 shrink-0 ${isActive ? "text-white opacity-95" : "text-slate-400 group-hover:text-white transition-all"}`} />
                  <div className="overflow-hidden">
                    <span className="text-xs tracking-wide block leading-none">{tab.label}</span>
                    <span className={`text-[9px] block leading-none mt-1 ${isActive ? "text-blue-200/80" : "text-slate-500"}`}>{tab.sub}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Footer branding identity check */}
          <div className="p-6 border-t border-slate-800 flex flex-col gap-3">
            <PWAInstallButton variant="full" />
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold tracking-widest block uppercase">Coded in Cloud Ingress</span>
              <span className="text-[10px] text-slate-300 block font-semibold leading-normal">Tahun Pelajaran {profile.tahunPelajaran} • Semester {profile.semester}</span>
            </div>
            <button
              id="btn-logout-app"
              onClick={() => {
                setShowLogoutModal(true);
              }}
              className="w-full py-2 bg-rose-600/25 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-extrabold border border-rose-500/20 active:scale-95 transition-all cursor-pointer block text-center"
            >
              Keluar Kelola Absensi
            </button>
          </div>
        </aside>

        {/* CONTAINER CONTENT ROUTING */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full z-10 space-y-6">
          
          {firestoreQuotaExceeded && (
            <div className="bg-amber-50/95 backdrop-blur-md border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md animate-fadeIn select-none z-20 relative">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-black text-amber-900 tracking-tight">SISTEM PENYIMPANAN LOKAL AKTIF (QUOTA DATABASE CLOUD HABIS)</h3>
                  <p className="text-[11px] text-amber-700 font-medium mt-1 leading-normal">
                    Kuota harian database Cloud (Firestore) Anda telah habis (Quota Exceeded). Seluruh data absensi dan siswa tetap dapat Anda kelola secara penuh dan tersimpan dengan sangat aman di penyimpanan lokal browser Anda.
                  </p>
                </div>
              </div>
              <span className="text-[9.5px] bg-amber-200/50 text-amber-800 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider whitespace-nowrap self-end sm:self-center">
                Mode Lokal Mandiri
              </span>
            </div>
          )}

          {/* TOP BAR / HEADER WITH ADMIN NAME AND PHOTO */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl md:rounded-3xl p-4 md:px-5 md:py-3.5 shadow-lg border border-white/50 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
            {/* Left side: Tab title and Active state */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                {(() => {
                  const CurrentIcon = tabsList[activeTab]?.icon;
                  return CurrentIcon ? <CurrentIcon className="w-5 h-5 text-blue-600" /> : null;
                })()}
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black text-slate-800 leading-tight">
                  {tabsList[activeTab]?.label || "Dashboard Utama"}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    Sistem {tabsList[activeTab]?.sub || "Aktif"}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Dynamic Offline/Online status badge */}
            <div className="flex items-center gap-2 shrink-0">
              {isOnline ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl text-emerald-800" title="Terhubung ke Internet">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span className="text-[9.5px] font-black uppercase tracking-wider font-mono">Daring (Online)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-150 px-3 py-1.5 rounded-xl text-amber-850 shadow-2xs animate-fadeIn" title="Aplikasi Berjalan Mandiri Tanpa Internet">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                  <span className="text-[9.5px] font-black uppercase tracking-wider font-mono">Luring (Offline Aktif)</span>
                </div>
              )}
            </div>

            {/* Right side: Admin Name & Profile Photo */}
            <div className="flex items-center gap-3 self-end sm:self-auto bg-slate-50/70 border border-slate-100 p-1.5 pr-4 rounded-2xl shrink-0 shadow-2xs">
              <div className="relative">
                <img
                  src={adminPhoto}
                  alt="Foto Admin"
                  className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm shadow-slate-200"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
              </div>
              <div className="text-left">
                <div className="text-[11px] font-black text-slate-800 leading-none flex items-center gap-1">
                  {adminName}
                  <span className="text-[8.5px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-black uppercase shrink-0">Admin</span>
                </div>
                <span className="text-[9.5px] font-bold text-slate-400 block mt-1 leading-none">
                  SMA Negeri 1 Majalaya Karawang
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/40 backdrop-blur-xs rounded-2xl md:rounded-3xl p-5 md:p-6 lg:p-8 shadow-xl border border-white/50 min-h-[calc(100vh-90px)] lg:min-h-[calc(100vh-140px)] relative overflow-hidden">
            
            {/* Header sparkle premium accent for design hierarchy */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 z-0"></div>

            <div className="relative z-10">
              {activeTab === 0 && (
                <DashboardTab 
                  profile={profile} 
                  students={students} 
                  records={records} 
                  onUpdateProfile={handleUpdateProfile} 
                  onNavigateToTab={(val) => setActiveTab(val)}
                />
              )}
              
              {activeTab === 1 && (
                <DatabaseTab 
                  students={students} 
                  onAddStudent={handleAddStudent} 
                  onBulkAddStudents={handleBulkAddStudents} 
                  onUpdateStudent={handleUpdateStudent} 
                  onDeleteStudent={handleDeleteStudent} 
                  onClearAllStudents={handleClearAllStudents}
                  onDeleteClassStudents={handleDeleteClassStudents}
                />
              )}

              {activeTab === 2 && (
                <LiveReportTab 
                  records={records} 
                  onClearAllRecords={handleClearAllRecords} 
                  onDeleteRecordsByDate={handleDeleteRecordsByDate}
                />
              )}

              {activeTab === 3 && (
                <RekapTab 
                  students={students} 
                  records={records} 
                  profile={profile} 
                  onClearAllRecords={handleClearAllRecords}
                />
              )}

              {activeTab === 4 && (
                <PresensiKalenderTab 
                  students={students} 
                  records={records} 
                  profile={profile} 
                  onUpdateAttendanceStatus={handleUpdateAttendanceStatus}
                  onClearAllRecords={handleClearAllRecords}
                />
              )}

              {activeTab === 5 && (
                <KedisiplinanTab 
                  students={students} 
                  records={records} 
                  profile={profile} 
                />
              )}

              {activeTab === 6 && (
                <PengaturanTab 
                  profile={profile} 
                  bgType={bgType}
                  bgColor={bgColor}
                  bgImage={bgImage}
                  onUpdateProfile={handleUpdateProfile} 
                  onUpdateAppBg={handleUpdateAppBg}
                  adminName={adminName}
                  onUpdateAdminName={setAdminName}
                  adminPhoto={adminPhoto}
                  onUpdateAdminPhoto={setAdminPhoto}
                  onClearAllRecords={handleClearAllRecords}
                />
              )}

              {activeTab === 7 && (
                <ScannerTab 
                  students={students} 
                  records={records} 
                  onTriggerAttendance={triggerAttendance} 
                  isOnline={isOnline}
                />
              )}

              {activeTab === 8 && (
                <KartuQRTab 
                  students={students} 
                  profile={profile} 
                />
              )}
            </div>
            
          </div>

        </main>

      </div>

      {/* Custom Logout Confirmation Modal to avoid blocking window.confirm in iframe environments */}
      {showLogoutModal && (
        <div id="logout-confirm-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full border border-slate-100 shadow-2xl relative">
            
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"></path>
              </svg>
            </div>

            <h3 className="text-sm font-black text-slate-800 tracking-tight mb-1">Keluar Kelola Absensi?</h3>
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mb-6">
              Sesi Anda akan diakhiri. Anda perlu memasukkan kembali username <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">admin</code> &amp; password administrator untuk mengelola database kembali.
            </p>

            <div className="flex gap-2.5">
              <button
                id="btn-logout-confirm-cancel"
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center"
              >
                Batal
              </button>
               <button
                id="btn-logout-confirm-submit"
                type="button"
                onClick={() => {
                  try {
                    speakText("Terima Kasih Sudah Berkunjung ke Aplikasi Absensi QR Code Murid SMA Negeri 1 Majalaya Karawang.");
                  } catch (e) {
                    console.error(e);
                  }
                  safeStorage.removeItem("attendance_admin_logged");
                  setIsLoggedIn(false);
                  setShowLogoutModal(false);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer text-center"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
