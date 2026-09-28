import React, { useState, useEffect } from 'react';
import { AndroidFrame } from './components/mobile/AndroidFrame';
import { MobileAuthScreen } from './components/auth/MobileAuthScreen';
import { MobileHomeScreen } from './components/dashboard/MobileHomeScreen';
import { MobileFinanceScreen } from './components/finance/MobileFinanceScreen';
import { MobileImportantScreen } from './components/important/MobileImportantScreen';
import { MobileDiaryScreen } from './components/diary/MobileDiaryScreen';
import { MobileNomineeScreen } from './components/nominee/MobileNomineeScreen';
import { MobileProfileScreen } from './components/profile/MobileProfileScreen';
import { MobileVoiceAssistant } from './components/voice/MobileVoiceAssistant';
import { MobileCheckinScreen } from './components/checkin/MobileCheckinScreen';
import { MobileNomineePortal } from './components/emergency/MobileNomineePortal';
import { SmsHistoryModal } from './components/common/SmsHistoryModal';
import { storageService } from './services/storage';
import { VaultState, User, Nominee, Language } from './types';

export default function App() {
  const [state, setState] = useState<VaultState>(storageService.getState());
  const [activeTab, setActiveTab] = useState<string>('home');
  const [activeSubtab, setActiveSubtab] = useState<string | undefined>(undefined);
  
  // Nominee session state if logged in as Nominee
  const [activeNomineeSession, setActiveNomineeSession] = useState<{
    nominee: Nominee;
    ownerEfid: string;
    sessionToken?: string;
    permittedDocs?: any[];
    permittedVault?: any;
  } | null>(null);

  // Modals
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [isSmsHistoryOpen, setIsSmsHistoryOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setState({ ...storageService.getState() });
    });
    return unsubscribe;
  }, []);

  const handleLanguageChange = (lang: Language) => {
    storageService.updateState((prev) => ({
      ...prev,
      language: lang,
    }));
  };

  const handleUserLoginSuccess = (user: User) => {
    setActiveTab('home');
  };

  const handleNomineeLoginSuccess = (
    nominee: Nominee,
    ownerEfid: string,
    sessionToken?: string,
    permittedDocs?: any[],
    permittedVault?: any
  ) => {
    setActiveNomineeSession({
      nominee,
      ownerEfid,
      sessionToken,
      permittedDocs,
      permittedVault,
    });
    setActiveTab('nominee_portal');
  };

  const handleLogout = () => {
    storageService.logout();
    setActiveNomineeSession(null);
    setActiveTab('home');
  };

  const handleNavigate = (tab: string, subtab?: string) => {
    setActiveTab(tab);
    setActiveSubtab(subtab);
  };

  // Determine if user or nominee is logged in
  const isAuthenticated = Boolean(state.user || activeNomineeSession);

  return (
    <AndroidFrame
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setActiveSubtab(undefined);
      }}
      currentUser={state.user}
      language={state.language}
      onLanguageChange={handleLanguageChange}
      onOpenVoice={() => setIsVoiceOpen(true)}
      onOpenSmsLogs={() => setIsSmsHistoryOpen(true)}
      onLogout={handleLogout}
      state={state}
      isNomineeView={Boolean(activeNomineeSession)}
    >
      {/* If not logged in, render Mobile Auth Screen inside phone */}
      {!isAuthenticated ? (
        <MobileAuthScreen
          onLoginSuccess={handleUserLoginSuccess}
          onNomineeLoginSuccess={handleNomineeLoginSuccess}
        />
      ) : activeNomineeSession ? (
        /* If logged in as Nominee, render the restricted Nominee Portal */
        <MobileNomineePortal
          state={activeNomineeSession.permittedVault || state}
          activeNominee={activeNomineeSession.nominee}
          ownerEfid={activeNomineeSession.ownerEfid}
          sessionToken={activeNomineeSession.sessionToken}
          permittedDocuments={activeNomineeSession.permittedDocs}
          activeTab={activeTab}
          onLogout={handleLogout}
        />
      ) : (
        /* If logged in as Vault Owner, render active tab */
        <>
          {activeTab === 'home' && (
            <MobileHomeScreen
              state={state}
              language={state.language}
              onNavigate={handleNavigate}
              onOpenCheckin={() => setIsCheckinOpen(true)}
            />
          )}

          {activeTab === 'vault' && (
            <MobileFinanceScreen
              state={state}
              initialSubtab={activeSubtab}
            />
          )}

          {activeTab === 'assets' && (
            <MobileImportantScreen
              state={state}
              initialSubtab={activeSubtab}
            />
          )}

          {activeTab === 'diary' && (
            <MobileDiaryScreen
              state={state}
              initialSubtab={activeSubtab}
            />
          )}

          {activeTab === 'nominee' && (
            <MobileNomineeScreen
              state={state}
              onOpenCheckin={() => setIsCheckinOpen(true)}
            />
          )}

          {activeTab === 'profile' && (
            <MobileProfileScreen
              state={state}
              onLogout={handleLogout}
              onOpenSmsHistory={() => setIsSmsHistoryOpen(true)}
            />
          )}
        </>
      )}

      {/* Floating Talk to LIFORA Modal */}
      {isVoiceOpen && (
        <MobileVoiceAssistant
          state={state}
          currentLanguage={state.language}
          onClose={() => setIsVoiceOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      {/* Safety Checkin Modal */}
      {isCheckinOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <MobileCheckinScreen
              state={state}
              onClose={() => setIsCheckinOpen(false)}
            />
          </div>
        </div>
      )}

      {/* SMS Gateway History Drawer */}
      {isSmsHistoryOpen && (
        <SmsHistoryModal onClose={() => setIsSmsHistoryOpen(false)} />
      )}
    </AndroidFrame>
  );
}
