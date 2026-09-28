import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { smsNotificationService } from './smsSimulator';
import { buildApiUrl, safeFetchJson } from './apiClient';

export interface SendOtpResult {
  success: boolean;
  verificationId: string;
  maskedNumber: string;
  expiresInSeconds?: number;
  cooldownSeconds?: number;
  isMock?: boolean;
  error?: string;
  message?: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  message: string;
  verifiedPhone?: string;
  purpose?: string;
  firebaseIdToken?: string;
}

export interface ResendOtpResult {
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  isMock?: boolean;
  error?: string;
}

// In-memory active confirmation result from Firebase Phone Auth
let activeFirebaseConfirmation: ConfirmationResult | null = null;
let activeRecaptchaVerifier: RecaptchaVerifier | null = null;
let lastTargetPhone: string = '';
let lastVerificationPurpose: 'USER_PHONE_VERIFICATION' | 'NOMINEE_PHONE_VERIFICATION' = 'USER_PHONE_VERIFICATION';

function getRecaptchaVerifier(): RecaptchaVerifier {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please ensure Firebase configuration is set.');
  }

  // Clear previous widget if exists
  if (activeRecaptchaVerifier) {
    try {
      activeRecaptchaVerifier.clear();
    } catch (e) {
      // Ignore cleanup error
    }
    activeRecaptchaVerifier = null;
  }

  const container = document.getElementById('recaptcha-container') || document.body;

  activeRecaptchaVerifier = new RecaptchaVerifier(auth, container, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - will proceed with phone auth
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, user may need to re-verify');
    }
  });

  return activeRecaptchaVerifier;
}

/**
 * Format Indian / international number to E.164 standard (+91XXXXXXXXXX)
 */
export function formatE164(mobileNumber: string): string {
  let clean = mobileNumber.replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    return `+${clean}`;
  }
  if (clean.length === 10) {
    return `+91${clean}`;
  }
  if (clean.length > 10) {
    return `+${clean}`;
  }
  throw new Error('Please enter a valid 10-digit mobile number');
}

/**
 * Real Firebase Phone Auth sendOtp implementation
 * References the core flow from mniprince/OTP-With-firebase (PhoneAuthProvider + verification callbacks)
 */
export async function sendOtp(
  mobileNumber: string,
  purpose: 'USER_PHONE_VERIFICATION' | 'NOMINEE_PHONE_VERIFICATION' = 'USER_PHONE_VERIFICATION'
): Promise<SendOtpResult> {
  let e164Phone: string;
  try {
    e164Phone = formatE164(mobileNumber);
  } catch (err: any) {
    return {
      success: false,
      verificationId: '',
      maskedNumber: '',
      error: err.message,
    };
  }

  const clean10 = e164Phone.replace(/\D/g, '').slice(-10);
  const maskedNumber = `+91 XXXXX X${clean10.slice(-4)}`;

  // If Firebase is configured with real credentials, execute real Firebase Phone Authentication
  if (isFirebaseConfigured && auth) {
    try {
      const verifier = getRecaptchaVerifier();
      const confirmationResult = await signInWithPhoneNumber(auth, e164Phone, verifier);
      activeFirebaseConfirmation = confirmationResult;
      lastTargetPhone = e164Phone;
      lastVerificationPurpose = purpose;

      return {
        success: true,
        verificationId: confirmationResult.verificationId,
        maskedNumber,
        expiresInSeconds: 600,
        cooldownSeconds: 60,
        isMock: false,
        message: 'Live Firebase SMS OTP sent to your mobile phone.',
      };
    } catch (err: any) {
      console.error('Firebase signInWithPhoneNumber error:', err);
      let userMsg = 'Failed to dispatch SMS via Firebase.';
      if (err.code === 'auth/invalid-phone-number') {
        userMsg = 'Invalid phone number format. Please check the 10-digit mobile number.';
      } else if (err.code === 'auth/too-many-requests') {
        userMsg = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (err.code === 'auth/quota-exceeded') {
        userMsg = 'Firebase SMS quota exceeded. Please check Firebase project SMS quota.';
      } else if (err.code === 'auth/captcha-check-failed') {
        userMsg = 'reCAPTCHA verification failed. Please refresh and try again.';
      } else if (err.message) {
        userMsg = err.message;
      }

      return {
        success: false,
        verificationId: '',
        maskedNumber,
        error: userMsg,
      };
    }
  }

  // If Firebase project credentials are not yet populated into environment variables,
  // route through secure server-side verification proxy.
  try {
    const targetUrl = buildApiUrl('/api/auth/send-otp');
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        mobile_number: clean10,
        purpose,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
      return {
        success: false,
        verificationId: '',
        maskedNumber,
        error: isHtml
          ? `Server returned HTML (${res.status} ${res.statusText}). Verify backend is running and VITE_API_URL points to the backend service.`
          : `Non-JSON server response (${res.status}): ${text.slice(0, 100)}`,
      };
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        verificationId: '',
        maskedNumber,
        error: data.error || 'Failed to dispatch SMS OTP.',
      };
    }

    // Trigger Android-style incoming SMS alert and broadcast auto-fill event
    if (data.demo_otp) {
      smsNotificationService.notifyIncomingSms({
        sender: 'LIFORA-VERIFY',
        message: `Your LIFORA verification code is ${data.demo_otp}. Do not share this OTP with anyone.`,
        otp: data.demo_otp,
        recipientMobile: clean10,
      });

      // Automatically dispatch auto-fill event so OTP boxes populate immediately
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('lifora_autofill_otp', { detail: { otp: data.demo_otp } })
        );
      }, 700);
    }

    return {
      success: true,
      verificationId: data.verification_id,
      maskedNumber: data.masked_number || maskedNumber,
      expiresInSeconds: data.expires_in_seconds || 600,
      cooldownSeconds: data.cooldown_seconds || 60,
      isMock: Boolean(data.is_mock),
      message: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      verificationId: '',
      maskedNumber,
      error: `Network error connecting to OTP service: ${err.message}`,
    };
  }
}

/**
 * Real Firebase Phone Auth verifyOtp implementation
 * Confirms with Firebase confirmationResult.confirm(otp)
 */
export async function verifyOtp(
  verificationId: string,
  enteredOtp: string
): Promise<VerifyOtpResult> {
  const cleanOtp = enteredOtp.trim();
  if (cleanOtp.length !== 6) {
    return {
      verified: false,
      message: 'Please enter all 6 digits of the OTP code received on your phone.',
    };
  }

  // 1. If active Firebase Phone ConfirmationResult is present
  if (activeFirebaseConfirmation) {
    try {
      const userCredential = await activeFirebaseConfirmation.confirm(cleanOtp);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      const verifiedPhone = user.phoneNumber || lastTargetPhone;

      // Inform backend that this phone number is verified via Firebase
      try {
        await fetch(buildApiUrl('/api/auth/firebase-verify-sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            phone: verifiedPhone,
            firebase_uid: user.uid,
            id_token: idToken,
            purpose: lastVerificationPurpose,
          }),
        });
      } catch (syncErr) {
        // Log sync warning, but do not block client verification
        console.warn('Backend sync error:', syncErr);
      }

      return {
        verified: true,
        message: 'Phone number verified successfully with Firebase.',
        verifiedPhone,
        purpose: lastVerificationPurpose,
        firebaseIdToken: idToken,
      };
    } catch (err: any) {
      console.error('Firebase OTP confirmation error:', err);
      let userMsg = 'Invalid verification code. Please check your SMS and try again.';
      if (err.code === 'auth/invalid-verification-code') {
        userMsg = 'Incorrect OTP entered. Please re-check the 6-digit code sent via SMS.';
      } else if (err.code === 'auth/code-expired') {
        userMsg = 'This OTP has expired. Please request a new verification code.';
      } else if (err.message) {
        userMsg = err.message;
      }

      return {
        verified: false,
        message: userMsg,
      };
    }
  }

  // 2. Fallback to server-side verification endpoint
  try {
    const targetUrl = buildApiUrl('/api/auth/verify-otp');
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        verification_id: verificationId,
        otp: cleanOtp,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return {
        verified: false,
        message: `Server returned non-JSON response (${response.status}). Check backend status.`,
      };
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        verified: false,
        message: data.error || 'Invalid OTP code. Please check your SMS.',
      };
    }

    return {
      verified: true,
      message: data.message || 'Mobile number verified successfully.',
      verifiedPhone: data.verified_phone,
      purpose: data.purpose,
    };
  } catch (err: any) {
    return {
      verified: false,
      message: `Error verifying OTP: ${err.message}`,
    };
  }
}

/**
 * Resend OTP with Firebase or server proxy
 */
export async function resendOtp(verificationId: string): Promise<ResendOtpResult> {
  if (lastTargetPhone) {
    const res = await sendOtp(lastTargetPhone, lastVerificationPurpose);
    return {
      success: res.success,
      message: res.message || 'New OTP sent to your phone.',
      cooldownSeconds: res.cooldownSeconds || 60,
      isMock: res.isMock,
      error: res.error,
    };
  }

  try {
    const targetUrl = buildApiUrl('/api/auth/resend-otp');
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ verification_id: verificationId }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        message: `Server returned non-JSON response (${res.status}).`,
        error: `Server returned non-JSON response (${res.status}).`,
      };
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.error || 'Failed to resend OTP.',
        error: data.error,
      };
    }

    return {
      success: true,
      message: data.message || 'New OTP has been dispatched to your mobile phone.',
      cooldownSeconds: data.cooldown_seconds || 60,
      isMock: Boolean(data.is_mock),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      error: err.message,
    };
  }
}

export const otpService = {
  sendOtp,
  verifyOtp,
  resendOtp,
};
