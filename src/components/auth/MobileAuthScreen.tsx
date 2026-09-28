import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ArrowRight, 
  Lock, 
  Phone, 
  User as UserIcon, 
  Calendar, 
  KeyRound, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ChevronLeft,
  Smartphone,
  HeartHandshake,
  Loader2,
  Radio,
  X
} from 'lucide-react';
import { User, Nominee } from '../../types';
import { otpService } from '../../services/otpService';
import { storageService } from '../../services/storage';
import { buildApiUrl } from '../../services/apiClient';

interface MobileAuthScreenProps {
  onLoginSuccess: (user: User) => void;
  onNomineeLoginSuccess: (nominee: Nominee, ownerEfid: string, sessionToken?: string, permittedDocs?: any[], permittedVault?: any) => void;
}

type AuthMode = 'CHOICE' | 'USER_LOGIN' | 'NOMINEE_LOGIN' | 'REGISTER_STEP1' | 'REGISTER_STEP2' | 'REGISTER_STEP3' | 'REGISTER_STEP4';

export const MobileAuthScreen: React.FC<MobileAuthScreenProps> = ({
  onLoginSuccess,
  onNomineeLoginSuccess
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('CHOICE');
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Nominee Login state
  const [nomineePhone, setNomineePhone] = useState('');
  const [nomineeOwnerEfid, setNomineeOwnerEfid] = useState('');
  const [nomineeOtpId, setNomineeOtpId] = useState('');
  const [nomineeOtpInput, setNomineeOtpInput] = useState('');
  const [nomineeOtpSent, setNomineeOtpSent] = useState(false);
  const [nomineeError, setNomineeError] = useState('');
  const [nomineeOtpTimer, setNomineeOtpTimer] = useState(0);
  const [nomineeIsSendingOtp, setNomineeIsSendingOtp] = useState(false);
  const [nomineeIsVerifying, setNomineeIsVerifying] = useState(false);
  const [nomineeIsMockOtp, setNomineeIsMockOtp] = useState(false);

  // User Registration State
  const [regFullName, setRegFullName] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  
  // Registration OTP State
  const [regOtpId, setRegOtpId] = useState('');
  const [regOtpDigits, setRegOtpDigits] = useState(['', '', '', '', '', '']);
  const [regOtpTimer, setRegOtpTimer] = useState(0);
  const [regIsSendingOtp, setRegIsSendingOtp] = useState(false);
  const [regOtpError, setRegOtpError] = useState('');
  const [regIsPhoneVerified, setRegIsPhoneVerified] = useState(false);
  const [regIsMockMode, setRegIsMockMode] = useState(false);
  const [regIsVerifyingOtp, setRegIsVerifyingOtp] = useState(false);

  // Identity KYC Step State
  const [regIdentityType, setRegIdentityType] = useState<'PAN' | 'AADHAAR'>('AADHAAR');
  const [regIdentityNumber, setRegIdentityNumber] = useState('');
  const [regIsRegistering, setRegIsRegistering] = useState(false);

  // Generated E-FID
  const [generatedEfid, setGeneratedEfid] = useState('');
  const [copiedEfid, setCopiedEfid] = useState(false);

  // General error
  const [generalError, setGeneralError] = useState('');

  const clearAllErrors = () => {
    setLoginError('');
    setNomineeError('');
    setRegOtpError('');
    setGeneralError('');
  };

  // Listen for instant auto-fill event from push notification banner
  useEffect(() => {
    const handleAutoFill = (e: any) => {
      const code = e.detail?.otp;
      if (code && typeof code === 'string' && code.length === 6) {
        if (authMode === 'REGISTER_STEP2') {
          setRegOtpDigits(code.split(''));
        } else if (authMode === 'NOMINEE_LOGIN') {
          setNomineeOtpInput(code);
        }
      }
    };
    window.addEventListener('lifora_autofill_otp', handleAutoFill);
    return () => window.removeEventListener('lifora_autofill_otp', handleAutoFill);
  }, [authMode]);

  // -------------------------------------------------------------
  // USER LOGIN HANDLER (PERSISTENT BACKEND DATABASE)
  // -------------------------------------------------------------
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError('Please enter your Mobile / E-FID and password');
      return;
    }

    setIsLoggingIn(true);

    try {
      const cleanIdent = loginIdentifier.trim().replace(/[\u2010-\u2015\u2212_]/g, '-');
      const result = await storageService.loginOwner(cleanIdent, loginPassword);
      setIsLoggingIn(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setLoginError(result.error || 'Invalid credentials. Please verify your Mobile / E-FID or password.');
      }
    } catch (err: any) {
      setIsLoggingIn(false);
      setLoginError(`Network error logging into vault: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // NOMINEE LOGIN HANDLER (With Real MSG91 OTP)
  // -------------------------------------------------------------
  const handleSendNomineeOtp = async () => {
    setNomineeError('');
    const cleanPhone = nomineePhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setNomineeError('Enter a valid 10-digit nominee mobile number');
      return;
    }
    if (!nomineeOwnerEfid.trim()) {
      setNomineeError("Enter the vault owner's Emergency Financial ID (E-FID)");
      return;
    }

    setNomineeIsSendingOtp(true);

    try {
      const res = await otpService.sendOtp(cleanPhone, 'NOMINEE_PHONE_VERIFICATION');
      setNomineeIsSendingOtp(false);

      if (res.success) {
        setNomineeOtpId(res.verificationId);
        setNomineeOtpSent(true);
        setNomineeIsMockOtp(Boolean(res.isMock));
        setNomineeOtpTimer(res.cooldownSeconds || 60);

        const interval = setInterval(() => {
          setNomineeOtpTimer((t) => {
            if (t <= 1) {
              clearInterval(interval);
              return 0;
            }
            return t - 1;
          });
        }, 1000);
      } else {
        setNomineeError(res.error || 'Failed to dispatch OTP via SMS provider');
      }
    } catch (err: any) {
      setNomineeIsSendingOtp(false);
      setNomineeError(err.message || 'Error communicating with SMS service');
    }
  };

  const handleVerifyNomineeLogin = async () => {
    setNomineeError('');
    if (nomineeOtpInput.trim().length !== 6) {
      setNomineeError('Enter the complete 6-digit OTP received via SMS');
      return;
    }

    setNomineeIsVerifying(true);

    try {
      const response = await fetch(buildApiUrl('/api/nominees/emergency-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nominee_mobile: nomineePhone.trim(),
          owner_efid: nomineeOwnerEfid.trim(),
          verification_id: nomineeOtpId,
          otp: nomineeOtpInput.trim(),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setNomineeIsVerifying(false);
        setNomineeError(`Server returned non-JSON response (${response.status}). Check backend service status.`);
        return;
      }

      const data = await response.json();
      setNomineeIsVerifying(false);

      if (!response.ok || !data.success) {
        setNomineeError(data.error || 'Nominee authentication failed.');
        return;
      }

      onNomineeLoginSuccess(
        data.nominee,
        data.ownerEfid,
        data.nomineeSessionToken,
        data.permittedDocuments,
        data.vault
      );
    } catch (err: any) {
      setNomineeIsVerifying(false);
      setNomineeError(`Server error verifying nominee emergency login: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // REGISTRATION FLOW (STEP 1 -> STEP 2 -> STEP 3 -> STEP 4)
  // -------------------------------------------------------------
  const handleProceedToOtpStep = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!regFullName.trim()) {
      setGeneralError('Full Name is required');
      return;
    }
    if (!regDob) {
      setGeneralError('Date of Birth is required');
      return;
    }
    const cleanPhone = regMobile.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setGeneralError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setGeneralError('Password must be at least 6 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setGeneralError('Passwords do not match');
      return;
    }

    setAuthMode('REGISTER_STEP2');
    handleSendRegOtp(cleanPhone);
  };

  const handleSendRegOtp = async (phoneToSend?: string) => {
    setRegOtpError('');
    setRegIsSendingOtp(true);
    const cleanNumber = (phoneToSend || regMobile).replace(/\D/g, '');

    try {
      const res = await otpService.sendOtp(cleanNumber, 'USER_PHONE_VERIFICATION');
      setRegIsSendingOtp(false);

      if (res.success) {
        setRegOtpId(res.verificationId);
        setRegIsMockMode(Boolean(res.isMock));
        setRegOtpTimer(res.cooldownSeconds || 60);

        const interval = setInterval(() => {
          setRegOtpTimer((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setRegOtpError(res.error || 'Failed to dispatch SMS OTP via gateway');
      }
    } catch (e: any) {
      setRegIsSendingOtp(false);
      setRegOtpError(e.message || 'SMS Gateway error');
    }
  };

  const handleRegOtpDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      val = val.slice(-1);
    }
    const updated = [...regOtpDigits];
    updated[index] = val;
    setRegOtpDigits(updated);

    if (val && index < 5) {
      const nextInput = document.getElementById(`reg-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyRegOtp = async () => {
    setRegOtpError('');
    const fullOtp = regOtpDigits.join('');
    if (fullOtp.length !== 6) {
      setRegOtpError('Please enter all 6 digits received via SMS');
      return;
    }

    setRegIsVerifyingOtp(true);

    try {
      const res = await otpService.verifyOtp(regOtpId, fullOtp);
      setRegIsVerifyingOtp(false);

      if (!res.verified) {
        setRegOtpError(res.message);
      } else {
        setRegIsPhoneVerified(true);
        setTimeout(() => {
          setAuthMode('REGISTER_STEP3');
        }, 600);
      }
    } catch (err: any) {
      setRegIsVerifyingOtp(false);
      setRegOtpError(err.message || 'Verification connection error');
    }
  };

  const handleCompleteIdentityKyc = async () => {
    setGeneralError('');
    if (!regIdentityNumber.trim()) {
      setGeneralError('Please enter your identity number for verification');
      return;
    }

    setRegIsRegistering(true);

    try {
      const maskedId = `${regIdentityType} •••• ${regIdentityNumber.slice(-4)}`;
      const result = await storageService.registerOwner({
        fullName: regFullName.trim(),
        mobileNumber: regMobile.replace(/\D/g, ''),
        dob: regDob,
        password: regPassword,
        maskedIdentityNumber: maskedId,
        verificationId: regOtpId,
        deferActivation: true,
      });

      setRegIsRegistering(false);

      if (!result.success || !result.user) {
        setGeneralError(result.error || 'Failed to complete registration.');
        return;
      }

      setGeneratedEfid(result.user.efid);
      setAuthMode('REGISTER_STEP4');
    } catch (err: any) {
      setRegIsRegistering(false);
      setGeneralError(`Registration error: ${err.message}`);
    }
  };

  const handleCopyGeneratedEfid = () => {
    navigator.clipboard.writeText(generatedEfid);
    setCopiedEfid(true);
    setTimeout(() => setCopiedEfid(false), 2000);
  };

  const handleFinishRegistration = () => {
    const user = storageService.completeRegistration();
    if (user) {
      onLoginSuccess(user);
    } else {
      const state = storageService.getState();
      if (state.user) {
        onLoginSuccess(state.user);
      }
    }
  };

  return (
    <div className="p-4 sm:p-5 flex flex-col min-h-full">
      {/* Back button */}
      {authMode !== 'CHOICE' && (
        <button
          onClick={() => {
            clearAllErrors();
            if (authMode === 'REGISTER_STEP2') setAuthMode('REGISTER_STEP1');
            else if (authMode === 'REGISTER_STEP3') setAuthMode('REGISTER_STEP2');
            else if (authMode === 'REGISTER_STEP4') setAuthMode('CHOICE');
            else setAuthMode('CHOICE');
          }}
          className="self-start flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 mb-3 font-medium transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. NATURAL WELCOME / CHOICE SCREEN */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'CHOICE' && (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
          <div className="w-16 h-16 rounded-2xl bg-stone-900 text-white flex items-center justify-center mb-4 shadow-sm">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
            LIFORA
          </h1>
          <p className="text-xs text-stone-500 max-w-xs mt-1 leading-relaxed">
            Digital Life Continuity Vault & Sovereign Emergency Inheritance System
          </p>

          <div className="w-full max-w-xs space-y-3 mt-8">
            {/* USER LOGIN */}
            <button
              onClick={() => {
                clearAllErrors();
                setAuthMode('USER_LOGIN');
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <UserIcon className="w-4 h-4 text-emerald-400" />
                <span>Vault Owner Login</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>

            {/* NOMINEE LOGIN */}
            <button
              onClick={() => {
                clearAllErrors();
                setAuthMode('NOMINEE_LOGIN');
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-semibold text-sm shadow-xs flex items-center justify-between active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <HeartHandshake className="w-4 h-4 text-emerald-700" />
                <span>Nominee Emergency Access</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>
          </div>

          <div className="mt-8 pt-4 border-t border-stone-200 w-full max-w-xs">
            <p className="text-xs text-stone-600">
              New to LIFORA?{' '}
              <button
                onClick={() => {
                  clearAllErrors();
                  setAuthMode('REGISTER_STEP1');
                }}
                className="text-emerald-800 font-bold hover:underline"
              >
                Create your vault
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. USER LOGIN SCREEN (PERSISTENT E-FID LOGIN) */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'USER_LOGIN' && (
        <div className="flex flex-col flex-1 py-2">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-stone-900">Owner Login</h2>
            <p className="text-xs text-stone-500 mt-1">
              Enter your registered mobile number or your Emergency Financial ID (E-FID)
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
              <button
                type="button"
                onClick={() => setLoginError('')}
                className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                title="Clear error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleUserLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Mobile Number or E-FID
              </label>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => {
                  setLoginIdentifier(e.target.value);
                  if (loginError) setLoginError('');
                }}
                placeholder="e.g. 9876543210 or EF-3RJP-2941"
                className="w-full px-3.5 py-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 text-stone-900 text-sm placeholder:text-stone-400 shadow-xs uppercase tracking-wide"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  placeholder="Enter your vault password"
                  className="w-full px-3.5 py-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 text-stone-900 text-sm placeholder:text-stone-400 shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <span>Sign In to Vault</span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-stone-500">
            <span>Don't have a vault yet? </span>
            <button
              onClick={() => setAuthMode('REGISTER_STEP1')}
              className="text-emerald-800 font-bold hover:underline"
            >
              Register here
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. NOMINEE LOGIN SCREEN (With Real SMS OTP) */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'NOMINEE_LOGIN' && (
        <div className="flex flex-col flex-1 py-2">
          <div className="mb-4">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Emergency Access Portal
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Nominee Access</h2>
            <p className="text-xs text-stone-500 mt-1">
              Verify your mobile number and enter the vault owner's E-FID to unlock authorized information.
            </p>
          </div>

          {nomineeError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{nomineeError}</span>
              </div>
              <button
                type="button"
                onClick={() => setNomineeError('')}
                className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                title="Clear error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nominee Mobile Number
              </label>
              <input
                type="tel"
                value={nomineePhone}
                onChange={(e) => {
                  setNomineePhone(e.target.value);
                  if (nomineeError) setNomineeError('');
                }}
                placeholder="Enter 10-digit mobile number"
                className="w-full px-3.5 py-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 text-stone-900 text-sm placeholder:text-stone-400 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Vault Owner's E-FID
              </label>
              <input
                type="text"
                value={nomineeOwnerEfid}
                onChange={(e) => {
                  setNomineeOwnerEfid(e.target.value.toUpperCase());
                  if (nomineeError) setNomineeError('');
                }}
                placeholder="e.g. EF-3RJP-2941"
                className="w-full px-3.5 py-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 text-stone-900 text-sm font-mono placeholder:text-stone-400 shadow-xs uppercase tracking-wider"
              />
            </div>

            {!nomineeOtpSent ? (
              <button
                type="button"
                onClick={handleSendNomineeOtp}
                disabled={nomineeIsSendingOtp}
                className="w-full py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {nomineeIsSendingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Sending SMS OTP...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>Send SMS OTP to Nominee</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700">
                      Enter 6-Digit SMS OTP
                    </label>
                    <span className="text-[11px] text-emerald-800 font-mono">
                      {nomineeOtpTimer > 0 ? `Resend in ${nomineeOtpTimer}s` : ''}
                    </span>
                  </div>
                  {/* Live Auto-Fill indicator badge */}
                  <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-[11px] text-emerald-800">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>தானியங்கி ஓடிபி உள்ளீடு (Auto-Detect Active)</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">Auto-Fill</span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={nomineeOtpInput}
                    onChange={(e) => setNomineeOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="· · · · · ·"
                    className="w-full px-3.5 py-3 rounded-xl bg-white border border-emerald-600 text-center text-lg font-mono tracking-widest text-stone-900 focus:outline-none shadow-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyNomineeLogin}
                    disabled={nomineeIsVerifying}
                    className="flex-1 py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {nomineeIsVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Access</span>
                    )}
                  </button>
                  {nomineeOtpTimer === 0 && (
                    <button
                      type="button"
                      onClick={handleSendNomineeOtp}
                      className="px-4 py-3.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 border border-stone-300"
                    >
                      Resend
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. REGISTRATION STEP 1 — PERSONAL PROFILE */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'REGISTER_STEP1' && (
        <div className="flex flex-col flex-1 py-2">
          {/* Progress Tracker */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-1 rounded-full bg-emerald-800"></div>
            <div className="flex-1 h-1 rounded-full bg-stone-200"></div>
            <div className="flex-1 h-1 rounded-full bg-stone-200"></div>
            <div className="flex-1 h-1 rounded-full bg-stone-200"></div>
          </div>

          <div className="mb-4">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Step 1 of 4 · Profile Details
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-0.5">Create Your Vault</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Enter your real details. Every field starts empty and persists in backend database.
            </p>
          </div>

          {generalError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGeneralError('')}
                className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                title="Clear error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleProceedToOtpStep} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={regFullName}
                onChange={(e) => {
                  setRegFullName(e.target.value);
                  if (generalError) setGeneralError('');
                }}
                placeholder="Enter your full name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:border-emerald-700 shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={regDob}
                onChange={(e) => {
                  setRegDob(e.target.value);
                  if (generalError) setGeneralError('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 text-sm focus:border-emerald-700 shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                value={regMobile}
                onChange={(e) => {
                  setRegMobile(e.target.value);
                  if (generalError) setGeneralError('');
                }}
                placeholder="Enter 10-digit mobile number"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:border-emerald-700 shadow-xs"
                required
              />
              <p className="text-[10px] text-stone-500 mt-1">
                A real SMS OTP will be sent to this number via MSG91 gateway.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => {
                  setRegPassword(e.target.value);
                  if (generalError) setGeneralError('');
                }}
                placeholder="Create vault password (min 6 characters)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:border-emerald-700 shadow-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={regConfirmPassword}
                onChange={(e) => {
                  setRegConfirmPassword(e.target.value);
                  if (generalError) setGeneralError('');
                }}
                placeholder="Confirm password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:border-emerald-700 shadow-xs"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all mt-4 flex items-center justify-center gap-2"
            >
              <span>Continue to SMS Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. REGISTRATION STEP 2 — MSG91 SMS OTP */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'REGISTER_STEP2' && (
        <div className="flex flex-col flex-1 py-2">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-1 rounded-full bg-emerald-800"></div>
            <div className="flex-1 h-1 rounded-full bg-emerald-800"></div>
            <div className="flex-1 h-1 rounded-full bg-stone-200"></div>
            <div className="flex-1 h-1 rounded-full bg-stone-200"></div>
          </div>

          <div className="mb-4">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Step 2 of 4 · SMS Verification
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-0.5">Verify Mobile Number</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Enter the 6-digit code sent via SMS to:
            </p>
            <p className="text-sm font-semibold text-stone-800 font-mono mt-0.5">
              +91 {regMobile.replace(/\D/g, '')}
            </p>
          </div>

          {regOtpError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{regOtpError}</span>
              </div>
              <button
                type="button"
                onClick={() => setRegOtpError('')}
                className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                title="Clear error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {regIsPhoneVerified && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>✓ Mobile Number Verified</span>
            </div>
          )}

          {/* Live Auto-Fill indicator badge */}
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-[11px] text-emerald-800">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>தானியங்கி ஓடிபி உள்ளீடு (Auto-Detect Active)</span>
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold">SMS Auto-Fill</span>
          </div>

          {/* 6 Digit Input */}
          <div className="flex justify-between gap-2 my-4">
            {regOtpDigits.map((digit, i) => (
              <input
                key={i}
                id={`reg-otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleRegOtpDigitChange(i, e.target.value)}
                className="w-11 h-14 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 text-center font-mono text-xl font-bold text-stone-900 focus:outline-none shadow-xs transition-all"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleVerifyRegOtp}
            disabled={regIsPhoneVerified || regIsVerifyingOtp}
            className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {regIsVerifyingOtp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Code...</span>
              </>
            ) : regIsPhoneVerified ? (
              '✓ Verified'
            ) : (
              'Verify Code'
            )}
          </button>

          <div className="mt-6 flex items-center justify-between text-xs text-stone-500">
            <span>Didn't receive code?</span>
            {regOtpTimer > 0 ? (
              <span className="font-mono text-stone-400">Resend in {regOtpTimer}s</span>
            ) : (
              <button
                type="button"
                onClick={() => handleSendRegOtp()}
                disabled={regIsSendingOtp}
                className="text-emerald-800 font-bold hover:underline"
              >
                Send Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. REGISTRATION STEP 3 — IDENTITY VERIFICATION & PERSIST */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'REGISTER_STEP3' && (
        <div className="flex flex-col flex-1 py-2">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-1 rounded-full bg-emerald-800"></div>
            <div className="flex-1 h-1 rounded-full bg-emerald-800"></div>
            <div className="flex-1 h-1 rounded-full bg-emerald-800"></div>
            <div className="flex-1 h-1 rounded-full bg-stone-200"></div>
          </div>

          <div className="mb-4">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Step 3 of 4 · Identity Confirmation
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-0.5">Confirm Identity</h2>
            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              <span className="font-bold">Privacy Protection: </span>
              Your identity details are securely stored in your private vault with one-way salted password hashing.
            </div>
          </div>

          {generalError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGeneralError('')}
                className="text-rose-500 hover:text-rose-700 p-0.5 shrink-0"
                title="Clear error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Select Identity Document
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegIdentityType('AADHAAR')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    regIdentityType === 'AADHAAR'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  Aadhaar Card
                </button>
                <button
                  type="button"
                  onClick={() => setRegIdentityType('PAN')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    regIdentityType === 'PAN'
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold'
                      : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  PAN Card
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                {regIdentityType === 'AADHAAR' ? 'Enter 12-Digit Aadhaar Number' : 'Enter 10-Digit PAN'}
              </label>
              <input
                type="text"
                value={regIdentityNumber}
                onChange={(e) => {
                  setRegIdentityNumber(e.target.value.toUpperCase());
                  if (generalError) setGeneralError('');
                }}
                placeholder={regIdentityType === 'AADHAAR' ? 'XXXX XXXX 1234' : 'ABCDE1234F'}
                className="w-full px-3.5 py-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 text-stone-900 text-sm font-mono tracking-wider shadow-xs uppercase"
              />
            </div>

            <button
              type="button"
              onClick={handleCompleteIdentityKyc}
              disabled={regIsRegistering}
              className="w-full py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              {regIsRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Profile to Database...</span>
                </>
              ) : (
                <>
                  <span>Save Vault & Generate E-FID</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. REGISTRATION STEP 4 — E-FID GENERATION & SUCCESS */}
      {/* ------------------------------------------------------------- */}
      {authMode === 'REGISTER_STEP4' && (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-bold text-stone-900">
            Vault Setup Complete
          </h2>
          <p className="text-xs text-stone-500 mt-1 max-w-xs">
            Your Emergency Financial Identity (E-FID) has been issued and permanently stored.
          </p>

          <div className="w-full max-w-xs bg-white border border-stone-300 rounded-2xl p-4 my-5 text-center shadow-sm">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              YOUR PERMANENT E-FID
            </span>
            <div className="text-2xl font-extrabold font-mono tracking-wider text-stone-900 my-2">
              {generatedEfid}
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              Save this E-FID. You can log in using either your Mobile Number or this E-FID with your password anytime.
            </p>

            <button
              type="button"
              onClick={handleCopyGeneratedEfid}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              {copiedEfid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEfid ? 'Copied' : 'Copy E-FID'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleFinishRegistration}
            className="w-full max-w-xs py-3.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm shadow-sm active:scale-[0.98] transition-all"
          >
            Enter Vault
          </button>
        </div>
      )}
    </div>
  );
};
