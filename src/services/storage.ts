import { VaultState, User, Nominee, AccessPolicy, AuditLog, Language, DocumentItem, DueDateRecord, SmsReminderLog } from '../types';
import { buildApiUrl } from './apiClient';

const TOKEN_KEY = 'lifora_auth_token_v2';
const USER_KEY = 'lifora_active_user_v2';
const CACHED_STATE_KEY = 'lifora_ai_mobile_vault_v2_zero_data';

export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  allow_financial_summary: true,
  allow_loans: true,
  allow_emi: true,
  allow_insurance: true,
  allow_bank_accounts: true,
  allow_property: true,
  allow_vehicles: true,
  allow_valuable_assets: true,
  allow_documents: true,
  allow_important_info: true,
  allow_personal_diary: false, // 🔒 STRICTLY FALSE BY DEFAULT!
  allow_financial_diary: true,
};

export const getEmptyVaultState = (): VaultState => ({
  user: null,
  token: null,
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
  dueDates: [],
  safetyCheckin: null,
  emergencySession: null,
  auditLogs: [],
  language: 'en',
});

export function sanitizeVaultState(raw: any): VaultState {
  if (!raw || typeof raw !== 'object') {
    return getEmptyVaultState();
  }
  return {
    user: raw.user && typeof raw.user === 'object' ? raw.user : null,
    token: typeof raw.token === 'string' ? raw.token : null,
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    loans: Array.isArray(raw.loans) ? raw.loans : [],
    emis: Array.isArray(raw.emis) ? raw.emis : [],
    insurance: Array.isArray(raw.insurance) ? raw.insurance : [],
    commitments: Array.isArray(raw.commitments) ? raw.commitments : [],
    moneyGiven: Array.isArray(raw.moneyGiven) ? raw.moneyGiven : [],
    moneyBorrowed: Array.isArray(raw.moneyBorrowed) ? raw.moneyBorrowed : [],
    properties: Array.isArray(raw.properties) ? raw.properties : [],
    valuableAssets: Array.isArray(raw.valuableAssets) ? raw.valuableAssets : [],
    vehicles: Array.isArray(raw.vehicles) ? raw.vehicles : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    personalDiary: Array.isArray(raw.personalDiary) ? raw.personalDiary : [],
    financialDiary: Array.isArray(raw.financialDiary) ? raw.financialDiary : [],
    importantInfo: Array.isArray(raw.importantInfo) ? raw.importantInfo : [],
    nominees: Array.isArray(raw.nominees) ? raw.nominees : [],
    dueDates: Array.isArray(raw.dueDates) ? raw.dueDates : [],
    safetyCheckin: raw.safetyCheckin && typeof raw.safetyCheckin === 'object' ? raw.safetyCheckin : null,
    emergencySession: raw.emergencySession && typeof raw.emergencySession === 'object' ? raw.emergencySession : null,
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
    language: raw.language === 'ta' || raw.language === 'tanglish' ? raw.language : 'en',
  };
}

class StorageService {
  private state: VaultState;
  private listeners: Set<() => void> = new Set();
  private syncDebounceTimer: any = null;
  private pendingRegistration: { user: User; token: string; vault: any } | null = null;

  constructor() {
    this.state = this.loadInitialState();
    // Hydrate from backend if token exists
    if (this.state.token) {
      this.syncWithBackend();
    }
  }

  private loadInitialState(): VaultState {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      const storedVault = localStorage.getItem(CACHED_STATE_KEY);

      let parsedVault: any = {};
      if (storedVault) {
        try {
          parsedVault = JSON.parse(storedVault);
        } catch {
          parsedVault = {};
        }
      }

      let user: User | null = null;
      if (storedUser) {
        try {
          user = JSON.parse(storedUser);
        } catch {
          user = null;
        }
      }

      return sanitizeVaultState({
        ...parsedVault,
        user: storedToken ? user : null,
        token: storedToken || null,
      });
    } catch (e) {
      console.warn('Failed to parse cached vault', e);
      return getEmptyVaultState();
    }
  }

  private saveState(state: VaultState): void {
    try {
      if (state.token) {
        localStorage.setItem(TOKEN_KEY, state.token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }

      if (state.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      } else {
        localStorage.removeItem(USER_KEY);
      }

      localStorage.setItem(CACHED_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save vault state to local storage', e);
    }
  }

  public getState(): VaultState {
    return this.state;
  }

  public updateState(updater: (prev: VaultState) => VaultState): void {
    this.state = sanitizeVaultState(updater(this.state));
    this.saveState(this.state);
    this.notify();

    // Debounced sync with backend database
    if (this.state.token && this.state.user) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = setTimeout(() => {
        this.pushVaultToBackend();
      }, 800);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    });
  }

  // -------------------------------------------------------------
  // Backend API Sync & Operations
  // -------------------------------------------------------------

  public async syncWithBackend(): Promise<void> {
    const token = this.state.token;
    if (!token) return;

    try {
      const res = await fetch(buildApiUrl('/api/vault'), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired on server
          this.logout();
        }
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const data = await res.json();
      if (data.success && data.vault) {
        const v = data.vault;
        this.updateState((prev) => ({
          ...prev,
          user: v.user || prev.user,
          accounts: v.accounts || prev.accounts,
          loans: v.loans || prev.loans,
          emis: v.emis || prev.emis,
          insurance: v.insurance || prev.insurance,
          commitments: v.commitments || prev.commitments,
          moneyGiven: v.moneyGiven || prev.moneyGiven,
          moneyBorrowed: v.moneyBorrowed || prev.moneyBorrowed,
          properties: v.properties || prev.properties,
          valuableAssets: v.valuableAssets || prev.valuableAssets,
          vehicles: v.vehicles || prev.vehicles,
          documents: v.documents || prev.documents,
          personalDiary: v.personalDiary || prev.personalDiary,
          financialDiary: v.financialDiary || prev.financialDiary,
          importantInfo: v.importantInfo || prev.importantInfo,
          nominees: v.nominees || prev.nominees,
          dueDates: v.dueDates || prev.dueDates || [],
          auditLogs: v.auditLogs || prev.auditLogs,
        }));
      }
    } catch (err) {
      console.warn('Backend sync failed:', err);
    }
  }

  private async pushVaultToBackend(): Promise<void> {
    const token = this.state.token;
    if (!token) return;

    try {
      await fetch(buildApiUrl('/api/vault'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accounts: this.state.accounts,
          loans: this.state.loans,
          emis: this.state.emis,
          insurance: this.state.insurance,
          commitments: this.state.commitments,
          moneyGiven: this.state.moneyGiven,
          moneyBorrowed: this.state.moneyBorrowed,
          properties: this.state.properties,
          valuableAssets: this.state.valuableAssets,
          vehicles: this.state.vehicles,
          personalDiary: this.state.personalDiary,
          financialDiary: this.state.financialDiary,
          importantInfo: this.state.importantInfo,
          nominees: this.state.nominees,
          safetyCheckin: this.state.safetyCheckin,
          auditLogs: this.state.auditLogs,
          language: this.state.language,
        }),
      });
    } catch (err) {
      console.error('Failed to persist vault changes to backend:', err);
    }
  }

  // -------------------------------------------------------------
  // Owner Authentication Actions
  // -------------------------------------------------------------

  public async loginOwner(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          error: `Server error (${res.status}). Verify API server is accessible.`,
        };
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Login failed. Please check your credentials.',
        };
      }

      const user: User = data.user;
      const token: string = data.token;
      const vault = data.vault || {};

      this.updateState((prev) => ({
        ...prev,
        user,
        token,
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
        documents: vault.documents || [],
        personalDiary: vault.personalDiary || [],
        financialDiary: vault.financialDiary || [],
        importantInfo: vault.importantInfo || [],
        nominees: vault.nominees || [],
        dueDates: vault.dueDates || [],
        auditLogs: vault.auditLogs || [],
      }));

      return { success: true, user };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error connecting to LIFORA server: ${err.message}`,
      };
    }
  }

  public async registerOwner(params: {
    fullName: string;
    mobileNumber: string;
    dob: string;
    password: string;
    maskedIdentityNumber?: string;
    verificationId?: string;
    customEfid?: string;
    deferActivation?: boolean;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          full_name: params.fullName,
          mobile_number: params.mobileNumber,
          date_of_birth: params.dob,
          password: params.password,
          masked_identity_number: params.maskedIdentityNumber,
          verification_id: params.verificationId,
          customEfid: params.customEfid,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          error: `Server error (${res.status}). Verify API server is accessible.`,
        };
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Registration failed. Please check provided details.',
        };
      }

      const user: User = data.user;
      const token: string = data.token;
      const vault = data.vault || {};

      if (params.deferActivation) {
        this.pendingRegistration = { user, token, vault };
      } else {
        this.updateState((prev) => ({
          ...prev,
          user,
          token,
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
          documents: vault.documents || [],
          personalDiary: vault.personalDiary || [],
          financialDiary: vault.financialDiary || [],
          importantInfo: vault.importantInfo || [],
          nominees: vault.nominees || [],
          dueDates: vault.dueDates || [],
          auditLogs: vault.auditLogs || [],
        }));
      }

      return { success: true, user };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error connecting to registration server: ${err.message}`,
      };
    }
  }

  public completeRegistration(): User | null {
    if (!this.pendingRegistration) {
      return this.state.user;
    }
    const { user, token, vault } = this.pendingRegistration;
    this.updateState((prev) => ({
      ...prev,
      user,
      token,
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
      documents: vault.documents || [],
      personalDiary: vault.personalDiary || [],
      financialDiary: vault.financialDiary || [],
      importantInfo: vault.importantInfo || [],
      nominees: vault.nominees || [],
      dueDates: vault.dueDates || [],
      auditLogs: vault.auditLogs || [],
    }));
    this.pendingRegistration = null;
    return user;
  }

  public logout(): void {
    // Only clears active auth session; preserves user and vault records in backend database!
    this.state = {
      ...this.state,
      user: null,
      token: null,
    };
    this.saveState(this.state);
    this.notify();
  }

  // -------------------------------------------------------------
  // Document Operations (Real Backend Upload, Storage & Perms)
  // -------------------------------------------------------------

  public async uploadDocument(
    file: File,
    metadata: {
      title: string;
      category: string;
      description?: string;
      allowNomineeEmergencyAccess: boolean;
    }
  ): Promise<{ success: boolean; document?: DocumentItem; error?: string }> {
    const token = this.state.token;
    if (!token) {
      return { success: false, error: 'Authentication required. Please log in.' };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', metadata.title);
    formData.append('category', metadata.category);
    formData.append('description', metadata.description || '');
    formData.append('allow_nominee_emergency_access', String(metadata.allowNomineeEmergencyAccess));

    try {
      const res = await fetch(buildApiUrl('/api/documents'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          error: `Server returned non-JSON response (${res.status}).`,
        };
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to upload document to secure vault.',
        };
      }

      const newDoc: DocumentItem = data.document;
      this.updateState((prev) => ({
        ...prev,
        documents: [newDoc, ...prev.documents.filter((d) => d.id !== newDoc.id)],
      }));

      return { success: true, document: newDoc };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error during file upload: ${err.message}`,
      };
    }
  }

  public async updateDocumentMetadata(
    docId: string,
    updates: {
      title?: string;
      category?: any;
      description?: string;
      allow_nominee_emergency_access?: boolean;
    }
  ): Promise<{ success: boolean; document?: DocumentItem; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl(`/api/documents/${docId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update document' };
      }

      const updated: DocumentItem = data.document;
      this.updateState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => (d.id === docId ? updated : d)),
      }));

      return { success: true, document: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async deleteDocument(docId: string): Promise<{ success: boolean; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl(`/api/documents/${docId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete document' };
      }

      this.updateState((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== docId),
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public getDocumentViewUrl(docId: string): string {
    const token = this.state.token;
    return buildApiUrl(`/api/documents/${docId}/view?token=${encodeURIComponent(token || '')}`);
  }

  public getDocumentDownloadUrl(docId: string): string {
    const token = this.state.token;
    return buildApiUrl(`/api/documents/${docId}/download?token=${encodeURIComponent(token || '')}`);
  }

  // -------------------------------------------------------------
  // Due Dates & Automated SMS Reminders
  // -------------------------------------------------------------

  public async fetchDueDates(): Promise<{ success: boolean; dueDates?: DueDateRecord[]; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl('/api/due-dates'), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to fetch due dates' };
      }

      const dueDates: DueDateRecord[] = data.due_dates || [];
      this.updateState((prev) => ({
        ...prev,
        dueDates,
      }));

      return { success: true, dueDates };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async createDueDate(payload: {
    record_type: DueDateRecord['record_type'];
    title: string;
    amount?: number | null;
    due_date: string;
    reminder_intervals?: number[];
    recipients?: DueDateRecord['recipients'];
    nominee_id?: string;
    nominee_name?: string;
    nominee_mobile?: string;
    nominee_consent_granted?: boolean;
    notes?: string;
    linked_entity_id?: string;
  }): Promise<{ success: boolean; dueDate?: DueDateRecord; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl('/api/due-dates'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create due date reminder' };
      }

      const newRecord: DueDateRecord = data.due_date;
      this.updateState((prev) => ({
        ...prev,
        dueDates: [newRecord, ...(prev.dueDates || []).filter((d) => d.id !== newRecord.id)],
      }));

      return { success: true, dueDate: newRecord };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async updateDueDate(
    id: string,
    updates: Partial<DueDateRecord>
  ): Promise<{ success: boolean; dueDate?: DueDateRecord; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl(`/api/due-dates/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update due date reminder' };
      }

      const updated: DueDateRecord = data.due_date;
      this.updateState((prev) => ({
        ...prev,
        dueDates: (prev.dueDates || []).map((d) => (d.id === id ? updated : d)),
      }));

      return { success: true, dueDate: updated };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async deleteDueDate(id: string): Promise<{ success: boolean; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl(`/api/due-dates/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete due date' };
      }

      this.updateState((prev) => ({
        ...prev,
        dueDates: (prev.dueDates || []).filter((d) => d.id !== id),
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async testSendDueDateSms(
    id: string,
    targetRecipient?: 'OWNER' | 'NOMINEE'
  ): Promise<{ success: boolean; message: string; results?: any[]; error?: string }> {
    const token = this.state.token;
    if (!token) return { success: false, message: 'Authentication required', error: 'Authentication required' };

    try {
      const res = await fetch(buildApiUrl(`/api/due-dates/${id}/test-sms`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_recipient: targetRecipient }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'SMS test failed', error: data.error };
      }

      return {
        success: data.success,
        message: data.message,
        results: data.results,
      };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  public async getDueDateLogs(id: string): Promise<SmsReminderLog[]> {
    const token = this.state.token;
    if (!token) return [];

    try {
      const res = await fetch(buildApiUrl(`/api/due-dates/${id}/logs`), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      return data.success && Array.isArray(data.logs) ? data.logs : [];
    } catch {
      return [];
    }
  }

  public async getAllReminderLogs(): Promise<SmsReminderLog[]> {
    const token = this.state.token;
    if (!token) return [];

    try {
      const res = await fetch(buildApiUrl('/api/due-dates/all-logs'), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      return data.success && Array.isArray(data.logs) ? data.logs : [];
    } catch {
      return [];
    }
  }

  public async triggerSchedulerCheck(): Promise<{ success: boolean; message: string; summary?: any; error?: string }> {
    try {
      const res = await fetch(buildApiUrl('/api/scheduler/run-reminders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      const data = await res.json();
      return {
        success: data.success,
        message: data.message,
        summary: data.summary,
      };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  }

  // -------------------------------------------------------------
  // Audit Logs
  // -------------------------------------------------------------

  public logAudit(action: string, actor: string, details: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'): void {
    const entry: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      actor,
      details,
      timestamp: new Date().toISOString(),
      severity,
    };
    this.updateState((prev) => ({
      ...prev,
      auditLogs: [entry, ...prev.auditLogs],
    }));
  }

  public repairVaultState(): VaultState {
    try {
      const sanitized = sanitizeVaultState(this.state);
      this.state = sanitized;
      this.saveState(sanitized);
      this.notify();
      return sanitized;
    } catch {
      const fresh = getEmptyVaultState();
      this.state = fresh;
      this.saveState(fresh);
      this.notify();
      return fresh;
    }
  }

  public safeEmergencyReset(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(CACHED_STATE_KEY);
      sessionStorage.clear();
    } catch {
      // ignore
    }
    const fresh = getEmptyVaultState();
    this.state = fresh;
    this.notify();
  }

  public resetAllData(): void {
    const fresh = getEmptyVaultState();
    this.state = fresh;
    this.saveState(fresh);
    this.notify();
  }
}

export const storageService = new StorageService();
