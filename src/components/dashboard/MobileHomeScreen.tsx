import React from 'react';
import { 
  CreditCard, 
  Landmark, 
  Shield, 
  Building, 
  Car, 
  Gem, 
  FileText, 
  BookOpen, 
  Users, 
  AlertCircle, 
  Calendar, 
  ArrowRight, 
  Plus, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Bell
} from 'lucide-react';
import { VaultState, Language } from '../../types';

interface MobileHomeScreenProps {
  state: VaultState;
  language: Language;
  onNavigate: (tab: string, subtab?: string) => void;
  onOpenCheckin: () => void;
}

export const MobileHomeScreen: React.FC<MobileHomeScreenProps> = ({
  state,
  language,
  onNavigate,
  onOpenCheckin
}) => {
  const user = state?.user;
  const accounts = state?.accounts || [];
  const loans = state?.loans || [];
  const emis = state?.emis || [];
  const insurance = state?.insurance || [];
  const properties = state?.properties || [];
  const vehicles = state?.vehicles || [];
  const valuableAssets = state?.valuableAssets || [];
  const documents = state?.documents || [];
  const nominees = state?.nominees || [];
  const personalDiary = state?.personalDiary || [];
  const dueDates = state?.dueDates || [];

  // Calculate dynamic Life Core completion score (0-100%)
  let healthScore = 0;
  if (accounts.length > 0) healthScore += 15;
  if (loans.length > 0 || emis.length > 0) healthScore += 15;
  if (insurance.length > 0) healthScore += 15;
  if (properties.length > 0 || vehicles.length > 0 || valuableAssets.length > 0) healthScore += 15;
  if (documents.length > 0) healthScore += 15;
  if (nominees.length > 0) healthScore += 15;
  if (nominees.some(n => n?.is_phone_verified)) healthScore += 10;
  healthScore = Math.min(100, healthScore);

  // Total monthly EMI burden
  const totalMonthlyEmi = loans.reduce((acc, l) => acc + (l?.emi_amount || 0), 0) +
    emis.reduce((acc, e) => acc + (e?.amount || 0), 0);

  // Dynamic Prioritization Engine
  const priorities: Array<{
    id: string;
    title: string;
    description: string;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    actionTab: string;
    actionSubtab?: string;
  }> = [];

  // 1. High Priority: Upcoming Due Dates (within 7 days)
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const upcomingDue = dueDates
    .filter((d) => d.status === 'ACTIVE')
    .map((d) => {
      const [dy, dm, dd] = d.due_date.split('-').map(Number);
      const [ty, tm, td] = todayIST.split('-').map(Number);
      const diff = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86400000);
      return { ...d, daysRemaining: diff };
    })
    .filter((d) => d.daysRemaining >= 0 && d.daysRemaining <= 7)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  if (upcomingDue.length > 0) {
    const item = upcomingDue[0];
    const daysLabel =
      item.daysRemaining === 0
        ? 'DUE TODAY'
        : item.daysRemaining === 1
        ? 'Due tomorrow'
        : `Due in ${item.daysRemaining} days`;
    priorities.push({
      id: `due_${item.id}`,
      title: `SMS Reminder: ${item.title} (${daysLabel})`,
      description: `${item.record_type.replace('_', ' ')} due on ${item.due_date}. Scheduled SMS alerts are active.`,
      urgency: item.daysRemaining <= 2 ? 'HIGH' : 'MEDIUM',
      actionTab: 'vault',
      actionSubtab: 'reminders',
    });
  }

  const unverifiedNominees = nominees.filter(n => !n?.is_phone_verified);
  if (unverifiedNominees.length > 0) {
    priorities.push({
      id: 'nominee_unverified',
      title: `${unverifiedNominees[0].name} requires phone verification`,
      description: 'Emergency access remains locked until the nominee verifies their mobile number via SMS.',
      urgency: 'HIGH',
      actionTab: 'nominee'
    });
  }

  if (loans.length > 0 || emis.length > 0) {
    priorities.push({
      id: 'emi_check',
      title: `Monthly EMI commitment: ₹${totalMonthlyEmi.toLocaleString('en-IN')}`,
      description: 'Review deduction dates and maintain minimum balances in linked accounts.',
      urgency: 'MEDIUM',
      actionTab: 'vault',
      actionSubtab: 'loans'
    });
  }

  if (nominees.length === 0) {
    priorities.push({
      id: 'no_nominee',
      title: 'No emergency nominee appointed',
      description: 'Appoint a family member or trusted executor to ensure continuity when you are unavailable.',
      urgency: 'HIGH',
      actionTab: 'nominee'
    });
  }

  const totalItemsCount = 
    accounts.length +
    loans.length +
    insurance.length +
    properties.length +
    vehicles.length +
    valuableAssets.length +
    documents.length +
    personalDiary.length;

  const isVaultEmpty = totalItemsCount === 0;

  // Category items
  const categories = [
    {
      id: 'vault',
      subtab: 'accounts',
      title: 'Bank Accounts',
      count: accounts.length,
      detail: accounts.length ? `${accounts.length} linked` : 'Not added',
      icon: Landmark,
      iconColor: 'text-blue-700 bg-blue-50',
    },
    {
      id: 'vault',
      subtab: 'loans',
      title: 'Loans & EMIs',
      count: loans.length + emis.length,
      detail: totalMonthlyEmi > 0 ? `₹${totalMonthlyEmi.toLocaleString('en-IN')}/mo` : 'No debt listed',
      icon: CreditCard,
      iconColor: 'text-purple-700 bg-purple-50',
    },
    {
      id: 'vault',
      subtab: 'insurance',
      title: 'Insurance',
      count: insurance.length,
      detail: insurance.length ? `${insurance.length} policies` : 'Not added',
      icon: Shield,
      iconColor: 'text-emerald-700 bg-emerald-50',
    },
    {
      id: 'vault',
      subtab: 'reminders',
      title: 'Due Dates & SMS',
      count: dueDates.length,
      detail: dueDates.length ? `${dueDates.length} scheduled` : 'Not scheduled',
      icon: Bell,
      iconColor: 'text-rose-700 bg-rose-50',
    },
    {
      id: 'assets',
      subtab: 'properties',
      title: 'Property & Land',
      count: properties.length,
      detail: properties.length ? `${properties.length} recorded` : 'Not added',
      icon: Building,
      iconColor: 'text-amber-800 bg-amber-50',
    },
    {
      id: 'assets',
      subtab: 'vehicles',
      title: 'Vehicles',
      count: vehicles.length,
      detail: vehicles.length ? `${vehicles.length} vehicles` : 'Not added',
      icon: Car,
      iconColor: 'text-rose-700 bg-rose-50',
    },
    {
      id: 'assets',
      subtab: 'valuables',
      title: 'Valuables & Gold',
      count: valuableAssets.length,
      detail: valuableAssets.length ? `${valuableAssets.length} items` : 'Not added',
      icon: Gem,
      iconColor: 'text-yellow-800 bg-yellow-50',
    },
    {
      id: 'assets',
      subtab: 'documents',
      title: 'Documents',
      count: documents.length,
      detail: documents.length ? `${documents.length} deeds` : 'Not added',
      icon: FileText,
      iconColor: 'text-teal-700 bg-teal-50',
    },
    {
      id: 'diary',
      subtab: 'personal',
      title: 'Personal Diary',
      count: personalDiary.length,
      detail: personalDiary.length ? `${personalDiary.length} notes` : 'Not added',
      icon: BookOpen,
      iconColor: 'text-indigo-700 bg-indigo-50',
    },
    {
      id: 'nominee',
      subtab: 'nominees',
      title: 'Nominee Access',
      count: nominees.length,
      detail: nominees.length ? `${nominees.length} designated` : 'Not added',
      icon: Users,
      iconColor: 'text-stone-700 bg-stone-100',
    },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Natural Welcome Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
              Protected Vault
            </span>
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">
              Welcome, {user?.full_name || 'Vault Owner'}
            </h2>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Continuity protocol active · Monitored
            </p>
          </div>
          <button
            onClick={onOpenCheckin}
            className="flex flex-col items-center p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-semibold transition-all active:scale-95"
            title="Safety Check-in Status"
          >
            <Clock className="w-4 h-4 text-emerald-800 mb-0.5" />
            <span>Safety Check</span>
          </button>
        </div>
      </div>

      {/* Natural Organic Life Core Visual Component */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
              Vault Health & Continuity
            </h3>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {healthScore}% Complete
          </span>
        </div>

        {/* Circular Life Core Ring (Calm, clean, natural) */}
        <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-stone-100 stroke-current"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-emerald-800 stroke-current transition-all duration-1000 ease-out"
                strokeWidth="7"
                strokeDasharray={`${healthScore * 2.51} 251.2`}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold font-mono text-stone-900">
                {healthScore}%
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                Readiness
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2 w-full text-xs">
            <div className="flex items-center justify-between text-stone-700">
              <span>Financial Records</span>
              <span className="font-semibold text-stone-900">
                {state.accounts.length + state.loans.length > 0 ? '✓ Ready' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-700">
              <span>Emergency Nominee</span>
              <span className="font-semibold text-stone-900">
                {state.nominees.length > 0 ? '✓ Linked' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-700">
              <span>Assets & Documentation</span>
              <span className="font-semibold text-stone-900">
                {state.properties.length + state.documents.length > 0 ? '✓ Verified' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Empty State Banner (When 0 items recorded) */}
        {isVaultEmpty && (
          <div className="mt-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-center">
            <p className="text-xs text-stone-700 font-medium leading-relaxed">
              Your Life Core is ready. Start adding your information to build your secure life vault.
            </p>
            <button
              onClick={() => onNavigate('vault', 'accounts')}
              className="mt-2.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Information</span>
            </button>
          </div>
        )}
      </div>

      {/* "What Should I Handle First?" Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-stone-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
              What Should I Handle First?
            </h3>
          </div>
        </div>

        {priorities.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-white border border-stone-200 text-stone-600 text-xs flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>You're all caught up. No urgent commitments pending.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {priorities.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate(item.actionTab, item.actionSubtab)}
                className="p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    item.urgency === 'HIGH' ? 'bg-amber-600' : 'bg-stone-400'
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Category Grid */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
            Vault Categories
          </h3>
          <span className="text-[10px] text-stone-400">Tap to manage</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.title}
                onClick={() => onNavigate(cat.id, cat.subtab)}
                className="p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 text-left transition-all active:scale-[0.98] shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl ${cat.iconColor} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-stone-500">
                    {cat.count}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-stone-900">
                  {cat.title}
                </h4>
                <p className="text-[10px] text-stone-500 mt-0.5 truncate">
                  {cat.detail}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
