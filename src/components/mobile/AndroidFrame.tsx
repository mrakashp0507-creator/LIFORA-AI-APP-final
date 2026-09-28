import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Battery, 
  Signal, 
  Shield, 
  Copy, 
  Check, 
  MessageSquare, 
  Mic, 
  Home, 
  CreditCard, 
  Building, 
  BookOpen, 
  Users, 
  Smartphone, 
  Maximize2,
  X,
  User as UserIcon,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { Language, User, VaultState } from '../../types';
import { smsNotificationService, IncomingSms } from '../../services/smsSimulator';

interface AndroidFrameProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User | null;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenVoice: () => void;
  onOpenSmsLogs: () => void;
  onLogout?: () => void;
  state: VaultState;
  isNomineeView?: boolean;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({
  children,
  activeTab,
  onTabChange,
  currentUser,
  language,
  onLanguageChange,
  onOpenVoice,
  onOpenSmsLogs,
  onLogout,
  state,
  isNomineeView = false
}) => {
  const [currentTime, setCurrentTime] = useState<string>('09:41');
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(true);
  const [incomingBanner, setIncomingBanner] = useState<IncomingSms | null>(null);
  const [copiedEfid, setCopiedEfid] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = smsNotificationService.subscribe((sms) => {
      setIncomingBanner(sms);
      const timeout = setTimeout(() => {
        setIncomingBanner((curr) => (curr?.id === sms.id ? null : curr));
      }, 7000);
      return () => clearTimeout(timeout);
    });
    return unsubscribe;
  }, []);

  const handleCopyEfid = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser?.efid) {
      navigator.clipboard.writeText(currentUser.efid);
      setCopiedEfid(true);
      setTimeout(() => setCopiedEfid(false), 2000);
    }
  };

  const handleCopyOtp = (otp?: string) => {
    if (otp) {
      navigator.clipboard.writeText(otp);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const confirmLogoutAction = () => {
    setShowLogoutModal(false);
    if (onLogout) {
      onLogout();
    }
  };

  const navItems = isNomineeView
    ? [
        { id: 'nominee_portal', label: 'Nominee Vault', icon: Users },
        { id: 'profile', label: 'Session Details', icon: Shield }
      ]
    : [
        { id: 'home', label: 'Overview', icon: Home },
        { id: 'vault', label: 'Finances', icon: CreditCard },
        { id: 'assets', label: 'Assets & Docs', icon: Building },
        { id: 'diary', label: 'Diary', icon: BookOpen },
        { id: 'nominee', label: 'Nominees', icon: Users },
        { id: 'profile', label: 'Profile', icon: UserIcon },
      ];

  const isLoggedIn = Boolean(currentUser || isNomineeView);

  return (
    <div className="min-h-screen bg-stone-900 text-stone-900 flex flex-col items-center justify-start p-0 sm:py-6 selection:bg-emerald-100 selection:text-emerald-900 antialiased font-sans">
      {/* Desktop Helper Toggle */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-[420px] px-3.5 py-1.5 mb-2.5 text-xs text-stone-400 bg-stone-800/90 rounded-full border border-stone-700/60 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-medium text-stone-300">
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Android Mobile Preview</span>
        </div>
        <button
          onClick={() => setDeviceFrameMode(!deviceFrameMode)}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors"
        >
          <Maximize2 className="w-3 h-3" />
          <span>{deviceFrameMode ? 'Device Frame' : 'Full Screen'}</span>
        </button>
      </div>

      {/* Android Device Body */}
      <div
        className={`w-full transition-all duration-300 flex flex-col ${
          deviceFrameMode
            ? 'sm:max-w-[412px] sm:rounded-[44px] sm:border-[9px] sm:border-stone-800 sm:shadow-[0_20px_60px_rgba(0,0,0,0.65)] relative overflow-hidden bg-[#F8F9FA]'
            : 'max-w-md w-full bg-[#F8F9FA] min-h-screen relative'
        }`}
      >
        {/* Punch Hole Camera Cutout */}
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none flex flex-col items-center pt-2">
          <div className="w-3.5 h-3.5 rounded-full bg-stone-900 border border-stone-800 shadow-inner flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-stone-950"></div>
          </div>
        </div>

        {/* Android Natural Status Bar */}
        <div className="relative z-40 bg-[#F8F9FA] px-6 pt-2 pb-1.5 flex items-center justify-between text-xs text-stone-700 select-none border-b border-stone-200/60">
          <div className="font-semibold text-[13px] text-stone-900 tracking-tight flex items-center gap-1.5">
            <span>{currentTime}</span>
            {currentUser?.is_verified && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            )}
          </div>
          <div className="flex items-center gap-2 text-stone-600">
            <Signal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold tracking-wider">5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] font-semibold text-stone-800">98%</span>
              <Battery className="w-4 h-4 text-stone-800" />
            </div>
          </div>
        </div>

        {/* Incoming Android SMS Push Notification Banner */}
        {incomingBanner && (
          <div className="absolute top-10 left-3 right-3 z-50 animate-in slide-in-from-top duration-300">
            <div className="bg-white border border-stone-300/80 shadow-[0_12px_32px_rgba(0,0,0,0.18)] rounded-2xl p-3 text-stone-900">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                      <span>{incomingBanner.sender}</span>
                      <span className="text-[10px] text-stone-400 font-normal">· {incomingBanner.timestamp}</span>
                    </div>
                    <p className="text-xs text-stone-700 font-sans mt-0.5 leading-snug line-clamp-2">
                      {incomingBanner.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIncomingBanner(null)}
                  className="text-stone-400 hover:text-stone-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {incomingBanner.otp && (
                <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-stone-500 font-medium">OTP Code:</span>
                    <span className="text-sm font-bold tracking-widest text-emerald-800 font-mono bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      {incomingBanner.otp}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyOtp(incomingBanner.otp)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-[11px] transition-all"
                    >
                      {copiedOtp ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOtp ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleCopyOtp(incomingBanner.otp);
                        // Trigger custom event for instant auto-fill across inputs
                        window.dispatchEvent(
                          new CustomEvent('lifora_autofill_otp', { detail: { otp: incomingBanner.otp } })
                        );
                        setIncomingBanner(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] shadow-sm transition-all active:scale-95"
                    >
                      <span>Auto-Fill</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clean Natural App Header */}
        <header className="bg-white/95 backdrop-blur-md px-4 py-2.5 border-b border-stone-200 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-sm">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-stone-900">
                  LIFORA
                </span>
                {currentUser && (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    · Vault
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 font-normal">
                Life Continuity Vault
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language Selector */}
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 text-[10px] border border-stone-200">
              <button
                onClick={() => onLanguageChange('en')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                  language === 'en' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onLanguageChange('ta')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                  language === 'ta' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                தமிழ்
              </button>
              <button
                onClick={() => onLanguageChange('tanglish')}
                className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                  language === 'tanglish' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Tanglish
              </button>
            </div>

            {/* Voice Assistant Mic Trigger */}
            <button
              onClick={onOpenVoice}
              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
              title="Voice Assistant"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>

            {/* SMS Gateway Tray Trigger */}
            <button
              onClick={onOpenSmsLogs}
              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
              title="SMS Messages"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            {/* Small Logout Icon Button */}
            {isLoggedIn && onLogout && (
              <button
                onClick={() => setShowLogoutModal(true)}
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-600 border border-stone-200 hover:border-rose-200 transition-colors"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* E-FID Bar (Natural Clean Strip) */}
        {currentUser && (
          <div className="bg-[#EEF2F0] px-4 py-1.5 border-b border-stone-200/80 flex items-center justify-between text-xs text-stone-700">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-800" />
              <span className="text-[11px] text-stone-600 font-medium">LIFORA ID:</span>
              <span className="font-mono font-bold text-stone-900 text-[11px]">
                {currentUser.efid}
              </span>
            </div>
            <button
              onClick={handleCopyEfid}
              className="text-[10px] text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1"
            >
              {copiedEfid ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedEfid ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* Main Viewport Content Area */}
        <main className="flex-1 min-h-[calc(100vh-140px)] sm:min-h-[620px] sm:max-h-[660px] overflow-y-auto overflow-x-hidden bg-[#F8F9FA] pb-20 scrollbar-none">
          {children}
        </main>

        {/* Material You Bottom Navigation Bar */}
        {isLoggedIn && (
          <nav className="fixed sm:absolute bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-1 pt-1 pb-3 flex flex-col items-center shadow-xs">
            <div className="w-full flex items-center justify-around">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex flex-col items-center justify-center py-1 px-1.5 transition-colors ${
                      isActive ? 'text-stone-950' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    <div
                      className={`w-9 h-6 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-900 font-bold'
                          : 'bg-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[9px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-stone-950' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Android Gesture Bar */}
            <div className="w-28 h-1 bg-stone-300 rounded-full mt-2"></div>
          </nav>
        )}

        {/* LOGOUT CONFIRMATION MODAL */}
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-white border border-stone-200 rounded-2xl p-5 shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <LogOut className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Sign out from LIFORA?
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  You will be logged out of your session. You can sign back in anytime with your credentials.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmLogoutAction}
                  className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs shadow-xs transition-all active:scale-95"
                >
                  Yes, Log Out
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
