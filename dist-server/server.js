// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";

// src/server/db.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PROJECT_ROOT = fs.existsSync(path.resolve(process.cwd(), "package.json")) ? process.cwd() : path.resolve(__dirname, "../../");
var SEED_DATA_DIR = path.resolve(PROJECT_ROOT, "data");
var SEED_DOCUMENTS_DIR = path.resolve(SEED_DATA_DIR, "documents");
var SEED_DB_FILE = path.resolve(SEED_DATA_DIR, "lifora_database.json");
var DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : SEED_DATA_DIR;
var DOCUMENTS_DIR = path.resolve(DATA_DIR, "documents");
var DB_FILE = path.resolve(DATA_DIR, "lifora_database.json");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}
if (DATA_DIR !== SEED_DATA_DIR && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_DB_FILE)) {
  try {
    fs.copyFileSync(SEED_DB_FILE, DB_FILE);
    console.log(`[LIFORA DB] Seeded initial vault database to persistent storage: ${DB_FILE}`);
  } catch (seedErr) {
    console.warn("[LIFORA DB] Warning seeding persistent database:", seedErr);
  }
}
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
    console.warn("[LIFORA DB] Warning seeding initial documents to persistent storage:", docSeedErr);
  }
}
function hashPassword(password, salt) {
  const chosenSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, chosenSalt, 1e5, 64, "sha512").toString("hex");
  return { hash, salt: chosenSalt };
}
function verifyPassword(password, hash, salt) {
  const testHash = crypto.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(testHash, "hex"), Buffer.from(hash, "hex"));
}
var LiforaDatabase = class {
  constructor() {
    this.lastMtime = 0;
    this.data = this.loadDatabase();
  }
  getInitialData() {
    return {
      users: [],
      vaults: {},
      documents: [],
      otp_sessions: {},
      nominee_sessions: {},
      due_dates: [],
      reminder_logs: []
    };
  }
  ensureLoaded() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const stat = fs.statSync(DB_FILE);
        if (stat.mtimeMs > this.lastMtime) {
          const raw = fs.readFileSync(DB_FILE, "utf-8");
          const parsed = JSON.parse(raw);
          this.data = {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            vaults: parsed.vaults && typeof parsed.vaults === "object" ? parsed.vaults : {},
            documents: Array.isArray(parsed.documents) ? parsed.documents : [],
            otp_sessions: parsed.otp_sessions && typeof parsed.otp_sessions === "object" ? parsed.otp_sessions : {},
            nominee_sessions: parsed.nominee_sessions && typeof parsed.nominee_sessions === "object" ? parsed.nominee_sessions : {},
            due_dates: Array.isArray(parsed.due_dates) ? parsed.due_dates : [],
            reminder_logs: Array.isArray(parsed.reminder_logs) ? parsed.reminder_logs : []
          };
          this.lastMtime = stat.mtimeMs;
        }
      }
    } catch (err) {
      console.error("[DB] Error checking/reloading database from disk:", err);
    }
  }
  loadDatabase() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        const stat = fs.statSync(DB_FILE);
        this.lastMtime = stat.mtimeMs;
        return {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          vaults: parsed.vaults && typeof parsed.vaults === "object" ? parsed.vaults : {},
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          otp_sessions: parsed.otp_sessions && typeof parsed.otp_sessions === "object" ? parsed.otp_sessions : {},
          nominee_sessions: parsed.nominee_sessions && typeof parsed.nominee_sessions === "object" ? parsed.nominee_sessions : {},
          due_dates: Array.isArray(parsed.due_dates) ? parsed.due_dates : [],
          reminder_logs: Array.isArray(parsed.reminder_logs) ? parsed.reminder_logs : []
        };
      }
    } catch (err) {
      console.error("[DB] Error loading database file, initializing clean DB:", err);
    }
    const init = this.getInitialData();
    this.persist(init);
    return init;
  }
  persist(dataToSave) {
    const data = dataToSave || this.data;
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempPath, DB_FILE);
      if (fs.existsSync(DB_FILE)) {
        this.lastMtime = fs.statSync(DB_FILE).mtimeMs;
      }
    } catch (err) {
      console.error("[DB] Atomic save failed, using direct write:", err);
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
        if (fs.existsSync(DB_FILE)) {
          this.lastMtime = fs.statSync(DB_FILE).mtimeMs;
        }
      } catch (writeErr) {
        console.error("[DB] Fatal error persisting database:", writeErr);
      }
    }
  }
  // --- Users & E-FID Canonical Utilities ---
  canonicalizeEfid(raw) {
    if (!raw) return "";
    const standard = raw.replace(/[\u2010-\u2015\u2212_]/g, "-");
    return standard.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  canonicalizeMobile(raw) {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return digits;
  }
  normalizeEfid(efid) {
    if (!efid) return "";
    const clean = efid.trim().toUpperCase().replace(/[\u2010-\u2015\u2212_]/g, "-").replace(/\s+/g, "");
    if (clean.length === 10 && clean.startsWith("EF") && !clean.includes("-")) {
      return `EF-${clean.substring(2, 6)}-${clean.substring(6, 10)}`;
    }
    return clean;
  }
  findUserByIdentifier(identifier) {
    this.ensureLoaded();
    const clean = identifier.trim();
    if (!clean) return null;
    const inputCanonicalMobile = this.canonicalizeMobile(clean);
    const inputCanonicalEfid = this.canonicalizeEfid(clean);
    const normalizedInputEfid = this.normalizeEfid(clean);
    return this.data.users.find((u) => {
      if (inputCanonicalMobile.length === 10) {
        const userMobileLast10 = this.canonicalizeMobile(u.mobile_number);
        if (userMobileLast10 === inputCanonicalMobile) {
          return true;
        }
      }
      if (u.efid.trim().toUpperCase() === clean.toUpperCase()) {
        return true;
      }
      if (this.normalizeEfid(u.efid) === normalizedInputEfid) {
        return true;
      }
      const userCanonical = this.canonicalizeEfid(u.efid);
      if (userCanonical && inputCanonicalEfid) {
        if (userCanonical === inputCanonicalEfid) {
          return true;
        }
        const userNoEf = userCanonical.replace(/^EF/, "");
        const inputNoEf = inputCanonicalEfid.replace(/^EF/, "");
        if (userNoEf && inputNoEf && userNoEf === inputNoEf) {
          return true;
        }
      }
      return false;
    }) || null;
  }
  findUserById(userId) {
    this.ensureLoaded();
    return this.data.users.find((u) => u.id === userId) || null;
  }
  findUserByEfid(efid) {
    this.ensureLoaded();
    const clean = efid.trim();
    if (!clean) return null;
    const inputCanonical = this.canonicalizeEfid(clean);
    const inputNoEf = inputCanonical.replace(/^EF/, "");
    const normalized = this.normalizeEfid(clean);
    return this.data.users.find((u) => {
      if (u.efid.trim().toUpperCase() === clean.toUpperCase()) return true;
      if (this.normalizeEfid(u.efid) === normalized) return true;
      const userCanonical = this.canonicalizeEfid(u.efid);
      if (userCanonical === inputCanonical) return true;
      const userNoEf = userCanonical.replace(/^EF/, "");
      if (userNoEf && inputNoEf && userNoEf === inputNoEf) return true;
      return false;
    }) || null;
  }
  generateUniqueEfid() {
    this.ensureLoaded();
    let efid = "";
    let exists = true;
    while (exists) {
      const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
      const part2 = Math.floor(1e3 + Math.random() * 9e3).toString();
      efid = `EF-${part1}-${part2}`;
      exists = Boolean(this.findUserByEfid(efid));
    }
    return efid;
  }
  createUser(userData) {
    this.ensureLoaded();
    const cleanMobile = this.canonicalizeMobile(userData.mobile_number);
    const existing = this.findUserByIdentifier(cleanMobile);
    if (existing) {
      throw new Error(`A vault account is already registered with mobile +91 ${cleanMobile}. Please log in.`);
    }
    const efid = userData.customEfid ? this.normalizeEfid(userData.customEfid) : this.generateUniqueEfid();
    const { hash, salt } = hashPassword(userData.password);
    const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const newUser = {
      id: userId,
      full_name: userData.full_name.trim(),
      mobile_number: cleanMobile,
      date_of_birth: userData.date_of_birth,
      role: "CUSTOMER",
      is_verified: true,
      efid,
      password_hash: hash,
      password_salt: salt,
      preferred_language: userData.preferred_language || "en",
      masked_identity_number: userData.masked_identity_number,
      inactivity_threshold_days: 30,
      last_activity_at: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const initialVault = {
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
          action: "VAULT_CREATED",
          actor: newUser.full_name,
          details: `Vault registered with permanent E-FID: ${efid}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          severity: "INFO"
        }
      ],
      language: newUser.preferred_language
    };
    this.data.users.push(newUser);
    this.data.vaults[userId] = initialVault;
    this.persist();
    return { user: newUser, initialVault };
  }
  // --- Vault State Management ---
  getVault(userId) {
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
        auditLogs: []
      };
      this.persist();
    }
    return this.data.vaults[userId];
  }
  updateVault(userId, partial) {
    const current = this.getVault(userId);
    this.data.vaults[userId] = {
      ...current,
      ...partial,
      auditLogs: partial.auditLogs || current.auditLogs || []
    };
    this.persist();
    return this.data.vaults[userId];
  }
  addAuditLog(userId, entry) {
    const vault = this.getVault(userId);
    const logItem = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      action: entry.action,
      actor: entry.actor,
      details: entry.details,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      severity: entry.severity || "INFO"
    };
    vault.auditLogs = [logItem, ...vault.auditLogs || []];
    this.persist();
    return logItem;
  }
  // --- Document Storage & Permissions ---
  getDocumentsDirectory() {
    return DOCUMENTS_DIR;
  }
  addDocument(doc) {
    const docId = `doc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const newDoc = {
      id: docId,
      user_id: doc.user_id,
      efid: this.normalizeEfid(doc.efid),
      title: doc.title.trim(),
      category: doc.category,
      description: doc.description?.trim() || "",
      original_filename: doc.original_filename,
      mime_type: doc.mime_type,
      file_size_bytes: doc.file_size_bytes,
      storage_path: doc.storage_path,
      allow_nominee_emergency_access: Boolean(doc.allow_nominee_emergency_access),
      // OFF by default
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.documents.unshift(newDoc);
    this.persist();
    return newDoc;
  }
  getUserDocuments(userId) {
    return this.data.documents.filter((d) => d.user_id === userId);
  }
  getDocumentById(docId) {
    return this.data.documents.find((d) => d.id === docId) || null;
  }
  updateDocument(docId, userId, updates) {
    const doc = this.data.documents.find((d) => d.id === docId && d.user_id === userId);
    if (!doc) return null;
    if (updates.title !== void 0) doc.title = updates.title.trim();
    if (updates.category !== void 0) doc.category = updates.category;
    if (updates.description !== void 0) doc.description = updates.description.trim();
    if (updates.allow_nominee_emergency_access !== void 0) {
      doc.allow_nominee_emergency_access = Boolean(updates.allow_nominee_emergency_access);
    }
    doc.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return doc;
  }
  deleteDocument(docId, userId) {
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
  getPermittedNomineeDocuments(ownerEfid) {
    const normalized = this.normalizeEfid(ownerEfid);
    return this.data.documents.filter(
      (d) => this.normalizeEfid(d.efid) === normalized && d.allow_nominee_emergency_access === true
    );
  }
  // --- OTP Sessions ---
  createOtpSession(sessionData) {
    const verification_id = `otp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const { hash, salt } = hashPassword(sessionData.plainOtp);
    const now = Date.now();
    const session = {
      verification_id,
      mobile_number: sessionData.mobile_number,
      purpose: sessionData.purpose,
      code_hash: hash,
      salt,
      attempts: 0,
      max_attempts: 4,
      expires_at: now + sessionData.expirySeconds * 1e3,
      resend_available_at: now + sessionData.cooldownSeconds * 1e3,
      is_mock: sessionData.isMock,
      is_verified: false,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.otp_sessions[verification_id] = session;
    this.persist();
    return session;
  }
  getOtpSession(verificationId) {
    return this.data.otp_sessions[verificationId] || null;
  }
  updateOtpSession(session) {
    this.data.otp_sessions[session.verification_id] = session;
    this.persist();
  }
  deleteOtpSession(verificationId) {
    delete this.data.otp_sessions[verificationId];
    this.persist();
  }
  // --- Nominee Emergency Session Tokens ---
  createNomineeSession(data) {
    const token = `nom_tok_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
    const session = {
      token,
      nominee_id: data.nominee_id,
      nominee_name: data.nominee_name,
      nominee_mobile: data.nominee_mobile,
      owner_efid: this.normalizeEfid(data.owner_efid),
      owner_user_id: data.owner_user_id,
      expires_at: Date.now() + 4 * 60 * 60 * 1e3,
      // 4 hours active emergency window
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.nominee_sessions[token] = session;
    this.persist();
    return session;
  }
  getNomineeSession(token) {
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
  addDueDate(record) {
    this.ensureLoaded();
    const id = `due_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const newRecord = {
      id,
      user_id: record.user_id,
      record_type: record.record_type,
      title: record.title.trim(),
      amount: record.record_type === "DOCUMENT_EXPIRY" ? null : record.amount !== void 0 ? record.amount : null,
      due_date: record.due_date,
      status: record.status || "ACTIVE",
      reminder_intervals: record.reminder_intervals && record.reminder_intervals.length > 0 ? record.reminder_intervals : [7, 3, 1],
      // Default: 7, 3, 1 days before
      recipients: record.recipients || "OWNER_ONLY",
      nominee_id: record.nominee_id,
      nominee_name: record.nominee_name,
      nominee_mobile: record.nominee_mobile ? this.canonicalizeMobile(record.nominee_mobile) : void 0,
      nominee_consent_granted: Boolean(record.nominee_consent_granted),
      notes: record.notes?.trim() || "",
      linked_entity_id: record.linked_entity_id,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.due_dates.unshift(newRecord);
    this.persist();
    return newRecord;
  }
  getDueDatesByUser(userId) {
    this.ensureLoaded();
    return this.data.due_dates.filter((d) => d.user_id === userId);
  }
  getDueDateById(id) {
    this.ensureLoaded();
    return this.data.due_dates.find((d) => d.id === id) || null;
  }
  updateDueDate(id, userId, updates) {
    this.ensureLoaded();
    const item = this.data.due_dates.find((d) => d.id === id && d.user_id === userId);
    if (!item) return null;
    if (updates.title !== void 0) item.title = updates.title.trim();
    if (updates.record_type !== void 0) item.record_type = updates.record_type;
    if (updates.amount !== void 0) {
      item.amount = item.record_type === "DOCUMENT_EXPIRY" ? null : updates.amount;
    }
    if (updates.due_date !== void 0) item.due_date = updates.due_date;
    if (updates.status !== void 0) item.status = updates.status;
    if (updates.reminder_intervals !== void 0) item.reminder_intervals = updates.reminder_intervals;
    if (updates.recipients !== void 0) item.recipients = updates.recipients;
    if (updates.nominee_id !== void 0) item.nominee_id = updates.nominee_id;
    if (updates.nominee_name !== void 0) item.nominee_name = updates.nominee_name;
    if (updates.nominee_mobile !== void 0) {
      item.nominee_mobile = updates.nominee_mobile ? this.canonicalizeMobile(updates.nominee_mobile) : void 0;
    }
    if (updates.nominee_consent_granted !== void 0) {
      item.nominee_consent_granted = Boolean(updates.nominee_consent_granted);
    }
    if (updates.notes !== void 0) item.notes = updates.notes.trim();
    item.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return item;
  }
  deleteDueDate(id, userId) {
    this.ensureLoaded();
    const index = this.data.due_dates.findIndex((d) => d.id === id && d.user_id === userId);
    if (index === -1) return false;
    this.data.due_dates.splice(index, 1);
    this.persist();
    return true;
  }
  getAllActiveDueDates() {
    this.ensureLoaded();
    return this.data.due_dates.filter((d) => d.status === "ACTIVE");
  }
  // --- SMS Delivery Audit Logs & Duplicate Prevention ---
  addReminderLog(logData) {
    this.ensureLoaded();
    const id = `slog_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const cleanMobile = this.canonicalizeMobile(logData.recipient_mobile);
    const maskedMobile = cleanMobile.length >= 4 ? `+91 XXXXX X${cleanMobile.slice(-4)}` : `+91 ${cleanMobile}`;
    const log = {
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
      dispatched_at: (/* @__PURE__ */ new Date()).toISOString(),
      status: logData.status,
      provider: logData.provider,
      message_preview: logData.message_preview,
      gateway_response: logData.gateway_response,
      error_message: logData.error_message
    };
    this.data.reminder_logs.unshift(log);
    this.persist();
    return log;
  }
  getReminderLogs(userId, dueDateId) {
    this.ensureLoaded();
    return this.data.reminder_logs.filter((l) => {
      if (l.user_id !== userId) return false;
      if (dueDateId && l.due_date_id !== dueDateId) return false;
      return true;
    });
  }
  hasReminderBeenSent(dueDateId, recipientMobile, daysBeforeDue, targetDate) {
    this.ensureLoaded();
    const cleanMobile = this.canonicalizeMobile(recipientMobile);
    return this.data.reminder_logs.some((l) => {
      if (l.due_date_id !== dueDateId) return false;
      if (l.recipient_mobile !== cleanMobile) return false;
      if (l.days_before_due !== daysBeforeDue) return false;
      if (l.status === "DELIVERED" || l.status === "QUEUED") {
        const logDateStr = l.dispatched_at.slice(0, 10);
        return logDateStr === targetDate;
      }
      return false;
    });
  }
};
var db = new LiforaDatabase();

// src/server/msg91.ts
import crypto2 from "crypto";
function getMsg91Config() {
  const envProvider = process.env.SMS_PROVIDER?.toUpperCase();
  const isProduction = process.env.NODE_ENV === "production";
  let provider;
  if (envProvider === "MOCK") {
    if (isProduction) {
      throw new Error("SECURITY VIOLATION: Mock OTP mode is strictly forbidden in production.");
    }
    provider = "MOCK";
  } else if (envProvider === "MSG91") {
    provider = "MSG91";
  } else {
    if (isProduction) {
      provider = "MSG91";
    } else {
      provider = process.env.MSG91_AUTH_KEY ? "MSG91" : "MOCK";
    }
  }
  return {
    provider,
    authKey: process.env.MSG91_AUTH_KEY || "",
    templateId: process.env.MSG91_TEMPLATE_ID || "",
    reminderFlowId: process.env.MSG91_REMINDER_FLOW_ID || process.env.MSG91_FLOW_ID || process.env.MSG91_TEMPLATE_ID || "",
    senderId: process.env.MSG91_SENDER_ID || "LIFORA",
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || "600", 10),
    cooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "4", 10)
  };
}
function generateCryptoOtp() {
  const buf = crypto2.randomBytes(4);
  const num = buf.readUInt32BE(0) % 9e5 + 1e5;
  return num.toString();
}
function formatIndianMobile(raw) {
  let clean = raw.replace(/\D/g, "");
  if (clean.startsWith("91") && clean.length === 12) {
    clean = clean.slice(2);
  }
  if (clean.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number");
  }
  return {
    clean10: clean,
    fullWithCountry: `91${clean}`
  };
}
async function sendMsg91SmsOtp(mobileNumber, plainOtp) {
  const config = getMsg91Config();
  const { clean10, fullWithCountry } = formatIndianMobile(mobileNumber);
  if (config.provider === "MOCK") {
    return {
      success: true,
      message: "Demo OTP dispatched in local simulation mode.",
      isMock: true,
      gatewayResponse: { status: "DEMO_MODE", recipient: `+91 ${clean10}` }
    };
  }
  if (!config.authKey) {
    throw new Error(
      "MSG91_AUTH_KEY is not configured in backend environment variables. Please provide your MSG91 Auth Key to dispatch real SMS."
    );
  }
  const url = new URL("https://api.msg91.com/api/v5/otp");
  url.searchParams.append("template_id", config.templateId);
  url.searchParams.append("mobile", fullWithCountry);
  url.searchParams.append("authkey", config.authKey);
  url.searchParams.append("otp", plainOtp);
  if (config.senderId) {
    url.searchParams.append("sender", config.senderId);
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8e3);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: config.authKey
      },
      body: JSON.stringify({
        template_id: config.templateId,
        mobile: fullWithCountry,
        otp: plainOtp,
        sender: config.senderId
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const errMsg = data?.message || data?.error || `HTTP error ${res.status}`;
      return {
        success: false,
        message: `MSG91 gateway rejected SMS request: ${errMsg}`,
        isMock: false,
        gatewayResponse: data
      };
    }
    if (data && data.type === "error") {
      return {
        success: false,
        message: `MSG91 SMS delivery error: ${data.message || "Unknown provider error"}`,
        isMock: false,
        gatewayResponse: data
      };
    }
    return {
      success: true,
      message: "SMS OTP successfully dispatched via MSG91 to recipient.",
      isMock: false,
      gatewayResponse: data
    };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("MSG91 gateway timeout. The SMS provider did not respond within 8 seconds.");
    }
    throw new Error(`Failed to communicate with MSG91 gateway: ${err.message}`);
  }
}
async function verifyWithMsg91Gateway(mobileNumber, enteredOtp) {
  const config = getMsg91Config();
  const { fullWithCountry } = formatIndianMobile(mobileNumber);
  if (config.provider === "MOCK" || !config.authKey) {
    return { verified: false, message: "Gateway verification not applicable in current mode." };
  }
  try {
    const url = new URL("https://api.msg91.com/api/v5/otp/verify");
    url.searchParams.append("mobile", fullWithCountry);
    url.searchParams.append("otp", enteredOtp.trim());
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        authkey: config.authKey
      }
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.type === "success") {
      return { verified: true, message: "OTP verified successfully via MSG91." };
    }
    return {
      verified: false,
      message: data?.message || "OTP verification failed at MSG91 gateway."
    };
  } catch (err) {
    return { verified: false, message: `MSG91 verification connection error: ${err.message}` };
  }
}
async function sendMsg91TransactionalSms(params) {
  const config = getMsg91Config();
  const { clean10, fullWithCountry } = formatIndianMobile(params.mobileNumber);
  const daysLabel = params.daysRemaining === 0 ? "Due TODAY" : params.daysRemaining === 1 ? "Due TOMORROW" : `Due in ${params.daysRemaining} days`;
  let textMessage = "";
  if (params.recipientType === "NOMINEE") {
    textMessage = `LIFORA Alert: Authorized notice for ${params.recipientName} - Scheduled reminder for "${params.title}" (${params.recordType.replace("_", " ")}) on ${params.dueDate} (${daysLabel}). - LIFORA Vault`;
  } else if (params.recordType === "DOCUMENT_EXPIRY") {
    textMessage = `LIFORA Alert: Reminder - Your document "${params.title}" expires on ${params.dueDate} (${daysLabel}). Please renew timely. - LIFORA Vault`;
  } else {
    const amtStr = params.amount ? ` of Rs.${params.amount.toLocaleString("en-IN")}` : "";
    textMessage = `LIFORA Alert: Reminder - Your ${params.recordType.replace("_", " ")} "${params.title}"${amtStr} is due on ${params.dueDate} (${daysLabel}). Please maintain adequate balance. - LIFORA Vault`;
  }
  if (config.provider === "MOCK") {
    return {
      success: true,
      message: "Demo reminder SMS simulated successfully (Local Demo Mode).",
      provider: "MOCK",
      messagePreview: textMessage,
      recipientMobile: clean10,
      gatewayResponse: { status: "DEMO_DISPATCHED", recipient: `+91 ${clean10}`, text: textMessage }
    };
  }
  if (!config.authKey) {
    return {
      success: false,
      message: "MSG91_AUTH_KEY is not configured in backend environment variables.",
      provider: "MSG91",
      messagePreview: textMessage,
      recipientMobile: clean10
    };
  }
  const flowOrTemplateId = config.reminderFlowId || config.templateId;
  if (flowOrTemplateId) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9e3);
      const payload = {
        template_id: flowOrTemplateId,
        sender: config.senderId,
        short_url: "0",
        recipients: [
          {
            mobiles: fullWithCountry,
            name: params.recipientName,
            title: params.title,
            category: params.recordType,
            date: params.dueDate,
            days: params.daysRemaining.toString(),
            amount: params.amount ? params.amount.toString() : "0"
          }
        ]
      };
      const res = await fetch("https://api.msg91.com/api/v5/flow", {
        method: "POST",
        headers: {
          authkey: config.authKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (res.ok && data && (data.type === "success" || data.status === "success" || data.request_id)) {
        return {
          success: true,
          message: "SMS reminder dispatched via MSG91 Flow gateway.",
          provider: "MSG91",
          messagePreview: textMessage,
          recipientMobile: clean10,
          gatewayResponse: data
        };
      }
      if (data && data.type === "error") {
        console.warn("[MSG91 Flow Error, attempting fallback]:", data.message);
      }
    } catch (flowErr) {
      console.warn("[MSG91 Flow dispatch error]:", flowErr.message);
    }
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9e3);
    const otpUrl = new URL("https://api.msg91.com/api/v5/otp");
    otpUrl.searchParams.append("template_id", config.templateId || flowOrTemplateId);
    otpUrl.searchParams.append("mobile", fullWithCountry);
    otpUrl.searchParams.append("authkey", config.authKey);
    const shortCode = `${params.daysRemaining}D`;
    otpUrl.searchParams.append("otp", shortCode);
    if (config.senderId) {
      otpUrl.searchParams.append("sender", config.senderId);
    }
    const res = await fetch(otpUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: config.authKey
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => null);
    if (res.ok && data && (data.type === "success" || data.message?.includes("success") || data.request_id)) {
      return {
        success: true,
        message: "SMS reminder accepted by MSG91 gateway.",
        provider: "MSG91",
        messagePreview: textMessage,
        recipientMobile: clean10,
        gatewayResponse: data
      };
    }
    return {
      success: false,
      message: data?.message || data?.error || `MSG91 gateway rejected SMS (HTTP ${res.status})`,
      provider: "MSG91",
      messagePreview: textMessage,
      recipientMobile: clean10,
      gatewayResponse: data
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to communicate with MSG91 gateway: ${err.message}`,
      provider: "MSG91",
      messagePreview: textMessage,
      recipientMobile: clean10
    };
  }
}

// src/server/scheduler.ts
function getIndiaTodayDate() {
  const now = /* @__PURE__ */ new Date();
  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  };
  const formatter = new Intl.DateTimeFormat("en-CA", options);
  const todayString = formatter.format(now);
  const [year, month, day] = todayString.split("-").map(Number);
  const todayDate = new Date(Date.UTC(year, month - 1, day));
  return { todayString, todayDate };
}
function calculateDaysRemaining(dueDateStr, todayStr) {
  if (!dueDateStr) return -999;
  const parts = dueDateStr.split("-");
  if (parts.length !== 3) return -999;
  const [dy, dm, dd] = parts.map(Number);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((dueUtc - todayUtc) / (1e3 * 60 * 60 * 24));
}
function calculateReminderDates(dueDateStr, intervals = [7, 3, 1]) {
  if (!dueDateStr) return [];
  const parts = dueDateStr.split("-");
  if (parts.length !== 3) return [];
  const [dy, dm, dd] = parts.map(Number);
  return intervals.map((interval) => {
    const dueUtc = new Date(Date.UTC(dy, dm - 1, dd));
    dueUtc.setUTCDate(dueUtc.getUTCDate() - interval);
    const y = dueUtc.getUTCFullYear();
    const m = String(dueUtc.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dueUtc.getUTCDate()).padStart(2, "0");
    return {
      intervalDays: interval,
      scheduledDate: `${y}-${m}-${d}`
    };
  });
}
async function runDueReminderCheck() {
  const { todayString } = getIndiaTodayDate();
  console.log(`[LIFORA SCHEDULER] Running due-date & document-expiry check for IST Date: ${todayString}`);
  db.ensureLoaded();
  const activeRecords = db.getAllActiveDueDates();
  const summary = {
    processedRecords: activeRecords.length,
    evaluatedReminders: 0,
    dispatchedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    logs: [],
    ranAt: (/* @__PURE__ */ new Date()).toISOString(),
    todayIST: todayString
  };
  for (const record of activeRecords) {
    if (record.status !== "ACTIVE") continue;
    const daysRemaining = calculateDaysRemaining(record.due_date, todayString);
    summary.evaluatedReminders++;
    const configuredIntervals = record.reminder_intervals || [7, 3, 1];
    const isIntervalTrigger = configuredIntervals.includes(daysRemaining);
    if (!isIntervalTrigger && daysRemaining !== 0) {
      continue;
    }
    const owner = db.findUserById(record.user_id);
    if (!owner) continue;
    const vault = db.getVault(owner.id);
    const nominees = vault.nominees || [];
    const shouldSendToOwner = record.recipients === "OWNER_ONLY" || record.recipients === "BOTH";
    if (shouldSendToOwner && owner.mobile_number) {
      const alreadySent = db.hasReminderBeenSent(record.id, owner.mobile_number, daysRemaining, todayString);
      if (!alreadySent) {
        try {
          const sendResult = await sendMsg91TransactionalSms({
            mobileNumber: owner.mobile_number,
            recipientName: owner.full_name,
            recipientType: "OWNER",
            recordType: record.record_type,
            title: record.title,
            amount: record.amount,
            dueDate: record.due_date,
            daysRemaining
          });
          const log = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: "OWNER",
            recipient_name: owner.full_name,
            recipient_mobile: owner.mobile_number,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: sendResult.success ? "DELIVERED" : "FAILED",
            provider: sendResult.provider,
            message_preview: sendResult.messagePreview,
            gateway_response: sendResult.gatewayResponse,
            error_message: sendResult.success ? void 0 : sendResult.message
          });
          summary.logs.push(log);
          if (sendResult.success) {
            summary.dispatchedCount++;
          } else {
            summary.failedCount++;
          }
        } catch (err) {
          summary.failedCount++;
          const errLog = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: "OWNER",
            recipient_name: owner.full_name,
            recipient_mobile: owner.mobile_number,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: "FAILED",
            provider: "MSG91",
            message_preview: `Reminder for ${record.title} (${daysRemaining}d remaining)`,
            error_message: err.message
          });
          summary.logs.push(errLog);
        }
      } else {
        summary.skippedCount++;
      }
    }
    const shouldSendToNominee = record.recipients === "AUTHORIZED_NOMINEE" || record.recipients === "BOTH";
    if (shouldSendToNominee) {
      if (!record.nominee_consent_granted) {
        db.addReminderLog({
          user_id: owner.id,
          due_date_id: record.id,
          record_title: record.title,
          record_type: record.record_type,
          recipient_type: "NOMINEE",
          recipient_name: record.nominee_name || "Unverified Nominee",
          recipient_mobile: record.nominee_mobile || "0000000000",
          days_before_due: daysRemaining,
          due_date: record.due_date,
          status: "SKIPPED",
          provider: "MSG91",
          message_preview: "Nominee reminder omitted: Owner consent not active.",
          error_message: "Consent Revoked or Inactive: Owner has not explicitly enabled nominee reminders."
        });
        summary.skippedCount++;
        continue;
      }
      let matchedNominee = null;
      if (record.nominee_id) {
        matchedNominee = nominees.find((n) => n.id === record.nominee_id);
      }
      if (!matchedNominee && record.nominee_mobile) {
        const cleanNomMobile = db.canonicalizeMobile(record.nominee_mobile);
        matchedNominee = nominees.find((n) => db.canonicalizeMobile(n.mobile_number) === cleanNomMobile);
      }
      const isVerified = Boolean(matchedNominee && (matchedNominee.is_phone_verified || matchedNominee.status === "VERIFIED"));
      const nomineePhone = matchedNominee ? matchedNominee.mobile_number : record.nominee_mobile;
      const nomineeName = matchedNominee && matchedNominee.name || record.nominee_name || "Designated Nominee";
      if (!isVerified || !nomineePhone) {
        db.addReminderLog({
          user_id: owner.id,
          due_date_id: record.id,
          record_title: record.title,
          record_type: record.record_type,
          recipient_type: "NOMINEE",
          recipient_name: nomineeName,
          recipient_mobile: nomineePhone || "0000000000",
          days_before_due: daysRemaining,
          due_date: record.due_date,
          status: "SKIPPED",
          provider: "MSG91",
          message_preview: "Nominee reminder omitted: Phone number unverified.",
          error_message: "Security Policy: Nominee phone number must complete SMS OTP verification before receiving reminder notices."
        });
        summary.skippedCount++;
        continue;
      }
      const nomineeAlreadySent = db.hasReminderBeenSent(record.id, nomineePhone, daysRemaining, todayString);
      if (!nomineeAlreadySent) {
        try {
          const sendResult = await sendMsg91TransactionalSms({
            mobileNumber: nomineePhone,
            recipientName: nomineeName,
            recipientType: "NOMINEE",
            recordType: record.record_type,
            title: record.title,
            amount: record.amount,
            dueDate: record.due_date,
            daysRemaining
          });
          const log = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: "NOMINEE",
            recipient_name: nomineeName,
            recipient_mobile: nomineePhone,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: sendResult.success ? "DELIVERED" : "FAILED",
            provider: sendResult.provider,
            message_preview: sendResult.messagePreview,
            gateway_response: sendResult.gatewayResponse,
            error_message: sendResult.success ? void 0 : sendResult.message
          });
          summary.logs.push(log);
          if (sendResult.success) {
            summary.dispatchedCount++;
          } else {
            summary.failedCount++;
          }
        } catch (err) {
          summary.failedCount++;
          const errLog = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: "NOMINEE",
            recipient_name: nomineeName,
            recipient_mobile: nomineePhone,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: "FAILED",
            provider: "MSG91",
            message_preview: `Nominee notice for ${record.title}`,
            error_message: err.message
          });
          summary.logs.push(errLog);
        }
      } else {
        summary.skippedCount++;
      }
    }
  }
  console.log(
    `[LIFORA SCHEDULER] Completed check: ${summary.dispatchedCount} SMS dispatched, ${summary.skippedCount} skipped/duplicate, ${summary.failedCount} failed.`
  );
  return summary;
}
var schedulerTimer = null;
function startBackgroundReminderScheduler(intervalMs = 60 * 60 * 1e3) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }
  console.log("[LIFORA SCHEDULER] Initializing persistent background reminder job...");
  setTimeout(() => {
    runDueReminderCheck().catch((err) => {
      console.error("[LIFORA SCHEDULER] Error during initial check:", err);
    });
  }, 5e3);
  schedulerTimer = setInterval(() => {
    runDueReminderCheck().catch((err) => {
      console.error("[LIFORA SCHEDULER] Error during recurring check:", err);
    });
  }, intervalMs);
}

// server.ts
dotenv.config();
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
var isProd = process.env.NODE_ENV === "production";
var rawAllowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : void 0,
  ...process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []
].filter(Boolean).map((origin) => origin.trim().replace(/\/+$/, ""));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.trim().replace(/\/+$/, "");
    if (!isProd) {
      if (/^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(cleanOrigin)) {
        return callback(null, true);
      }
    }
    if (rawAllowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }
    const isVercelOrigin = /^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(cleanOrigin);
    const hasConfiguredVercel = rawAllowedOrigins.some((o) => o.includes("vercel.app"));
    const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS !== "false";
    if (isVercelOrigin && (hasConfiguredVercel || allowVercelPreviews || rawAllowedOrigins.length === 0)) {
      return callback(null, true);
    }
    if (isProd) {
      console.warn(`[CORS Blocked] Origin "${origin}" is not authorized. Allowed origins:`, rawAllowedOrigins);
      return callback(null, false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
}));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
var DOCUMENTS_DIR2 = db.getDocumentsDirectory();
if (!fs2.existsSync(DOCUMENTS_DIR2)) {
  fs2.mkdirSync(DOCUMENTS_DIR2, { recursive: true });
}
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCUMENTS_DIR2);
  },
  filename: (req, file, cb) => {
    const ext = path2.extname(file.originalname).toLowerCase();
    const safeBase = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `${safeBase}${ext}`);
  }
});
var upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
    // 15MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    const ext = path2.extname(file.originalname).toLowerCase();
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Only PDF, JPG, JPEG, and PNG files are allowed."));
    }
  }
});
function authenticateOwner(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required. Missing Bearer token." });
  }
  const token = authHeader.split(" ")[1];
  const parts = token.split("_");
  if (parts.length >= 3 && parts[0] === "lifora" && parts[1] === "tok") {
    const userId = parts.slice(2, -1).join("_") || parts[2];
    const user = db.findUserById(userId);
    if (user) {
      req.user = user;
      return next();
    }
  }
  const directUser = db.findUserById(token);
  if (directUser) {
    req.user = directUser;
    return next();
  }
  return res.status(401).json({ success: false, error: "Invalid or expired session. Please log in again." });
}
app.get(["/health", "/api/health"], (req, res) => {
  const msg91Config = getMsg91Config();
  res.json({
    status: "healthy",
    service: "LIFORA AI Core Engine",
    version: "2.5.0",
    environment: process.env.NODE_ENV || "development",
    sms_provider: msg91Config.provider,
    msg91_configured: Boolean(msg91Config.authKey && msg91Config.templateId),
    msg91_sender_id: msg91Config.senderId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { mobile_number, purpose } = req.body;
    if (!mobile_number) {
      return res.status(400).json({ success: false, error: "Mobile number is required" });
    }
    const { clean10 } = formatIndianMobile(mobile_number);
    const validPurpose = purpose === "NOMINEE_PHONE_VERIFICATION" ? "NOMINEE_PHONE_VERIFICATION" : "USER_PHONE_VERIFICATION";
    const config = getMsg91Config();
    const plainOtp = generateCryptoOtp();
    const isMock = config.provider === "MOCK";
    let sendResult;
    try {
      sendResult = await sendMsg91SmsOtp(clean10, plainOtp);
    } catch (gatewayErr) {
      return res.status(502).json({
        success: false,
        error: gatewayErr.message || "Failed to dispatch SMS via MSG91 gateway."
      });
    }
    if (!sendResult.success) {
      return res.status(502).json({
        success: false,
        error: sendResult.message
      });
    }
    const session = db.createOtpSession({
      mobile_number: clean10,
      purpose: validPurpose,
      plainOtp,
      isMock,
      expirySeconds: config.expirySeconds,
      cooldownSeconds: config.cooldownSeconds
    });
    const maskedNumber = `+91 XXXXX X${clean10.slice(-4)}`;
    return res.json({
      success: true,
      verification_id: session.verification_id,
      masked_number: maskedNumber,
      expires_in_seconds: config.expirySeconds,
      cooldown_seconds: config.cooldownSeconds,
      is_mock: isMock,
      // For developer demo mode ONLY: expose demo OTP when explicitly in MOCK mode
      demo_otp: isMock ? plainOtp : void 0,
      message: isMock ? "Demo OTP generated (Demo Mode Active). Live SMS requires configured MSG91_AUTH_KEY." : "SMS OTP successfully sent to your mobile phone via MSG91."
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/resend-otp", async (req, res) => {
  try {
    const { verification_id } = req.body;
    if (!verification_id) {
      return res.status(400).json({ success: false, error: "Verification ID is required" });
    }
    const session = db.getOtpSession(verification_id);
    if (!session) {
      return res.status(404).json({ success: false, error: "OTP session not found or expired. Please request a new OTP." });
    }
    const now = Date.now();
    if (now < session.resend_available_at) {
      const waitSeconds = Math.ceil((session.resend_available_at - now) / 1e3);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`
      });
    }
    const config = getMsg91Config();
    const newOtp = generateCryptoOtp();
    const isMock = config.provider === "MOCK";
    try {
      await sendMsg91SmsOtp(session.mobile_number, newOtp);
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }
    const { hash, salt } = hashPassword(newOtp);
    session.code_hash = hash;
    session.salt = salt;
    session.attempts = 0;
    session.expires_at = now + config.expirySeconds * 1e3;
    session.resend_available_at = now + config.cooldownSeconds * 1e3;
    db.updateOtpSession(session);
    return res.json({
      success: true,
      message: "New OTP has been dispatched to your mobile phone.",
      cooldown_seconds: config.cooldownSeconds,
      is_mock: isMock,
      demo_otp: isMock ? newOtp : void 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { verification_id, otp } = req.body;
    if (!verification_id || !otp) {
      return res.status(400).json({ success: false, error: "Verification ID and OTP are required" });
    }
    const cleanOtp = otp.toString().trim();
    if (cleanOtp.length !== 6) {
      return res.status(400).json({ success: false, error: "Please enter the complete 6-digit OTP" });
    }
    const session = db.getOtpSession(verification_id);
    if (!session) {
      return res.status(400).json({ success: false, error: "Invalid or expired verification session. Please request a new OTP." });
    }
    if (Date.now() > session.expires_at) {
      db.deleteOtpSession(verification_id);
      return res.status(400).json({ success: false, error: "OTP has expired. Please request a new OTP." });
    }
    if (session.attempts >= session.max_attempts) {
      db.deleteOtpSession(verification_id);
      return res.status(429).json({ success: false, error: "Maximum verification attempts exceeded. Please request a new OTP." });
    }
    const config = getMsg91Config();
    if (config.provider === "MSG91" && config.authKey) {
      try {
        const gwResult = await verifyWithMsg91Gateway(session.mobile_number, cleanOtp);
        if (!gwResult.verified) {
          session.attempts += 1;
          db.updateOtpSession(session);
          const remaining = session.max_attempts - session.attempts;
          return res.status(400).json({
            success: false,
            error: `${gwResult.message || "Incorrect OTP."} ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new OTP."}`
          });
        }
      } catch (gwErr) {
        console.error("MSG91 gateway verify error, falling back to local hash validation:", gwErr.message);
        const isValid = verifyPassword(cleanOtp, session.code_hash, session.salt);
        if (!isValid) {
          session.attempts += 1;
          db.updateOtpSession(session);
          const remaining = session.max_attempts - session.attempts;
          return res.status(400).json({
            success: false,
            error: `Incorrect OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new OTP."}`
          });
        }
      }
    } else {
      const isValid = verifyPassword(cleanOtp, session.code_hash, session.salt);
      if (!isValid) {
        session.attempts += 1;
        db.updateOtpSession(session);
        const remaining = session.max_attempts - session.attempts;
        return res.status(400).json({
          success: false,
          error: `Incorrect OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new OTP."}`
        });
      }
    }
    session.is_verified = true;
    db.updateOtpSession(session);
    return res.json({
      success: true,
      verified: true,
      message: "Mobile number verified successfully.",
      verified_phone: session.mobile_number,
      purpose: session.purpose
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/firebase-verify-sync", async (req, res) => {
  try {
    const { phone, firebase_uid, id_token, purpose } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone number is required" });
    }
    const { clean10 } = formatIndianMobile(phone);
    const validPurpose = purpose === "NOMINEE_PHONE_VERIFICATION" ? "NOMINEE_PHONE_VERIFICATION" : "USER_PHONE_VERIFICATION";
    const session = db.createOtpSession({
      mobile_number: clean10,
      purpose: validPurpose,
      plainOtp: "FIREBASE_VERIFIED",
      isMock: false,
      expirySeconds: 3600,
      cooldownSeconds: 60
    });
    session.is_verified = true;
    db.updateOtpSession(session);
    return res.json({
      success: true,
      verification_id: session.verification_id,
      verified: true,
      message: "Firebase phone verification synchronized with backend."
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/register", (req, res) => {
  try {
    const { full_name, mobile_number, date_of_birth, password, masked_identity_number, verification_id, customEfid } = req.body;
    if (!full_name || !mobile_number || !password || !date_of_birth) {
      return res.status(400).json({ success: false, error: "All fields (Full Name, Mobile, Date of Birth, Password) are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }
    const { clean10 } = formatIndianMobile(mobile_number);
    if (verification_id) {
      const session = db.getOtpSession(verification_id);
      if (session && !session.is_verified) {
        return res.status(400).json({ success: false, error: "Mobile number verification has not been completed" });
      }
    }
    const { user, initialVault } = db.createUser({
      full_name,
      mobile_number: clean10,
      date_of_birth,
      password,
      masked_identity_number,
      customEfid
    });
    const token = `lifora_tok_${user.id}_${Date.now()}`;
    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      mobile_number: user.mobile_number,
      date_of_birth: user.date_of_birth,
      role: user.role,
      is_verified: user.is_verified,
      efid: user.efid,
      preferred_language: user.preferred_language,
      masked_identity_number: user.masked_identity_number,
      inactivity_threshold_days: user.inactivity_threshold_days,
      last_activity_at: user.last_activity_at,
      created_at: user.created_at
    };
    return res.status(201).json({
      success: true,
      message: "Vault account registered successfully with permanent E-FID.",
      user: safeUser,
      token,
      vault: initialVault
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/login", (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: "Please enter your E-FID / Mobile number and password" });
    }
    const cleanInput = identifier.trim();
    const user = db.findUserByIdentifier(cleanInput);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: `No vault account found for "${cleanInput}". Please register as a new vault owner.`
      });
    }
    const isPasswordValid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password. Please verify your password and try again."
      });
    }
    user.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
    const token = `lifora_tok_${user.id}_${Date.now()}`;
    const vault = db.getVault(user.id);
    const documents = db.getUserDocuments(user.id);
    const dueDates = db.getDueDatesByUser(user.id);
    db.addAuditLog(user.id, {
      action: "USER_LOGIN_SUCCESS",
      actor: user.full_name,
      details: `Authenticated into LIFORA Vault via E-FID (${user.efid})`
    });
    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      mobile_number: user.mobile_number,
      date_of_birth: user.date_of_birth,
      role: user.role,
      is_verified: user.is_verified,
      efid: user.efid,
      preferred_language: user.preferred_language,
      masked_identity_number: user.masked_identity_number,
      inactivity_threshold_days: user.inactivity_threshold_days,
      last_activity_at: user.last_activity_at,
      created_at: user.created_at
    };
    return res.json({
      success: true,
      message: "Login successful.",
      user: safeUser,
      token,
      vault: {
        ...vault,
        documents,
        dueDates
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/vault", authenticateOwner, (req, res) => {
  const user = req.user;
  const vault = db.getVault(user.id);
  const documents = db.getUserDocuments(user.id);
  const dueDates = db.getDueDatesByUser(user.id);
  res.json({
    success: true,
    vault: {
      ...vault,
      documents,
      dueDates,
      user
    }
  });
});
app.put("/api/vault", authenticateOwner, (req, res) => {
  try {
    const user = req.user;
    const updates = req.body;
    const updatedVault = db.updateVault(user.id, updates);
    res.json({ success: true, vault: updatedVault });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/documents", authenticateOwner, upload.single("file"), (req, res) => {
  try {
    const user = req.user;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "No document file provided for upload." });
    }
    const { title, category, description, allow_nominee_emergency_access } = req.body;
    if (!title || !title.trim()) {
      if (fs2.existsSync(file.path)) fs2.unlinkSync(file.path);
      return res.status(400).json({ success: false, error: "Document name is required." });
    }
    const validCategories = ["Identity Proof", "Insurance", "Property", "Vehicle", "Medical", "Financial", "Other"];
    const chosenCategory = validCategories.includes(category) ? category : "Other";
    const isNomineeAccessAllowed = allow_nominee_emergency_access === "true" || allow_nominee_emergency_access === true;
    const newDoc = db.addDocument({
      user_id: user.id,
      efid: user.efid,
      title: title.trim(),
      category: chosenCategory,
      description: description?.trim() || "",
      original_filename: file.originalname,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
      storage_path: file.filename,
      allow_nominee_emergency_access: isNomineeAccessAllowed
    });
    db.addAuditLog(user.id, {
      action: "DOCUMENT_UPLOADED",
      actor: user.full_name,
      details: `Uploaded document: "${newDoc.title}" (${newDoc.category}). Nominee access: ${newDoc.allow_nominee_emergency_access ? "ENABLED" : "DISABLED"}`
    });
    return res.status(201).json({
      success: true,
      message: "Document saved successfully to your secure vault.",
      document: newDoc
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/documents", authenticateOwner, (req, res) => {
  const user = req.user;
  const docs = db.getUserDocuments(user.id);
  res.json({ success: true, documents: docs });
});
app.get("/api/documents/:id/view", (req, res) => {
  const docId = req.params.id;
  const token = req.query.token || req.headers.authorization?.replace("Bearer ", "");
  let isAuthorized = false;
  let actorName = "Vault Owner";
  let isNominee = false;
  const doc = db.getDocumentById(docId);
  if (!doc) {
    return res.status(404).json({ success: false, error: "Document not found." });
  }
  if (token) {
    const parts = token.split("_");
    const userId = parts.slice(2, -1).join("_") || parts[2] || token;
    const user = db.findUserById(userId);
    if (user && user.id === doc.user_id) {
      isAuthorized = true;
      actorName = user.full_name;
    }
  }
  if (!isAuthorized && token) {
    const nomineeSession = db.getNomineeSession(token);
    if (nomineeSession && db.normalizeEfid(nomineeSession.owner_efid) === db.normalizeEfid(doc.efid)) {
      if (doc.allow_nominee_emergency_access) {
        isAuthorized = true;
        actorName = `Nominee: ${nomineeSession.nominee_name}`;
        isNominee = true;
      } else {
        return res.status(403).json({
          success: false,
          error: "Access Denied: The vault owner has not authorized nominee access for this private document."
        });
      }
    }
  }
  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: "Unauthorized to view this document." });
  }
  const filePath = path2.resolve(DOCUMENTS_DIR2, doc.storage_path);
  if (!fs2.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "Document file not found on storage server." });
  }
  if (isNominee) {
    db.addAuditLog(doc.user_id, {
      action: "NOMINEE_DOCUMENT_VIEW",
      actor: actorName,
      details: `Nominee viewed document: "${doc.title}"`,
      severity: "WARNING"
    });
  }
  res.setHeader("Content-Type", doc.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
  fs2.createReadStream(filePath).pipe(res);
});
app.get("/api/documents/:id/download", (req, res) => {
  const docId = req.params.id;
  const token = req.query.token || req.headers.authorization?.replace("Bearer ", "");
  let isAuthorized = false;
  let actorName = "Vault Owner";
  let isNominee = false;
  const doc = db.getDocumentById(docId);
  if (!doc) {
    return res.status(404).json({ success: false, error: "Document not found." });
  }
  if (token) {
    const parts = token.split("_");
    const userId = parts.slice(2, -1).join("_") || parts[2] || token;
    const user = db.findUserById(userId);
    if (user && user.id === doc.user_id) {
      isAuthorized = true;
      actorName = user.full_name;
    }
  }
  if (!isAuthorized && token) {
    const nomineeSession = db.getNomineeSession(token);
    if (nomineeSession && db.normalizeEfid(nomineeSession.owner_efid) === db.normalizeEfid(doc.efid)) {
      if (doc.allow_nominee_emergency_access) {
        isAuthorized = true;
        actorName = `Nominee: ${nomineeSession.nominee_name}`;
        isNominee = true;
      } else {
        return res.status(403).json({
          success: false,
          error: "Access Denied: The vault owner has not authorized nominee access for this private document."
        });
      }
    }
  }
  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: "Unauthorized to download this document." });
  }
  const filePath = path2.resolve(DOCUMENTS_DIR2, doc.storage_path);
  if (!fs2.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "Document file not found on storage server." });
  }
  if (isNominee) {
    db.addAuditLog(doc.user_id, {
      action: "NOMINEE_DOCUMENT_DOWNLOAD",
      actor: actorName,
      details: `Nominee downloaded document: "${doc.title}"`,
      severity: "WARNING"
    });
  }
  res.setHeader("Content-Type", doc.mime_type);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.original_filename)}"`);
  fs2.createReadStream(filePath).pipe(res);
});
app.put("/api/documents/:id", authenticateOwner, (req, res) => {
  const user = req.user;
  const docId = req.params.id;
  const { title, category, description, allow_nominee_emergency_access } = req.body;
  const updated = db.updateDocument(docId, user.id, {
    title,
    category,
    description,
    allow_nominee_emergency_access
  });
  if (!updated) {
    return res.status(404).json({ success: false, error: "Document not found or unauthorized." });
  }
  db.addAuditLog(user.id, {
    action: "DOCUMENT_UPDATED",
    actor: user.full_name,
    details: `Updated document "${updated.title}". Nominee access: ${updated.allow_nominee_emergency_access ? "ENABLED" : "DISABLED"}`
  });
  res.json({ success: true, message: "Document updated successfully.", document: updated });
});
app.delete("/api/documents/:id", authenticateOwner, (req, res) => {
  const user = req.user;
  const docId = req.params.id;
  const doc = db.getDocumentById(docId);
  const title = doc ? doc.title : docId;
  const deleted = db.deleteDocument(docId, user.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: "Document not found or unauthorized." });
  }
  db.addAuditLog(user.id, {
    action: "DOCUMENT_DELETED",
    actor: user.full_name,
    details: `Deleted document "${title}" from vault`
  });
  res.json({ success: true, message: "Document permanently deleted from vault." });
});
app.get("/api/due-dates", authenticateOwner, (req, res) => {
  const user = req.user;
  const dueDates = db.getDueDatesByUser(user.id);
  const { todayString } = getIndiaTodayDate();
  const enriched = dueDates.map((d) => ({
    ...d,
    days_remaining: calculateDaysRemaining(d.due_date, todayString),
    scheduled_reminders: calculateReminderDates(d.due_date, d.reminder_intervals)
  }));
  res.json({
    success: true,
    due_dates: enriched,
    today_ist: todayString
  });
});
app.post("/api/due-dates", authenticateOwner, (req, res) => {
  try {
    const user = req.user;
    const {
      record_type,
      title,
      amount,
      due_date,
      reminder_intervals,
      recipients,
      nominee_id,
      nominee_name,
      nominee_mobile,
      nominee_consent_granted,
      notes,
      linked_entity_id
    } = req.body;
    if (!title || !due_date || !record_type) {
      return res.status(400).json({ success: false, error: "Title, due date, and category are required." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ success: false, error: "Invalid due date format. Please use YYYY-MM-DD." });
    }
    const newRecord = db.addDueDate({
      user_id: user.id,
      record_type,
      title,
      amount: record_type === "DOCUMENT_EXPIRY" ? null : amount !== void 0 && amount !== null && amount !== "" ? parseFloat(amount) : null,
      due_date,
      reminder_intervals: Array.isArray(reminder_intervals) && reminder_intervals.length > 0 ? reminder_intervals : [7, 3, 1],
      recipients: recipients || "OWNER_ONLY",
      nominee_id,
      nominee_name,
      nominee_mobile,
      nominee_consent_granted: Boolean(nominee_consent_granted),
      notes,
      linked_entity_id
    });
    db.addAuditLog(user.id, {
      action: "DUE_DATE_CREATED",
      actor: user.full_name,
      details: `Scheduled ${record_type} reminder: "${newRecord.title}" due on ${newRecord.due_date}. Recipients: ${newRecord.recipients}`
    });
    const { todayString } = getIndiaTodayDate();
    return res.status(201).json({
      success: true,
      message: "Due date reminder scheduled successfully.",
      due_date: {
        ...newRecord,
        days_remaining: calculateDaysRemaining(newRecord.due_date, todayString),
        scheduled_reminders: calculateReminderDates(newRecord.due_date, newRecord.reminder_intervals)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.put("/api/due-dates/:id", authenticateOwner, (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;
    const updates = req.body;
    const updated = db.updateDueDate(id, user.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Due date record not found or unauthorized." });
    }
    db.addAuditLog(user.id, {
      action: "DUE_DATE_UPDATED",
      actor: user.full_name,
      details: `Updated reminder "${updated.title}" (Status: ${updated.status}).`
    });
    const { todayString } = getIndiaTodayDate();
    return res.json({
      success: true,
      message: "Due date reminder updated successfully.",
      due_date: {
        ...updated,
        days_remaining: calculateDaysRemaining(updated.due_date, todayString),
        scheduled_reminders: calculateReminderDates(updated.due_date, updated.reminder_intervals)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/api/due-dates/:id", authenticateOwner, (req, res) => {
  const user = req.user;
  const id = req.params.id;
  const existing = db.getDueDateById(id);
  const title = existing ? existing.title : id;
  const deleted = db.deleteDueDate(id, user.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: "Due date record not found or unauthorized." });
  }
  db.addAuditLog(user.id, {
    action: "DUE_DATE_DELETED",
    actor: user.full_name,
    details: `Cancelled and removed reminder for "${title}".`
  });
  return res.json({ success: true, message: "Due date reminder permanently removed." });
});
app.post("/api/due-dates/:id/test-sms", authenticateOwner, async (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;
    const record = db.getDueDateById(id);
    if (!record || record.user_id !== user.id) {
      return res.status(404).json({ success: false, error: "Due date record not found." });
    }
    const { target_recipient } = req.body;
    const { todayString } = getIndiaTodayDate();
    const daysRemaining = calculateDaysRemaining(record.due_date, todayString);
    const results = [];
    if (!target_recipient || target_recipient === "OWNER" || record.recipients === "OWNER_ONLY" || record.recipients === "BOTH") {
      const ownerRes = await sendMsg91TransactionalSms({
        mobileNumber: user.mobile_number,
        recipientName: user.full_name,
        recipientType: "OWNER",
        recordType: record.record_type,
        title: record.title,
        amount: record.amount,
        dueDate: record.due_date,
        daysRemaining
      });
      const log = db.addReminderLog({
        user_id: user.id,
        due_date_id: record.id,
        record_title: record.title,
        record_type: record.record_type,
        recipient_type: "OWNER",
        recipient_name: user.full_name,
        recipient_mobile: user.mobile_number,
        days_before_due: daysRemaining,
        due_date: record.due_date,
        status: ownerRes.success ? "DELIVERED" : "FAILED",
        provider: ownerRes.provider,
        message_preview: ownerRes.messagePreview,
        gateway_response: ownerRes.gatewayResponse,
        error_message: ownerRes.success ? void 0 : ownerRes.message
      });
      results.push({
        recipient: "OWNER",
        mobile: user.mobile_number,
        result: ownerRes,
        log
      });
    }
    if (target_recipient === "NOMINEE" || record.recipients === "AUTHORIZED_NOMINEE" || record.recipients === "BOTH") {
      if (!record.nominee_consent_granted) {
        return res.status(400).json({
          success: false,
          error: 'Owner consent revoked or inactive: You must check "Authorize Nominee SMS" before reminders can be dispatched.'
        });
      }
      const vault = db.getVault(user.id);
      const nominees = vault.nominees || [];
      const nominee = nominees.find((n) => n.id === record.nominee_id) || (record.nominee_mobile ? nominees.find((n) => db.canonicalizeMobile(n.mobile_number) === db.canonicalizeMobile(record.nominee_mobile)) : null);
      if (!nominee || !nominee.is_phone_verified && nominee.status !== "VERIFIED") {
        return res.status(400).json({
          success: false,
          error: "Security Policy: Nominee phone number is unverified. Nominee must complete SMS OTP verification first."
        });
      }
      const nomRes = await sendMsg91TransactionalSms({
        mobileNumber: nominee.mobile_number,
        recipientName: nominee.name,
        recipientType: "NOMINEE",
        recordType: record.record_type,
        title: record.title,
        amount: record.amount,
        dueDate: record.due_date,
        daysRemaining
      });
      const log = db.addReminderLog({
        user_id: user.id,
        due_date_id: record.id,
        record_title: record.title,
        record_type: record.record_type,
        recipient_type: "NOMINEE",
        recipient_name: nominee.name,
        recipient_mobile: nominee.mobile_number,
        days_before_due: daysRemaining,
        due_date: record.due_date,
        status: nomRes.success ? "DELIVERED" : "FAILED",
        provider: nomRes.provider,
        message_preview: nomRes.messagePreview,
        gateway_response: nomRes.gatewayResponse,
        error_message: nomRes.success ? void 0 : nomRes.message
      });
      results.push({
        recipient: "NOMINEE",
        mobile: nominee.mobile_number,
        result: nomRes,
        log
      });
    }
    const allSuccessful = results.length > 0 && results.every((r) => r.result.success);
    return res.json({
      success: allSuccessful,
      message: allSuccessful ? "Real SMS test reminder dispatched via MSG91 gateway." : "One or more SMS dispatches could not be confirmed by MSG91.",
      results
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/due-dates/:id/logs", authenticateOwner, (req, res) => {
  const user = req.user;
  const id = req.params.id;
  const logs = db.getReminderLogs(user.id, id);
  res.json({ success: true, logs });
});
app.get("/api/due-dates/all-logs", authenticateOwner, (req, res) => {
  const user = req.user;
  const logs = db.getReminderLogs(user.id);
  res.json({ success: true, logs });
});
app.post("/api/scheduler/run-reminders", async (req, res) => {
  try {
    const summary = await runDueReminderCheck();
    return res.json({
      success: true,
      message: "Automated reminder evaluation completed.",
      summary
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/nominees/emergency-login", async (req, res) => {
  try {
    const { nominee_mobile, owner_efid, verification_id, otp } = req.body;
    if (!nominee_mobile || !owner_efid || !verification_id || !otp) {
      return res.status(400).json({
        success: false,
        error: "Nominee mobile, Owner E-FID, and verified OTP are required."
      });
    }
    const cleanOtp = otp.toString().trim();
    const session = db.getOtpSession(verification_id);
    if (!session || Date.now() > session.expires_at) {
      return res.status(400).json({ success: false, error: "OTP session expired. Please request a new OTP." });
    }
    const isOtpValid = verifyPassword(cleanOtp, session.code_hash, session.salt);
    if (!isOtpValid) {
      return res.status(400).json({ success: false, error: "Invalid OTP code. Please enter the code sent to your mobile." });
    }
    const owner = db.findUserByEfid(owner_efid);
    if (!owner) {
      return res.status(404).json({
        success: false,
        error: `No vault found matching Owner E-FID "${owner_efid}". Please verify the E-FID.`
      });
    }
    const { clean10 } = formatIndianMobile(nominee_mobile);
    const vault = db.getVault(owner.id);
    const registeredNominees = vault.nominees || [];
    const matched = registeredNominees.find((n) => n.mobile_number.replace(/\D/g, "") === clean10);
    const nomineeName = matched ? matched.name : "Designated Nominee";
    const nomineeSession = db.createNomineeSession({
      nominee_id: matched ? matched.id : `nom_${Date.now()}`,
      nominee_name: nomineeName,
      nominee_mobile: clean10,
      owner_efid: owner.efid,
      owner_user_id: owner.id
    });
    const permittedDocuments = db.getPermittedNomineeDocuments(owner.efid);
    db.addAuditLog(owner.id, {
      action: "NOMINEE_EMERGENCY_LOGIN",
      actor: nomineeName,
      details: `Nominee (${nominee_mobile}) authenticated into vault. Permitted documents accessible: ${permittedDocuments.length}`,
      severity: "WARNING"
    });
    return res.json({
      success: true,
      message: "Nominee authenticated into controlled emergency portal.",
      nomineeSessionToken: nomineeSession.token,
      ownerEfid: owner.efid,
      nominee: {
        id: nomineeSession.nominee_id,
        name: nomineeName,
        mobile_number: clean10,
        relationship: matched ? matched.relationship : "Designated Nominee",
        status: "VERIFIED"
      },
      permittedDocuments,
      vault: {
        accounts: vault.accounts || [],
        loans: vault.loans || [],
        emis: vault.emis || [],
        insurance: vault.insurance || [],
        commitments: vault.commitments || [],
        moneyGiven: vault.moneyGiven || [],
        moneyBorrowed: vault.moneyBorrowed || [],
        properties: vault.properties || [],
        valuableAssets: vault.valuableAssets || [],
        vehicles: vault.vehicles || [],
        documents: permittedDocuments || [],
        personalDiary: (vault.personalDiary || []).filter((d) => d.is_emergency_shared === true),
        financialDiary: vault.financialDiary || [],
        importantInfo: vault.importantInfo || [],
        nominees: vault.nominees || [],
        safetyCheckin: null,
        emergencySession: null,
        auditLogs: [],
        language: vault.language || "en"
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/nominee/documents", (req, res) => {
  const token = req.query.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ success: false, error: "Nominee session token required." });
  }
  const session = db.getNomineeSession(token);
  if (!session) {
    return res.status(401).json({ success: false, error: "Emergency session expired. Please re-authenticate." });
  }
  const docs = db.getPermittedNomineeDocuments(session.owner_efid);
  res.json({ success: true, documents: docs });
});
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});
app.use((err, req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal server error occurred."
    });
  }
  next(err);
});
async function setupViteOrStatic() {
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(process.cwd(), "dist");
    if (fs2.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path2.resolve(distPath, "index.html"));
      });
    } else {
      console.warn(`[LIFORA AI] Static dist directory not found at ${distPath}. Running in API-only mode.`);
      app.get("/", (req, res) => {
        res.json({
          service: "LIFORA AI Core Backend API",
          status: "online",
          mode: "backend-only",
          health: "/health",
          api_health: "/api/health",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
      app.get("*", (req, res) => {
        res.status(404).json({
          success: false,
          error: "Frontend is hosted separately (e.g. Vercel). This service provides the LIFORA backend API."
        });
      });
    }
  }
}
setupViteOrStatic().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LIFORA AI] Server running on port ${PORT} (Mode: ${isProd ? "production" : "development"})`);
    startBackgroundReminderScheduler();
  });
});
