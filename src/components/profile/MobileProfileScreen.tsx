import React, { useState } from 'react';
import { 
  User, 
  Shield, 
  Copy, 
  Check, 
  MessageSquare, 
  LogOut, 
  Trash2, 
  History,
  Lock
} from 'lucide-react';
import { VaultState } from '../../types';
import { storageService } from '../../services/storage';

interface MobileProfileScreenProps {
  state: VaultState;
  onLogout: () => void;
  onOpenSmsHistory: () => void;
}

export const MobileProfileScreen: React.FC<MobileProfileScreenProps> = ({
  state,
  onLogout,
  onOpenSmsHistory
}) => {
  const user = state?.user;
  const auditLogs = state?.auditLogs || [];
  const [copiedEfid, setCopiedEfid] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleCopyEfid = () => {
    if (user?.efid) {
      navigator.clipboard.writeText(user.efid);
      setCopiedEfid(true);
      setTimeout(() => setCopiedEfid(false), 2000);
    }
  };

  const handleResetVault = () => {
    storageService.resetAllData();
    setShowConfirmReset(false);
    onLogout();
  };

  return (
    <div className="p-4 space-y-4">
      {/* E-FID Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider block">
                Emergency Financial ID
              </span>
              <span className="text-base font-bold font-mono tracking-wider text-stone-900">
                {user?.efid || 'NOT GENERATED'}
              </span>
            </div>
          </div>
          <button
            onClick={handleCopyEfid}
            className="py-1 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1 transition-all"
          >
            {copiedEfid ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copiedEfid ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <p className="text-[11px] text-stone-500 mt-2.5 leading-relaxed">
          Your unique E-FID allows designated nominees to authenticate emergency access. Never share your password.
        </p>
      </div>

      {/* Profile Details */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
          Owner Profile Details
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-stone-100 text-stone-700">
            <span className="text-stone-500">Full Name</span>
            <span className="font-semibold text-stone-900">{user?.full_name || 'Owner'}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-stone-100 text-stone-700">
            <span className="text-stone-500">Mobile Number</span>
            <span className="font-mono font-semibold text-stone-900">+91 {user?.mobile_number}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-stone-100 text-stone-700">
            <span className="text-stone-500">Date of Birth</span>
            <span className="font-mono text-stone-800">{user?.date_of_birth || 'Not recorded'}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 text-stone-700">
            <span className="text-stone-500">Identity Status</span>
            <span className="font-mono text-emerald-800 font-semibold">{user?.masked_identity_number || 'Verified'}</span>
          </div>
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <button
          onClick={onOpenSmsHistory}
          className="w-full p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 flex items-center justify-between text-xs font-semibold text-stone-800 transition-all shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-stone-700" />
            <span>MSG91 SMS Gateway Logs</span>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">View Dispatches &rarr;</span>
        </button>
      </div>

      {/* Chronological Audit Trail */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-stone-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Security Audit Log
            </h3>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">
            {auditLogs.length} events
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-none">
            {auditLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="p-2 rounded-xl bg-stone-50 border border-stone-100 text-[11px]"
              >
                <div className="flex items-center justify-between text-stone-600">
                  <span className="font-semibold text-stone-900">{log.action}</span>
                  <span className="text-[9px] text-stone-400 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">{log.details}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout & Reset */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out from Vault</span>
        </button>

        {!showConfirmReset ? (
          <button
            onClick={() => setShowConfirmReset(true)}
            className="w-full py-2.5 text-rose-700 hover:text-rose-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Vault to Clean State</span>
          </button>
        ) : (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 text-center">
            <p className="text-xs text-rose-900 font-bold">
              Are you sure? This erases all data back to zero.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleResetVault}
                className="flex-1 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs"
              >
                Yes, Erase
              </button>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 rounded-xl bg-stone-200 text-stone-800 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
