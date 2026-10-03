/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Student, SchoolProfile } from "../types";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import { 
  Search, Filter, Printer, Download, CheckSquare, Square, Check, RefreshCw, QrCode, IdCard, LayoutGrid, CheckCircle, Info, ChevronRight, Sparkles, Image
} from "lucide-react";

// Helper to convert OKLCH color definitions in CSS to highly compatible RGB/RGBA
export function replaceOklchInString(str: string): string {
  if (typeof str !== "string") return str;
  const strLower = str.toLowerCase();
  if (!strLower.includes("oklch") && !strLower.includes("oklab")) return str;

  let result = str;

  // 1. Convert oklch(L C H / A) or oklch(L C H)
  const oklchRegex = /oklch\(\s*([0-9.%]+)[,\s]+([0-9.%]+)[,\s]+([0-9.deg%]+)(?:\s*[\/|,\s]\s*([0-9.%]+))?\s*\)/gi;
  result = result.replace(oklchRegex, (match, lStr, cStr, hStr, aStr) => {
    try {
      let L = parseFloat(lStr);
      if (lStr.includes("%")) L /= 100;
      
      let C = parseFloat(cStr);
      if (cStr.includes("%")) C = (C / 100) * 0.4;
      
      let H = parseFloat(hStr);
      if (hStr.includes("deg")) H = parseFloat(hStr.replace("deg", ""));
      
      let A = 1;
      if (aStr) {
        A = parseFloat(aStr);
        if (aStr.includes("%")) A /= 100;
      }
      if (isNaN(A)) A = 1;

      if (isNaN(L) || isNaN(C) || isNaN(H)) {
        return "rgb(15, 118, 110)"; // Emerald fallback
      }

      L = Math.max(0, Math.min(1, L));
      C = Math.max(0, Math.min(1, C));
      H = H % 360;
      if (H < 0) H += 360;
      
      const hRad = (H * Math.PI) / 180;
      const chromA = C * Math.cos(hRad);
      const chromB = C * Math.sin(hRad);
      
      const l = L + 0.3963377774 * chromA + 0.2158037573 * chromB;
      const m = L - 0.1055613458 * chromA - 0.0638541728 * chromB;
      const s = L - 0.0894841775 * chromA - 1.2914855480 * chromB;

      const l3 = Math.pow(Math.max(0, l), 3);
      const m3 = Math.pow(Math.max(0, m), 3);
      const s3 = Math.pow(Math.max(0, s), 3);

      const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7068271810 * s3;

      const toSRGB = (v: number) => {
        return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      };

      const rgbR = Math.min(255, Math.max(0, Math.round(toSRGB(rLinear) * 255)));
      const rgbG = Math.min(255, Math.max(0, Math.round(toSRGB(gLinear) * 255)));
      const rgbB = Math.min(255, Math.max(0, Math.round(toSRGB(bLinear) * 255)));

      if (A < 1) {
        return `rgba(${rgbR}, ${rgbG}, ${rgbB}, ${A})`;
      } else {
        return `rgb(${rgbR}, ${rgbG}, ${rgbB})`;
      }
    } catch (e) {
      return "rgb(15, 118, 110)";
    }
  });

  // 2. Convert oklab(L A B / Alpha) or oklab(L A B)
  const oklabRegex = /oklab\(\s*([0-9.%]+)[,\s]+([0-9.a-z%+-]+)[,\s]+([0-9.a-z%+-]+)(?:\s*[\/|,\s]\s*([0-9.%]+))?\s*\)/gi;
  result = result.replace(oklabRegex, (match, lStr, aStrVal, bStrVal, alphaStr) => {
    try {
      let L = parseFloat(lStr);
      if (lStr.includes("%")) L /= 100;
      
      let chromA = parseFloat(aStrVal);
      if (aStrVal.includes("%")) chromA = (chromA / 100) * 0.4;
      
      let chromB = parseFloat(bStrVal);
      if (bStrVal.includes("%")) chromB = (chromB / 100) * 0.4;
      
      let A = 1;
      if (alphaStr) {
        A = parseFloat(alphaStr);
        if (alphaStr.includes("%")) A /= 100;
      }
      if (isNaN(A)) A = 1;

      if (isNaN(L) || isNaN(chromA) || isNaN(chromB)) {
        return "rgb(15, 118, 110)";
      }

      L = Math.max(0, Math.min(1, L));
      
      const l = L + 0.3963377774 * chromA + 0.2158037573 * chromB;
      const m = L - 0.1055613458 * chromA - 0.0638541728 * chromB;
      const s = L - 0.0894841775 * chromA - 1.2914855480 * chromB;

      const l3 = Math.pow(Math.max(0, l), 3);
      const m3 = Math.pow(Math.max(0, m), 3);
      const s3 = Math.pow(Math.max(0, s), 3);

      const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7068271810 * s3;

      const toSRGB = (v: number) => {
        return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      };

      const rgbR = Math.min(255, Math.max(0, Math.round(toSRGB(rLinear) * 255)));
      const rgbG = Math.min(255, Math.max(0, Math.round(toSRGB(gLinear) * 255)));
      const rgbB = Math.min(255, Math.max(0, Math.round(toSRGB(bLinear) * 255)));

      if (A < 1) {
        return `rgba(${rgbR}, ${rgbG}, ${rgbB}, ${A})`;
      } else {
        return `rgb(${rgbR}, ${rgbG}, ${rgbB})`;
      }
    } catch (e) {
      return "rgb(15, 118, 110)";
    }
  });

  return result;
}

/**
 * A highly robust, modern element capturing utility using html-to-image.
 * This completely resolves rendering issues with Tailwind v4, modern CSS properties,
 * and OKLCH color functions by drawing components to native SVGs first.
 */
export async function renderCardToPng(element: HTMLElement): Promise<string> {
  try {
    return await toPng(element, {
      pixelRatio: 2.8, // HD Resolution for crisp margins and printing
      backgroundColor: "#ffffff",
      style: {
        transform: "none",
        boxShadow: "none",
        opacity: "1",
      },
      cacheBust: true,
      skipFonts: false,
    });
  } catch (err) {
    console.error("[html-to-image] Primary render failed, retrying with fonts skipped...", err);
    // Fallback: Skip custom external web font downloads if they timeout or throw CORS errors
    return await toPng(element, {
      pixelRatio: 2.5,
      backgroundColor: "#ffffff",
      style: {
        transform: "none",
        boxShadow: "none",
        opacity: "1",
      },
      cacheBust: true,
      skipFonts: true,
    });
  }
}

interface KartuQRTabProps {
  students: Student[];
  profile: SchoolProfile;
}

type CardTheme = "green_alhaya" | "blue_formal" | "dark_premium" | "gold_luxury";

export default function KartuQRTab({ students, profile }: KartuQRTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [cardTheme, setCardTheme] = useState<CardTheme>("green_alhaya");
  const [selectedStudentNisList, setSelectedStudentNisList] = useState<string[]>(
    () => students.map(s => s.nis)
  );

  // Synchronize selection if students change
  React.useEffect(() => {
    setSelectedStudentNisList(students.map(s => s.nis));
  }, [students]);

  // Unique classes list for filtering
  const classesList = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.kelas))).sort();
  }, [students]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch = s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.nis.includes(searchTerm);
      const matchClass = classFilter === "Semua" || s.kelas === classFilter;
      return matchSearch && matchClass;
    });
  }, [students, searchTerm, classFilter]);

  // Handle Select All for current filtered list
  const handleSelectAllFiltered = () => {
    const filteredNis = filteredStudents.map(s => s.nis);
    const allFilteredAreSelected = filteredNis.every(nis => selectedStudentNisList.includes(nis));

    if (allFilteredAreSelected) {
      // Unselect only the filtered ones
      setSelectedStudentNisList(prev => prev.filter(nis => !filteredNis.includes(nis)));
    } else {
      // Select all filtered ones (avoiding duplicates)
      setSelectedStudentNisList(prev => {
        const union = new Set([...prev, ...filteredNis]);
        return Array.from(union);
      });
    }
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedStudentNisList.includes(s.nis));
  }, [filteredStudents, selectedStudentNisList]);

  const toggleStudentSelection = (nis: string) => {
    setSelectedStudentNisList(prev => 
      prev.includes(nis) ? prev.filter(n => n !== nis) : [...prev, nis]
    );
  };

  // Truncate School name if too long for card header
  const getDisplaySchoolName = (name: string) => {
    if (name.length > 36) {
      // Try abbreviation or elegant truncation
      return name.replace("Kabupaten ", "Kab. ").replace("Negeri ", "N ").substring(0, 38);
    }
    return name;
  };

  // State for PDF rendering progress
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // States for PNG ZIP rendering progress
  const [isGeneratingPngZip, setIsGeneratingPngZip] = useState(false);
  const [pngProgress, setPngProgress] = useState(0);

  // Download all selected cards packaged as individual high-res PNG files inside a ZIP
  const handleDownloadPNGZip = async () => {
    const selectedNis = filteredStudents
      .filter(s => selectedStudentNisList.includes(s.nis))
      .map(s => s.nis);

    console.log("[PNG ZIP GENERATION] Initiating PNG ZIP rendering cycle for students count:", selectedNis.length);

    if (selectedNis.length === 0) {
      alert("Tidak ada siswa terpilih. Silakan centang minimal satu siswa!");
      return;
    }

    setIsGeneratingPngZip(true);
    setPngProgress(0);

    const zip = new JSZip();

    try {
      for (let i = 0; i < selectedNis.length; i++) {
        const nis = selectedNis[i];
        setPngProgress(Math.round((i / selectedNis.length) * 100));

        const element = document.getElementById(`idcard-${nis}`);
        if (!element) {
          console.warn(`[PNG ZIP GENERATION] Element idcard-${nis} was not found in the DOM! Skipping...`);
          continue;
        }

        const studentData = students.find(s => s.nis === nis);
        const studentName = studentData ? studentData.nama.replace(/[^a-zA-Z0-9]/g, "_") : nis;

        // Save original styles & temporarily style card for rendering crisp screenshot
        const originalOpacity = element.style.opacity;
        const originalBoxShadow = element.style.boxShadow;
        const originalTransform = element.style.transform;

        element.style.opacity = "1";
        element.style.boxShadow = "none";
        element.style.transform = "none";

        const checkBtn = document.getElementById(`checkbox-badge-card-${nis}`);
        const downloadSingleBtn = document.getElementById(`single-download-btn-${nis}`);
        if (checkBtn) {
          checkBtn.style.setProperty("display", "none", "important");
        }
        if (downloadSingleBtn) {
          downloadSingleBtn.style.setProperty("display", "none", "important");
        }

        let imgData = "";
        try {
          imgData = await renderCardToPng(element);
        } catch (renderErr) {
          console.error(`[PNG ZIP] Render error for card ${nis}:`, renderErr);
        }

        // Restore styles to original state instantly
        element.style.opacity = originalOpacity;
        element.style.boxShadow = originalBoxShadow;
        element.style.transform = originalTransform;
        if (checkBtn) {
          checkBtn.style.display = "";
        }
        if (downloadSingleBtn) {
          downloadSingleBtn.style.display = "";
        }

        if (imgData) {
          const base64Data = imgData.split(",")[1];
          zip.file(`KARTU_${studentName}_${nis}.png`, base64Data, { base64: true });
        }
      }

      setPngProgress(95);
      
      const fileClassLabel = classFilter === "Semua" ? "SEMUA_KELAS" : `KELAS_${classFilter}`;
      const content = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `KARTU_ABSEN_PNG_${fileClassLabel}_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setPngProgress(100);
    } catch (err) {
      console.error("[PNG ZIP] CRITICAL FAILURE:", err);
      alert("Terjadi kesalahan saat memproses ekspor gambar PNG.");
    } finally {
      setIsGeneratingPngZip(false);
    }
  };

  // Download a single card image directly as high-res PNG
  const handleDownloadSinglePNG = async (nis: string) => {
    const element = document.getElementById(`idcard-${nis}`);
    if (!element) return;

    const studentData = students.find(s => s.nis === nis);
    const studentName = studentData ? studentData.nama.replace(/[^a-zA-Z0-9]/g, "_") : nis;

    try {
      // Save original styles
      const originalOpacity = element.style.opacity;
      const originalBoxShadow = element.style.boxShadow;
      const originalTransform = element.style.transform;

      element.style.opacity = "1";
      element.style.boxShadow = "none";
      element.style.transform = "none";

      const checkBtn = document.getElementById(`checkbox-badge-card-${nis}`);
      const downloadSingleBtn = document.getElementById(`single-download-btn-${nis}`);
      if (checkBtn) {
        checkBtn.style.setProperty("display", "none", "important");
      }
      if (downloadSingleBtn) {
        downloadSingleBtn.style.setProperty("display", "none", "important");
      }

      let imgData = "";
      try {
        imgData = await renderCardToPng(element);
      } catch (renderErr) {
        console.error("Single target render error:", renderErr);
      }

      // Restore style states
      element.style.opacity = originalOpacity;
      element.style.boxShadow = originalBoxShadow;
      element.style.transform = originalTransform;
      if (checkBtn) {
        checkBtn.style.display = "";
      }
      if (downloadSingleBtn) {
        downloadSingleBtn.style.display = "";
      }

      if (imgData) {
        const link = document.createElement("a");
        link.href = imgData;
        link.download = `KARTU_ABSEN_${studentName}_${nis}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Gagal merender gambar kartu.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat memproses unduhan gambar.");
    }
  };

  // Download high-resolution grid PDF for standard sizes
  const handleDownloadPDF = async () => {
    const selectedNis = filteredStudents
      .filter(s => selectedStudentNisList.includes(s.nis))
      .map(s => s.nis);

    console.log("[PDF GENERATION] Initiating PDF rendering cycle for students count:", selectedNis.length);

    if (selectedNis.length === 0) {
      alert("Tidak ada siswa terpilih. Silakan centang minimal satu siswa!");
      return;
    }

    setIsGeneratingPdf(true);
    setPdfProgress(0);

    try {
      // Create a premium A4 document
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Layout constants for 3 columns, 3 rows (9 cards per A4 page)
      // Standard ID card size (ISO 7810 ID-1): 8.56 cm x 5.398 cm (85.6 mm x 53.98 mm)
      // Since our card is in portrait layout, width is 53.98 mm and height is 85.6 mm.
      const cardWidthMm = 53.98;   // Width of card on paper
      const cardHeightMm = 85.6;   // Height of card on paper
      const marginX = 14;          // Left/right page margins to perfectly center 3 columns
      const marginY = 12;          // Top/bottom page margins to perfectly center 3 rows
      const gapX = 10;             // Gap between columns
      const gapY = 10;             // Gap between rows

      let cardCountOnCurrentPage = 0;

      for (let i = 0; i < selectedNis.length; i++) {
        const nis = selectedNis[i];
        setPdfProgress(Math.round((i / selectedNis.length) * 100));

        console.log(`[PDF GENERATION] [Card ${i+1}/${selectedNis.length}] Targeting element idcard-${nis}`);
        const element = document.getElementById(`idcard-${nis}`);
        if (!element) {
          console.warn(`[PDF GENERATION] Element idcard-${nis} was not found in the DOM! Skipping...`);
          continue;
        }

        // Save original styles & temporarily style card for rendering crisp screenshot
        const originalOpacity = element.style.opacity;
        const originalBoxShadow = element.style.boxShadow;
        const originalTransform = element.style.transform;
        
        element.style.opacity = "1";
        element.style.boxShadow = "none";
        element.style.transform = "none";

        // Temporarily hide checkbox badge selector and single download button so they don't block the visual design in PDF
        const checkBtn = element.querySelector(`#checkbox-badge-card-${nis}`) as HTMLElement;
        const downloadSingleBtn = element.querySelector(`#single-download-btn-${nis}`) as HTMLElement;
        
        if (checkBtn) {
          checkBtn.style.setProperty("display", "none", "important");
        }
        if (downloadSingleBtn) {
          downloadSingleBtn.style.setProperty("display", "none", "important");
        }

        console.log(`[PDF GENERATION] [Card ${i+1}/${selectedNis.length}] Rasterizing idcard-${nis} with renderCardToPng...`);

        let imgData = "";
        try {
          imgData = await renderCardToPng(element);
        } catch (renderErr) {
          console.error(`[PDF GENERATION] renderCardToPng error for card ${nis}:`, renderErr);
        }

        // Restore styles to original state instantly
        element.style.opacity = originalOpacity;
        element.style.boxShadow = originalBoxShadow;
        element.style.transform = originalTransform;
        
        if (checkBtn) {
          checkBtn.style.display = "";
        }
        if (downloadSingleBtn) {
          downloadSingleBtn.style.display = "";
        }

        if (!imgData) {
          console.warn(`[PDF GENERATION] No image data obtained for card ${nis}. Skipping this card.`);
          continue;
        }

        // Handle page breaking after every 9 cards (3x3 grid)
        if (cardCountOnCurrentPage > 0 && cardCountOnCurrentPage % 9 === 0) {
          console.log("[PDF GENERATION] Adding new page for card positioning...");
          pdf.addPage();
          cardCountOnCurrentPage = 0;
        }

        const col = cardCountOnCurrentPage % 3;
        const row = Math.floor(cardCountOnCurrentPage / 3);

        const xPos = marginX + col * (cardWidthMm + gapX);
        const yPos = marginY + row * (cardHeightMm + gapY);

        console.log(`[PDF GENERATION] Adding image to PDF sheet at col: ${col}, row: ${row}, location params x: ${xPos}mm, y: ${yPos}mm`);
        pdf.addImage(imgData, "PNG", xPos, yPos, cardWidthMm, cardHeightMm);
        cardCountOnCurrentPage++;
      }

      setPdfProgress(100);
      
      const fileClassLabel = classFilter === "Semua" ? "SEMUA_KELAS" : `KELAS_${classFilter}`;
      const fileName = `KARTU_ABSEN_QR_${fileClassLabel}_${Date.now()}.pdf`;
      console.log(`[PDF GENERATION] Exportation complete. Triggering download behavior: ${fileName}`);
      pdf.save(fileName);
    } catch (err) {
      console.error("[PDF GENERATION] CRITICAL FAILURE:", err);
      alert("Terjadi kesalahan saat memproses rendering PDF.");
    } finally {
      setIsGeneratingPdf(false);
      console.log("[PDF GENERATION] Lock released. Generation completed.");
    }
  };

  // Keep a clean fallback print triggered helper
  const handlePrint = () => {
    window.print();
  };

  // Get theme styles
  const themeConfig = {
    green_alhaya: {
      bgCard: "bg-white",
      gradientStart: "#022c22", // emerald-950
      gradientEnd: "#15803d", // green-700
      headerSubText: "#a7f3d0", // emerald-200
      pillBg: "#d1fae5", // emerald-100
      pillText: "#065f46", // emerald-800
      pillBorder: "#a7f3d0", // emerald-200
      borderColor: "#059669", // emerald-600
      accentBadgeText: "BUMI ALHAYA SUCCESS",
      buttonColor: "bg-emerald-600 hover:bg-emerald-700",
    },
    blue_formal: {
      bgCard: "bg-white",
      gradientStart: "#172554", // blue-950
      gradientEnd: "#1d4ed8", // blue-700
      headerSubText: "#bfdbfe", // blue-200
      pillBg: "#dbeafe", // blue-100
      pillText: "#1e3a8a", // blue-900
      pillBorder: "#bfdbfe", // blue-200
      borderColor: "#2563eb", // blue-600
      accentBadgeText: "SMART ACCREDITED",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
    },
    dark_premium: {
      bgCard: "bg-white",
      gradientStart: "#0a0a0a", // neutral-950
      gradientEnd: "#334155", // slate-700
      headerSubText: "#e2e8f0", // slate-200
      pillBg: "#1e293b", // slate-800
      pillText: "#f8fafc", // slate-50
      pillBorder: "#475569", // slate-600
      borderColor: "#0f172a", // slate-900
      accentBadgeText: "CODER INGRESS STANDARD",
      buttonColor: "bg-slate-800 hover:bg-slate-950",
    },
    gold_luxury: {
      bgCard: "bg-white",
      gradientStart: "#0f172a", // slate-950
      gradientEnd: "#78350f", // amber-900
      headerSubText: "#fde68a", // amber-200
      pillBg: "#fef3c7", // amber-100
      pillText: "#78350f", // amber-900
      pillBorder: "#fde68a", // amber-200
      borderColor: "#d97706", // amber-600
      accentBadgeText: "EXCELLENT PRESTIGE",
      buttonColor: "bg-amber-600 hover:bg-amber-700",
    }
  }[cardTheme];

  return (
    <div className="space-y-6" id="cetak-kartu-qr-tab-root">
      
      {/* Dynamic embedded printing styles block to ensure clean execution */}
      <style>{`
        @media print {
          /* Hide everything in standard dashboard layout */
          body * {
            visibility: hidden;
          }
          /* Show only print-friendly container area */
          #print-area-wrapper, #print-area-wrapper * {
            visibility: visible;
          }
          #print-area-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Custom grid columns specifically styled for print sheets */
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10mm !important;
            padding: 10mm 14mm !important;
            justify-items: center !important;
            background: white !important;
          }
          .print-card-box {
            width: 53.98mm !important;
            height: 85.6mm !important;
            transform: scale(0.816) !important;
            transform-origin: top center !important;
            margin-bottom: -15mm !important; /* compensate for scale-down vertical space gap */
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
            border-radius: 4mm !important;
          }
          /* Hide non-printable elements inside print area wrapper if any */
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Accent block */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-teal-700 to-emerald-900 p-6 rounded-3xl text-white shadow-md no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <IdCard className="w-6 h-6 text-emerald-300 animate-pulse" />
            <h1 className="text-lg font-black tracking-tight font-display uppercase">Menu Kartu Absensi QR Siswa</h1>
          </div>
          <p className="text-xs text-emerald-100 font-semibold max-w-2xl leading-normal">
            Generate dan unduh kartu absensi fisik siswa per kelas dalam format PDF siap cetak dengan ukuran standar ID Card (8.56 cm x 5.398 cm). Layout otomatis dioptimalkan agar muat hingga 9 kartu per halaman A4 untuk menghemat kertas!
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            id="btn-png-zip-trigger-main"
            type="button"
            onClick={handleDownloadPNGZip}
            className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 transition-all cursor-pointer select-none"
            title="Sangat direkomendasikan jika PDF bermasalah. Mengunduh seluruh kartu pilihan dalam satu berkas .zip berisi file gambar PNG resolusi tinggi."
          >
            <Image className="w-4 h-4 text-teal-100 animate-pulse" />
            Unduh Gambar PNG (.zip)
          </button>

          <button
            id="btn-pdf-trigger-main"
            type="button"
            onClick={handleDownloadPDF}
            className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-sm flex items-center gap-2 transition-all cursor-pointer select-none"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Unduh Berkas PDF
          </button>
          
          <button
            id="btn-print-trigger-main"
            type="button"
            onClick={handlePrint}
            className="px-3 py-2.5 bg-emerald-800/80 hover:bg-emerald-700/90 text-emerald-100 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer select-none"
            title="Gunakan cetak bawaan browser sebagai alternatif"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Browser
          </button>
        </div>
      </div>

      {/* Options Toolbar Panel */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/65 shadow-md flex flex-col gap-4 no-print">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <LayoutGrid className="w-4 h-4 text-emerald-500" /> Options & Filter Kartu Absensi
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* 1. Search name/nis */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 block">Cari Siswa</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="search-input-kartu"
                type="text"
                placeholder="Ketik nama / NIS siswa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none placeholder-slate-400 font-sans font-bold transition-all text-slate-700"
              />
            </div>
          </div>

          {/* 2. Filter Class */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 block">Filter Kelas</label>
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id="filter-kelas-kartu"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-sans font-black transition-all text-slate-700 cursor-pointer appearance-none"
              >
                <option value="Semua">Semua Kelas ({students.length} Siswa)</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>Kelas {c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Choose Card Template Theme */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 block">Pilih Desain Template</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id="select-theme-kartu"
                value={cardTheme}
                onChange={(e) => setCardTheme(e.target.value as CardTheme)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none font-sans font-black transition-all text-slate-700 cursor-pointer appearance-none"
              >
                <option value="green_alhaya">🟢 Hijau Bumi Al-Haya (Khas Islami)</option>
                <option value="blue_formal">🔵 Biru Formal Sekolah (Elegansi Modern)</option>
                <option value="dark_premium">⚫ Hitam Premium (Minimalis Mewah)</option>
                <option value="gold_luxury">🟡 Emas Mewah (Klasik Eksklusif)</option>
              </select>
            </div>
          </div>

          {/* 4. Selection stats & helpers */}
          <div className="flex items-end justify-start md:justify-end">
            <button
              id="btn-select-all-filtered-cards"
              type="button"
              onClick={handleSelectAllFiltered}
              className={`w-full py-2 px-4 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                isAllFilteredSelected
                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {isAllFilteredSelected ? (
                <>
                  <Square className="w-4 h-4" /> Batalkan Semua ({filteredStudents.length})
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" /> Pilih Semua ({filteredStudents.length})
                </>
              )}
            </button>
          </div>

        </div>

        {/* Live Filter Info banner */}
        <div className="bg-slate-50 p-3 px-4 rounded-xl border border-slate-100 flex items-center justify-between text-[11px] font-sans font-semibold text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-500" />
            <span>Terdapat <strong>{filteredStudents.length}</strong> siswa lolos filter. Dipilih untuk dicetak: <strong>{filteredStudents.filter(s => selectedStudentNisList.includes(s.nis)).length}</strong> kartu.</span>
          </div>
          <span className="text-[10px] bg-slate-200 text-slate-650 px-2 py-0.5 rounded font-black">
            Template: {cardTheme.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main Preview Container & Printable Area Wrapper */}
      <div id="print-area-wrapper" className="space-y-4">
        
        {/* Helper title header only visible during prints to organize printed assets */}
        <div className="hidden print:block text-center space-y-1 mb-6 border-b-2 border-slate-200 pb-3">
          <h2 className="text-base font-black uppercase text-slate-800 tracking-wider">KARTU ABSENSI DIGITAL SISWA</h2>
          <p className="text-[10px] font-bold text-slate-500">
            {profile.namaSekolah.toUpperCase()} • TAHUN PELAJARAN {profile.tahunPelajaran} • SEMESTER {profile.semester.toUpperCase()}
          </p>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white bg-slate-50/20 scroll-pt-12 no-print">
            <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
            <h4 className="text-sm font-black text-slate-700">Siswa Tidak Ditemukan</h4>
            <p className="text-[11px] text-slate-450 font-semibold max-w-sm mx-auto leading-relaxed mt-1">
              Tidak ada kartu absensi yang memenuhi syarat pencarian "{searchTerm}" di kelas "{classFilter}". Silakan atur filter kembali.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 print-grid">
            {filteredStudents.map((siswa) => {
              const isSelected = selectedStudentNisList.includes(siswa.nis);

              return (
                <div 
                  key={siswa.nis} 
                  id={`idcard-${siswa.nis}`}
                  style={{
                    borderColor: isSelected ? themeConfig.borderColor : '#cbd5e1',
                    boxShadow: isSelected ? `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06), 0 0 0 2px ${themeConfig.borderColor}40` : undefined,
                    backgroundColor: '#ffffff'
                  }}
                  className={`relative w-[250px] h-[395px] rounded-2xl overflow-hidden border flex flex-col justify-between select-none print-card-box ${
                    isSelected 
                      ? "" 
                      : "opacity-60 hover:opacity-100 no-print"
                  }`}
                >
                  {/* Top Wave Graphic Pattern Design with SVG overlays */}
                  <div className="absolute top-0 left-0 right-0 h-[105px] overflow-hidden z-0 bg-white">
                    {/* Dark gradient base background */}
                    <div 
                      style={{ backgroundImage: `linear-gradient(135deg, ${themeConfig.gradientStart}, ${themeConfig.gradientEnd})` }}
                      className="w-full h-full relative"
                    >
                      
                      {/* Left circular glow accent */}
                      <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
                      
                      {/* Soft wave path accent */}
                      <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-[40px] pointer-events-none fill-white opacity-100">
                        <path d="M0.00,49.98 C150.00,150.00 349.20,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"></path>
                      </svg>
                      
                      <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-[55px] pointer-events-none fill-white/15">
                        <path d="M0.00,49.98 C80.00,110.00 220.00,20.00 500.00,80.00 L500.00,150.00 L0.00,150.00 Z"></path>
                      </svg>
                    </div>
                  </div>

                  {/* Header info content layout */}
                  <div className="relative z-10 p-3 pt-3 flex items-start gap-2 h-[82px] overflow-hidden">
                    {/* Circle school logo container */}
                    <div className="w-11 h-11 rounded-full bg-white shadow-md p-1 shrink-0 flex items-center justify-center border border-white/40">
                      {profile.logo ? (
                        <img 
                          src={profile.logo} 
                          alt="Logo" 
                          crossOrigin="anonymous" 
                          referrerPolicy="no-referrer" 
                          className="max-w-full max-h-full object-contain" 
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-teal-600 flex items-center justify-center text-white font-serif font-black text-xs">P</div>
                      )}
                    </div>

                    <div className="text-left select-none text-[8px] font-sans text-white pr-1">
                      <span 
                        style={{ color: themeConfig.headerSubText.toLowerCase() }}
                        className="text-[7.5px] tracking-widest block uppercase font-extrabold"
                      >
                        KARTU ABSEN QR CODE
                      </span>
                      <h4 className="font-extrabold text-[9px] uppercase tracking-tight leading-3 font-display mt-0.5 line-clamp-2">
                        {getDisplaySchoolName(profile.namaSekolah)}
                      </h4>
                      <span className="text-[6.5px] block font-light mt-0.5 opacity-90 tracking-wide leading-none">TAHUN PELAJARAN: {profile.tahunPelajaran}</span>
                    </div>
                  </div>

                  {/* Main QR Code segment centered */}
                  <div className="flex flex-col items-center justify-center pt-2 relative z-10 flex-1 bg-white">
                    <div className="p-2.5 bg-white border border-slate-200 shadow-md rounded-2xl hover:scale-103 transition-transform duration-200">
                      <QRCodeCanvas 
                        id={`qr-card-canvas-${siswa.nis}`}
                        value={siswa.nis} 
                        size={120}
                        level="Q"
                        includeMargin={false}
                      />
                    </div>
                    {/* QR scanning border guideline visual */}
                    <div 
                      style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}
                      className="text-[7px] select-none font-black tracking-widest uppercase mt-2.5 border rounded px-2 py-0.5 font-mono"
                    >
                      NIS: {siswa.nis}
                    </div>
                  </div>

                  {/* Footer Profile Segment of Student cards */}
                  <div className="relative bg-white pt-2 pb-3 px-4 flex flex-col justify-end items-center text-center z-10">
                    <div className="space-y-1 w-full overflow-hidden">
                      {/* Name in Display style */}
                      <h3 
                        style={{ color: '#1e293b' }}
                        className="font-display font-black text-sm tracking-tight truncate leading-tight w-full hover:overflow-visible hover:whitespace-normal px-2"
                        title={siswa.nama}
                      >
                        {siswa.nama}
                      </h3>
                      
                      {/* NIS ID badge indicator */}
                      <span 
                        style={{ color: '#64748b' }}
                        className="text-[9.5px] font-mono tracking-wide font-extrabold select-all block"
                      >
                        NOMOR ABSEN: {siswa.nis}
                      </span>
                    </div>

                    {/* Class badge pill */}
                    <div 
                      style={{
                        backgroundColor: themeConfig.pillBg,
                        color: themeConfig.pillText,
                        borderColor: themeConfig.pillBorder
                      }}
                      className="mt-2 px-4 py-0.5 rounded-full border text-[8.5px] font-black uppercase tracking-wider shadow-2xs inline-flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      Kelas {siswa.kelas}
                    </div>
                  </div>

                  {/* Bottom wave graphic aesthetic matching with subtle curves */}
                  <div className="relative h-[48px] overflow-hidden z-0 shrink-0 bg-white">
                    {/* Wave colored graphic base */}
                    <div className="absolute inset-0 z-0">
                      <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="absolute top-0 left-0 w-full h-[40px] pointer-events-none fill-white opacity-100 z-10">
                        <path d="M0.00,49.98 C150.00,150.00 349.20,-49.98 500.00,49.98 L500.00,0.00 L0.00,0.00 Z"></path>
                      </svg>
                      
                      {/* Gradient background bottom */}
                      <div 
                        style={{ backgroundImage: `linear-gradient(135deg, ${themeConfig.gradientStart}, ${themeConfig.gradientEnd})` }}
                        className="w-full h-full"
                      ></div>
                    </div>

                    {/* Left overlay label */}
                    <div className="absolute bottom-2 left-4 z-20 text-[6.5px] font-black text-white/50 tracking-widest font-mono uppercase">
                      AIS AUTO-VERIFY SYSTEM
                    </div>

                    {/* Right logo badge marker */}
                    <div className="absolute bottom-1.5 right-4 z-20 font-black text-white/95 text-[7px] tracking-wide bg-white/15 border border-white/10 px-2 py-0.5 rounded uppercase block">
                      {themeConfig.accentBadgeText}
                    </div>
                  </div>

                   {/* Single Download PNG Button (hidden on print absolutely) */}
                  <button
                    id={`single-download-btn-${siswa.nis}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSinglePNG(siswa.nis);
                    }}
                    className="absolute top-2.5 right-[46px] z-20 p-1.5 rounded-lg border shadow-xs cursor-pointer transition-all hover:scale-110 active:scale-95 bg-white/90 text-slate-650 border-slate-200/90 hover:bg-white hover:text-emerald-700 no-print flex items-center justify-center"
                    title="Unduh kartu milik siswa ini saja sebagai gambar PNG berkualitas tinggi"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>

                  {/* Checkbox overlay button overlay element over cards (hidden on print absolutely) */}
                  <button
                    id={`checkbox-badge-card-${siswa.nis}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStudentSelection(siswa.nis);
                    }}
                    className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-lg border shadow-xs cursor-pointer transition-all hover:scale-110 active:scale-95 no-print flex items-center justify-center ${
                      isSelected 
                        ? "bg-emerald-500 text-white border-emerald-600" 
                        : "bg-white/90 text-slate-400 border-slate-200/90 hover:bg-white hover:text-slate-700"
                    }`}
                    title={isSelected ? "Batalkan pilihan kartu" : "Pilih kartu ini"}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <div className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Loading Modal Overlay specifically styled for PDF rendering */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-all text-white p-6 no-print">
          <div className="bg-slate-950 p-8 rounded-3xl border border-emerald-500/30 max-w-sm w-full text-center space-y-6 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-sans font-black text-white text-base tracking-tight uppercase">Mengekspor PDF</h3>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                Sedang memproses & merender kartu QR terpilih ke lembar A4. Harap jangan tutup tab ini...
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                  style={{ width: `${pdfProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono font-black text-slate-400 px-1">
                <span>PROGRESS: {pdfProgress}%</span>
                <span>RENDERING KARTU</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal Overlay specifically styled for PNG ZIP rendering */}
      {isGeneratingPngZip && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-all text-white p-6 no-print">
          <div className="bg-slate-950 p-8 rounded-3xl border border-teal-500/35 max-w-sm w-full text-center space-y-6 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-teal-500/10 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-8 h-8 text-teal-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-sans font-black text-white text-base tracking-tight uppercase">Mengekspor PNG ZIP</h3>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                Sedang memproses & mengompres kartu QR terpilih menjadi gambar PNG presisi tinggi dalam bentuk ZIP. Harap tunggu...
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${pngProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono font-black text-slate-400 px-1">
                <span>PROGRESS: {pngProgress}%</span>
                <span>MENGOMPRES HINGGA SELESAI</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
