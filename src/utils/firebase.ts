import { initializeApp } from "firebase/app";
import { 
  getFirestore,
  collection,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { Student, AttendanceRecord, SchoolProfile } from "../types";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore using standard, stable getFirestore with specific Database ID
// This ensures the application runs in a full-online mode as requested, communicating
// directly with the Firestore server without any offline cache interference or stale local data.
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection on boot to satisfy integration validation
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently offline.");
    }
  }
}
testConnection();

// HELPER FUNCTIONS FOR FIRESTORE SYNC

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };

  const isQuota = (err: any): boolean => {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    const code = String(err.code || "").toLowerCase();
    return msg.includes("quota exceeded") || msg.includes("resource_exhausted") || msg.includes("resource-exhausted") || code.includes("resource-exhausted");
  };

  if (isQuota(error) || isQuota(errInfo.error)) {
    console.warn('Firestore Warning (Quota Exceeded - Safe Local Fallback): ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// 1. Students Sync Helpers
export const syncStudentToFirestore = async (student: Student) => {
  try {
    await setDoc(doc(db, "students", student.nis), student);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${student.nis}`);
  }
};

export const deleteStudentFromFirestore = async (nis: string) => {
  try {
    await deleteDoc(doc(db, "students", nis));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${nis}`);
  }
};

export const syncBulkStudentsToFirestore = async (studentsList: Student[]) => {
  try {
    // For large lists, write in batches of 500
    let batch = writeBatch(db);
    let count = 0;
    for (const student of studentsList) {
      const docRef = doc(db, "students", student.nis);
      batch.set(docRef, student);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "students");
  }
};

export const deleteSpecificStudentsFromFirestore = async (studentsList: Student[]) => {
  try {
    let batch = writeBatch(db);
    let count = 0;
    for (const student of studentsList) {
      const docRef = doc(db, "students", student.nis);
      batch.delete(docRef);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, "students");
  }
};

export const clearAllStudentsFromFirestore = async () => {
  try {
    const snapshot = await getDocs(collection(db, "students"));
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snapshot.docs) {
      batch.delete(d.ref);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, "students");
  }
};

// 2. Attendance Records Sync Helpers
export const syncRecordToFirestore = async (record: AttendanceRecord) => {
  try {
    await setDoc(doc(db, "records", record.id), record);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `records/${record.id}`);
  }
};

export const syncBulkRecordsToFirestore = async (recordsList: AttendanceRecord[]) => {
  try {
    let batch = writeBatch(db);
    let count = 0;
    for (const record of recordsList) {
      const docRef = doc(db, "records", record.id);
      batch.set(docRef, record);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "records");
  }
};

export const deleteRecordFromFirestore = async (recordId: string) => {
  try {
    await deleteDoc(doc(db, "records", recordId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `records/${recordId}`);
  }
};

export const deleteSpecificRecordsFromFirestore = async (recordsList: AttendanceRecord[]) => {
  try {
    let batch = writeBatch(db);
    let count = 0;
    for (const record of recordsList) {
      const docRef = doc(db, "records", record.id);
      batch.delete(docRef);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, "records");
  }
};

export const deleteRecordsByDateFromFirestore = async (dateStr: string) => {
  try {
    const snapshot = await getDocs(collection(db, "records"));
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snapshot.docs) {
      const data = d.data() as AttendanceRecord;
      if (data && data.waktuAbsensi && data.waktuAbsensi.startsWith(dateStr)) {
        batch.delete(d.ref);
        count++;
        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, "records");
  }
};

export const clearAllRecordsFromFirestore = async () => {
  try {
    const snapshot = await getDocs(collection(db, "records"));
    let batch = writeBatch(db);
    let count = 0;
    for (const d of snapshot.docs) {
      batch.delete(d.ref);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, "records");
  }
};

// 3. School Profile Sync Helper
export const syncSchoolProfileToFirestore = async (profile: SchoolProfile) => {
  try {
    await setDoc(doc(db, "school", "config"), profile);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "school/config");
  }
};

export const isStudentsCollectionEmpty = async (): Promise<boolean> => {
  try {
    const snapshot = await getDocs(collection(db, "students"));
    return snapshot.empty;
  } catch (err) {
    console.error("Gagal memeriksa koleksi siswa:", err);
    return false; // Safe fallback: assume not empty so we don't accidentally seed/overwrite
  }
};
