import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Send,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  ChevronRight,
  Filter,
  X,
  RefreshCw,
  Eye,
  FileText,
  CreditCard,
  Lock,
  PauseCircle,
  PlayCircle,
  History
} from 'lucide-react';
import { VaultState, DueDateRecord, DueDateCategory, ReminderRecipientType, SmsReminderLog, Nominee } from '../../types';
import { storageService } from '../../services/storage';

interface MobileDueDatesViewProps {
  state: VaultState;
  onNavigateToCategory?: (category: string) => void;
}

export const MobileDueDatesView: React.FC<MobileDueDatesViewProps> = ({ state }) => {
  const [filter, setFilter] = useState<'ALL' | 'EMI' | 'LOAN' | 'INSURANCE' | 'DOCUMENT_EXPIRY' | 'OTHER_COMMITMENT'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DueDateRecord | null>(null);
  
  // History Modal
  const [selectedRecordForLogs, setSelectedRecordForLogs] = useState<DueDateRecord | null>(null);
  const [reminderLogs, setReminderLogs] = useState<SmsReminderLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [recordType, setRecordType] = useState<DueDateCategory>('EMI');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remind7, setRemind7] = useState(true);
  const [remind3, setRemind3] = useState(true);
  const [remind1, setRemind1] = useState(true);
  const [recipient, setRecipient] = useState<ReminderRecipientType>('OWNER_ONLY');
  const [selectedNomineeId, setSelectedNomineeId] = useState('');
  const [nomineeConsent, setNomineeConsent] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Test SMS State
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [schedulerNotice, setSchedulerNotice] = useState<string | null>(null);

  const dueDates = state?.dueDates || [];
  const nominees = state?.nominees || [];
  const verifiedNominees = nominees.filter((n) => n?.is_phone_verified || n?.status === 'VERIFIED');

  useEffect(() => {
    // Refresh due dates from backend on mount
    storageService.fetchDueDates();
  }, []);

  // Calculate today's date in Asia/Kolkata (IST)
  const getTodayIST = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  };

  const todayIST = getTodayIST();

  const getDaysRemaining = (dueDateStr: string): number => {
    if (!dueDateStr) return 0;
    const [dy, dm, dd] = dueDateStr.split('-').map(Number);
    const [ty, tm, td] = todayIST.split('-').map(Number);
    const dueUtc = Date.UTC(dy, dm - 1, dd);
    const todayUtc = Date.UTC(ty, tm - 1, td);
    return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
  };

  const calculateReminders = (dueDateStr: string, intervals: number[]) => {
    if (!dueDateStr) return [];
    const [dy, dm, dd] = dueDateStr.split('-').map(Number);
    return intervals.map((interval) => {
      const d = new Date(Date.UTC(dy, dm - 1, dd));
      d.setUTCDate(d.getUTCDate() - interval);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return { interval, dateStr: `${y}-${m}-${day}` };
    });
  };

  const openAddModal = (initialCategory: DueDateCategory = 'EMI', initialTitle = '', initialDate = '', initialAmt = '') => {
    setEditingRecord(null);
    setTitle(initialTitle);
    setRecordType(initialCategory);
    setAmount(initialAmt);
    setDueDate(initialDate);
    setRemind7(true);
    setRemind3(true);
    setRemind1(true);
    setRecipient('OWNER_ONLY');
    setSelectedNomineeId(verifiedNominees[0]?.id || '');
    setNomineeConsent(false);
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (rec: DueDateRecord) => {
    setEditingRecord(rec);
    setTitle(rec.title);
    setRecordType(rec.record_type);
    setAmount(rec.amount ? rec.amount.toString() : '');
    setDueDate(rec.due_date);
    setRemind7(rec.reminder_intervals.includes(7));
    setRemind3(rec.reminder_intervals.includes(3));
    setRemind1(rec.reminder_intervals.includes(1));
    setRecipient(rec.recipients);
    setSelectedNomineeId(rec.nominee_id || verifiedNominees[0]?.id || '');
    setNomineeConsent(rec.nominee_consent_granted);
    setNotes(rec.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setFormError('Please enter a title and select a due date.');
      return;
    }

    const intervals: number[] = [];
    if (remind7) intervals.push(7);
    if (remind3) intervals.push(3);
    if (remind1) intervals.push(1);

    if (intervals.length === 0) {
      setFormError('Please select at least one reminder interval (e.g. 7, 3, or 1 day before).');
      return;
    }

    if ((recipient === 'AUTHORIZED_NOMINEE' || recipient === 'BOTH') && !nomineeConsent) {
      setFormError('Owner consent required: You must check the authorization box to enable nominee reminders.');
      return;
    }

    const targetNominee = nominees.find((n) => n.id === selectedNomineeId);

    const payload = {
      record_type: recordType,
      title: title.trim(),
      amount: recordType === 'DOCUMENT_EXPIRY' ? null : (amount ? parseFloat(amount) : null),
      due_date: dueDate,
      reminder_intervals: intervals,
      recipients: recipient,
      nominee_id: targetNominee?.id,
      nominee_name: targetNominee?.name,
      nominee_mobile: targetNominee?.mobile_number,
      nominee_consent_granted: (recipient === 'AUTHORIZED_NOMINEE' || recipient === 'BOTH') ? nomineeConsent : false,
      notes: notes.trim(),
    };

    if (editingRecord) {
      await storageService.updateDueDate(editingRecord.id, payload);
    } else {
      await storageService.createDueDate(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this due-date reminder? Future SMS notifications for this item will be stopped.')) {
      await storageService.deleteDueDate(id);
    }
  };

  const handleTogglePause = async (rec: DueDateRecord) => {
    const nextStatus = rec.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await storageService.updateDueDate(rec.id, { status: nextStatus });
  };

  const handleTestSms = async (id: string, targetRecipient?: 'OWNER' | 'NOMINEE') => {
    setTestingId(id);
    setTestResult(null);
    const res = await storageService.testSendDueDateSms(id, targetRecipient);
    setTestingId(null);
    setTestResult({
      id,
      success: res.success,
      message: res.message,
    });
    setTimeout(() => {
      setTestResult(null);
    }, 6000);
  };

  const handleViewLogs = async (rec: DueDateRecord) => {
    setSelectedRecordForLogs(rec);
    setIsLoadingLogs(true);
    const logs = await storageService.getDueDateLogs(rec.id);
    setReminderLogs(logs);
    setIsLoadingLogs(false);
  };

  const handleRunScheduler = async () => {
    setIsRunningScheduler(true);
    setSchedulerNotice(null);
    const res = await storageService.triggerSchedulerCheck();
    setIsRunningScheduler(false);
    if (res.success && res.summary) {
      setSchedulerNotice(
        `Scheduler check finished: ${res.summary.dispatchedCount} SMS dispatched, ${res.summary.skippedCount} skipped, ${res.summary.failedCount} failed.`
      );
    } else {
      setSchedulerNotice(res.message || 'Scheduler check completed.');
    }
    setTimeout(() => setSchedulerNotice(null), 7000);
  };

  // Filtered & Sorted due dates (nearest due dates first)
  const filteredDueDates = dueDates
    .filter((d) => (filter === 'ALL' ? true : d.record_type === filter))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // Category Icon helper
  const getCategoryBadge = (type: DueDateCategory) => {
    switch (type) {
      case 'EMI':
        return <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">EMI</span>;
      case 'LOAN':
        return <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">Loan</span>;
      case 'INSURANCE':
        return <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">Insurance</span>;
      case 'DOCUMENT_EXPIRY':
        return <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">Document Expiry</span>;
      case 'OTHER_COMMITMENT':
        return <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded border border-stone-200">Commitment</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Control */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Automatic Due-Date & Expiry SMS Reminders
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Real MSG91 SMS dispatched 7d, 3d, & 1d before due dates.
              </p>
            </div>
          </div>
          <button
            onClick={() => openAddModal()}
            className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Reminder</span>
          </button>
        </div>

        {/* Scheduler Status Bar */}
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-stone-500">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>Timezone: <strong>Asia/Kolkata (IST)</strong> · Today: {todayIST}</span>
          </div>
          <button
            onClick={handleRunScheduler}
            disabled={isRunningScheduler}
            className="text-emerald-800 hover:text-emerald-900 font-semibold flex items-center gap-1 disabled:opacity-50"
            title="Evaluate reminders and trigger scheduled SMS immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningScheduler ? 'animate-spin' : ''}`} />
            <span>{isRunningScheduler ? 'Checking...' : 'Check & Run Now'}</span>
          </button>
        </div>

        {schedulerNotice && (
          <div className="mt-2.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{schedulerNotice}</span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-[11px] overflow-x-auto scrollbar-none">
        {(['ALL', 'EMI', 'LOAN', 'INSURANCE', 'DOCUMENT_EXPIRY'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              filter === tab ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab === 'ALL'
              ? `All (${dueDates.length})`
              : tab === 'DOCUMENT_EXPIRY'
              ? 'Doc Expiry'
              : tab}
          </button>
        ))}
      </div>

      {/* Quick import helpers if user has existing loans/insurance/docs without reminders */}
      {dueDates.length === 0 && (state.loans?.length > 0 || state.insurance?.length > 0 || state.documents?.length > 0) && (
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>Quick Sync From Your Vault</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            You have items in your vault that can be protected with automated SMS reminders.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {state.loans?.slice(0, 2).map((l) => (
              <button
                key={l.id}
                onClick={() => openAddModal('LOAN', `${l.provider} Loan EMI`, '', l.emi_amount?.toString())}
                className="py-1 px-2.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold flex items-center gap-1 hover:bg-amber-100/50"
              >
                <Plus className="w-3 h-3" />
                <span>Add {l.provider} EMI</span>
              </button>
            ))}
            {state.insurance?.slice(0, 1).map((i) => (
              <button
                key={i.id}
                onClick={() => openAddModal('INSURANCE', `${i.provider} ${i.insurance_type} Renewal`, '', i.premium_amount?.toString())}
                className="py-1 px-2.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold flex items-center gap-1 hover:bg-amber-100/50"
              >
                <Plus className="w-3 h-3" />
                <span>Add {i.provider} Renewal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List of Due Dates */}
      {filteredDueDates.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
          <Calendar className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-stone-800">No due date reminders scheduled</p>
          <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
            Add recurring EMIs, loan payments, insurance renewals, or document expirations. You and your authorized nominee will receive SMS reminders.
          </p>
          <button
            onClick={() => openAddModal()}
            className="mt-3.5 py-1.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Reminder</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDueDates.map((rec) => {
            const daysRemaining = getDaysRemaining(rec.due_date);
            const calculated = calculateReminders(rec.due_date, rec.reminder_intervals);
            const isPaused = rec.status === 'PAUSED';

            let urgencyColor = 'bg-stone-100 text-stone-700 border-stone-200';
            if (daysRemaining <= 0) {
              urgencyColor = 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
            } else if (daysRemaining <= 3) {
              urgencyColor = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
            } else if (daysRemaining <= 7) {
              urgencyColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
            }

            return (
              <div
                key={rec.id}
                className={`p-4 rounded-2xl bg-white border ${isPaused ? 'border-stone-200 opacity-60' : 'border-stone-200'} shadow-xs space-y-3`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(rec.record_type)}
                      {isPaused && (
                        <span className="bg-stone-200 text-stone-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          PAUSED
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mt-1">
                      {rec.title}
                    </h4>
                    {rec.amount !== null && rec.amount !== undefined && (
                      <p className="text-xs font-mono font-bold text-stone-800 mt-0.5">
                        ₹{rec.amount.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-lg border ${urgencyColor}`}>
                      {daysRemaining === 0
                        ? 'DUE TODAY'
                        : daysRemaining < 0
                        ? `Overdue by ${Math.abs(daysRemaining)}d`
                        : daysRemaining === 1
                        ? 'Due tomorrow'
                        : `${daysRemaining} days left`}
                    </span>
                    <p className="text-[10px] text-stone-400 font-mono mt-1">
                      Due: {rec.due_date}
                    </p>
                  </div>
                </div>

                {/* Scheduled Reminder Dates Grid */}
                <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200/80 text-[11px] space-y-1.5">
                  <div className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>SMS Dispatch Schedule (Asia/Kolkata)</span>
                    <span className="font-normal text-stone-400">
                      Recipient: {rec.recipients === 'OWNER_ONLY' ? 'Owner Only' : rec.recipients === 'AUTHORIZED_NOMINEE' ? 'Nominee Only' : 'Owner & Nominee'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                    {calculated.map((c) => {
                      const isPast = c.dateStr <= todayIST;
                      return (
                        <div
                          key={c.interval}
                          className={`p-1.5 rounded-lg border text-[10px] ${
                            c.dateStr === todayIST
                              ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 font-bold'
                              : isPast
                              ? 'bg-stone-100 border-stone-200 text-stone-400'
                              : 'bg-white border-stone-200 text-stone-700'
                          }`}
                        >
                          <span className="block text-[9px] text-stone-500">{c.interval}d before</span>
                          <span>{c.dateStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Nominee Consent Badge */}
                {(rec.recipients === 'AUTHORIZED_NOMINEE' || rec.recipients === 'BOTH') && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-900">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                      <span>
                        Nominee: <strong>{rec.nominee_name || 'Designated Nominee'}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                      Consent Verified
                    </span>
                  </div>
                )}

                {/* Actions & Live Test */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePause(rec)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 text-[11px] font-medium flex items-center gap-1"
                      title={isPaused ? 'Resume Reminders' : 'Pause Reminders'}
                    >
                      {isPaused ? <PlayCircle className="w-3.5 h-3.5 text-emerald-700" /> : <PauseCircle className="w-3.5 h-3.5 text-amber-700" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      onClick={() => openEditModal(rec)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 text-[11px] font-medium flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleViewLogs(rec)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 text-[11px] font-medium flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Logs</span>
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                      title="Delete reminder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleTestSms(rec.id)}
                    disabled={testingId === rec.id}
                    className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                  >
                    <Send className={`w-3 h-3 ${testingId === rec.id ? 'animate-pulse' : ''}`} />
                    <span>{testingId === rec.id ? 'Sending...' : 'Test Send SMS'}</span>
                  </button>
                </div>

                {/* Immediate Feedback for Test SMS */}
                {testResult && testResult.id === rec.id && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border border-rose-200 text-rose-900'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">{testResult.message}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">
                        Recorded in persistent SMS audit logs.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ADD / EDIT DUE-DATE MODAL */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {editingRecord ? 'Edit Due-Date Reminder' : 'Schedule Due-Date SMS Reminder'}
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    Automatic SMS alerts via MSG91 before deadlines
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="py-4 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Commitment Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'EMI', label: 'EMI Payment' },
                      { id: 'LOAN', label: 'Loan Due' },
                      { id: 'INSURANCE', label: 'Insurance Premium' },
                      { id: 'DOCUMENT_EXPIRY', label: 'Document Expiry' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRecordType(cat.id)}
                      className={`p-2 rounded-xl border text-left font-medium transition-all ${
                        recordType === cat.id
                          ? 'border-emerald-800 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                          : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title / Name */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  {recordType === 'DOCUMENT_EXPIRY' ? 'Document Name' : 'Item Title / Provider'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    recordType === 'DOCUMENT_EXPIRY'
                      ? 'e.g. Passport, Driving License, Property Deed'
                      : 'e.g. HDFC Home Loan, LIC Jeevan Labh, Car EMI'
                  }
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-emerald-800 text-stone-900"
                />
              </div>

              {/* Amount (hidden for document expiry) */}
              {recordType !== 'DOCUMENT_EXPIRY' && (
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                    Amount (₹) <span className="font-normal text-stone-400 lowercase">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-emerald-800 text-stone-900 font-mono"
                  />
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  {recordType === 'DOCUMENT_EXPIRY' ? 'Expiration Date' : 'Payment Due Date'}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-emerald-800 text-stone-900 font-mono"
                />
              </div>

              {/* Reminder Intervals */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Reminder Intervals <span className="text-[10px] text-stone-400 font-normal">(Auto-calculated)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remind7}
                      onChange={(e) => setRemind7(e.target.checked)}
                      className="rounded text-emerald-800 focus:ring-emerald-800"
                    />
                    <span className="font-medium text-stone-800">7 Days Before</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remind3}
                      onChange={(e) => setRemind3(e.target.checked)}
                      className="rounded text-emerald-800 focus:ring-emerald-800"
                    />
                    <span className="font-medium text-stone-800">3 Days Before</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remind1}
                      onChange={(e) => setRemind1(e.target.checked)}
                      className="rounded text-emerald-800 focus:ring-emerald-800"
                    />
                    <span className="font-medium text-stone-800">1 Day Before</span>
                  </label>
                </div>
              </div>

              {/* Recipient Selection */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  SMS Recipient Policy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'OWNER_ONLY', label: 'Owner Only' },
                      { id: 'BOTH', label: 'Owner & Nominee' },
                      { id: 'AUTHORIZED_NOMINEE', label: 'Nominee Only' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecipient(r.id)}
                      className={`p-2 rounded-xl border text-center font-medium transition-all ${
                        recipient === r.id
                          ? 'border-emerald-800 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nominee Consent & Verification Section */}
              {(recipient === 'AUTHORIZED_NOMINEE' || recipient === 'BOTH') && (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Nominee Consent & Privacy Verification</span>
                  </div>

                  {nominees.length === 0 ? (
                    <p className="text-[11px] text-amber-800">
                      No nominees are registered in your vault. Please add and verify a nominee first.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-amber-900 mb-1">
                          Select Registered Nominee:
                        </label>
                        <select
                          value={selectedNomineeId}
                          onChange={(e) => setSelectedNomineeId(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-stone-900 font-medium"
                        >
                          {nominees.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name} ({n.relationship}) · {n.is_phone_verified ? '✓ Verified Phone' : '⚠️ Unverified Phone'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-start gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={nomineeConsent}
                          onChange={(e) => setNomineeConsent(e.target.checked)}
                          required
                          className="rounded text-emerald-800 focus:ring-emerald-800 mt-0.5"
                        />
                        <span className="text-[11px] text-amber-950 leading-snug">
                          <strong>I explicitly authorize LIFORA to send SMS notifications</strong> to this nominee. No sensitive passwords, account numbers, or CVVs will be transmitted.
                        </span>
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Notes <span className="font-normal text-stone-400 lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Deducted automatically from SBI Account"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-emerald-800 text-stone-900"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold shadow-xs active:scale-95 transition-all"
                >
                  {editingRecord ? 'Save Changes' : 'Schedule Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SMS DELIVERY LOGS MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedRecordForLogs && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  SMS Delivery History
                </h3>
                <p className="text-[10px] text-stone-500">
                  {selectedRecordForLogs.title} ({selectedRecordForLogs.due_date})
                </p>
              </div>
              <button onClick={() => setSelectedRecordForLogs(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {isLoadingLogs ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-300" />
                  <span>Loading delivery attempts...</span>
                </div>
              ) : reminderLogs.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  <Smartphone className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                  <p className="text-stone-700 font-semibold">No SMS reminders dispatched yet.</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Reminders trigger automatically 7d, 3d, and 1d before the due date, or via "Test Send SMS".
                  </p>
                </div>
              ) : (
                reminderLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900 text-[11px]">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            log.status === 'DELIVERED' ? 'bg-emerald-600' : log.status === 'SKIPPED' ? 'bg-amber-500' : 'bg-rose-600'
                          }`}
                        />
                        <span>{log.recipient_name} ({log.recipient_type})</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        log.status === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-900'
                          : log.status === 'SKIPPED'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}>
                        {log.status}
                      </span>
                    </div>

                    <p className="text-stone-700 font-mono text-[11px] leading-relaxed bg-white p-2 rounded-xl border border-stone-200/80">
                      {log.message_preview}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                      <span>To: {log.recipient_mobile_masked}</span>
                      <span>{new Date(log.dispatched_at).toLocaleString()}</span>
                    </div>

                    {log.error_message && (
                      <p className="text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setSelectedRecordForLogs(null)}
                className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
