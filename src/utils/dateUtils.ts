/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HolidayRange } from "../types";

export const parseLocalDate = (dateInput: string | Date): Date => {
  if (dateInput instanceof Date) {
    return dateInput;
  }
  if (typeof dateInput === "string") {
    const parts = dateInput.trim().split(/[\sT]+/);
    const datePart = parts[0];
    const timePart = parts[1] || "00:00:00";
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm, ss] = timePart.split(":").map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
    }
  }
  return new Date(dateInput);
};

/**
 * Checks if a given date falls on a weekend (Saturday or Sunday)
 */
export const isWeekend = (dateInput: string | Date): boolean => {
  const date = parseLocalDate(dateInput);
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

/**
 * Checks if a date falls within any holiday range
 */
export const getHolidayLabel = (dateStr: string, holidayRanges: HolidayRange[]): string | null => {
  const dateKey = typeof dateStr === "string" ? dateStr.split(" ")[0].split("T")[0] : "";
  if (!dateKey) return null;

  for (const range of holidayRanges) {
    if (dateKey >= range.startDate && dateKey <= range.endDate) {
      return range.description || "Hari Libur";
    }
  }
  return null;
};

/**
 * Format date to Local Bahasa Indonesia format, e.g., "Senin, 25 Mei 2026"
 */
export const formatIndonesianDate = (dateInput: string | Date): string => {
  const date = parseLocalDate(dateInput);
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

/**
 * Format date to short label, e.g., "Senin / 25 Mei"
 */
export const formatShortDayDate = (dateInput: string | Date): string => {
  const date = parseLocalDate(dateInput);
  const dayName = date.toLocaleDateString("id-ID", { weekday: "long" });
  const dayNum = date.getDate();
  const monthName = date.toLocaleDateString("id-ID", { month: "short" });
  return `${dayName}\n${dayNum} ${monthName}`;
};

/**
 * Get name of day, e.g. "Senin"
 */
export const getDayName = (dateInput: string | Date): string => {
  const date = parseLocalDate(dateInput);
  return date.toLocaleDateString("id-ID", { weekday: "long" });
};

/**
 * Get all dates in a month for a specific target year as YYYY-MM-DD
 */
export const getDatesForMonth = (year: number, monthZeroBased: number): string[] => {
  const dates: string[] = [];
  const date = new Date(year, monthZeroBased, 1);
  while (date.getMonth() === monthZeroBased) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

/**
 * Calculate lateness in minutes
 * @param attendanceTimeStr YYYY-MM-DD HH:mm:ss
 * @param limitTimeStr HH:MM
 */
export const calculateLateness = (attendanceTimeStr: string, limitTimeStr: string): number => {
  // Extract time part from attendanceTimeStr
  const timeMatch = attendanceTimeStr.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return 0;
  
  const hAtt = parseInt(timeMatch[1], 10);
  const mAtt = parseInt(timeMatch[2], 10);
  
  const limitParts = limitTimeStr.split(":");
  const hLimit = parseInt(limitParts[0], 10);
  const mLimit = parseInt(limitParts[1], 10);
  
  const attTotalMinutes = hAtt * 60 + mAtt;
  const limitTotalMinutes = hLimit * 60 + mLimit;
  
  const diff = attTotalMinutes - limitTotalMinutes;
  return diff > 0 ? diff : 0;
};
