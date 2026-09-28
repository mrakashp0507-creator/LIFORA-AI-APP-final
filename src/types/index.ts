export type Language = 'en' | 'ta' | 'tanglish';

export interface User {
  id: string;
  full_name: string;
  mobile_number: string;
  email?: string;
  date_of_birth?: string;
  role: 'CUSTOMER' | 'NOMINEE';
  is_verified: boolean;
  efid: string; // Emergency Financial ID
  preferred_language: Language;
  masked_identity_number?: string;
  inactivity_threshold_days: number;
  last_activity_at: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_type: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'FIXED_DEPOSIT' | 'OTHER';
  account_nickname?: string;
  masked_account_number: string;
  ifsc_code?: string;
  branch?: string;
  notes?: string;
  created_at: string;
}

export interface Loan {
  id: string;
  provider: string;
  loan_type: 'HOME_LOAN' | 'PERSONAL_LOAN' | 'AUTO_LOAN' | 'EDUCATION_LOAN' | 'BUSINESS_LOAN' | 'GOLD_LOAN' | 'OTHER';
  original_amount: number;
  outstanding_amount: number;
  emi_amount: number;
  due_date: string;
  start_date?: string;
  end_date?: string;
  interest_rate?: number;
  notes?: string;
  created_at: string;
}

export interface EmiItem {
  id: string;
  name: string;
  linked_loan_id?: string;
  linked_loan_name?: string;
  amount: number;
  due_date: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  start_date?: string;
  end_date?: string;
  reminder_preference: '2_WEEKS_MANDATORY' | '1_WEEK' | '3_DAYS' | 'DUE_DAY';
  status: 'UPCOMING' | 'DUE_SOON' | 'DUE_TODAY' | 'PAID' | 'OVERDUE';
  notes?: string;
  created_at: string;
}

export interface InsurancePolicy {
  id: string;
  provider: string;
  insurance_type: 'HEALTH' | 'LIFE' | 'TERM' | 'VEHICLE' | 'HOME' | 'OTHER';
  policy_number_masked: string;
  premium_amount: number;
  renewal_date: string;
  coverage_amount: number;
  notes?: string;
  created_at: string;
}

export interface OtherCommitment {
  id: string;
  name: string;
  commitment_type: 'CHIT_FUND' | 'INSTALLMENT' | 'RECURRING_PAYMENT' | 'OTHER';
  amount: number;
  due_date: string;
  frequency: string;
  notes?: string;
  created_at: string;
}

export interface MoneyGiven {
  id: string;
  person_or_org: string;
  amount: number;
  date_given: string;
  purpose: string;
  expected_return_date?: string;
  status: 'PENDING' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'WRITTEN_OFF';
  notes?: string;
  created_at: string;
}

export interface MoneyBorrowed {
  id: string;
  person_or_org: string;
  amount: number;
  date_borrowed: string;
  expected_repayment_date?: string;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID';
  notes?: string;
  created_at: string;
}

export interface PropertyItem {
  id: string;
  category: 'PROPERTY' | 'HOUSE' | 'LAND';
  name: string;
  property_type: string;
  location: string;
  ownership: 'SOLE_OWNER' | 'JOINT_OWNER' | 'INHERITED' | 'MORTGAGED';
  purchase_year?: string;
  estimated_value: number; // User-provided estimate
  // House specific fields
  built_up_area?: string;
  land_area?: string;
  floors?: string;
  rooms?: string;
  linked_home_loan?: string;
  // Land specific fields
  survey_number?: string;
  notes?: string;
  created_at: string;
}

export interface ValuableAsset {
  id: string;
  name: string;
  category: 'GOLD' | 'JEWELRY' | 'DIAMONDS' | 'PRECIOUS_STONES' | 'SILVER' | 'HEIRLOOM' | 'OTHER';
  description?: string;
  estimated_value: number; // Labeled clearly: User-provided estimate
  weight_grams?: number;
  purchase_info?: string;
  location_stored?: string; // e.g. SBI T. Nagar Safe Locker
  notes?: string;
  created_at: string;
}

export interface VehicleItem {
  id: string;
  vehicle_type: 'CAR' | 'TWO_WHEELER' | 'COMMERCIAL' | 'ELECTRIC' | 'OTHER';
  brand: string;
  model: string;
  registration_number: string;
  purchase_year?: string;
  insurance_provider?: string;
  insurance_expiry?: string;
  puc_expiry?: string;
  linked_vehicle_loan?: string;
  notes?: string;
  created_at: string;
}

export type DocumentCategory =
  | 'Identity Proof'
  | 'Insurance'
  | 'Property'
  | 'Vehicle'
  | 'Medical'
  | 'Financial'
  | 'Other'
  | 'HOME_LOAN'
  | 'HOUSE'
  | 'LAND'
  | 'BANK'
  | 'LOAN'
  | 'EMI';

export interface DocumentItem {
  id: string;
  user_id?: string;
  efid?: string;
  title: string;
  category: DocumentCategory;
  description?: string;
  original_filename?: string;
  mime_type?: string;
  file_size_bytes?: number;
  file_type?: string;
  file_size_kb?: number;
  file_data_url?: string;
  allow_nominee_emergency_access: boolean; // STRICTLY FALSE BY DEFAULT
  is_ai_extracted?: boolean;
  is_verified_by_user?: boolean;
  extracted_summary?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PersonalDiaryEntry {
  id: string;
  title: string;
  content: string;
  is_emergency_shared: boolean; // 🔒 PRIVATE BY DEFAULT! User must explicitly grant access
  category: 'PERSONAL_THOUGHT' | 'INSTRUCTION' | 'PRIVATE_NOTE';
  created_at: string;
  updated_at: string;
}

export interface FinancialDiaryEntry {
  id: string;
  title: string;
  instructions: string;
  category: 'PAYMENT_NOTE' | 'INHERITANCE_INSTRUCTION' | 'LENDING_CONTEXT' | 'FUTURE_PLAN';
  created_at: string;
  updated_at: string;
}

export interface ImportantInfoItem {
  id: string;
  // Strictly only these 4 categories permitted by specification:
  // 1. Property, 2. Vehicles, 3. Documents, 4. Important Information
  category: 'PROPERTY_ESSENTIAL' | 'VEHICLE_ESSENTIAL' | 'DOCUMENT_ESSENTIAL' | 'IMPORTANT_INSTRUCTION';
  title: string;
  details: string;
  created_at: string;
}

export interface AccessPolicy {
  allow_financial_summary: boolean;
  allow_loans: boolean;
  allow_emi: boolean;
  allow_insurance: boolean;
  allow_bank_accounts: boolean;
  allow_property: boolean;
  allow_vehicles: boolean;
  allow_valuable_assets: boolean;
  allow_documents: boolean;
  allow_important_info: boolean;
  allow_personal_diary: boolean; // 🔒 MUST BE FALSE BY DEFAULT
  allow_financial_diary: boolean;
}

export interface Nominee {
  id: string;
  name: string;
  dob?: string;
  mobile_number: string;
  relationship: string;
  is_phone_verified: boolean;
  verification_id?: string;
  access_policy: AccessPolicy;
  status: 'PENDING_VERIFICATION' | 'VERIFIED';
  created_at: string;
}

export interface SafetyCheckin {
  id: string;
  requested_by_nominee: string;
  nominee_name: string;
  status: 'PENDING' | 'RESPONDED' | 'EXPIRED';
  response_choice?: 'IM_OKAY' | 'CALL_ME' | 'RESPOND_LATER' | 'NEED_HELP';
  requested_at: string;
  responded_at?: string;
}

export interface EmergencySession {
  is_active: boolean;
  activated_at?: string;
  expires_at?: string;
  remaining_hours: number;
  nominee_id?: string;
  nominee_name?: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  details: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface PriorityItem {
  id: string;
  title: string;
  category: string;
  due_date: string;
  days_remaining: number;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string; // Transparent reason, e.g., "Due in 2 days"
}

export type DueDateCategory = 'EMI' | 'LOAN' | 'INSURANCE' | 'DOCUMENT_EXPIRY' | 'OTHER_COMMITMENT';

export type ReminderRecipientType = 'OWNER_ONLY' | 'AUTHORIZED_NOMINEE' | 'BOTH';

export type DueDateStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface DueDateRecord {
  id: string;
  user_id: string;
  record_type: DueDateCategory;
  title: string;
  amount?: number | null; // Optional, null/undefined for document expiry
  due_date: string; // YYYY-MM-DD
  status: DueDateStatus;
  reminder_intervals: number[]; // e.g. [7, 3, 1]
  recipients: ReminderRecipientType;
  nominee_id?: string;
  nominee_name?: string;
  nominee_mobile?: string;
  nominee_consent_granted: boolean;
  notes?: string;
  linked_entity_id?: string; // id of linked loan, document, or policy
  created_at: string;
  updated_at: string;
}

export interface SmsReminderLog {
  id: string;
  user_id: string;
  due_date_id: string;
  record_title: string;
  record_type: DueDateCategory;
  recipient_type: 'OWNER' | 'NOMINEE';
  recipient_name: string;
  recipient_mobile_masked: string;
  recipient_mobile: string;
  days_before_due: number;
  due_date: string;
  dispatched_at: string;
  status: 'DELIVERED' | 'FAILED' | 'QUEUED' | 'SKIPPED';
  provider: 'MSG91' | 'MOCK';
  message_preview: string;
  gateway_response?: any;
  error_message?: string;
}

export interface VaultState {
  user: User | null;
  token: string | null;
  // All modules strictly start empty for any user
  accounts: BankAccount[];
  loans: Loan[];
  emis: EmiItem[];
  insurance: InsurancePolicy[];
  commitments: OtherCommitment[];
  moneyGiven: MoneyGiven[];
  moneyBorrowed: MoneyBorrowed[];
  properties: PropertyItem[];
  valuableAssets: ValuableAsset[];
  vehicles: VehicleItem[];
  documents: DocumentItem[];
  personalDiary: PersonalDiaryEntry[];
  financialDiary: FinancialDiaryEntry[];
  importantInfo: ImportantInfoItem[];
  nominees: Nominee[];
  dueDates?: DueDateRecord[];
  safetyCheckin: SafetyCheckin | null;
  emergencySession: EmergencySession | null;
  auditLogs: AuditLog[];
  language: Language;
}
