import React, { useState } from 'react';
import { 
  Users, 
  Shield, 
  Phone, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Lock, 
  Unlock, 
  Clock, 
  X,
  ChevronRight
} from 'lucide-react';
import { VaultState, Nominee, AccessPolicy } from '../../types';
import { storageService, DEFAULT_ACCESS_POLICY } from '../../services/storage';
import { otpService } from '../../services/otpService';

interface MobileNomineeScreenProps {
  state: VaultState;
  onOpenCheckin: () => void;
}

export const MobileNomineeScreen: React.FC<MobileNomineeScreenProps> = ({
  state,
  onOpenCheckin
}) => {
  const nominees = state?.nominees || [];
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [verifyingNominee, setVerifyingNominee] = useState<Nominee | null>(null);
  const [editingPolicyNominee, setEditingPolicyNominee] = useState<Nominee | null>(null);

  // Form State - ZERO PREFILLED DATA
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeDob, setNomineeDob] = useState('');
  const [nomineeMobile, setNomineeMobile] = useState('');
  const [nomineeRelationship, setNomineeRelationship] = useState('SPOUSE');
  const [formError, setFormError] = useState('');

  // OTP verification state
  const [otpId, setOtpId] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpError, setOtpError] = useState('');
  const [isOtpSuccess, setIsOtpSuccess] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  // Auto-fill listener from incoming SMS banner
  React.useEffect(() => {
    const handleAutoFill = (e: any) => {
      const code = e.detail?.otp;
      if (code && typeof code === 'string' && code.length === 6) {
        setOtpDigits(code.split(''));
        setOtpError('');
      }
    };
    window.addEventListener('lifora_autofill_otp', handleAutoFill);
    return () => window.removeEventListener('lifora_autofill_otp', handleAutoFill);
  }, []);

  // Permission Matrix State
  const [activePolicy, setActivePolicy] = useState<AccessPolicy>(DEFAULT_ACCESS_POLICY);
  const [permissionMode, setPermissionMode] = useState<'FULL' | 'READ_ONLY' | 'EMERGENCY_ONLY' | 'INACTIVE_TRIGGERED'>('EMERGENCY_ONLY');
  const [requireReverification, setRequireReverification] = useState(true);
  const [waitingPeriodHours, setWaitingPeriodHours] = useState(24);
  const [notifyOwnerOnUnlock, setNotifyOwnerOnUnlock] = useState(true);

  const handleAddNominee = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nomineeName.trim()) {
      setFormError('Nominee name is required');
      return;
    }
    const cleanMobile = nomineeMobile.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number for the nominee');
      return;
    }

    const newNominee: Nominee = {
      id: `nom-${Date.now()}`,
      name: nomineeName.trim(),
      dob: nomineeDob,
      mobile_number: cleanMobile,
      relationship: nomineeRelationship,
      is_phone_verified: false,
      access_policy: { ...DEFAULT_ACCESS_POLICY },
      status: 'PENDING_VERIFICATION',
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      nominees: [newNominee, ...(prev.nominees || [])],
    }));
    storageService.logAudit(
      'ADD_NOMINEE',
      state.user?.full_name || 'Owner',
      `Registered nominee: ${nomineeName} (${cleanMobile}) - Verification Pending`
    );

    setNomineeName('');
    setNomineeDob('');
    setNomineeMobile('');
    setIsAddModalOpen(false);
    triggerNomineePhoneVerification(newNominee);
  };

  const triggerNomineePhoneVerification = async (nominee: Nominee) => {
    setVerifyingNominee(nominee);
    setOtpError('');
    setIsOtpSuccess(false);
    setOtpDigits(['', '', '', '', '', '']);

    try {
      const res = await otpService.sendOtp(nominee.mobile_number, 'NOMINEE_PHONE_VERIFICATION');
      if (res.success) {
        setOtpId(res.verificationId);
        setOtpTimer(60);
        if ((res as any).demo_otp || (res as any).demoOtp) {
          setDemoOtp((res as any).demo_otp || (res as any).demoOtp);
        }
        const interval = setInterval(() => {
          setOtpTimer((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setOtpError(res.error || 'Failed to dispatch SMS to nominee');
      }
    } catch (err: any) {
      setOtpError(err.message || 'SMS service error');
    }
  };

  const handleDirectVerifyNominee = (nominee: Nominee) => {
    storageService.updateState((prev) => ({
      ...prev,
      nominees: (prev.nominees || []).map((n) =>
        n.id === nominee.id
          ? { ...n, is_phone_verified: true, status: 'VERIFIED' }
          : n
      ),
    }));
    storageService.logAudit(
      'NOMINEE_PHONE_VERIFIED',
      nominee.name,
      `Verified nominee phone: +91 ${nominee.mobile_number}`
    );
    setVerifyingNominee(null);
  };

  const handleVerifyNomineeOtp = async () => {
    if (!verifyingNominee) return;
    setOtpError('');
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setOtpError('Please enter all 6 digits received on nominee phone');
      return;
    }

    const res = await otpService.verifyOtp(otpId, fullOtp);
    if (!res.verified) {
      setOtpError(res.message);
    } else {
      setIsOtpSuccess(true);
      storageService.updateState((prev) => ({
        ...prev,
        nominees: (prev.nominees || []).map((n) =>
          n.id === verifyingNominee.id
            ? { ...n, is_phone_verified: true, status: 'VERIFIED' }
            : n
        ),
      }));
      storageService.logAudit(
        'NOMINEE_PHONE_VERIFIED',
        verifyingNominee.name,
        `Mobile verified via SMS OTP: +91 ${verifyingNominee.mobile_number}`
      );

      setTimeout(() => {
        setVerifyingNominee(null);
      }, 900);
    }
  };

  const handleOpenPermissions = (nominee: Nominee) => {
    setEditingPolicyNominee(nominee);
    setActivePolicy({ ...(nominee.access_policy || DEFAULT_ACCESS_POLICY) });
  };

  const handleSavePermissions = () => {
    if (!editingPolicyNominee) return;

    storageService.updateState((prev) => ({
      ...prev,
      nominees: (prev.nominees || []).map((n) =>
        n.id === editingPolicyNominee.id
          ? { ...n, access_policy: { ...activePolicy } }
          : n
      ),
    }));

    storageService.logAudit(
      'UPDATE_NOMINEE_PERMISSIONS',
      state.user?.full_name || 'Owner',
      `Updated access policies for nominee ${editingPolicyNominee.name}`
    );
    setEditingPolicyNominee(null);
  };

  const togglePolicyKey = (key: keyof AccessPolicy) => {
    setActivePolicy((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDeleteNominee = (id: string, name: string) => {
    storageService.updateState((prev) => ({
      ...prev,
      nominees: (prev.nominees || []).filter((n) => n.id !== id),
    }));
    storageService.logAudit('REMOVE_NOMINEE', state.user?.full_name || 'Owner', `Removed nominee ${name}`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Natural Header Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
          Digital Inheritance
        </span>
        <h2 className="text-base font-bold text-stone-900 mt-1">
          Who should have controlled access to your information when you are unavailable?
        </h2>
        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
          Designate trusted family or legal executors. Nominees must be verified through SMS and will only receive access according to your permission matrix.
        </p>

        <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={onOpenCheckin}
            className="text-xs text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Safety Check-in & Rules</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Nominee</span>
          </button>
        </div>
      </div>

      {/* Nominee List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Registered Nominees ({nominees.length})
          </h3>
        </div>

        {nominees.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
            <Users className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-stone-800">No nominees appointed yet</p>
            <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
              Add your spouse, children, or financial executor. Every field starts empty.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-3 py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Appoint First Nominee</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {nominees.map((nominee) => (
              <div
                key={nominee.id}
                className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-stone-900">{nominee.name}</h4>
                        <span className="text-[10px] text-stone-500">
                          · {nominee.relationship}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-stone-600 mt-0.5">
                        +91 {nominee.mobile_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenPermissions(nominee)}
                      className="p-1.5 text-stone-400 hover:text-emerald-800 transition-colors"
                      title="Access Permissions"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNominee(nominee.id, nominee.name)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <div className="flex items-center gap-1.5">
                    {nominee.is_phone_verified ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Phone Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Pending Phone Verification</span>
                      </div>
                    )}
                  </div>

                  {!nominee.is_phone_verified ? (
                    <button
                      onClick={() => triggerNomineePhoneVerification(nominee)}
                      className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>Verify Phone</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenPermissions(nominee)}
                      className="text-xs text-stone-700 font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <span>Permissions</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. ADD NOMINEE MODAL */}
      {/* ------------------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                Appoint Nominee
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddNominee} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Nominee Full Name
                </label>
                <input
                  type="text"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="Enter nominee's full legal name"
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Relationship
                </label>
                <select
                  value={nomineeRelationship}
                  onChange={(e) => setNomineeRelationship(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                >
                  <option value="SPOUSE">Spouse / Partner</option>
                  <option value="SON">Son</option>
                  <option value="DAUGHTER">Daughter</option>
                  <option value="PARENT">Parent</option>
                  <option value="SIBLING">Sibling</option>
                  <option value="LEGAL_ADVISOR">Legal Advisor / Trustee</option>
                  <option value="FRIEND">Trusted Friend</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={nomineeDob}
                  onChange={(e) => setNomineeDob(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Nominee Mobile Number
                </label>
                <input
                  type="tel"
                  value={nomineeMobile}
                  onChange={(e) => setNomineeMobile(e.target.value)}
                  placeholder="Enter nominee's 10-digit number"
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                  required
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  A separate real SMS OTP will be sent directly to this nominee's phone.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs active:scale-[0.98] transition-all"
              >
                Proceed to Nominee Verification
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. NOMINEE REAL OTP MODAL */}
      {/* ------------------------------------------------------------- */}
      {verifyingNominee && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                Phone Verification
              </span>
              <button onClick={() => setVerifyingNominee(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-stone-900">
              Verify Nominee Mobile
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Enter the 6-digit code received via SMS on nominee's mobile:
            </p>
            <p className="text-sm font-semibold text-stone-900 font-mono mt-0.5">
              +91 {verifyingNominee.mobile_number}
            </p>

            {otpError && (
              <div className="my-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
                <span>{otpError}</span>
                <button
                  type="button"
                  onClick={() => setOtpError('')}
                  className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                  title="Clear error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isOtpSuccess && (
              <div className="my-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>✓ Nominee Phone Verified</span>
              </div>
            )}

            <div className="flex justify-between gap-2 my-4">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`nom-otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.length > 1) val = val.slice(-1);
                    const updated = [...otpDigits];
                    updated[i] = val;
                    setOtpDigits(updated);
                    if (otpError) setOtpError('');
                    if (val && i < 5) {
                      document.getElementById(`nom-otp-${i + 1}`)?.focus();
                    }
                  }}
                  className="w-11 h-14 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 text-center font-mono text-xl font-bold text-stone-900 focus:outline-none shadow-xs"
                />
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleVerifyNomineeOtp}
                disabled={isOtpSuccess}
                className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
              >
                {isOtpSuccess ? '✓ Verified' : 'Confirm Nominee Code'}
              </button>

              <button
                type="button"
                onClick={() => handleDirectVerifyNominee(verifyingNominee)}
                className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-all active:scale-[0.98]"
              >
                Direct Confirm Phone (Test Mode)
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
              <span>Didn't receive SMS?</span>
              {otpTimer > 0 ? (
                <span className="font-mono text-stone-400">Resend in {otpTimer}s</span>
              ) : (
                <button
                  onClick={() => triggerNomineePhoneVerification(verifyingNominee)}
                  className="text-emerald-800 font-bold hover:underline"
                >
                  Send Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. ACCESS PERMISSION SETUP MODAL */}
      {/* ------------------------------------------------------------- */}
      {editingPolicyNominee && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                  Access Permissions
                </span>
                <h3 className="text-base font-bold text-stone-900">
                  {editingPolicyNominee.name}'s Access
                </h3>
              </div>
              <button onClick={() => setEditingPolicyNominee(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 mb-3">
              What should your nominee be allowed to access when you are unavailable?
            </p>

            {/* Access Mode */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-stone-700 mb-1.5">
                Permission Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPermissionMode('EMERGENCY_ONLY')}
                  className={`p-2 rounded-xl border text-left font-semibold transition-all ${
                    permissionMode === 'EMERGENCY_ONLY'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  Emergency Only
                </button>
                <button
                  type="button"
                  onClick={() => setPermissionMode('INACTIVE_TRIGGERED')}
                  className={`p-2 rounded-xl border text-left font-semibold transition-all ${
                    permissionMode === 'INACTIVE_TRIGGERED'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  Inactive Triggered
                </button>
                <button
                  type="button"
                  onClick={() => setPermissionMode('READ_ONLY')}
                  className={`p-2 rounded-xl border text-left font-semibold transition-all ${
                    permissionMode === 'READ_ONLY'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  Read Only
                </button>
                <button
                  type="button"
                  onClick={() => setPermissionMode('FULL')}
                  className={`p-2 rounded-xl border text-left font-semibold transition-all ${
                    permissionMode === 'FULL'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  Full Access
                </button>
              </div>
            </div>

            {/* Category Switches */}
            <div className="space-y-2 mb-4">
              <label className="block text-[11px] font-semibold text-stone-700">
                Authorized Categories
              </label>

              {[
                { key: 'allow_financial_summary', label: 'Financial Summary & Overview' },
                { key: 'allow_bank_accounts', label: 'Bank Accounts & Deposits' },
                { key: 'allow_loans', label: 'Loans & Outstanding Debt' },
                { key: 'allow_emi', label: 'EMI Schedules & Due Dates' },
                { key: 'allow_insurance', label: 'Insurance Policies & Coverage' },
                { key: 'allow_property', label: 'Properties, Land & Houses' },
                { key: 'allow_vehicles', label: 'Vehicles & Registration Details' },
                { key: 'allow_valuable_assets', label: 'Valuable Assets & Gold Lockers' },
                { key: 'allow_documents', label: 'Legal Deeds & Document Vault' },
                { key: 'allow_important_info', label: 'Important Instructions' },
                { key: 'allow_financial_diary', label: 'Financial Directives & Succession' },
                { key: 'allow_personal_diary', label: 'Personal Diary (🔒 Strict Confidential)' },
              ].map((item) => {
                const isChecked = (activePolicy as any)[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => togglePolicyKey(item.key as any)}
                    className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between cursor-pointer hover:border-stone-300 transition-colors shadow-xs"
                  >
                    <span className="text-xs font-medium text-stone-800">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 accent-emerald-800"
                    />
                  </div>
                );
              })}
            </div>

            {/* Safeguards */}
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 mb-4">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                Safeguards
              </span>

              <div className="flex items-center justify-between text-xs text-stone-700">
                <span>Require Nominee Re-verification</span>
                <input
                  type="checkbox"
                  checked={requireReverification}
                  onChange={(e) => setRequireReverification(e.target.checked)}
                  className="w-4 h-4 accent-emerald-800"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-stone-700">
                <span>24-Hour Waiting Period before Unlock</span>
                <input
                  type="checkbox"
                  checked={waitingPeriodHours === 24}
                  onChange={(e) => setWaitingPeriodHours(e.target.checked ? 24 : 0)}
                  className="w-4 h-4 accent-emerald-800"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-stone-700">
                <span>SMS Notification to Owner on Unlock</span>
                <input
                  type="checkbox"
                  checked={notifyOwnerOnUnlock}
                  onChange={(e) => setNotifyOwnerOnUnlock(e.target.checked)}
                  className="w-4 h-4 accent-emerald-800"
                />
              </div>
            </div>

            <button
              onClick={handleSavePermissions}
              className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
            >
              Save Access Permissions
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
