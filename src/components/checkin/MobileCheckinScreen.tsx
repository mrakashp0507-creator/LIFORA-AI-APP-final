import React, { useState } from 'react';
import { 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  PhoneCall, 
  AlertCircle, 
  X, 
  Send
} from 'lucide-react';
import { VaultState, SafetyCheckin } from '../../types';
import { storageService } from '../../services/storage';
import { smsNotificationService } from '../../services/smsSimulator';

interface MobileCheckinScreenProps {
  state: VaultState;
  onClose: () => void;
}

export const MobileCheckinScreen: React.FC<MobileCheckinScreenProps> = ({
  state,
  onClose
}) => {
  const user = state.user;
  const [selectedThreshold, setSelectedThreshold] = useState<number>(
    user?.inactivity_threshold_days || 30
  );
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const handleUpdateThreshold = (days: number) => {
    setSelectedThreshold(days);
    storageService.updateState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, inactivity_threshold_days: days } : null,
    }));
    storageService.logAudit(
      'UPDATE_INACTIVITY_THRESHOLD',
      user?.full_name || 'Owner',
      `Configured inactivity trigger to ${days} days`
    );
  };

  const handleSimulateNomineeCheckin = () => {
    const nomineeName = (state?.nominees || [])[0]?.name || 'Priya Raman (Spouse)';
    const newCheckin: SafetyCheckin = {
      id: `chk-${Date.now()}`,
      requested_by_nominee: 'nom-1',
      nominee_name: nomineeName,
      status: 'PENDING',
      requested_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      safetyCheckin: newCheckin,
    }));

    smsNotificationService.notifyIncomingSms({
      sender: 'LIFORA-SAFETY',
      message: `Safety Alert: Your nominee ${nomineeName} has initiated a LIFORA Safety Check-in. Please confirm you are safe.`,
      recipientMobile: user?.mobile_number || 'Owner',
    });

    storageService.logAudit('SAFETY_CHECKIN_INITIATED', nomineeName, 'Initiated safety check-in request to owner');
  };

  const handleCheckinResponse = (choice: 'IM_OKAY' | 'CALL_ME' | 'RESPOND_LATER' | 'NEED_HELP') => {
    const nomineeName = state.safetyCheckin?.nominee_name || 'Nominee';

    storageService.updateState((prev) => ({
      ...prev,
      safetyCheckin: null,
      user: prev.user ? { ...prev.user, last_activity_at: new Date().toISOString() } : null,
    }));

    let messageText = '';
    if (choice === 'IM_OKAY') {
      messageText = 'Status updated: You confirmed you are safe. Inactivity timer reset.';
      smsNotificationService.notifyIncomingSms({
        sender: 'LIFORA-MSG91',
        message: `Safety Update to ${nomineeName}: ${user?.full_name || 'Owner'} responded "I'm Okay". Inactivity timer reset.`,
        recipientMobile: nomineeName,
      });
    } else if (choice === 'CALL_ME') {
      messageText = 'SMS dispatched to nominee: "Please call me when you see this."';
      smsNotificationService.notifyIncomingSms({
        sender: 'LIFORA-MSG91',
        message: `Urgent SMS to ${nomineeName}: ${user?.full_name || 'Owner'} requested: "Please call me when you see this."`,
        recipientMobile: nomineeName,
      });
    } else if (choice === 'NEED_HELP') {
      messageText = 'EMERGENCY ALERT dispatched to all verified nominees.';
      smsNotificationService.notifyIncomingSms({
        sender: 'LIFORA-ALERT',
        message: `CRITICAL ALERT: ${user?.full_name || 'Owner'} responded "I Need Help" on LIFORA Safety Check-in. Immediate contact advised.`,
        recipientMobile: nomineeName,
      });
    }

    setFeedbackMsg(messageText);
    storageService.logAudit('SAFETY_CHECKIN_RESPONSE', user?.full_name || 'Owner', `Responded: ${choice}`);
    setTimeout(() => {
      setFeedbackMsg('');
    }, 4000);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
            Safety Monitoring
          </span>
          <h2 className="text-base font-bold text-stone-900">
            Inactivity Watchdog & Check-in
          </h2>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Active Check-in Dialog */}
      {state.safetyCheckin && (
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
              <span>Are you okay?</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
              Pending Response
            </span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Your nominee <span className="font-semibold text-stone-900">{state.safetyCheckin.nominee_name}</span> requested a safety check-in. Please select your status:
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleCheckinResponse('IM_OKAY')}
              className="py-3 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>I'm Okay</span>
            </button>

            <button
              onClick={() => handleCheckinResponse('CALL_ME')}
              className="py-3 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>Call Me</span>
            </button>

            <button
              onClick={() => handleCheckinResponse('NEED_HELP')}
              className="py-3 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <AlertCircle className="w-4 h-4" />
              <span>I Need Help</span>
            </button>

            <button
              onClick={() => handleCheckinResponse('RESPOND_LATER')}
              className="py-3 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {/* Inactivity Threshold Configuration */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
          Inactivity Alert Period
        </h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          If you do not open LIFORA within this period, an automated SMS safety check-in is sent to your phone. If unanswered, designated nominees are notified.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              onClick={() => handleUpdateThreshold(days)}
              className={`py-3 px-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedThreshold === days
                  ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-bold shadow-xs'
                  : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Test Trigger */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
          Test Safety Check-in Alert
        </h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          Simulate a nominee safety check-in to verify that your notifications and responses function as intended.
        </p>
        <button
          onClick={handleSimulateNomineeCheckin}
          className="w-full py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-300 flex items-center justify-center gap-2 mt-2 transition-all active:scale-95"
        >
          <Send className="w-3.5 h-3.5 text-stone-600" />
          <span>Trigger Test Check-in Alert</span>
        </button>
      </div>
    </div>
  );
};
