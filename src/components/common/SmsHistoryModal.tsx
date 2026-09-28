import React from 'react';
import { MessageSquare, X, Smartphone, Shield, Check, Clock } from 'lucide-react';
import { smsNotificationService, IncomingSms } from '../../services/smsSimulator';

interface SmsHistoryModalProps {
  onClose: () => void;
}

export const SmsHistoryModal: React.FC<SmsHistoryModalProps> = ({ onClose }) => {
  const history = smsNotificationService.getHistory();

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] h-[520px]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-emerald-800" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                SMS Verification Logs
              </h3>
              <p className="text-[10px] text-stone-500">Live SMS dispatches to owner & nominee</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 scrollbar-none">
          {history.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              <p className="text-stone-600 font-medium">No SMS dispatched in this session yet.</p>
              <p className="text-[11px] text-stone-400 mt-1">SMS dispatches occur when verifying mobile numbers.</p>
            </div>
          ) : (
            history.map((sms) => (
              <div
                key={sms.id}
                className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between text-stone-600">
                  <div className="flex items-center gap-1.5 font-bold text-stone-900 text-[11px]">
                    <Shield className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{sms.sender}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">{sms.timestamp}</span>
                </div>

                <p className="text-stone-800 font-mono text-[11px] leading-relaxed">
                  {sms.message}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-stone-200/80 text-[10px] text-stone-500">
                  <span>To: +91 {sms.recipientMobile}</span>
                  {sms.otp && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        OTP: {sms.otp}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(sms.otp || '');
                          window.dispatchEvent(
                            new CustomEvent('lifora_autofill_otp', { detail: { otp: sms.otp } })
                          );
                          onClose();
                        }}
                        className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded text-[10px]"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
