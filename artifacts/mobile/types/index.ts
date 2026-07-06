export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'archived';
export type SortField = 'date' | 'amount' | 'customer';
export type SortOrder = 'asc' | 'desc';
export type FilterStatus = 'all' | 'active' | 'paid' | 'pending' | 'archived' | 'favorites';

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export type SettlementStatus = 'receive' | 'return' | 'settled';

export interface BusinessInfo {
  companyName: string;
  ownerName: string;
  driverName: string;
  mobile: string;
  truckNumber: string;
  address: string;
  gstNumber: string;
  upiId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  logoUri?: string;
  signatureUri?: string;
  profilePhotoUri?: string;
  footerNotes: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  status: InvoiceStatus;
  isFavorite: boolean;
  isArchived: boolean;
  customName?: string;
  businessSnapshot: BusinessInfo;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  clientGST?: string;
  fromLocation: string;
  toLocation: string;
  truckNumber: string;
  driverName: string;
  expenses: ExpenseItem[];
  advanceAmount: number;
  totalExpenses: number;
  balance: number;
  settlementStatus: SettlementStatus;
  currency: string;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  downloadCount: number;
  templateId?: string;
  pdfUrl?: string;
  pdfName?: string;
  pdfCreatedAt?: string;
  /** True when this invoice was saved locally and is waiting to be uploaded to Firestore. */
  pendingSync?: boolean;
}

export interface AppSettings {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultGstRate: number;
  defaultCurrency: string;
  defaultPaymentTerms: string;
  defaultTemplateId: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended';
  isPremium: boolean;
  premiumPlanId?: string;
  createdAt: string;
  lastActive: string;
  invoiceCount: number;
}

export interface PremiumPlan {
  id: string;
  name: string;
  type: 'monthly' | 'yearly' | 'lifetime' | 'free_trial';
  price: number;
  currency: string;
  features: string[];
  isActive: boolean;
  trialDays?: number;
  sortOrder: number;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  isPublished: boolean;
  isPremium: boolean;
  previewUri?: string;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export type BannerType = 'home' | 'offer' | 'announcement' | 'maintenance';

export interface AppBanner {
  id: string;
  type: BannerType;
  title: string;
  message: string;
  imageUri?: string;
  isActive: boolean;
  ctaText?: string;
  ctaUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

export type NotificationTarget = 'all' | 'premium' | 'selected';

export interface PushNotificationPayload {
  id: string;
  title: string;
  body: string;
  target: NotificationTarget;
  selectedUserIds?: string[];
  data?: Record<string, string>;
  sentAt?: string;
  scheduledAt?: string;
  status: 'draft' | 'sent' | 'scheduled';
}

export type FeedbackType = 'feedback' | 'bug' | 'contact' | 'faq';

export interface UserFeedback {
  id: string;
  userId: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  adminReply?: string;
}

export interface AnalyticsSnapshot {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  totalInvoices: number;
  pdfDownloads: number;
  invoiceGenerationCount: number;
  dailyActiveUsers: { date: string; count: number }[];
  monthlyActiveUsers: { month: string; count: number }[];
  revenueTotal: number;
  mostUsedCalculator: string;
  mostDownloadedTemplate: string;
  topCustomers: { name: string; invoiceCount: number; totalAmount: number }[];
}

export interface AIInvoiceRequest {
  prompt: string;
  context?: Partial<Invoice>;
}

export interface OCRScanResult {
  rawText: string;
  parsedData: Partial<Invoice>;
  confidence: number;
}

export type SupportedLocale = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'mr' | 'gu';

export interface LocaleStrings {
  locale: SupportedLocale;
  translations: Record<string, string>;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
  active: boolean;
  priority: number; // 1 = high (red), 2 = medium (orange), 3 = low (blue)
  /** When true, announcement is shown at the top of the list and pinned home screen banner. */
  isPinned?: boolean;
  /** When true, announcement is shown as a modal popup on app open. */
  isPopup?: boolean;
}
