import React, { useState } from 'react';
import { 
  BookOpen, 
  Lock, 
  Unlock, 
  Mic, 
  Square, 
  Plus, 
  Trash2, 
  Calendar,
  X,
  CheckCircle2
} from 'lucide-react';
import { VaultState, PersonalDiaryEntry, FinancialDiaryEntry } from '../../types';
import { storageService } from '../../services/storage';

interface MobileDiaryScreenProps {
  state: VaultState;
  initialSubtab?: string;
}

type DiaryTab = 'personal' | 'financial';

export const MobileDiaryScreen: React.FC<MobileDiaryScreenProps> = ({
  state,
  initialSubtab = 'personal'
}) => {
  const personalDiary = state?.personalDiary || [];
  const financialDiary = state?.financialDiary || [];

  const [subtab, setSubtab] = useState<DiaryTab>((initialSubtab as DiaryTab) || 'personal');
  const [modalType, setModalType] = useState<'NONE' | 'PERSONAL' | 'FINANCIAL'>('NONE');

  // Form states - ZERO PREFILLED DATA
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalContent, setPersonalContent] = useState('');
  const [isEmergencyShared, setIsEmergencyShared] = useState(false);
  const [personalCategory, setPersonalCategory] = useState<'PERSONAL_THOUGHT' | 'INSTRUCTION' | 'PRIVATE_NOTE'>('PERSONAL_THOUGHT');

  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Financial Directive Form State
  const [financialTitle, setFinancialTitle] = useState('');
  const [financialInstructions, setFinancialInstructions] = useState('');
  const [financialCategory, setFinancialCategory] = useState<'PAYMENT_NOTE' | 'INHERITANCE_INSTRUCTION' | 'LENDING_CONTEXT' | 'FUTURE_PLAN'>('INHERITANCE_INSTRUCTION');

  const handleSavePersonalNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalTitle.trim() || !personalContent.trim()) return;

    const newNote: PersonalDiaryEntry = {
      id: `pnote-${Date.now()}`,
      title: personalTitle.trim(),
      content: personalContent.trim(),
      is_emergency_shared: isEmergencyShared,
      category: personalCategory,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      personalDiary: [newNote, ...(prev.personalDiary || [])],
    }));
    storageService.logAudit(
      'ADD_PERSONAL_NOTE',
      state.user?.full_name || 'Owner',
      `Created note: ${personalTitle} (Emergency Access: ${isEmergencyShared ? 'ENABLED' : 'PRIVATE ONLY'})`
    );

    setPersonalTitle('');
    setPersonalContent('');
    setIsEmergencyShared(false);
    setModalType('NONE');
  };

  const handleSaveFinancialInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!financialTitle.trim() || !financialInstructions.trim()) return;

    const newEntry: FinancialDiaryEntry = {
      id: `fnote-${Date.now()}`,
      title: financialTitle.trim(),
      instructions: financialInstructions.trim(),
      category: financialCategory,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      financialDiary: [newEntry, ...(prev.financialDiary || [])],
    }));
    storageService.logAudit(
      'ADD_FINANCIAL_INSTRUCTION',
      state.user?.full_name || 'Owner',
      `Saved directive: ${financialTitle}`
    );

    setFinancialTitle('');
    setFinancialInstructions('');
    setModalType('NONE');
  };

  const handleDeletePersonalNote = (id: string) => {
    storageService.updateState((prev) => ({
      ...prev,
      personalDiary: (prev.personalDiary || []).filter(n => n.id !== id),
    }));
  };

  const handleDeleteFinancialNote = (id: string) => {
    storageService.updateState((prev) => ({
      ...prev,
      financialDiary: (prev.financialDiary || []).filter(n => n.id !== id),
    }));
  };

  const handleToggleEmergencyShare = (id: string) => {
    storageService.updateState((prev) => ({
      ...prev,
      personalDiary: (prev.personalDiary || []).map(n => 
        n.id === id ? { ...n, is_emergency_shared: !n.is_emergency_shared } : n
      ),
    }));
  };

  const handleToggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordDuration(0);
      const interval = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 60) {
            clearInterval(interval);
            setIsRecording(false);
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setIsRecording(false);
      if (recordDuration > 2) {
        setPersonalContent((prev) => 
          prev ? `${prev}\n[Voice Letter: 0:${recordDuration.toString().padStart(2, '0')}]` : `[Voice Letter: 0:${recordDuration.toString().padStart(2, '0')}]`
        );
      }
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Subtab Switcher */}
      <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-[11px]">
        <button
          onClick={() => setSubtab('personal')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            subtab === 'personal' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Personal Diary ({personalDiary.length})
        </button>
        <button
          onClick={() => setSubtab('financial')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            subtab === 'financial' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Financial Directives ({financialDiary.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. PERSONAL DIARY TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'personal' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-800" />
              <span className="text-stone-700 font-medium">Confidential · Private by default</span>
            </div>
            <button
              onClick={() => setModalType('PERSONAL')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Write Note</span>
            </button>
          </div>

          {personalDiary.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <BookOpen className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">Your personal diary is empty</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Record legacy messages, letters to children, or confidential thoughts. Each note can be marked private or emergency-shared.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {personalDiary.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">{note.title}</h4>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleEmergencyShare(note.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all ${
                          note.is_emergency_shared
                            ? 'bg-amber-50 text-amber-900 border border-amber-300'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                        title="Toggle Emergency Sharing"
                      >
                        {note.is_emergency_shared ? (
                          <>
                            <Unlock className="w-3 h-3 text-amber-700" />
                            <span>Shared in Emergency</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-emerald-800" />
                            <span>Private Only</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeletePersonalNote(note.id)}
                        className="p-1 text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. FINANCIAL DIRECTIVES TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'financial' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Directives & Account Directives
            </h3>
            <button
              onClick={() => setModalType('FINANCIAL')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Directive</span>
            </button>
          </div>

          {financialDiary.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <BookOpen className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No financial instructions recorded</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Leave precise directions for bank locker keys, demat succession, business shares, or confidential settlements.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {financialDiary.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">{item.title}</h4>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                        {item.category.replace('_', ' ')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteFinancialNote(item.id)}
                      className="p-1 text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {item.instructions}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL */}
      {/* ------------------------------------------------------------- */}
      {modalType !== 'NONE' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                {modalType === 'PERSONAL' && 'New Personal Diary Note'}
                {modalType === 'FINANCIAL' && 'New Financial Directive'}
              </h3>
              <button onClick={() => setModalType('NONE')} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalType === 'PERSONAL' && (
              <form onSubmit={handleSavePersonalNote} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={personalTitle}
                    onChange={(e) => setPersonalTitle(e.target.value)}
                    placeholder="e.g. Letter to Children, Private Thoughts"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Note Content</label>
                  <textarea
                    rows={4}
                    value={personalContent}
                    onChange={(e) => setPersonalContent(e.target.value)}
                    placeholder="Write your note here..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 leading-relaxed shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleRecording}
                      className={`p-2 rounded-xl transition-all ${
                        isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                      }`}
                    >
                      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <div>
                      <span className="text-xs font-semibold text-stone-800">
                        {isRecording ? `Recording... 0:${recordDuration.toString().padStart(2, '0')}` : 'Record Voice Note'}
                      </span>
                      <p className="text-[10px] text-stone-500">Attach audio transcription</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      Emergency Nominee Access
                    </span>
                    <span className="text-[10px] text-stone-500">
                      When enabled, verified nominees can read this during an active emergency.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEmergencyShared}
                    onChange={(e) => setIsEmergencyShared(e.target.checked)}
                    className="w-5 h-5 accent-emerald-800 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Note
                </button>
              </form>
            )}

            {modalType === 'FINANCIAL' && (
              <form onSubmit={handleSaveFinancialInstruction} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={financialCategory}
                    onChange={(e) => setFinancialCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  >
                    <option value="INHERITANCE_INSTRUCTION">Inheritance & Asset Succession</option>
                    <option value="PAYMENT_NOTE">Critical Account Settlement</option>
                    <option value="LENDING_CONTEXT">Informal Debt / Money Guidance</option>
                    <option value="FUTURE_PLAN">Family Continuity Directive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Directive Title</label>
                  <input
                    type="text"
                    value={financialTitle}
                    onChange={(e) => setFinancialTitle(e.target.value)}
                    placeholder="e.g. Demat Account Nominee & Locker Access"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Instructions</label>
                  <textarea
                    rows={4}
                    value={financialInstructions}
                    onChange={(e) => setFinancialInstructions(e.target.value)}
                    placeholder="Enter confidential instructions..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 leading-relaxed shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Directive
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
