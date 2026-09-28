import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { User, VaultState, AccessPolicy, Nominee, DueDateRecord, SmsReminderLog } from '../types/index';

export interface StoredUser {
  id: string;
  full_name: string;
  mobile_number: string;
  date_of_birth: string;
  role: 'CUSTOMER';
  is_verified: boolean;
  efid: string; // Always stored uppercase, trimmed (e.g. EF-3RJP-2941)
  password_hash: string;
  password_salt: string;
  preferred_language: 'en' | 'ta' | 'tanglish';
  masked_identity_number?: string;
  inactivity_threshold_days: number;
  last_activity_at: string;
  created_at: string;
}

export interface StoredDocument {
  id: string;
  user_id: string;
  efid: string;
  title: string;
  category: 'Identity Proof' | 'Insurance' | 'Property' | 'Vehicle' | 'Medical' | 'Financial' | 'Other';
  description?: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string; // filename in /data/documents/
  allow_nominee_emergency_access: boolean; // STRICTLY FALSE BY DEFAULT
  created_at: string;
  updated_at: string;
}

export interface OtpSession {
  verification_id: string;
  mobile_number: string;
  purpose: 'USER_PHONE_VERIFICATION' | 'NOMINEE_PHONE_VERIFICATION';
  code_hash: string;
  salt: string;
  attempts: number;
  max_attempts: number;
  expires_at: number; // epoch ms
  resend_available_at: number; // epoch ms
  is_mock: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface NomineeSession {
  token: string;
  nominee_id: string;
  nominee_name: string;
  nominee_mobile: string;
  owner_efid: string;
  owner_user_id: string;
  expires_at: number;
  created_at: string;
}

export interface DatabaseSchema {
  users: StoredUser[];
  vaults: Record<string, Partial<VaultState>>; // Keyed by user_id
  documents: StoredDocument[];
  otp_sessions: Record<string, OtpSession>;
  nominee_sessions: Record<string, NomineeSession>;
  due_dates: DueDateRecord[];
  reminder_logs: SmsReminderLog[];
}

// Robust multi-environment root directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = fs.existsSync(path.resolve(process.cwd(), 'package.json'))
  ? process.cwd()
  : path.resolve(__dirname, '../../');

const SEED_DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const SEED_DOCUMENTS_DIR = path.resolve(SEED_DATA_DIR, 'documents');
const SEED_DB_FILE = path.resolve(SEED_DATA_DIR, 'lifora_database.json');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : SEED_DATA_DIR;
const DOCUMENTS_DIR = path.resolve(DATA_DIR, 'documents');
const DB_FILE = path.resolve(DATA_DIR, 'lifora_database.json');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

// If using custom persistent DATA_DIR and DB_FILE doesn't exist, seed with repository data
if (DATA_DIR !== SEED_DATA_DIR && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_DB_FILE)) {
  try {
    fs.copyFileSync(SEED_DB_FILE, DB_FILE);
    console.log(`[LIFORA DB] Seeded initial vault database to persistent storage: ${DB_FILE}`);
  } catch (seedErr) {
    console.warn('[LIFORA DB] Warning seeding persistent database:', seedErr);
  }
}

// If using custom persistent DATA_DIR, also seed any initial documents
if (DATA_DIR !== SEED_DATA_DIR && fs.existsSync(SEED_DOCUMENTS_DIR)) {
  try {
    const seedDocs = fs.readdirSync(SEED_DOCUMENTS_DIR);
    for (const docFile of seedDocs) {
      const srcPath = path.resolve(SEED_DOCUMENTS_DIR, docFile);
      const destPath = path.resolve(DOCUMENTS_DIR, docFile);
      if (!fs.existsSync(destPath) && fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } catch (docSeedErr) {
    console.warn('[LIFORA DB] Warning seeding initial documents to persistent storage:', docSeedErr);
  }
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, chosenSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: chosenSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
}

class LiforaDatabase {
  private data: DatabaseSchema;
  private lastMtime: number = 0;

  constructor() {
    this.data = this.loadDatabase();
  }

  private getInitialData(): DatabaseSchema {
    return {
      users: [],
      vaults: {},
      documents: [],
      otp_sessions: {},
      nominee_sessions: {},
      due_dates: [],
      reminder_logs: [],
    };
  }

  public ensureLoaded(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        if (stat.mtimeMs > this.lastMtime) {
          const raw = fs.readFileSync(DB_FILE, 'utf-8');
          const parsed = JSON.parse(raw);
          this.data = {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            vaults: parsed.vaults && typeof parsed.vaults === 'object' ? parsed.vaults : {},
            documents: Array.isArray(parsed.documents) ? parsed.documents : [],
            otp_sessions: parsed.otp_sessions && typeof parsed.otp_sessions === 'object' ? parsed.otp_sessions : {},
            nominee_sessions: parsed.nominee_sessions && typeof parsed.nominee_sessions === 'object' ? parsed.nominee_sessions : {},
            due_dates: Array.isArray(parsed.due_dates) ? parsed.due_dates : [],
            reminder_logs: Array.isArray(parsed.reminder_logs) ? parsed.reminder_logs : [],
          };
          this.lastMtime = stat.mtimeMs;
        }
      }
    } catch (err) {
      console.error('[DB] Error checking/reloading database from disk:', err);
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const stat = fs.statSync(DB_FILE);
        this.lastMtime = stat.mtimeMs;
        return {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          vaults: parsed.vaults && typeof parsed.vaults === 'object' ? parsed.vaults : {},
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          otp_sessions: parsed.otp_sessions && typeof parsed.otp_sessions === 'object' ? parsed.otp_sessions : {},
          nominee_sessions: parsed.nominee_sessions && typeof parsed.nominee_sessions === 'object' ? parsed.nominee_sessions : {},
          due_dates: Array.isArray(parsed.due_dates) ? parsed.due_dates : [],
          reminder_logs: Array.isArray(parsed.reminder_logs) ? parsed.reminder_logs : [],
        };
      }
    } catch (err) {
      console.error('[DB] Error loading database file, initializing clean DB:', err);
    }

    const init = this.getInitialData();
    this.persist(init);
    return init;
  }

  public persist(dataToSave?: DatabaseSchema): void {
    const data = dataToSave || this.data;
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
      if (fs.existsSync(DB_FILE)) {
        this.lastMtime = fs.statSync(DB_FILE).mtimeMs;
      }
    } catch (err) {
      console.error('[DB] Atomic save failed, using direct write:', err);
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        if (fs.existsSync(DB_FILE)) {
          this.lastMtime = fs.statSync(DB_FILE).mtimeMs;
        }
      } catch (writeErr) {
        console.error('[DB] Fatal error persisting database:', writeErr);
      }
    }
  }

  // --- Users & E-FID Canonical Utilities ---

  public canonicalizeEfid(raw: string): string {
    if (!raw) return '';
    // Normalize dashes (standard hyphen, en-dash \u2013, em-dash \u2014, minus \u2212, underscore)
    const standard = raw.replace(/[\u2010-\u2015\u2212_]/g, '-');
    // Remove all non-alphanumeric and uppercase
    return standard.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  public canonicalizeMobile(raw: string): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) {
      return digits.slice(-10); // Standard 10-digit Indian mobile
    }
    return digits;
  }

  public normalizeEfid(efid: string): string {
    if (!efid) return '';
    const clean = efid.trim().toUpperCase().replace(/[\u2010-\u2015\u2212_]/g, '-').replace(/\s+/g, '');
    // If entered without hyphens like EFC7165145, re-format into canonical EF-XXXX-XXXX
    if (clean.length === 10 && clean.startsWith('EF') && !clean.includes('-')) {
      return `EF-${clean.substring(2, 6)}-${clean.substring(6, 10)}`;
    }
    return clean;
  }

  public findUserByIdentifier(identifier: string): StoredUser | null {
    this.ensureLoaded();
    const clean = identifier.trim();
    if (!clean) return null;

    const inputCanonicalMobile = this.canonicalizeMobile(clean);
    const inputCanonicalEfid = this.canonicalizeEfid(clean);
    const normalizedInputEfid = this.normalizeEfid(clean);

    return this.data.users.find((u) => {
      // 1. Mobile Number Match (handles +91, 91, 0, spaces, dashes)
      if (inputCanonicalMobile.length === 10) {
        const userMobileLast10 = this.canonicalizeMobile(u.mobile_number);
        if (userMobileLast10 === inputCanonicalMobile) {
          return true;
        }
      }

      // 2. Exact string match (case-insensitive)
      if (u.efid.trim().toUpperCase() === clean.toUpperCase()) {
        return true;
      }

      // 3. Normalized string match
      if (this.normalizeEfid(u.efid) === normalizedInputEfid) {
        return true;
      }

      // 4. Canonical alphanumeric match (stripping hyphens, en-dashes, spaces)
      const userCanonical = this.canonicalizeEfid(u.efid);
      if (userCanonical && inputCanonicalEfid) {
        if (userCanonical === inputCanonicalEfid) {
          return true;
        }
        // Match without "EF" prefix (e.g. user typed "3RJP-2941" or "3RJP2941")
        const userNoEf = userCanonical.replace(/^EF/, '');
        const inputNoEf = inputCanonicalEfid.replace(/^EF/, '');
        if (userNoEf && inputNoEf && userNoEf === inputNoEf) {
          return true;
        }
      }

      return false;
    }) || null;
  }

  public findUserById(userId: string): StoredUser | null {
    this.ensureLoaded();
    return this.data.users.find((u) => u.id === userId) || null;
  }

  public findUserByEfid(efid: string): StoredUser | null {
    this.ensureLoaded();
    const clean = efid.trim();
    if (!clean) return null;
    const inputCanonical = this.canonicalizeEfid(clean);
    const inputNoEf = inputCanonical.replace(/^EF/, '');
    const normalized = this.normalizeEfid(clean);

    return this.data.users.find((u) => {
      if (u.efid.trim().toUpperCase() === clean.toUpperCase()) return true;
      if (this.normalizeEfid(u.efid) === normalized) return true;
      const userCanonical = this.canonicalizeEfid(u.efid);
      if (userCanonical === inputCanonical) return true;
      const userNoEf = userCanonical.replace(/^EF/, '');
      if (userNoEf && inputNoEf && userNoEf === inputNoEf) return true;
      return false;
    }) || null;
  }

  public generateUniqueEfid(): string {
    this.ensureLoaded();
    let efid = '';
    let exists = true;
    while (exists) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars
      const part2 = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
      efid = `EF-${part1}-${part2}`;
      exists = Boolean(this.findUserByEfid(efid));
    }
    return efid;
  }

  public createUser(userData: {
    full_name: string;
    mobile_number: string;
    date_of_birth: string;
    password: string;
    masked_identity_number?: string;
    preferred_language?: 'en' | 'ta' | 'tanglish';
    customEfid?: string;
  }): { user: StoredUser; initialVault: Partial<VaultState> } {
    this.ensureLoaded();
    const cleanMobile = this.canonicalizeMobile(userData.mobile_number);
    const existing = this.findUserByIdentifier(cleanMobile);
    if (existing) {
      throw new Error(`A vault account is already registered with mobile +91 ${cleanMobile}. Please log in.`);
    }

    const efid = userData.customEfid
      ? this.normalizeEfid(userData.customEfid)
      : this.generateUniqueEfid();

    const { hash, salt } = hashPassword(userData.password);
    const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const newUser: StoredUser = {
      id: userId,
      full_name: userData.full_name.trim(),
      mobile_number: cleanMobile,
      date_of_birth: userData.date_of_birth,
      role: 'CUSTOMER',
      is_verified: true,
      efid,
      password_hash: hash,
      password_salt: salt,
      preferred_language: userData.preferred_language || 'en',
      masked_identity_number: userData.masked_identity_number,
      inactivity_threshold_days: 30,
      last_activity_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const initialVault: Partial<VaultState> = {
      accounts: [],
      loans: [],
      emis: [],
      insurance: [],
      commitments: [],
      moneyGiven: [],
      moneyBorrowed: [],
      properties: [],
      valuableAssets: [],
      vehicles: [],
      documents: [],
      personalDiary: [],
      financialDiary: [],
      importantInfo: [],
      nominees: [],
      safetyCheckin: null,
      emergencySession: null,
      auditLogs: [
        {
          id: `aud-${Date.now()}-reg`,
          action: 'VAULT_CREATED',
          actor: newUser.full_name,
          details: `Vault registered with permanent E-FID: ${efid}`,
          timestamp: new Date().toISOString(),
          severity: 'INFO',
        },
      ],
      language: newUser.preferred_language,
    };

    this.data.users.push(newUser);
    this.data.vaults[userId] = initialVault;
    this.persist();

    return { user: newUser, initialVault };
  }

  // --- Vault State Management ---

  public getVault(userId: string): Partial<VaultState> {
    this.ensureLoaded();
    if (!this.data.vaults[userId]) {
      this.data.vaults[userId] = {
        accounts: [],
        loans: [],
        emis: [],
        insurance: [],
        commitments: [],
        moneyGiven: [],
        moneyBorrowed: [],
        properties: [],
        valuableAssets: [],
        vehicles: [],
        documents: [],
        personalDiary: [],
        financialDiary: [],
        importantInfo: [],
        nominees: [],
        auditLogs: [],
      };
      this.persist();
    }
    return this.data.vaults[userId];
  }

  public updateVault(userId: string, partial: Partial<VaultState>): Partial<VaultState> {
    const current = this.getVault(userId);
    this.data.vaults[userId] = {
      ...current,
      ...partial,
      auditLogs: partial.auditLogs || current.auditLogs || [],
    };
    this.persist();
    return this.data.vaults[userId];
  }

  public addAuditLog(userId: string, entry: { action: string; actor: string; details: string; severity?: 'INFO' | 'WARNING' | 'CRITICAL' }) {
    const vault = this.getVault(userId);
    const logItem = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: entry.action,
      actor: entry.actor,
      details: entry.details,
      timestamp: new Date().toISOString(),
      severity: entry.severity || 'INFO',
    };
    vault.auditLogs = [logItem, ...(vault.auditLogs || [])];
    this.persist();
    return logItem;
  }

  // --- Document Storage & Permissions ---

  public getDocumentsDirectory(): string {
    return DOCUMENTS_DIR;
  }

  public addDocument(doc: {
    user_id: string;
    efid: string;
    title: string;
    category: StoredDocument['category'];
    description?: string;
    original_filename: string;
    mime_type: string;
    file_size_bytes: number;
    storage_path: string;
    allow_nominee_emergency_access?: boolean;
  }): StoredDocument {
    const docId = `doc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newDoc: StoredDocument = {
      id: docId,
      user_id: doc.user_id,
      efid: this.normalizeEfid(doc.efid),
      title: doc.title.trim(),
      category: doc.category,
      description: doc.description?.trim() || '',
      original_filename: doc.original_filename,
      mime_type: doc.mime_type,
      file_size_bytes: doc.file_size_bytes,
      storage_path: doc.storage_path,
      allow_nominee_emergency_access: Boolean(doc.allow_nominee_emergency_access), // OFF by default
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.documents.unshift(newDoc);
    this.persist();
    return newDoc;
  }

  public getUserDocuments(userId: string): StoredDocument[] {
    return this.data.documents.filter((d) => d.user_id === userId);
  }

  public getDocumentById(docId: string): StoredDocument | null {
    return this.data.documents.find((d) => d.id === docId) || null;
  }

  public updateDocument(
    docId: string,
    userId: string,
    updates: {
      title?: string;
      category?: StoredDocument['category'];
      description?: string;
      allow_nominee_emergency_access?: boolean;
    }
  ): StoredDocument | null {
    const doc = this.data.documents.find((d) => d.id === docId && d.user_id === userId);
    if (!doc) return null;

    if (updates.title !== undefined) doc.title = updates.title.trim();
    if (updates.category !== undefined) doc.category = updates.category;
    if (updates.description !== undefined) doc.description = updates.description.trim();
    if (updates.allow_nominee_emergency_access !== undefined) {
      doc.allow_nominee_emergency_access = Boolean(updates.allow_nominee_emergency_access);
    }
    doc.updated_at = new Date().toISOString();

    this.persist();
    return doc;
  }

  public deleteDocument(docId: string, userId: string): boolean {
    const index = this.data.documents.findIndex((d) => d.id === docId && d.user_id === userId);
    if (index === -1) return false;

    const doc = this.data.documents[index];
    const filePath = path.resolve(DOCUMENTS_DIR, doc.storage_path);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn(`[DB] Failed to remove document file on disk: ${filePath}`, err);
      }
    }

    this.data.documents.splice(index, 1);
    this.persist();
    return true;
  }

  public getPermittedNomineeDocuments(ownerEfid: string): StoredDocument[] {
    const normalized = this.normalizeEfid(ownerEfid);
    return this.data.documents.filter(
      (d) => this.normalizeEfid(d.efid) === normalized && d.allow_nominee_emergency_access === true
    );
  }

  // --- OTP Sessions ---

  public createOtpSession(sessionData: {
    mobile_number: string;
    purpose: 'USER_PHONE_VERIFICATION' | 'NOMINEE_PHONE_VERIFICATION';
    plainOtp: string;
    isMock: boolean;
    expirySeconds: number;
    cooldownSeconds: number;
  }): OtpSession {
    const verification_id = `otp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const { hash, salt } = hashPassword(sessionData.plainOtp);

    const now = Date.now();
    const session: OtpSession = {
      verification_id,
      mobile_number: sessionData.mobile_number,
      purpose: sessionData.purpose,
      code_hash: hash,
      salt,
      attempts: 0,
      max_attempts: 4,
      expires_at: now + sessionData.expirySeconds * 1000,
      resend_available_at: now + sessionData.cooldownSeconds * 1000,
      is_mock: sessionData.isMock,
      is_verified: false,
      created_at: new Date().toISOString(),
    };

    this.data.otp_sessions[verification_id] = session;
    this.persist();
    return session;
  }

  public getOtpSession(verificationId: string): OtpSession | null {
    return this.data.otp_sessions[verificationId] || null;
  }

  public updateOtpSession(session: OtpSession): void {
    this.data.otp_sessions[session.verification_id] = session;
    this.persist();
  }

  public deleteOtpSession(verificationId: string): void {
    delete this.data.otp_sessions[verificationId];
    this.persist();
  }

  // --- Nominee Emergency Session Tokens ---

  public createNomineeSession(data: {
    nominee_id: string;
    nominee_name: string;
    nominee_mobile: string;
    owner_efid: string;
    owner_user_id: string;
  }): NomineeSession {
    const token = `nom_tok_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const session: NomineeSession = {
      token,
      nominee_id: data.nominee_id,
      nominee_name: data.nominee_name,
      nominee_mobile: data.nominee_mobile,
      owner_efid: this.normalizeEfid(data.owner_efid),
      owner_user_id: data.owner_user_id,
      expires_at: Date.now() + 4 * 60 * 60 * 1000, // 4 hours active emergency window
      created_at: new Date().toISOString(),
    };

    this.data.nominee_sessions[token] = session;
    this.persist();
    return session;
  }

  public getNomineeSession(token: string): NomineeSession | null {
    const session = this.data.nominee_sessions[token];
    if (!session) return null;
    if (Date.now() > session.expires_at) {
      delete this.data.nominee_sessions[token];
      this.persist();
      return null;
    }
    return session;
  }

  // --- Automatic Due-Date & SMS Reminder Management ---

  public addDueDate(record: {
    user_id: string;
    record_type: DueDateRecord['record_type'];
    title: string;
    amount?: number | null;
    due_date: string;
    status?: DueDateRecord['status'];
    reminder_intervals?: number[];
    recipients?: DueDateRecord['recipients'];
    nominee_id?: string;
    nominee_name?: string;
    nominee_mobile?: string;
    nominee_consent_granted?: boolean;
    notes?: string;
    linked_entity_id?: string;
  }): DueDateRecord {
    this.ensureLoaded();
    const id = `due_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const newRecord: DueDateRecord = {
      id,
      user_id: record.user_id,
      record_type: record.record_type,
      title: record.title.trim(),
      amount: record.record_type === 'DOCUMENT_EXPIRY' ? null : (record.amount !== undefined ? record.amount : null),
      due_date: record.due_date,
      status: record.status || 'ACTIVE',
      reminder_intervals: record.reminder_intervals && record.reminder_intervals.length > 0
        ? record.reminder_intervals
        : [7, 3, 1], // Default: 7, 3, 1 days before
      recipients: record.recipients || 'OWNER_ONLY',
      nominee_id: record.nominee_id,
      nominee_name: record.nominee_name,
      nominee_mobile: record.nominee_mobile ? this.canonicalizeMobile(record.nominee_mobile) : undefined,
      nominee_consent_granted: Boolean(record.nominee_consent_granted),
      notes: record.notes?.trim() || '',
      linked_entity_id: record.linked_entity_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.due_dates.unshift(newRecord);
    this.persist();
    return newRecord;
  }

  public getDueDatesByUser(userId: string): DueDateRecord[] {
    this.ensureLoaded();
    return this.data.due_dates.filter((d) => d.user_id === userId);
  }

  public getDueDateById(id: string): DueDateRecord | null {
    this.ensureLoaded();
    return this.data.due_dates.find((d) => d.id === id) || null;
  }

  public updateDueDate(
    id: string,
    userId: string,
    updates: Partial<DueDateRecord>
  ): DueDateRecord | null {
    this.ensureLoaded();
    const item = this.data.due_dates.find((d) => d.id === id && d.user_id === userId);
    if (!item) return null;

    if (updates.title !== undefined) item.title = updates.title.trim();
    if (updates.record_type !== undefined) item.record_type = updates.record_type;
    if (updates.amount !== undefined) {
      item.amount = item.record_type === 'DOCUMENT_EXPIRY' ? null : updates.amount;
    }
    if (updates.due_date !== undefined) item.due_date = updates.due_date;
    if (updates.status !== undefined) item.status = updates.status;
    if (updates.reminder_intervals !== undefined) item.reminder_intervals = updates.reminder_intervals;
    if (updates.recipients !== undefined) item.recipients = updates.recipients;
    if (updates.nominee_id !== undefined) item.nominee_id = updates.nominee_id;
    if (updates.nominee_name !== undefined) item.nominee_name = updates.nominee_name;
    if (updates.nominee_mobile !== undefined) {
      item.nominee_mobile = updates.nominee_mobile ? this.canonicalizeMobile(updates.nominee_mobile) : undefined;
    }
    if (updates.nominee_consent_granted !== undefined) {
      item.nominee_consent_granted = Boolean(updates.nominee_consent_granted);
    }
    if (updates.notes !== undefined) item.notes = updates.notes.trim();
    item.updated_at = new Date().toISOString();

    this.persist();
    return item;
  }

  public deleteDueDate(id: string, userId: string): boolean {
    this.ensureLoaded();
    const index = this.data.due_dates.findIndex((d) => d.id === id && d.user_id === userId);
    if (index === -1) return false;

    this.data.due_dates.splice(index, 1);
    this.persist();
    return true;
  }

  public getAllActiveDueDates(): DueDateRecord[] {
    this.ensureLoaded();
    return this.data.due_dates.filter((d) => d.status === 'ACTIVE');
  }

  // --- SMS Delivery Audit Logs & Duplicate Prevention ---

  public addReminderLog(logData: {
    user_id: string;
    due_date_id: string;
    record_title: string;
    record_type: DueDateRecord['record_type'];
    recipient_type: 'OWNER' | 'NOMINEE';
    recipient_name: string;
    recipient_mobile: string;
    days_before_due: number;
    due_date: string;
    status: SmsReminderLog['status'];
    provider: 'MSG91' | 'MOCK';
    message_preview: string;
    gateway_response?: any;
    error_message?: string;
  }): SmsReminderLog {
    this.ensureLoaded();
    const id = `slog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const cleanMobile = this.canonicalizeMobile(logData.recipient_mobile);
    const maskedMobile = cleanMobile.length >= 4 ? `+91 XXXXX X${cleanMobile.slice(-4)}` : `+91 ${cleanMobile}`;

    const log: SmsReminderLog = {
      id,
      user_id: logData.user_id,
      due_date_id: logData.due_date_id,
      record_title: logData.record_title,
      record_type: logData.record_type,
      recipient_type: logData.recipient_type,
      recipient_name: logData.recipient_name,
      recipient_mobile: cleanMobile,
      recipient_mobile_masked: maskedMobile,
      days_before_due: logData.days_before_due,
      due_date: logData.due_date,
      dispatched_at: new Date().toISOString(),
      status: logData.status,
      provider: logData.provider,
      message_preview: logData.message_preview,
      gateway_response: logData.gateway_response,
      error_message: logData.error_message,
    };

    this.data.reminder_logs.unshift(log);
    this.persist();
    return log;
  }

  public getReminderLogs(userId: string, dueDateId?: string): SmsReminderLog[] {
    this.ensureLoaded();
    return this.data.reminder_logs.filter((l) => {
      if (l.user_id !== userId) return false;
      if (dueDateId && l.due_date_id !== dueDateId) return false;
      return true;
    });
  }

  public hasReminderBeenSent(
    dueDateId: string,
    recipientMobile: string,
    daysBeforeDue: number,
    targetDate: string // YYYY-MM-DD
  ): boolean {
    this.ensureLoaded();
    const cleanMobile = this.canonicalizeMobile(recipientMobile);
    return this.data.reminder_logs.some((l) => {
      if (l.due_date_id !== dueDateId) return false;
      if (l.recipient_mobile !== cleanMobile) return false;
      if (l.days_before_due !== daysBeforeDue) return false;
      // Only count as already sent if DELIVERED or QUEUED on that target date
      if (l.status === 'DELIVERED' || l.status === 'QUEUED') {
        const logDateStr = l.dispatched_at.slice(0, 10);
        return logDateStr === targetDate;
      }
      return false;
    });
  }
}

export const db = new LiforaDatabase();
