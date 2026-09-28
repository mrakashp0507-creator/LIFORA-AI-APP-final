import React, { useState } from 'react';
import { 
  Landmark, 
  CreditCard, 
  Shield, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Trash2, 
  Calendar, 
  X, 
  Wallet,
  Clock,
  ChevronRight
} from 'lucide-react';
import { VaultState, BankAccount, Loan, EmiItem, InsurancePolicy, MoneyGiven, MoneyBorrowed } from '../../types';
import { storageService } from '../../services/storage';
import { MobileDueDatesView } from '../reminders/MobileDueDatesView';

interface MobileFinanceScreenProps {
  state: VaultState;
  initialSubtab?: string;
}

type FinanceTab = 'accounts' | 'loans' | 'insurance' | 'reminders' | 'ledger';

export const MobileFinanceScreen: React.FC<MobileFinanceScreenProps> = ({
  state,
  initialSubtab = 'accounts'
}) => {
  const [subtab, setSubtab] = useState<FinanceTab>(
    (initialSubtab as FinanceTab) || 'accounts'
  );

  const [modalType, setModalType] = useState<'NONE' | 'ACCOUNT' | 'LOAN' | 'INSURANCE' | 'MONEY_GIVEN' | 'MONEY_BORROWED'>('NONE');

  // Safe arrays
  const accounts = state?.accounts || [];
  const loans = state?.loans || [];
  const emis = state?.emis || [];
  const insurance = state?.insurance || [];
  const dueDates = state?.dueDates || [];
  const moneyGiven = state?.moneyGiven || [];
  const moneyBorrowed = state?.moneyBorrowed || [];

  // Form states - ZERO PREFILLED DATA
  const [bankName, setBankName] = useState('');
  const [accType, setAccType] = useState<'SAVINGS' | 'CURRENT' | 'SALARY' | 'FIXED_DEPOSIT' | 'OTHER'>('SAVINGS');
  const [maskedAcc, setMaskedAcc] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');

  // Loan state
  const [loanProvider, setLoanProvider] = useState('');
  const [loanType, setLoanType] = useState<'HOME_LOAN' | 'PERSONAL_LOAN' | 'AUTO_LOAN' | 'EDUCATION_LOAN' | 'GOLD_LOAN' | 'OTHER'>('HOME_LOAN');
  const [loanOriginalAmt, setLoanOriginalAmt] = useState('');
  const [loanOutstandingAmt, setLoanOutstandingAmt] = useState('');
  const [loanEmiAmt, setLoanEmiAmt] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');

  // Insurance state
  const [insProvider, setInsProvider] = useState('');
  const [insType, setInsType] = useState<'HEALTH' | 'LIFE' | 'TERM' | 'VEHICLE' | 'HOME' | 'OTHER'>('LIFE');
  const [insPolicyNo, setInsPolicyNo] = useState('');
  const [insPremium, setInsPremium] = useState('');
  const [insCoverage, setInsCoverage] = useState('');
  const [insRenewalDate, setInsRenewalDate] = useState('');

  // Money Given / Borrowed state
  const [personName, setPersonName] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState('');
  const [ledgerPurpose, setLedgerPurpose] = useState('');

  // Monthly EMI burden
  const totalMonthlyEmi = loans.reduce((acc, l) => acc + (l?.emi_amount || 0), 0) +
    emis.reduce((acc, e) => acc + (e?.amount || 0), 0);

  // Total Outstanding Debt
  const totalOutstanding = loans.reduce((acc, l) => acc + (l?.outstanding_amount || 0), 0);

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !maskedAcc.trim()) return;

    const newAcc: BankAccount = {
      id: `acc-${Date.now()}`,
      bank_name: bankName.trim(),
      account_type: accType,
      masked_account_number: maskedAcc.trim(),
      ifsc_code: ifsc.trim().toUpperCase(),
      branch: branch.trim(),
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      accounts: [newAcc, ...prev.accounts],
    }));
    storageService.logAudit('ADD_BANK_ACCOUNT', state.user?.full_name || 'Owner', `Added bank account: ${bankName}`);

    setBankName('');
    setMaskedAcc('');
    setIfsc('');
    setBranch('');
    setModalType('NONE');
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanProvider.trim() || !loanEmiAmt) return;

    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      provider: loanProvider.trim(),
      loan_type: loanType,
      original_amount: parseFloat(loanOriginalAmt) || 0,
      outstanding_amount: parseFloat(loanOutstandingAmt) || 0,
      emi_amount: parseFloat(loanEmiAmt) || 0,
      due_date: loanDueDate || '5th of every month',
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      loans: [newLoan, ...prev.loans],
    }));
    storageService.logAudit('ADD_LOAN', state.user?.full_name || 'Owner', `Added ${loanType}: ${loanProvider}`);

    setLoanProvider('');
    setLoanOriginalAmt('');
    setLoanOutstandingAmt('');
    setLoanEmiAmt('');
    setLoanDueDate('');
    setModalType('NONE');
  };

  const handleSaveInsurance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insProvider.trim() || !insPolicyNo.trim()) return;

    const newPolicy: InsurancePolicy = {
      id: `ins-${Date.now()}`,
      provider: insProvider.trim(),
      insurance_type: insType,
      policy_number_masked: insPolicyNo.trim(),
      premium_amount: parseFloat(insPremium) || 0,
      coverage_amount: parseFloat(insCoverage) || 0,
      renewal_date: insRenewalDate || 'Annual Renewal',
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      insurance: [newPolicy, ...prev.insurance],
    }));
    storageService.logAudit('ADD_INSURANCE', state.user?.full_name || 'Owner', `Added ${insType} policy: ${insProvider}`);

    setInsProvider('');
    setInsPolicyNo('');
    setInsPremium('');
    setInsCoverage('');
    setInsRenewalDate('');
    setModalType('NONE');
  };

  const handleSaveMoneyGiven = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !ledgerAmount) return;

    const entry: MoneyGiven = {
      id: `given-${Date.now()}`,
      person_or_org: personName.trim(),
      amount: parseFloat(ledgerAmount) || 0,
      date_given: ledgerDate || new Date().toISOString().split('T')[0],
      purpose: ledgerPurpose.trim(),
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      moneyGiven: [entry, ...prev.moneyGiven],
    }));
    storageService.logAudit('ADD_MONEY_GIVEN', state.user?.full_name || 'Owner', `Recorded receivable: ₹${ledgerAmount} to ${personName}`);

    setPersonName('');
    setLedgerAmount('');
    setLedgerDate('');
    setLedgerPurpose('');
    setModalType('NONE');
  };

  const handleSaveMoneyBorrowed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !ledgerAmount) return;

    const entry: MoneyBorrowed = {
      id: `borrowed-${Date.now()}`,
      person_or_org: personName.trim(),
      amount: parseFloat(ledgerAmount) || 0,
      date_borrowed: ledgerDate || new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      notes: ledgerPurpose.trim(),
      created_at: new Date().toISOString(),
    };

    storageService.updateState((prev) => ({
      ...prev,
      moneyBorrowed: [entry, ...prev.moneyBorrowed],
    }));
    storageService.logAudit('ADD_MONEY_BORROWED', state.user?.full_name || 'Owner', `Recorded payable: ₹${ledgerAmount} from ${personName}`);

    setPersonName('');
    setLedgerAmount('');
    setLedgerDate('');
    setLedgerPurpose('');
    setModalType('NONE');
  };

  const handleDeleteItem = (category: 'ACCOUNT' | 'LOAN' | 'INSURANCE' | 'GIVEN' | 'BORROWED', id: string) => {
    storageService.updateState((prev) => {
      switch (category) {
        case 'ACCOUNT':
          return { ...prev, accounts: prev.accounts.filter(a => a.id !== id) };
        case 'LOAN':
          return { ...prev, loans: prev.loans.filter(l => l.id !== id) };
        case 'INSURANCE':
          return { ...prev, insurance: prev.insurance.filter(i => i.id !== id) };
        case 'GIVEN':
          return { ...prev, moneyGiven: prev.moneyGiven.filter(g => g.id !== id) };
        case 'BORROWED':
          return { ...prev, moneyBorrowed: prev.moneyBorrowed.filter(b => b.id !== id) };
      }
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Monthly Financial Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs text-stone-500 mb-2 font-medium">
          <span>Monthly Liability Overview</span>
          <span>Active</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#FAFBFB] p-3 rounded-xl border border-stone-200/80">
            <span className="text-[10px] text-stone-500 uppercase font-semibold">
              Monthly EMI
            </span>
            <div className="text-xl font-bold text-stone-900 font-mono mt-0.5">
              ₹{totalMonthlyEmi.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-stone-400">
              {loans.length} active loans
            </span>
          </div>

          <div className="bg-[#FAFBFB] p-3 rounded-xl border border-stone-200/80">
            <span className="text-[10px] text-stone-500 uppercase font-semibold">
              Total Debt Balance
            </span>
            <div className="text-xl font-bold text-stone-900 font-mono mt-0.5">
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-stone-400">
              Principal outstanding
            </span>
          </div>
        </div>
      </div>

      {/* Subtab Segmented Switcher */}
      <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-[11px] overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubtab('accounts')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'accounts' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setSubtab('loans')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'loans' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Loans & EMI ({loans.length})
        </button>
        <button
          onClick={() => setSubtab('insurance')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'insurance' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Insurance ({insurance.length})
        </button>
        <button
          onClick={() => setSubtab('reminders')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'reminders' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Due Dates & SMS ({dueDates.length})
        </button>
        <button
          onClick={() => setSubtab('ledger')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            subtab === 'ledger' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          Lent / Borrowed
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. BANK ACCOUNTS TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'accounts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Bank Accounts & Deposits
            </h3>
            <button
              onClick={() => setModalType('ACCOUNT')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <Landmark className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No bank accounts linked yet</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Record your bank name, account type, and masked account number for family continuity.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{acc.bank_name}</h4>
                      <p className="text-[11px] font-mono text-stone-700 font-semibold mt-0.5">
                        A/C: •••• {(acc.masked_account_number || '').slice(-4)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500">
                        <span>{acc.account_type}</span>
                        {acc.ifsc_code && <span>· IFSC: {acc.ifsc_code}</span>}
                        {acc.branch && <span>· {acc.branch}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('ACCOUNT', acc.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. LOANS & EMIs TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'loans' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Active Loans & Monthly EMIs
            </h3>
            <button
              onClick={() => setModalType('LOAN')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Loan</span>
            </button>
          </div>

          {loans.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <CreditCard className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No active loans or EMIs recorded</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Track home loans, auto loans, personal loans, and their monthly deduction dates.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {loans.map((loan) => (
                <div
                  key={loan.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{loan.provider}</h4>
                      <p className="text-sm font-bold text-stone-900 font-mono mt-0.5">
                        ₹{(loan.emi_amount || 0).toLocaleString('en-IN')}{' '}
                        <span className="text-[10px] font-normal text-stone-500">/mo EMI</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500">
                        <span>{(loan.loan_type || '').replace('_', ' ')}</span>
                        <span>· Due: {loan.due_date}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1 font-mono">
                        Outstanding: ₹{(loan.outstanding_amount || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('LOAN', loan.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. INSURANCE TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'insurance' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Insurance Policies
            </h3>
            <button
              onClick={() => setModalType('INSURANCE')}
              className="py-1.5 px-3 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Policy</span>
            </button>
          </div>

          {insurance.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-dashed border-stone-300 text-center">
              <Shield className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-stone-800">No insurance policies recorded</p>
              <p className="text-[11px] text-stone-500 mt-1 max-w-xs mx-auto">
                Record life, health, term, and vehicle policies with renewal dates so protection never lapses.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {insurance.map((ins) => (
                <div
                  key={ins.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{ins.provider}</h4>
                      <p className="text-sm font-bold text-emerald-800 font-mono mt-0.5">
                        Coverage: ₹{(ins.coverage_amount || 0).toLocaleString('en-IN')}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500">
                        <span>{ins.insurance_type}</span>
                        <span>· Policy: •••• {(ins.policy_number_masked || '').slice(-4)}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Renewal: {ins.renewal_date} (Premium: ₹{(ins.premium_amount || 0).toLocaleString('en-IN')})</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteItem('INSURANCE', ins.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. LENT & BORROWED TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'ledger' && (
        <div className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-stone-800">
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Money Given to Others
                </h3>
              </div>
              <button
                onClick={() => setModalType('MONEY_GIVEN')}
                className="py-1 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold border border-stone-300"
              >
                + Add Given
              </button>
            </div>

            {moneyGiven.length === 0 ? (
              <p className="text-[11px] text-stone-500 italic p-3 rounded-xl bg-white border border-stone-200">
                No receivables recorded.
              </p>
            ) : (
              moneyGiven.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs shadow-xs"
                >
                  <div>
                    <h5 className="font-bold text-stone-900">{item.person_or_org}</h5>
                    <p className="text-[10px] text-stone-500 mt-0.5">{item.purpose || 'Personal Loan'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-800 text-sm">
                      ₹{(item.amount || 0).toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => handleDeleteItem('GIVEN', item.id)}
                      className="text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2.5 pt-2 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-stone-800">
                <ArrowDownLeft className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Money Borrowed from Others
                </h3>
              </div>
              <button
                onClick={() => setModalType('MONEY_BORROWED')}
                className="py-1 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold border border-stone-300"
              >
                + Add Borrowed
              </button>
            </div>

            {moneyBorrowed.length === 0 ? (
              <p className="text-[11px] text-stone-500 italic p-3 rounded-xl bg-white border border-stone-200">
                No payables recorded.
              </p>
            ) : (
              moneyBorrowed.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs shadow-xs"
                >
                  <div>
                    <h5 className="font-bold text-stone-900">{item.person_or_org}</h5>
                    <p className="text-[10px] text-stone-500 mt-0.5">{item.notes || 'Borrowed Amount'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-stone-900 text-sm">
                      ₹{(item.amount || 0).toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => handleDeleteItem('BORROWED', item.id)}
                      className="text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. DUE DATES & AUTOMATIC SMS REMINDERS TAB */}
      {/* ------------------------------------------------------------- */}
      {subtab === 'reminders' && (
        <MobileDueDatesView state={state} />
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL FOR ADDING ITEMS - CLEAN NATURAL FORM */}
      {/* ------------------------------------------------------------- */}
      {modalType !== 'NONE' && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                {modalType === 'ACCOUNT' && 'Add Bank Account'}
                {modalType === 'LOAN' && 'Add Loan / EMI'}
                {modalType === 'INSURANCE' && 'Add Insurance Policy'}
                {modalType === 'MONEY_GIVEN' && 'Record Money Given'}
                {modalType === 'MONEY_BORROWED' && 'Record Money Borrowed'}
              </h3>
              <button onClick={() => setModalType('NONE')} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account Form */}
            {modalType === 'ACCOUNT' && (
              <form onSubmit={handleSaveAccount} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India, HDFC Bank"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Account Type</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  >
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CURRENT">Current Account</option>
                    <option value="SALARY">Salary Account</option>
                    <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={maskedAcc}
                    onChange={(e) => setMaskedAcc(e.target.value)}
                    placeholder="Enter account number (or last 4 digits)"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Branch</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. Main Branch"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Bank Account
                </button>
              </form>
            )}

            {/* Loan Form */}
            {modalType === 'LOAN' && (
              <form onSubmit={handleSaveLoan} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Lender / Bank</label>
                  <input
                    type="text"
                    value={loanProvider}
                    onChange={(e) => setLoanProvider(e.target.value)}
                    placeholder="e.g. ICICI Bank, SBI, Tata Capital"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Loan Type</label>
                  <select
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  >
                    <option value="HOME_LOAN">Home Loan</option>
                    <option value="PERSONAL_LOAN">Personal Loan</option>
                    <option value="AUTO_LOAN">Auto / Car Loan</option>
                    <option value="EDUCATION_LOAN">Education Loan</option>
                    <option value="GOLD_LOAN">Gold Loan</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Original Amount (₹)</label>
                    <input
                      type="number"
                      value={loanOriginalAmt}
                      onChange={(e) => setLoanOriginalAmt(e.target.value)}
                      placeholder="e.g. 5000000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Outstanding Balance (₹)</label>
                    <input
                      type="number"
                      value={loanOutstandingAmt}
                      onChange={(e) => setLoanOutstandingAmt(e.target.value)}
                      placeholder="e.g. 4200000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Monthly EMI (₹)</label>
                    <input
                      type="number"
                      value={loanEmiAmt}
                      onChange={(e) => setLoanEmiAmt(e.target.value)}
                      placeholder="e.g. 45000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Monthly Due Date</label>
                    <input
                      type="text"
                      value={loanDueDate}
                      onChange={(e) => setLoanDueDate(e.target.value)}
                      placeholder="e.g. 5th of every month"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Loan & EMI
                </button>
              </form>
            )}

            {/* Insurance Form */}
            {modalType === 'INSURANCE' && (
              <form onSubmit={handleSaveInsurance} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Insurance Provider</label>
                  <input
                    type="text"
                    value={insProvider}
                    onChange={(e) => setInsProvider(e.target.value)}
                    placeholder="e.g. LIC, Max Life, Star Health"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Policy Type</label>
                  <select
                    value={insType}
                    onChange={(e) => setInsType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  >
                    <option value="LIFE">Life Insurance</option>
                    <option value="TERM">Term Insurance</option>
                    <option value="HEALTH">Health Insurance</option>
                    <option value="VEHICLE">Vehicle Insurance</option>
                    <option value="HOME">Home Insurance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Policy Number</label>
                    <input
                      type="text"
                      value={insPolicyNo}
                      onChange={(e) => setInsPolicyNo(e.target.value)}
                      placeholder="e.g. POL-8392019"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Coverage Amount (₹)</label>
                    <input
                      type="number"
                      value={insCoverage}
                      onChange={(e) => setInsCoverage(e.target.value)}
                      placeholder="e.g. 10000000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Annual Premium (₹)</label>
                    <input
                      type="number"
                      value={insPremium}
                      onChange={(e) => setInsPremium(e.target.value)}
                      placeholder="e.g. 35000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Renewal Date</label>
                    <input
                      type="date"
                      value={insRenewalDate}
                      onChange={(e) => setInsRenewalDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Policy
                </button>
              </form>
            )}

            {/* Money Given Form */}
            {modalType === 'MONEY_GIVEN' && (
              <form onSubmit={handleSaveMoneyGiven} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Recipient Person or Organization</label>
                  <input
                    type="text"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="Enter name of borrower"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Amount Given (₹)</label>
                  <input
                    type="number"
                    value={ledgerAmount}
                    onChange={(e) => setLedgerAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Purpose / Notes</label>
                  <input
                    type="text"
                    value={ledgerPurpose}
                    onChange={(e) => setLedgerPurpose(e.target.value)}
                    placeholder="e.g. Friendly loan for medical emergency"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Record
                </button>
              </form>
            )}

            {/* Money Borrowed Form */}
            {modalType === 'MONEY_BORROWED' && (
              <form onSubmit={handleSaveMoneyBorrowed} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Lender Person or Organization</label>
                  <input
                    type="text"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="Enter name of person you borrowed from"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Amount Borrowed (₹)</label>
                  <input
                    type="number"
                    value={ledgerAmount}
                    onChange={(e) => setLedgerAmount(e.target.value)}
                    placeholder="e.g. 75000"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-mono shadow-xs focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">Repayment Terms / Notes</label>
                  <input
                    type="text"
                    value={ledgerPurpose}
                    onChange={(e) => setLedgerPurpose(e.target.value)}
                    placeholder="e.g. Agreed to repay by December"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 shadow-xs focus:border-emerald-700"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs mt-3 shadow-xs"
                >
                  Save Record
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
