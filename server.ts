import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import { db, StoredUser, StoredDocument, verifyPassword, hashPassword } from './src/server/db';
import { sendMsg91SmsOtp, verifyWithMsg91Gateway, getMsg91Config, generateCryptoOtp, formatIndianMobile, sendMsg91TransactionalSms } from './src/server/msg91';
import {
  startBackgroundReminderScheduler,
  runDueReminderCheck,
  calculateDaysRemaining,
  calculateReminderDates,
  getIndiaTodayDate,
} from './src/server/scheduler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// CORS configuration for Vercel frontend and external origins
// Parses FRONTEND_URL, CORS_ORIGIN, and supports Vercel preview/production domains
const rawAllowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
]
  .filter(Boolean)
  .map((origin) => origin!.trim().replace(/\/+$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow requests with no Origin (server-to-server, curl, mobile frames, health monitors)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    // 2. Allow local development origins in non-production
    if (!isProd) {
      if (/^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(cleanOrigin)) {
        return callback(null, true);
      }
    }

    // 3. Exact match against configured FRONTEND_URL or CORS_ORIGIN
    if (rawAllowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // 4. Match Vercel deployment domains (*.vercel.app)
    // If FRONTEND_URL or CORS_ORIGIN specifies a Vercel domain, or if ALLOW_VERCEL_PREVIEWS is enabled,
    // allow legitimate Vercel production and preview deployments
    const isVercelOrigin = /^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(cleanOrigin);
    const hasConfiguredVercel = rawAllowedOrigins.some((o) => o.includes('vercel.app'));
    const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS !== 'false';

    if (isVercelOrigin && (hasConfiguredVercel || allowVercelPreviews || rawAllowedOrigins.length === 0)) {
      return callback(null, true);
    }

    // 5. In production, strictly reject origins not in the whitelist
    if (isProd) {
      console.warn(`[CORS Blocked] Origin "${origin}" is not authorized. Allowed origins:`, rawAllowedOrigins);
      return callback(null, false);
    }

    // Fallback for dev mode
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
}));

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Document upload directory
const DOCUMENTS_DIR = db.getDocumentsDirectory();
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCUMENTS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];

    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Only PDF, JPG, JPEG, and PNG files are allowed.'));
    }
  },
});

// -------------------------------------------------------------
// Authentication Middleware
// -------------------------------------------------------------
interface AuthenticatedRequest extends Request {
  user?: StoredUser;
  nomineeSession?: any;
}

function authenticateOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  // Simple token format: lifora_tok_<userId>_<timestamp>
  const parts = token.split('_');
  if (parts.length >= 3 && parts[0] === 'lifora' && parts[1] === 'tok') {
    const userId = parts.slice(2, -1).join('_') || parts[2];
    const user = db.findUserById(userId);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // Fallback for custom sessions
  const directUser = db.findUserById(token);
  if (directUser) {
    req.user = directUser;
    return next();
  }

  return res.status(401).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
}

// -------------------------------------------------------------
// 1. HEALTH & SYSTEM STATUS
// -------------------------------------------------------------
app.get(['/health', '/api/health'], (req, res) => {
  const msg91Config = getMsg91Config();
  res.json({
    status: 'healthy',
    service: 'LIFORA AI Core Engine',
    version: '2.5.0',
    environment: process.env.NODE_ENV || 'development',
    sms_provider: msg91Config.provider,
    msg91_configured: Boolean(msg91Config.authKey && msg91Config.templateId),
    msg91_sender_id: msg91Config.senderId,
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// 2. MSG91 SMS OTP ENDPOINTS
// -------------------------------------------------------------

// Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { mobile_number, purpose } = req.body;
    if (!mobile_number) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }

    const { clean10 } = formatIndianMobile(mobile_number);
    const validPurpose = purpose === 'NOMINEE_PHONE_VERIFICATION' ? 'NOMINEE_PHONE_VERIFICATION' : 'USER_PHONE_VERIFICATION';
    const config = getMsg91Config();

    const plainOtp = generateCryptoOtp();
    const isMock = config.provider === 'MOCK';

    // Dispatch SMS via MSG91
    let sendResult;
    try {
      sendResult = await sendMsg91SmsOtp(clean10, plainOtp);
    } catch (gatewayErr: any) {
      return res.status(502).json({
        success: false,
        error: gatewayErr.message || 'Failed to dispatch SMS via MSG91 gateway.',
      });
    }

    if (!sendResult.success) {
      return res.status(502).json({
        success: false,
        error: sendResult.message,
      });
    }

    // Save session in persistent DB with hashed OTP
    const session = db.createOtpSession({
      mobile_number: clean10,
      purpose: validPurpose,
      plainOtp,
      isMock,
      expirySeconds: config.expirySeconds,
      cooldownSeconds: config.cooldownSeconds,
    });

    const maskedNumber = `+91 XXXXX X${clean10.slice(-4)}`;

    // Return response without exposing the OTP in production
    return res.json({
      success: true,
      verification_id: session.verification_id,
      masked_number: maskedNumber,
      expires_in_seconds: config.expirySeconds,
      cooldown_seconds: config.cooldownSeconds,
      is_mock: isMock,
      // For developer demo mode ONLY: expose demo OTP when explicitly in MOCK mode
      demo_otp: isMock ? plainOtp : undefined,
      message: isMock
        ? 'Demo OTP generated (Demo Mode Active). Live SMS requires configured MSG91_AUTH_KEY.'
        : 'SMS OTP successfully sent to your mobile phone via MSG91.',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { verification_id } = req.body;
    if (!verification_id) {
      return res.status(400).json({ success: false, error: 'Verification ID is required' });
    }

    const session = db.getOtpSession(verification_id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'OTP session not found or expired. Please request a new OTP.' });
    }

    const now = Date.now();
    if (now < session.resend_available_at) {
      const waitSeconds = Math.ceil((session.resend_available_at - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
      });
    }

    const config = getMsg91Config();
    const newOtp = generateCryptoOtp();
    const isMock = config.provider === 'MOCK';

    try {
      await sendMsg91SmsOtp(session.mobile_number, newOtp);
    } catch (err: any) {
      return res.status(502).json({ success: false, error: err.message });
    }

    // Refresh OTP session
    const { hash, salt } = hashPassword(newOtp);
    session.code_hash = hash;
    session.salt = salt;
    session.attempts = 0;
    session.expires_at = now + config.expirySeconds * 1000;
    session.resend_available_at = now + config.cooldownSeconds * 1000;
    db.updateOtpSession(session);

    return res.json({
      success: true,
      message: 'New OTP has been dispatched to your mobile phone.',
      cooldown_seconds: config.cooldownSeconds,
      is_mock: isMock,
      demo_otp: isMock ? newOtp : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { verification_id, otp } = req.body;
    if (!verification_id || !otp) {
      return res.status(400).json({ success: false, error: 'Verification ID and OTP are required' });
    }

    const cleanOtp = otp.toString().trim();
    if (cleanOtp.length !== 6) {
      return res.status(400).json({ success: false, error: 'Please enter the complete 6-digit OTP' });
    }

    const session = db.getOtpSession(verification_id);
    if (!session) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification session. Please request a new OTP.' });
    }

    if (Date.now() > session.expires_at) {
      db.deleteOtpSession(verification_id);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new OTP.' });
    }

    if (session.attempts >= session.max_attempts) {
      db.deleteOtpSession(verification_id);
      return res.status(429).json({ success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    // If in live MSG91 mode, verify with MSG91 gateway API
    const config = getMsg91Config();
    if (config.provider === 'MSG91' && config.authKey) {
      try {
        const gwResult = await verifyWithMsg91Gateway(session.mobile_number, cleanOtp);
        if (!gwResult.verified) {
          session.attempts += 1;
          db.updateOtpSession(session);
          const remaining = session.max_attempts - session.attempts;
          return res.status(400).json({
            success: false,
            error: `${gwResult.message || 'Incorrect OTP.'} ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new OTP.'}`,
          });
        }
      } catch (gwErr: any) {
        // Fallback to local cryptographic hash verification if gateway call fails or times out
        console.error('MSG91 gateway verify error, falling back to local hash validation:', gwErr.message);
        const isValid = verifyPassword(cleanOtp, session.code_hash, session.salt);
        if (!isValid) {
          session.attempts += 1;
          db.updateOtpSession(session);
          const remaining = session.max_attempts - session.attempts;
          return res.status(400).json({
            success: false,
            error: `Incorrect OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new OTP.'}`,
          });
        }
      }
    } else {
      // Local cryptographic hash verification (MOCK mode)
      const isValid = verifyPassword(cleanOtp, session.code_hash, session.salt);
      if (!isValid) {
        session.attempts += 1;
        db.updateOtpSession(session);
        const remaining = session.max_attempts - session.attempts;
        return res.status(400).json({
          success: false,
          error: `Incorrect OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new OTP.'}`,
        });
      }
    }

    // Mark verified
    session.is_verified = true;
    db.updateOtpSession(session);

    return res.json({
      success: true,
      verified: true,
      message: 'Mobile number verified successfully.',
      verified_phone: session.mobile_number,
      purpose: session.purpose,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Firebase Phone Verification Backend Sync
app.post('/api/auth/firebase-verify-sync', async (req, res) => {
  try {
    const { phone, firebase_uid, id_token, purpose } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const { clean10 } = formatIndianMobile(phone);
    const validPurpose = purpose === 'NOMINEE_PHONE_VERIFICATION' ? 'NOMINEE_PHONE_VERIFICATION' : 'USER_PHONE_VERIFICATION';

    // Create or update verified session in database
    const session = db.createOtpSession({
      mobile_number: clean10,
      purpose: validPurpose,
      plainOtp: 'FIREBASE_VERIFIED',
      isMock: false,
      expirySeconds: 3600,
      cooldownSeconds: 60,
    });

    session.is_verified = true;
    db.updateOtpSession(session);

    return res.json({
      success: true,
      verification_id: session.verification_id,
      verified: true,
      message: 'Firebase phone verification synchronized with backend.',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. OWNER REGISTRATION & LOGIN (PERSISTENT E-FID)
// -------------------------------------------------------------

// Owner Registration
app.post('/api/auth/register', (req, res) => {
  try {
    const { full_name, mobile_number, date_of_birth, password, masked_identity_number, verification_id, customEfid } = req.body;

    if (!full_name || !mobile_number || !password || !date_of_birth) {
      return res.status(400).json({ success: false, error: 'All fields (Full Name, Mobile, Date of Birth, Password) are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const { clean10 } = formatIndianMobile(mobile_number);

    // Verify OTP session if provided
    if (verification_id) {
      const session = db.getOtpSession(verification_id);
      if (session && !session.is_verified) {
        return res.status(400).json({ success: false, error: 'Mobile number verification has not been completed' });
      }
    }

    const { user, initialVault } = db.createUser({
      full_name,
      mobile_number: clean10,
      date_of_birth,
      password,
      masked_identity_number,
      customEfid,
    });

    const token = `lifora_tok_${user.id}_${Date.now()}`;

    // Clean user object (do not expose password_hash or salt)
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
      created_at: user.created_at,
    };

    return res.status(201).json({
      success: true,
      message: 'Vault account registered successfully with permanent E-FID.',
      user: safeUser,
      token,
      vault: initialVault,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Owner Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Please enter your E-FID / Mobile number and password' });
    }

    const cleanInput = identifier.trim();
    const user = db.findUserByIdentifier(cleanInput);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `No vault account found for "${cleanInput}". Please register as a new vault owner.`,
      });
    }

    // Verify password hash
    const isPasswordValid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please verify your password and try again.',
      });
    }

    // Update last activity
    user.last_activity_at = new Date().toISOString();
    const token = `lifora_tok_${user.id}_${Date.now()}`;

    // Get persistent vault data & documents
    const vault = db.getVault(user.id);
    const documents = db.getUserDocuments(user.id);
    const dueDates = db.getDueDatesByUser(user.id);

    // Audit log
    db.addAuditLog(user.id, {
      action: 'USER_LOGIN_SUCCESS',
      actor: user.full_name,
      details: `Authenticated into LIFORA Vault via E-FID (${user.efid})`,
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
      created_at: user.created_at,
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      user: safeUser,
      token,
      vault: {
        ...vault,
        documents,
        dueDates,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. VAULT STATE PERSISTENCE ENDPOINTS
// -------------------------------------------------------------

// Get full vault data
app.get('/api/vault', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const vault = db.getVault(user.id);
  const documents = db.getUserDocuments(user.id);
  const dueDates = db.getDueDatesByUser(user.id);

  res.json({
    success: true,
    vault: {
      ...vault,
      documents,
      dueDates,
      user,
    },
  });
});

// Update vault data
app.put('/api/vault', authenticateOwner, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const updates = req.body;
    const updatedVault = db.updateVault(user.id, updates);
    res.json({ success: true, vault: updatedVault });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. IMPORTANT DOCUMENTS – SECURE DOCUMENT VAULT
// -------------------------------------------------------------

// Upload Document
app.post('/api/documents', authenticateOwner, upload.single('file'), (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No document file provided for upload.' });
    }

    const { title, category, description, allow_nominee_emergency_access } = req.body;

    if (!title || !title.trim()) {
      // Remove uploaded file if title missing
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, error: 'Document name is required.' });
    }

    const validCategories = ['Identity Proof', 'Insurance', 'Property', 'Vehicle', 'Medical', 'Financial', 'Other'];
    const chosenCategory = validCategories.includes(category) ? category : 'Other';
    const isNomineeAccessAllowed = allow_nominee_emergency_access === 'true' || allow_nominee_emergency_access === true;

    const newDoc = db.addDocument({
      user_id: user.id,
      efid: user.efid,
      title: title.trim(),
      category: chosenCategory as any,
      description: description?.trim() || '',
      original_filename: file.originalname,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
      storage_path: file.filename,
      allow_nominee_emergency_access: isNomineeAccessAllowed,
    });

    db.addAuditLog(user.id, {
      action: 'DOCUMENT_UPLOADED',
      actor: user.full_name,
      details: `Uploaded document: "${newDoc.title}" (${newDoc.category}). Nominee access: ${newDoc.allow_nominee_emergency_access ? 'ENABLED' : 'DISABLED'}`,
    });

    return res.status(201).json({
      success: true,
      message: 'Document saved successfully to your secure vault.',
      document: newDoc,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// List Documents
app.get('/api/documents', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const docs = db.getUserDocuments(user.id);
  res.json({ success: true, documents: docs });
});

// View Document (Inline)
app.get('/api/documents/:id/view', (req, res) => {
  const docId = req.params.id;
  const token = req.query.token as string || (req.headers.authorization?.replace('Bearer ', ''));

  let isAuthorized = false;
  let actorName = 'Vault Owner';
  let isNominee = false;

  const doc = db.getDocumentById(docId);
  if (!doc) {
    return res.status(404).json({ success: false, error: 'Document not found.' });
  }

  // 1. Check if token belongs to Owner
  if (token) {
    const parts = token.split('_');
    const userId = parts.slice(2, -1).join('_') || parts[2] || token;
    const user = db.findUserById(userId);
    if (user && user.id === doc.user_id) {
      isAuthorized = true;
      actorName = user.full_name;
    }
  }

  // 2. Check if token belongs to Nominee Session
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
          error: 'Access Denied: The vault owner has not authorized nominee access for this private document.',
        });
      }
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'Unauthorized to view this document.' });
  }

  const filePath = path.resolve(DOCUMENTS_DIR, doc.storage_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Document file not found on storage server.' });
  }

  if (isNominee) {
    db.addAuditLog(doc.user_id, {
      action: 'NOMINEE_DOCUMENT_VIEW',
      actor: actorName,
      details: `Nominee viewed document: "${doc.title}"`,
      severity: 'WARNING',
    });
  }

  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// Download Document
app.get('/api/documents/:id/download', (req, res) => {
  const docId = req.params.id;
  const token = req.query.token as string || (req.headers.authorization?.replace('Bearer ', ''));

  let isAuthorized = false;
  let actorName = 'Vault Owner';
  let isNominee = false;

  const doc = db.getDocumentById(docId);
  if (!doc) {
    return res.status(404).json({ success: false, error: 'Document not found.' });
  }

  // Check Owner
  if (token) {
    const parts = token.split('_');
    const userId = parts.slice(2, -1).join('_') || parts[2] || token;
    const user = db.findUserById(userId);
    if (user && user.id === doc.user_id) {
      isAuthorized = true;
      actorName = user.full_name;
    }
  }

  // Check Nominee
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
          error: 'Access Denied: The vault owner has not authorized nominee access for this private document.',
        });
      }
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'Unauthorized to download this document.' });
  }

  const filePath = path.resolve(DOCUMENTS_DIR, doc.storage_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Document file not found on storage server.' });
  }

  if (isNominee) {
    db.addAuditLog(doc.user_id, {
      action: 'NOMINEE_DOCUMENT_DOWNLOAD',
      actor: actorName,
      details: `Nominee downloaded document: "${doc.title}"`,
      severity: 'WARNING',
    });
  }

  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_filename)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// Update Document Metadata
app.put('/api/documents/:id', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const docId = req.params.id;
  const { title, category, description, allow_nominee_emergency_access } = req.body;

  const updated = db.updateDocument(docId, user.id, {
    title,
    category,
    description,
    allow_nominee_emergency_access,
  });

  if (!updated) {
    return res.status(404).json({ success: false, error: 'Document not found or unauthorized.' });
  }

  db.addAuditLog(user.id, {
    action: 'DOCUMENT_UPDATED',
    actor: user.full_name,
    details: `Updated document "${updated.title}". Nominee access: ${updated.allow_nominee_emergency_access ? 'ENABLED' : 'DISABLED'}`,
  });

  res.json({ success: true, message: 'Document updated successfully.', document: updated });
});

// Delete Document
app.delete('/api/documents/:id', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const docId = req.params.id;

  const doc = db.getDocumentById(docId);
  const title = doc ? doc.title : docId;

  const deleted = db.deleteDocument(docId, user.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Document not found or unauthorized.' });
  }

  db.addAuditLog(user.id, {
    action: 'DOCUMENT_DELETED',
    actor: user.full_name,
    details: `Deleted document "${title}" from vault`,
  });

  res.json({ success: true, message: 'Document permanently deleted from vault.' });
});

// -------------------------------------------------------------
// 6. DUE-DATE & AUTOMATIC SMS REMINDER SYSTEM (MSG91)
// -------------------------------------------------------------

// List all due dates for authenticated owner
app.get('/api/due-dates', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const dueDates = db.getDueDatesByUser(user.id);
  const { todayString } = getIndiaTodayDate();

  const enriched = dueDates.map((d) => ({
    ...d,
    days_remaining: calculateDaysRemaining(d.due_date, todayString),
    scheduled_reminders: calculateReminderDates(d.due_date, d.reminder_intervals),
  }));

  res.json({
    success: true,
    due_dates: enriched,
    today_ist: todayString,
  });
});

// Create new due date record
app.post('/api/due-dates', authenticateOwner, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
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
      linked_entity_id,
    } = req.body;

    if (!title || !due_date || !record_type) {
      return res.status(400).json({ success: false, error: 'Title, due date, and category are required.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ success: false, error: 'Invalid due date format. Please use YYYY-MM-DD.' });
    }

    const newRecord = db.addDueDate({
      user_id: user.id,
      record_type,
      title,
      amount: record_type === 'DOCUMENT_EXPIRY' ? null : (amount !== undefined && amount !== null && amount !== '' ? parseFloat(amount) : null),
      due_date,
      reminder_intervals: Array.isArray(reminder_intervals) && reminder_intervals.length > 0 ? reminder_intervals : [7, 3, 1],
      recipients: recipients || 'OWNER_ONLY',
      nominee_id,
      nominee_name,
      nominee_mobile,
      nominee_consent_granted: Boolean(nominee_consent_granted),
      notes,
      linked_entity_id,
    });

    db.addAuditLog(user.id, {
      action: 'DUE_DATE_CREATED',
      actor: user.full_name,
      details: `Scheduled ${record_type} reminder: "${newRecord.title}" due on ${newRecord.due_date}. Recipients: ${newRecord.recipients}`,
    });

    const { todayString } = getIndiaTodayDate();
    return res.status(201).json({
      success: true,
      message: 'Due date reminder scheduled successfully.',
      due_date: {
        ...newRecord,
        days_remaining: calculateDaysRemaining(newRecord.due_date, todayString),
        scheduled_reminders: calculateReminderDates(newRecord.due_date, newRecord.reminder_intervals),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update due date record
app.put('/api/due-dates/:id', authenticateOwner, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const id = req.params.id;
    const updates = req.body;

    const updated = db.updateDueDate(id, user.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Due date record not found or unauthorized.' });
    }

    db.addAuditLog(user.id, {
      action: 'DUE_DATE_UPDATED',
      actor: user.full_name,
      details: `Updated reminder "${updated.title}" (Status: ${updated.status}).`,
    });

    const { todayString } = getIndiaTodayDate();
    return res.json({
      success: true,
      message: 'Due date reminder updated successfully.',
      due_date: {
        ...updated,
        days_remaining: calculateDaysRemaining(updated.due_date, todayString),
        scheduled_reminders: calculateReminderDates(updated.due_date, updated.reminder_intervals),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete due date record
app.delete('/api/due-dates/:id', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const id = req.params.id;
  const existing = db.getDueDateById(id);
  const title = existing ? existing.title : id;

  const deleted = db.deleteDueDate(id, user.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Due date record not found or unauthorized.' });
  }

  db.addAuditLog(user.id, {
    action: 'DUE_DATE_DELETED',
    actor: user.full_name,
    details: `Cancelled and removed reminder for "${title}".`,
  });

  return res.json({ success: true, message: 'Due date reminder permanently removed.' });
});

// Test send immediate SMS reminder via real MSG91 gateway
app.post('/api/due-dates/:id/test-sms', authenticateOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const id = req.params.id;
    const record = db.getDueDateById(id);
    if (!record || record.user_id !== user.id) {
      return res.status(404).json({ success: false, error: 'Due date record not found.' });
    }

    const { target_recipient } = req.body;
    const { todayString } = getIndiaTodayDate();
    const daysRemaining = calculateDaysRemaining(record.due_date, todayString);

    const results: any[] = [];

    // Owner Dispatch
    if (!target_recipient || target_recipient === 'OWNER' || record.recipients === 'OWNER_ONLY' || record.recipients === 'BOTH') {
      const ownerRes = await sendMsg91TransactionalSms({
        mobileNumber: user.mobile_number,
        recipientName: user.full_name,
        recipientType: 'OWNER',
        recordType: record.record_type,
        title: record.title,
        amount: record.amount,
        dueDate: record.due_date,
        daysRemaining,
      });

      const log = db.addReminderLog({
        user_id: user.id,
        due_date_id: record.id,
        record_title: record.title,
        record_type: record.record_type,
        recipient_type: 'OWNER',
        recipient_name: user.full_name,
        recipient_mobile: user.mobile_number,
        days_before_due: daysRemaining,
        due_date: record.due_date,
        status: ownerRes.success ? 'DELIVERED' : 'FAILED',
        provider: ownerRes.provider,
        message_preview: ownerRes.messagePreview,
        gateway_response: ownerRes.gatewayResponse,
        error_message: ownerRes.success ? undefined : ownerRes.message,
      });

      results.push({
        recipient: 'OWNER',
        mobile: user.mobile_number,
        result: ownerRes,
        log,
      });
    }

    // Nominee Dispatch (Enforce consent and phone verification)
    if (target_recipient === 'NOMINEE' || record.recipients === 'AUTHORIZED_NOMINEE' || record.recipients === 'BOTH') {
      if (!record.nominee_consent_granted) {
        return res.status(400).json({
          success: false,
          error: 'Owner consent revoked or inactive: You must check "Authorize Nominee SMS" before reminders can be dispatched.',
        });
      }

      const vault = db.getVault(user.id);
      const nominees = vault.nominees || [];
      const nominee = nominees.find((n: any) => n.id === record.nominee_id) ||
        (record.nominee_mobile ? nominees.find((n: any) => db.canonicalizeMobile(n.mobile_number) === db.canonicalizeMobile(record.nominee_mobile!)) : null);

      if (!nominee || (!nominee.is_phone_verified && nominee.status !== 'VERIFIED')) {
        return res.status(400).json({
          success: false,
          error: 'Security Policy: Nominee phone number is unverified. Nominee must complete SMS OTP verification first.',
        });
      }

      const nomRes = await sendMsg91TransactionalSms({
        mobileNumber: nominee.mobile_number,
        recipientName: nominee.name,
        recipientType: 'NOMINEE',
        recordType: record.record_type,
        title: record.title,
        amount: record.amount,
        dueDate: record.due_date,
        daysRemaining,
      });

      const log = db.addReminderLog({
        user_id: user.id,
        due_date_id: record.id,
        record_title: record.title,
        record_type: record.record_type,
        recipient_type: 'NOMINEE',
        recipient_name: nominee.name,
        recipient_mobile: nominee.mobile_number,
        days_before_due: daysRemaining,
        due_date: record.due_date,
        status: nomRes.success ? 'DELIVERED' : 'FAILED',
        provider: nomRes.provider,
        message_preview: nomRes.messagePreview,
        gateway_response: nomRes.gatewayResponse,
        error_message: nomRes.success ? undefined : nomRes.message,
      });

      results.push({
        recipient: 'NOMINEE',
        mobile: nominee.mobile_number,
        result: nomRes,
        log,
      });
    }

    const allSuccessful = results.length > 0 && results.every((r) => r.result.success);
    return res.json({
      success: allSuccessful,
      message: allSuccessful
        ? 'Real SMS test reminder dispatched via MSG91 gateway.'
        : 'One or more SMS dispatches could not be confirmed by MSG91.',
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delivery logs for specific due date
app.get('/api/due-dates/:id/logs', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const id = req.params.id;
  const logs = db.getReminderLogs(user.id, id);
  res.json({ success: true, logs });
});

// All delivery logs for owner
app.get('/api/due-dates/all-logs', authenticateOwner, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const logs = db.getReminderLogs(user.id);
  res.json({ success: true, logs });
});

// Manual trigger for backend scheduler
app.post('/api/scheduler/run-reminders', async (req: Request, res: Response) => {
  try {
    const summary = await runDueReminderCheck();
    return res.json({
      success: true,
      message: 'Automated reminder evaluation completed.',
      summary,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. NOMINEE AUTH & CONTROLLED EMERGENCY ACCESS
// -------------------------------------------------------------

app.post('/api/nominees/emergency-login', async (req, res) => {
  try {
    const { nominee_mobile, owner_efid, verification_id, otp } = req.body;

    if (!nominee_mobile || !owner_efid || !verification_id || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Nominee mobile, Owner E-FID, and verified OTP are required.',
      });
    }

    // Verify OTP
    const cleanOtp = otp.toString().trim();
    const session = db.getOtpSession(verification_id);
    if (!session || Date.now() > session.expires_at) {
      return res.status(400).json({ success: false, error: 'OTP session expired. Please request a new OTP.' });
    }

    const isOtpValid = verifyPassword(cleanOtp, session.code_hash, session.salt);
    if (!isOtpValid) {
      return res.status(400).json({ success: false, error: 'Invalid OTP code. Please enter the code sent to your mobile.' });
    }

    // Find Owner by E-FID
    const owner = db.findUserByEfid(owner_efid);
    if (!owner) {
      return res.status(404).json({
        success: false,
        error: `No vault found matching Owner E-FID "${owner_efid}". Please verify the E-FID.`,
      });
    }

    const { clean10 } = formatIndianMobile(nominee_mobile);
    const vault = db.getVault(owner.id);
    const registeredNominees = vault.nominees || [];

    // Find matching nominee in owner's records
    const matched = registeredNominees.find((n: any) => n.mobile_number.replace(/\D/g, '') === clean10);
    const nomineeName = matched ? matched.name : 'Designated Nominee';

    // Create secure nominee session token
    const nomineeSession = db.createNomineeSession({
      nominee_id: matched ? matched.id : `nom_${Date.now()}`,
      nominee_name: nomineeName,
      nominee_mobile: clean10,
      owner_efid: owner.efid,
      owner_user_id: owner.id,
    });

    // Retrieve ONLY documents where owner explicitly enabled nominee access
    const permittedDocuments = db.getPermittedNomineeDocuments(owner.efid);

    // Audit log in owner's vault
    db.addAuditLog(owner.id, {
      action: 'NOMINEE_EMERGENCY_LOGIN',
      actor: nomineeName,
      details: `Nominee (${nominee_mobile}) authenticated into vault. Permitted documents accessible: ${permittedDocuments.length}`,
      severity: 'WARNING',
    });

    return res.json({
      success: true,
      message: 'Nominee authenticated into controlled emergency portal.',
      nomineeSessionToken: nomineeSession.token,
      ownerEfid: owner.efid,
      nominee: {
        id: nomineeSession.nominee_id,
        name: nomineeName,
        mobile_number: clean10,
        relationship: matched ? matched.relationship : 'Designated Nominee',
        status: 'VERIFIED',
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
        personalDiary: (vault.personalDiary || []).filter((d: any) => d.is_emergency_shared === true),
        financialDiary: vault.financialDiary || [],
        importantInfo: vault.importantInfo || [],
        nominees: vault.nominees || [],
        safetyCheckin: null,
        emergencySession: null,
        auditLogs: [],
        language: vault.language || 'en',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Nominee List Permitted Documents
app.get('/api/nominee/documents', (req, res) => {
  const token = req.query.token as string || (req.headers.authorization?.replace('Bearer ', ''));
  if (!token) {
    return res.status(401).json({ success: false, error: 'Nominee session token required.' });
  }

  const session = db.getNomineeSession(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Emergency session expired. Please re-authenticate.' });
  }

  const docs = db.getPermittedNomineeDocuments(session.owner_efid);
  res.json({ success: true, documents: docs });
});

// -------------------------------------------------------------
// API 404 & ERROR HANDLING (PREVENTS HTML FALLBACK FOR API CALLS)
// -------------------------------------------------------------
// Any route matching /api/* that wasn't handled above MUST return JSON, NEVER index.html
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Express error handler for API requests
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl.startsWith('/api')) {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error occurred.',
    });
  }
  next(err);
});

// -------------------------------------------------------------
// 8. VITE / STATIC SPA SERVING
// -------------------------------------------------------------
async function setupViteOrStatic() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn(`[LIFORA AI] Static dist directory not found at ${distPath}. Running in API-only mode.`);
      app.get('/', (req, res) => {
        res.json({
          service: 'LIFORA AI Core Backend API',
          status: 'online',
          mode: 'backend-only',
          health: '/health',
          api_health: '/api/health',
          timestamp: new Date().toISOString(),
        });
      });
      app.get('*', (req, res) => {
        res.status(404).json({
          success: false,
          error: 'Frontend is hosted separately (e.g. Vercel). This service provides the LIFORA backend API.',
        });
      });
    }
  }
}

setupViteOrStatic().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LIFORA AI] Server running on port ${PORT} (Mode: ${isProd ? 'production' : 'development'})`);
    // Start automated background scheduler for due-date & document-expiry SMS reminders
    startBackgroundReminderScheduler();
  });
});
