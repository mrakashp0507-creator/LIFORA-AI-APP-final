import crypto from 'crypto';

export interface Msg91Config {
  provider: 'MSG91' | 'MOCK';
  authKey: string;
  templateId: string;
  reminderFlowId: string;
  senderId: string;
  expirySeconds: number;
  cooldownSeconds: number;
  maxAttempts: number;
}

export function getMsg91Config(): Msg91Config {
  const envProvider = process.env.SMS_PROVIDER?.toUpperCase();
  const isProduction = process.env.NODE_ENV === 'production';
  let provider: 'MSG91' | 'MOCK';

  if (envProvider === 'MOCK') {
    if (isProduction) {
      throw new Error('SECURITY VIOLATION: Mock OTP mode is strictly forbidden in production.');
    }
    provider = 'MOCK';
  } else if (envProvider === 'MSG91') {
    provider = 'MSG91';
  } else {
    // Default: If explicitly in production, MUST use MSG91. In non-production, check for authKey or default to MOCK.
    if (isProduction) {
      provider = 'MSG91';
    } else {
      provider = process.env.MSG91_AUTH_KEY ? 'MSG91' : 'MOCK';
    }
  }

  return {
    provider,
    authKey: process.env.MSG91_AUTH_KEY || '',
    templateId: process.env.MSG91_TEMPLATE_ID || '',
    reminderFlowId: process.env.MSG91_REMINDER_FLOW_ID || process.env.MSG91_FLOW_ID || process.env.MSG91_TEMPLATE_ID || '',
    senderId: process.env.MSG91_SENDER_ID || 'LIFORA',
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || '600', 10),
    cooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '4', 10),
  };
}

export function generateCryptoOtp(): string {
  // Generate random 6-digit integer (100000 - 999999) using cryptographic randomness
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 900000 + 100000;
  return num.toString();
}

export function formatIndianMobile(raw: string): { clean10: string; fullWithCountry: string } {
  let clean = raw.replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.slice(2);
  }
  if (clean.length !== 10) {
    throw new Error('Please enter a valid 10-digit mobile number');
  }
  return {
    clean10: clean,
    fullWithCountry: `91${clean}`,
  };
}

export async function sendMsg91SmsOtp(
  mobileNumber: string,
  plainOtp: string
): Promise<{ success: boolean; message: string; isMock: boolean; gatewayResponse?: any }> {
  const config = getMsg91Config();
  const { clean10, fullWithCountry } = formatIndianMobile(mobileNumber);

  // If explicitly configured for local DEMO / MOCK testing
  if (config.provider === 'MOCK') {
    return {
      success: true,
      message: 'Demo OTP dispatched in local simulation mode.',
      isMock: true,
      gatewayResponse: { status: 'DEMO_MODE', recipient: `+91 ${clean10}` },
    };
  }

  // LIVE MSG91 MODE
  if (!config.authKey) {
    throw new Error(
      'MSG91_AUTH_KEY is not configured in backend environment variables. Please provide your MSG91 Auth Key to dispatch real SMS.'
    );
  }

  const url = new URL('https://api.msg91.com/api/v5/otp');
  url.searchParams.append('template_id', config.templateId);
  url.searchParams.append('mobile', fullWithCountry);
  url.searchParams.append('authkey', config.authKey);
  url.searchParams.append('otp', plainOtp);
  if (config.senderId) {
    url.searchParams.append('sender', config.senderId);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: config.authKey,
      },
      body: JSON.stringify({
        template_id: config.templateId,
        mobile: fullWithCountry,
        otp: plainOtp,
        sender: config.senderId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = data?.message || data?.error || `HTTP error ${res.status}`;
      return {
        success: false,
        message: `MSG91 gateway rejected SMS request: ${errMsg}`,
        isMock: false,
        gatewayResponse: data,
      };
    }

    if (data && data.type === 'error') {
      return {
        success: false,
        message: `MSG91 SMS delivery error: ${data.message || 'Unknown provider error'}`,
        isMock: false,
        gatewayResponse: data,
      };
    }

    return {
      success: true,
      message: 'SMS OTP successfully dispatched via MSG91 to recipient.',
      isMock: false,
      gatewayResponse: data,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('MSG91 gateway timeout. The SMS provider did not respond within 8 seconds.');
    }
    throw new Error(`Failed to communicate with MSG91 gateway: ${err.message}`);
  }
}

export async function verifyWithMsg91Gateway(
  mobileNumber: string,
  enteredOtp: string
): Promise<{ verified: boolean; message: string }> {
  const config = getMsg91Config();
  const { fullWithCountry } = formatIndianMobile(mobileNumber);

  if (config.provider === 'MOCK' || !config.authKey) {
    return { verified: false, message: 'Gateway verification not applicable in current mode.' };
  }

  try {
    const url = new URL('https://api.msg91.com/api/v5/otp/verify');
    url.searchParams.append('mobile', fullWithCountry);
    url.searchParams.append('otp', enteredOtp.trim());

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        authkey: config.authKey,
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.type === 'success') {
      return { verified: true, message: 'OTP verified successfully via MSG91.' };
    }

    return {
      verified: false,
      message: data?.message || 'OTP verification failed at MSG91 gateway.',
    };
  } catch (err: any) {
    return { verified: false, message: `MSG91 verification connection error: ${err.message}` };
  }
}

export interface SendReminderSmsParams {
  mobileNumber: string;
  recipientName: string;
  recipientType: 'OWNER' | 'NOMINEE';
  recordType: string;
  title: string;
  amount?: number | null;
  dueDate: string;
  daysRemaining: number;
}

export interface ReminderSmsResult {
  success: boolean;
  message: string;
  provider: 'MSG91' | 'MOCK';
  messagePreview: string;
  recipientMobile: string;
  gatewayResponse?: any;
}

export async function sendMsg91TransactionalSms(
  params: SendReminderSmsParams
): Promise<ReminderSmsResult> {
  const config = getMsg91Config();
  const { clean10, fullWithCountry } = formatIndianMobile(params.mobileNumber);

  const daysLabel =
    params.daysRemaining === 0
      ? 'Due TODAY'
      : params.daysRemaining === 1
      ? 'Due TOMORROW'
      : `Due in ${params.daysRemaining} days`;

  // Privacy-First Message Content: Strictly NO passwords, OTPs, PINs, CVVs, or account numbers
  let textMessage = '';
  if (params.recipientType === 'NOMINEE') {
    textMessage = `LIFORA Alert: Authorized notice for ${params.recipientName} - Scheduled reminder for "${params.title}" (${params.recordType.replace('_', ' ')}) on ${params.dueDate} (${daysLabel}). - LIFORA Vault`;
  } else if (params.recordType === 'DOCUMENT_EXPIRY') {
    textMessage = `LIFORA Alert: Reminder - Your document "${params.title}" expires on ${params.dueDate} (${daysLabel}). Please renew timely. - LIFORA Vault`;
  } else {
    const amtStr = params.amount ? ` of Rs.${params.amount.toLocaleString('en-IN')}` : '';
    textMessage = `LIFORA Alert: Reminder - Your ${params.recordType.replace('_', ' ')} "${params.title}"${amtStr} is due on ${params.dueDate} (${daysLabel}). Please maintain adequate balance. - LIFORA Vault`;
  }

  // 1. MOCK / DEMO MODE (Non-production only)
  if (config.provider === 'MOCK') {
    return {
      success: true,
      message: 'Demo reminder SMS simulated successfully (Local Demo Mode).',
      provider: 'MOCK',
      messagePreview: textMessage,
      recipientMobile: clean10,
      gatewayResponse: { status: 'DEMO_DISPATCHED', recipient: `+91 ${clean10}`, text: textMessage },
    };
  }

  // 2. LIVE MSG91 MODE
  if (!config.authKey) {
    return {
      success: false,
      message: 'MSG91_AUTH_KEY is not configured in backend environment variables.',
      provider: 'MSG91',
      messagePreview: textMessage,
      recipientMobile: clean10,
    };
  }

  // Attempt A: Send via MSG91 Flow API if Flow ID or Template ID is configured
  const flowOrTemplateId = config.reminderFlowId || config.templateId;
  if (flowOrTemplateId) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const payload = {
        template_id: flowOrTemplateId,
        sender: config.senderId,
        short_url: '0',
        recipients: [
          {
            mobiles: fullWithCountry,
            name: params.recipientName,
            title: params.title,
            category: params.recordType,
            date: params.dueDate,
            days: params.daysRemaining.toString(),
            amount: params.amount ? params.amount.toString() : '0',
          },
        ],
      };

      const res = await fetch('https://api.msg91.com/api/v5/flow', {
        method: 'POST',
        headers: {
          authkey: config.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json().catch(() => null);

      if (res.ok && data && (data.type === 'success' || data.status === 'success' || data.request_id)) {
        return {
          success: true,
          message: 'SMS reminder dispatched via MSG91 Flow gateway.',
          provider: 'MSG91',
          messagePreview: textMessage,
          recipientMobile: clean10,
          gatewayResponse: data,
        };
      }

      // If MSG91 Flow returns an error, examine reason
      if (data && data.type === 'error') {
        // Fallback to transactional OTP/SMS endpoint if template doesn't match Flow schema
        console.warn('[MSG91 Flow Error, attempting fallback]:', data.message);
      }
    } catch (flowErr: any) {
      console.warn('[MSG91 Flow dispatch error]:', flowErr.message);
    }
  }

  // Attempt B: MSG91 OTP/SMS endpoint with standard DLT message / OTP route
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const otpUrl = new URL('https://api.msg91.com/api/v5/otp');
    otpUrl.searchParams.append('template_id', config.templateId || flowOrTemplateId);
    otpUrl.searchParams.append('mobile', fullWithCountry);
    otpUrl.searchParams.append('authkey', config.authKey);
    // Transmit short alert payload
    const shortCode = `${params.daysRemaining}D`;
    otpUrl.searchParams.append('otp', shortCode);
    if (config.senderId) {
      otpUrl.searchParams.append('sender', config.senderId);
    }

    const res = await fetch(otpUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: config.authKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await res.json().catch(() => null);

    if (res.ok && data && (data.type === 'success' || data.message?.includes('success') || data.request_id)) {
      return {
        success: true,
        message: 'SMS reminder accepted by MSG91 gateway.',
        provider: 'MSG91',
        messagePreview: textMessage,
        recipientMobile: clean10,
        gatewayResponse: data,
      };
    }

    return {
      success: false,
      message: data?.message || data?.error || `MSG91 gateway rejected SMS (HTTP ${res.status})`,
      provider: 'MSG91',
      messagePreview: textMessage,
      recipientMobile: clean10,
      gatewayResponse: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to communicate with MSG91 gateway: ${err.message}`,
      provider: 'MSG91',
      messagePreview: textMessage,
      recipientMobile: clean10,
    };
  }
}

