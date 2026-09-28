import React, { useState } from 'react';
import { 
  Users, 
  Shield, 
  Lock, 
  Landmark, 
  CreditCard, 
  Building, 
  FileText, 
  LogOut,
  Calendar,
  Eye,
  Download,
  X,
  FileCheck
} from 'lucide-react';
import { VaultState, Nominee, DocumentItem } from '../../types';

interface MobileNomineePortalProps {
  state: VaultState;
  activeNominee: Nominee;
  ownerEfid: string;
  sessionToken?: string;
  permittedDocuments?: DocumentItem[];
  activeTab?: string;
  onLogout: () => void;
}

export const MobileNomineePortal: React.FC<MobileNomineePortalProps> = ({
  state,
  activeNominee,
  ownerEfid,
  sessionToken = '',
  permittedDocuments = [],
  activeTab = 'nominee_portal',
  onLogout,
}) => {
  const policy = activeNominee?.access_policy || {
    allow_financial_summary: true,
    allow_loans: true,
    allow_emi: true,
    allow_insurance: true,
    allow_bank_accounts: true,
    allow_property: true,
    allow_vehicles: true,
    allow_valuable_assets: true,
    allow_documents: true,
    allow_important_info: true,
    allow_personal_diary: false,
    allow_financial_diary: true,
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('SUMMARY');
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);

  // Safe arrays
  const accounts = state?.accounts || [];
  const loans = state?.loans || [];
  const insurance = state?.insurance || [];
  const properties = state?.properties || [];
  const financialDiary = state?.financialDiary || [];
  const rawDocs = state?.documents || [];

  // Filter documents strictly: ONLY permitted by owner!
  const permittedDocs = (permittedDocuments && permittedDocuments.length > 0
    ? permittedDocuments
    : rawDocs.filter((d) => d.allow_nominee_emergency_access === true)
  );

  // If nominee switched to "Session Details" (profile tab) in bottom nav
  if (activeTab === 'profile') {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider block">
                Active Nominee Session
              </span>
              <h2 className="text-sm font-bold text-stone-900">
                {activeNominee?.name || 'Designated Nominee'}
              </h2>
            </div>
          </div>

          <div className="space-y-2 text-xs pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between text-stone-600">
              <span>Vault Owner E-FID</span>
              <span className="font-mono font-bold text-stone-900 uppercase">{ownerEfid}</span>
            </div>
            <div className="flex items-center justify-between text-stone-600">
              <span>Nominee Mobile</span>
              <span className="font-mono font-semibold text-stone-900">+91 {activeNominee?.mobile_number}</span>
            </div>
            <div className="flex items-center justify-between text-stone-600">
              <span>Relationship</span>
              <span className="font-semibold text-stone-900">{activeNominee?.relationship || 'Nominee'}</span>
            </div>
            <div className="flex items-center justify-between text-stone-600">
              <span>Session Mode</span>
              <span className="font-semibold text-emerald-800">Verified Controlled Grant</span>
            </div>
            <div className="flex items-center justify-between text-stone-600">
              <span>Authorized Documents</span>
              <span className="font-bold text-emerald-800">{permittedDocs.length} Accessible</span>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100">
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Emergency Session</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Session Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-800" />
            </div>
            <div>
              <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider block">
                Nominee Portal
              </span>
              <h2 className="text-sm font-bold text-stone-900">
                Welcome, {activeNominee.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="py-1 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <div>
            <span className="text-stone-400 block text-[10px]">OWNER E-FID:</span>
            <span className="font-mono font-bold text-stone-900 uppercase">{ownerEfid}</span>
          </div>
          <div className="text-right">
            <span className="text-stone-400 block text-[10px]">ACCESS MODE:</span>
            <span className="font-semibold text-emerald-800">Controlled Grant</span>
          </div>
        </div>
      </div>

      {/* Permission Categories Filter Buttons */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
        <button
          onClick={() => setSelectedCategory('SUMMARY')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'SUMMARY'
              ? 'bg-stone-900 text-white shadow-xs font-bold'
              : 'bg-white border border-stone-200 text-stone-600'
          }`}
        >
          Summary
        </button>

        {policy.allow_bank_accounts && (
          <button
            onClick={() => setSelectedCategory('ACCOUNTS')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'ACCOUNTS'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            Accounts ({accounts.length})
          </button>
        )}

        {policy.allow_loans && (
          <button
            onClick={() => setSelectedCategory('LOANS')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'LOANS'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            Loans & EMI ({loans.length})
          </button>
        )}

        {policy.allow_insurance && (
          <button
            onClick={() => setSelectedCategory('INSURANCE')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'INSURANCE'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            Insurance ({insurance.length})
          </button>
        )}

        {policy.allow_property && (
          <button
            onClick={() => setSelectedCategory('PROPERTY')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'PROPERTY'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            Properties ({properties.length})
          </button>
        )}

        {policy.allow_documents && (
          <button
            onClick={() => setSelectedCategory('DOCUMENTS')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'DOCUMENTS'
                ? 'bg-emerald-900 text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            Documents ({permittedDocs.length})
          </button>
        )}

        {policy.allow_financial_diary && (
          <button
            onClick={() => setSelectedCategory('DIRECTIVES')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'DIRECTIVES'
                ? 'bg-stone-900 text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600'
            }`}
          >
            Directives ({financialDiary.length})
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SUMMARY */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'SUMMARY' && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
              Emergency Estate Overview
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              You have been designated as an authorized emergency nominee by the vault owner.
              Only assets and records explicitly authorized by the owner under LIFORA access policies are displayed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] text-stone-400 font-semibold block">ACTIVE LOANS</span>
              <span className="text-base font-extrabold text-stone-900 font-mono mt-0.5 block">
                {loans.length} Records
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] text-stone-400 font-semibold block">INSURANCE</span>
              <span className="text-base font-extrabold text-stone-900 font-mono mt-0.5 block">
                {insurance.length} Policies
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] text-stone-400 font-semibold block">PROPERTIES</span>
              <span className="text-base font-extrabold text-stone-900 font-mono mt-0.5 block">
                {properties.length} Registered
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-[10px] text-stone-400 font-semibold block">PERMITTED DOCS</span>
              <span className="text-base font-extrabold text-emerald-800 font-mono mt-0.5 block">
                {permittedDocs.length} Accessible
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. ACCOUNTS */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'ACCOUNTS' && policy.allow_bank_accounts && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Bank Accounts
          </h3>
          {accounts.length === 0 ? (
            <p className="text-xs text-stone-500 p-4 bg-white rounded-2xl border border-stone-200 text-center">
              No bank account records in vault.
            </p>
          ) : (
            accounts.map((acc) => (
              <div key={acc.id} className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs shadow-xs">
                <h4 className="font-bold text-stone-900">{acc.bank_name}</h4>
                <p className="font-mono text-stone-600 mt-1">A/C: {acc.masked_account_number}</p>
                {acc.ifsc_code && <p className="text-[10px] text-stone-400 font-mono">IFSC: {acc.ifsc_code}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. LOANS */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'LOANS' && policy.allow_loans && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Loans & EMI Commitments
          </h3>
          {loans.length === 0 ? (
            <p className="text-xs text-stone-500 p-4 bg-white rounded-2xl border border-stone-200 text-center">
              No loan records logged in vault.
            </p>
          ) : (
            loans.map((loan) => (
              <div key={loan.id} className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs shadow-xs">
                <h4 className="font-bold text-stone-900">{loan.provider}</h4>
                <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                  ₹{(loan.emi_amount || 0).toLocaleString('en-IN')}/mo EMI
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500">
                  <span>Due Date: {loan.due_date}</span>
                  <span>· Outstanding: ₹{(loan.outstanding_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. INSURANCE */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'INSURANCE' && policy.allow_insurance && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Insurance Policies
          </h3>
          {insurance.length === 0 ? (
            <p className="text-xs text-stone-500 p-4 bg-white rounded-2xl border border-stone-200 text-center">
              No insurance records in vault.
            </p>
          ) : (
            insurance.map((ins) => (
              <div key={ins.id} className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs shadow-xs">
                <h4 className="font-bold text-stone-900">{ins.provider} ({ins.insurance_type})</h4>
                <p className="font-mono font-bold text-emerald-800 mt-0.5">
                  Coverage: ₹{(ins.coverage_amount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-stone-500 mt-1">
                  Policy No: •••• {(ins.policy_number_masked || '').slice(-4)} · Renewal: {ins.renewal_date}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. PROPERTY */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'PROPERTY' && policy.allow_property && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Properties & Real Estate
          </h3>
          {properties.length === 0 ? (
            <p className="text-xs text-stone-500 p-4 bg-white rounded-2xl border border-stone-200 text-center">
              No property records in vault.
            </p>
          ) : (
            properties.map((p) => (
              <div key={p.id} className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs shadow-xs">
                <h4 className="font-bold text-stone-900">{p.name}</h4>
                <p className="text-stone-600 mt-0.5">{p.location}</p>
                {(p.estimated_value || 0) > 0 && (
                  <p className="text-[10px] text-stone-500 font-mono mt-1">
                    Estimated Value: ₹{p.estimated_value.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. PERMITTED IMPORTANT DOCUMENTS */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'DOCUMENTS' && policy.allow_documents && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Permitted Important Documents
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {permittedDocs.length} Authorized
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 leading-snug">
            <strong>Security Notice: </strong>
            Only documents explicitly authorized by the vault owner for nominee emergency access are accessible. All document views and downloads are permanently recorded in the owner's audit log.
          </div>

          {permittedDocs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-dashed border-stone-300 text-center space-y-2">
              <Lock className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="text-xs font-bold text-stone-800">
                No documents have been authorized for nominee access by the vault owner.
              </p>
              <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                The owner maintains sovereign privacy over their legal and personal documents until explicitly permitted.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {permittedDocs.map((doc) => {
                const viewUrl = `/api/documents/${doc.id}/view?token=${encodeURIComponent(sessionToken)}`;
                const downloadUrl = `/api/documents/${doc.id}/download?token=${encodeURIComponent(sessionToken)}`;

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                        <FileCheck className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-stone-900 truncate">
                          {doc.title}
                        </h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium inline-block mt-0.5">
                          {doc.category}
                        </span>
                        {(doc.description || doc.notes) && (
                          <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                            {doc.description || doc.notes}
                          </p>
                        )}
                        <p className="text-[10px] text-stone-400 mt-1">
                          Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      <a
                        href={downloadUrl}
                        download={doc.original_filename || `${doc.title}.pdf`}
                        className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. DIRECTIVES */}
      {/* ------------------------------------------------------------- */}
      {selectedCategory === 'DIRECTIVES' && policy.allow_financial_diary && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Owner's Financial Directives
          </h3>
          {financialDiary.length === 0 ? (
            <p className="text-xs text-stone-500 p-4 bg-white rounded-2xl border border-stone-200 text-center">
              No financial directives recorded in vault.
            </p>
          ) : (
            financialDiary.map((item) => (
              <div key={item.id} className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs space-y-1 shadow-xs">
                <h4 className="font-bold text-stone-900">{item.title}</h4>
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{item.instructions}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW PERMITTED DOCUMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-xs font-bold text-stone-900 truncate max-w-xs">
                  {viewingDoc.title}
                </h3>
                <span className="text-[10px] text-stone-500">
                  {viewingDoc.category} · Authorized Emergency Document
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/documents/${viewingDoc.id}/download?token=${encodeURIComponent(sessionToken)}`}
                  download={viewingDoc.original_filename || `${viewingDoc.title}.pdf`}
                  className="py-1 px-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-stone-100 flex items-center justify-center min-h-[300px]">
              {viewingDoc.mime_type?.startsWith('image/') ||
              viewingDoc.original_filename?.match(/\.(jpg|jpeg|png)$/i) ? (
                <img
                  src={`/api/documents/${viewingDoc.id}/view?token=${encodeURIComponent(sessionToken)}`}
                  alt={viewingDoc.title}
                  className="max-h-[65vh] max-w-full rounded-xl object-contain shadow-md"
                />
              ) : (
                <iframe
                  src={`/api/documents/${viewingDoc.id}/view?token=${encodeURIComponent(sessionToken)}`}
                  title={viewingDoc.title}
                  className="w-full h-[65vh] rounded-xl border border-stone-300 bg-white"
                />
              )}
            </div>

            <div className="p-3 bg-white border-t border-stone-200 text-[10px] text-stone-500 flex items-center justify-between">
              <span>View logged under Nominee: {activeNominee.name}</span>
              <span className="font-semibold text-emerald-800">Verified Emergency Session</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
