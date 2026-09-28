import { db } from './db';
import { sendMsg91TransactionalSms } from './msg91';
import { DueDateRecord, SmsReminderLog } from '../types';

/**
 * Returns today's calendar date in Asia/Kolkata (IST) timezone formatted as YYYY-MM-DD
 */
export function getIndiaTodayDate(): { todayString: string; todayDate: Date } {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // 'en-CA' gives YYYY-MM-DD
  const todayString = formatter.format(now);
  const [year, month, day] = todayString.split('-').map(Number);
  const todayDate = new Date(Date.UTC(year, month - 1, day));
  return { todayString, todayDate };
}

/**
 * Calculates calendar day difference between dueDate and today
 * E.g., dueDate="2026-10-30", today="2026-10-23" => 7
 */
export function calculateDaysRemaining(dueDateStr: string, todayStr: string): number {
  if (!dueDateStr) return -999;
  const parts = dueDateStr.split('-');
  if (parts.length !== 3) return -999;
  const [dy, dm, dd] = parts.map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the exact scheduled reminder calendar dates for a given due date
 */
export function calculateReminderDates(
  dueDateStr: string,
  intervals: number[] = [7, 3, 1]
): Array<{ intervalDays: number; scheduledDate: string }> {
  if (!dueDateStr) return [];
  const parts = dueDateStr.split('-');
  if (parts.length !== 3) return [];
  const [dy, dm, dd] = parts.map(Number);

  return intervals.map((interval) => {
    const dueUtc = new Date(Date.UTC(dy, dm - 1, dd));
    dueUtc.setUTCDate(dueUtc.getUTCDate() - interval);
    const y = dueUtc.getUTCFullYear();
    const m = String(dueUtc.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dueUtc.getUTCDate()).padStart(2, '0');
    return {
      intervalDays: interval,
      scheduledDate: `${y}-${m}-${d}`,
    };
  });
}

export interface ReminderJobSummary {
  processedRecords: number;
  evaluatedReminders: number;
  dispatchedCount: number;
  skippedCount: number;
  failedCount: number;
  logs: SmsReminderLog[];
  ranAt: string;
  todayIST: string;
}

/**
 * Core Automated Reminder Worker
 * Evaluates all active Due-Date records in the persistent database,
 * checks intervals (7d, 3d, 1d), owner preferences, nominee consent & verification,
 * prevents duplicate notifications, and dispatches via MSG91 gateway.
 */
export async function runDueReminderCheck(): Promise<ReminderJobSummary> {
  const { todayString } = getIndiaTodayDate();
  console.log(`[LIFORA SCHEDULER] Running due-date & document-expiry check for IST Date: ${todayString}`);

  db.ensureLoaded();
  const activeRecords = db.getAllActiveDueDates();

  const summary: ReminderJobSummary = {
    processedRecords: activeRecords.length,
    evaluatedReminders: 0,
    dispatchedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    logs: [],
    ranAt: new Date().toISOString(),
    todayIST: todayString,
  };

  for (const record of activeRecords) {
    // Skip if status is not ACTIVE (e.g. PAUSED, COMPLETED, CANCELLED)
    if (record.status !== 'ACTIVE') continue;

    const daysRemaining = calculateDaysRemaining(record.due_date, todayString);
    summary.evaluatedReminders++;

    // Check if daysRemaining matches any of the record's configured reminder intervals
    const configuredIntervals = record.reminder_intervals || [7, 3, 1];
    const isIntervalTrigger = configuredIntervals.includes(daysRemaining);

    // Also support due-day reminder if daysRemaining === 0 and configured
    if (!isIntervalTrigger && daysRemaining !== 0) {
      continue;
    }

    const owner = db.findUserById(record.user_id);
    if (!owner) continue;

    const vault = db.getVault(owner.id);
    const nominees = vault.nominees || [];

    // Recipient A: Owner
    const shouldSendToOwner = record.recipients === 'OWNER_ONLY' || record.recipients === 'BOTH';
    if (shouldSendToOwner && owner.mobile_number) {
      // Duplicate prevention check
      const alreadySent = db.hasReminderBeenSent(record.id, owner.mobile_number, daysRemaining, todayString);
      if (!alreadySent) {
        try {
          const sendResult = await sendMsg91TransactionalSms({
            mobileNumber: owner.mobile_number,
            recipientName: owner.full_name,
            recipientType: 'OWNER',
            recordType: record.record_type,
            title: record.title,
            amount: record.amount,
            dueDate: record.due_date,
            daysRemaining,
          });

          const log = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: 'OWNER',
            recipient_name: owner.full_name,
            recipient_mobile: owner.mobile_number,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: sendResult.success ? 'DELIVERED' : 'FAILED',
            provider: sendResult.provider,
            message_preview: sendResult.messagePreview,
            gateway_response: sendResult.gatewayResponse,
            error_message: sendResult.success ? undefined : sendResult.message,
          });

          summary.logs.push(log);
          if (sendResult.success) {
            summary.dispatchedCount++;
          } else {
            summary.failedCount++;
          }
        } catch (err: any) {
          summary.failedCount++;
          const errLog = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: 'OWNER',
            recipient_name: owner.full_name,
            recipient_mobile: owner.mobile_number,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: 'FAILED',
            provider: 'MSG91',
            message_preview: `Reminder for ${record.title} (${daysRemaining}d remaining)`,
            error_message: err.message,
          });
          summary.logs.push(errLog);
        }
      } else {
        summary.skippedCount++;
      }
    }

    // Recipient B: Authorized Nominee
    const shouldSendToNominee = record.recipients === 'AUTHORIZED_NOMINEE' || record.recipients === 'BOTH';
    if (shouldSendToNominee) {
      // Nominee Security & Consent Verification:
      // 1. Owner must have explicitly granted nominee consent
      if (!record.nominee_consent_granted) {
        db.addReminderLog({
          user_id: owner.id,
          due_date_id: record.id,
          record_title: record.title,
          record_type: record.record_type,
          recipient_type: 'NOMINEE',
          recipient_name: record.nominee_name || 'Unverified Nominee',
          recipient_mobile: record.nominee_mobile || '0000000000',
          days_before_due: daysRemaining,
          due_date: record.due_date,
          status: 'SKIPPED',
          provider: 'MSG91',
          message_preview: 'Nominee reminder omitted: Owner consent not active.',
          error_message: 'Consent Revoked or Inactive: Owner has not explicitly enabled nominee reminders.',
        });
        summary.skippedCount++;
        continue;
      }

      // 2. Find target nominee in owner's vault
      let matchedNominee = null;
      if (record.nominee_id) {
        matchedNominee = nominees.find((n: any) => n.id === record.nominee_id);
      }
      if (!matchedNominee && record.nominee_mobile) {
        const cleanNomMobile = db.canonicalizeMobile(record.nominee_mobile);
        matchedNominee = nominees.find((n: any) => db.canonicalizeMobile(n.mobile_number) === cleanNomMobile);
      }

      // 3. Check nominee verification status
      const isVerified = Boolean(matchedNominee && (matchedNominee.is_phone_verified || matchedNominee.status === 'VERIFIED'));
      const nomineePhone = matchedNominee ? matchedNominee.mobile_number : record.nominee_mobile;
      const nomineeName = (matchedNominee && matchedNominee.name) || record.nominee_name || 'Designated Nominee';

      if (!isVerified || !nomineePhone) {
        db.addReminderLog({
          user_id: owner.id,
          due_date_id: record.id,
          record_title: record.title,
          record_type: record.record_type,
          recipient_type: 'NOMINEE',
          recipient_name: nomineeName,
          recipient_mobile: nomineePhone || '0000000000',
          days_before_due: daysRemaining,
          due_date: record.due_date,
          status: 'SKIPPED',
          provider: 'MSG91',
          message_preview: 'Nominee reminder omitted: Phone number unverified.',
          error_message: 'Security Policy: Nominee phone number must complete SMS OTP verification before receiving reminder notices.',
        });
        summary.skippedCount++;
        continue;
      }

      // 4. Duplicate check for nominee
      const nomineeAlreadySent = db.hasReminderBeenSent(record.id, nomineePhone, daysRemaining, todayString);
      if (!nomineeAlreadySent) {
        try {
          const sendResult = await sendMsg91TransactionalSms({
            mobileNumber: nomineePhone,
            recipientName: nomineeName,
            recipientType: 'NOMINEE',
            recordType: record.record_type,
            title: record.title,
            amount: record.amount,
            dueDate: record.due_date,
            daysRemaining,
          });

          const log = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: 'NOMINEE',
            recipient_name: nomineeName,
            recipient_mobile: nomineePhone,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: sendResult.success ? 'DELIVERED' : 'FAILED',
            provider: sendResult.provider,
            message_preview: sendResult.messagePreview,
            gateway_response: sendResult.gatewayResponse,
            error_message: sendResult.success ? undefined : sendResult.message,
          });

          summary.logs.push(log);
          if (sendResult.success) {
            summary.dispatchedCount++;
          } else {
            summary.failedCount++;
          }
        } catch (err: any) {
          summary.failedCount++;
          const errLog = db.addReminderLog({
            user_id: owner.id,
            due_date_id: record.id,
            record_title: record.title,
            record_type: record.record_type,
            recipient_type: 'NOMINEE',
            recipient_name: nomineeName,
            recipient_mobile: nomineePhone,
            days_before_due: daysRemaining,
            due_date: record.due_date,
            status: 'FAILED',
            provider: 'MSG91',
            message_preview: `Nominee notice for ${record.title}`,
            error_message: err.message,
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

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Initializes the background scheduler loop.
 * Runs check every 1 hour (3600000 ms) and immediately on startup.
 */
export function startBackgroundReminderScheduler(intervalMs: number = 60 * 60 * 1000): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log('[LIFORA SCHEDULER] Initializing persistent background reminder job...');

  // Immediate execution on server boot (with 5 second grace period to allow full initialization)
  setTimeout(() => {
    runDueReminderCheck().catch((err) => {
      console.error('[LIFORA SCHEDULER] Error during initial check:', err);
    });
  }, 5000);

  // Periodic recurring check
  schedulerTimer = setInterval(() => {
    runDueReminderCheck().catch((err) => {
      console.error('[LIFORA SCHEDULER] Error during recurring check:', err);
    });
  }, intervalMs);
}
