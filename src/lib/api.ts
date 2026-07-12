/**
 * Typed endpoint surface — one function per route in fxsim/v1.
 * Each function returns ApiResult<T>; callers branch on `.ok`.
 */

import { fxsim } from './fxsim'
import type {
  Account, AdminStats, AdminUserRow, AdminUserDetail, AdminRisk, AdvancedStats, AnalyticsChallenges,
  AnalyticsGrowth, AnalyticsRevenue, AuthUser, BasicStats, Certificate,
  ChallengeAccount, ChallengeMetrics, ChallengePlan, FullStats, HistoryResp,
  LeaderboardRow, NoChallengeResp, NotificationsResp, OpenOrderBody,
  PaymentConfig, PaymentOrder, PendingOrder, PendingOrderBody, Position,
  PricesMap, Symbol, Trade, Transaction, KycInfo, PayoutsResp,
  AdminKycRow, AdminPayoutRow, AdminNotificationsResp, Banner, Coupon,
  AffiliateMe, Commission, AdminAffiliate, TestToolChallenge, AffiliatePayout,
  CryptoNetwork, StripeStatus, HealthReport, SmtpConfig, DemoStatus,
  TradableAccount,
} from '@/types/api'

// ── Auth (additions to the backend — see backend-additions/ folder) ─────────
export const api = {
  auth: {
    login:    (body: { username: string; password: string; remember?: boolean }) =>
      fxsim<{ user?: AuthUser; nonce?: string; two_factor_required?: boolean; uid?: number }>('/auth/login', { body, public: true }),
    verify2fa: (uid: number, code: string) =>
      fxsim<{ user: AuthUser; nonce: string }>('/auth/2fa/verify', { body: { uid, code }, public: true }),
    register: (body: { username: string; email: string; password: string; ref?: string }) =>
      fxsim<{ user: AuthUser; nonce: string }>('/auth/register', { body, public: true }),
    logout:   () => fxsim<{ success: true }>('/auth/logout', { method: 'POST' }),
    me:       (force?: boolean) => fxsim<AuthUser>('/auth/me', { cache: force ? 0 : 30_000 }),
    requestReset: (login: string)   => fxsim<{ success: true; message: string }>('/auth/request-reset', { body: { login }, public: true }),
    doReset:      (key: string, login: string, password: string) =>
      fxsim<{ success: true; message: string }>('/auth/do-reset', { body: { key, login, password }, public: true }),
    resendVerification: () => fxsim<{ success: true; message: string }>('/auth/resend-verification', { method: 'POST' }),
    verifyEmail: (token: string) => fxsim<{ status: 'success' | 'expired' | 'invalid'; message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}&format=json`, { public: true }),
    twoFactorStatus:    () => fxsim<{ enabled: boolean }>('/auth/2fa/status', { cache: 60_000 }),
    twoFactorToggle:    (enable: boolean, code?: string) => fxsim<{ success: boolean; enabled?: boolean; pending?: boolean; message?: string }>('/auth/2fa/toggle', { body: code ? { enable, code } : { enable } }),
  },

  // ── Public ────────────────────────────────────────────────────────────
  prices:        ()              => fxsim<PricesMap>('/prices', { public: true }),
  banners:       (placement?: string, page?: string) =>
    fxsim<Banner[]>('/banners', { query: { placement, page }, public: true, cache: 15_000 }),
  branding:      () => fxsim<{
    brand_name: string; brand_tagline: string; logo_url: string; login_logo_url: string;
    favicon_url: string; support_email: string; primary_color: string; secondary_color: string; footer_text: string;
  }>('/branding', { public: true, cache: 60_000 }),

  symbols:       (force = false) => fxsim<Symbol[]>('/symbols', { cache: 5 * 60_000, force }), // changes rarely; force=true bypasses cache
  challengePlans: ()             => fxsim<ChallengePlan[]>('/challenge/plans', { public: true, cache: 60_000 }),
  leaderboard:   ()              => fxsim<LeaderboardRow[]>('/stats/leaderboard', { public: true, cache: 30_000 }),

  // ── Account / Trading ─────────────────────────────────────────────────
  account:       ()              => fxsim<Account | NoChallengeResp>('/account',      { cache: 4_000 }),
  // V10.7.4a Option A — account switcher
  challengeAccounts: ()          => fxsim<{ accounts: TradableAccount[]; selected_challenge_id: number }>('/challenge/accounts', { cache: 4_000 }),
  selectChallenge:   (id: number) => fxsim<{ success: boolean; selected_challenge_id?: number; message?: string }>('/challenge/select', { body: { id }, retries: 0 }),
  positions:     ()              => fxsim<Position[]>('/positions',                   { cache: 2_000 }),
  open:          (b: OpenOrderBody) => fxsim<{ success: boolean; message?: string; position_id?: number }>('/open', { body: b, retries: 0 }),
  close:         (id: number)    => fxsim<{ success: boolean; message?: string; pnl?: number }>(`/close/${id}`, { method: 'POST', retries: 0 }),
  partialClose:  (id: number, lots: number) => fxsim<{ success: boolean; message?: string }>(`/partial-close/${id}`, { body: { lots }, retries: 0 }),
  sltp:          (id: number, sl: number | null, tp: number | null) =>
    fxsim<{ success: boolean; message?: string }>(`/sltp/${id}`, { body: { sl, tp } }),
  history:       (lastId?: number) => fxsim<HistoryResp>('/history',                  { query: { last_id: lastId }, cache: 6_000 }),
  transactions:  ()              => fxsim<Transaction[]>('/transactions',             { cache: 8_000 }),
  stats:         ()              => fxsim<BasicStats>('/stats',                       { cache: 10_000 }),
  statsFull:     ()              => fxsim<FullStats | NoChallengeResp>('/stats/full', { cache: 10_000 }),
  statsAdvanced: ()              => fxsim<AdvancedStats | NoChallengeResp>('/stats/advanced', { cache: 15_000 }),

  // ── Pending orders ────────────────────────────────────────────────────
  pendingPlace:  (b: PendingOrderBody) => fxsim<{ success: boolean; message?: string }>('/pending-order/place', { body: b, retries: 0 }),
  pendingCancel: (id: number)    => fxsim<{ success: boolean; message?: string }>(`/pending-order/${id}/cancel`, { method: 'POST', retries: 0 }),
  pendingMine:   ()              => fxsim<PendingOrder[]>('/pending-order/my', { cache: 4_000 }),

  // ── Challenge ─────────────────────────────────────────────────────────
  challengeMy:      ()           => fxsim<ChallengeAccount[]>('/challenge/my', { cache: 8_000 }),
  challengeStart:   (planId: number) => fxsim<{ success: boolean; message?: string; requires_payment?: boolean; plan_id?: number; amount?: number }>('/challenge/start', { body: { plan_id: planId } }),
  challengeMetrics: (id: number) => fxsim<ChallengeMetrics>(`/challenge/${id}/metrics`, { cache: 6_000 }),
  challengeMt5:     (id: number) => fxsim<{ ready: boolean; message?: string; mt5_login?: string; mt5_password?: string; mt5_server?: string; mt5_account_type?: string }>(`/challenge/${id}/mt5-details`, { cache: 30_000 }),
  challengePayout:  (id: number, method: string, address: string) =>
    fxsim<{ success: boolean; message?: string; trader_amount?: number; firm_amount?: number }>(`/challenge/${id}/payout`, { body: { method, address } }),
  certificate:      (id: number) => fxsim<Certificate>(`/certificate/${id}`, { cache: 5 * 60_000 }),
  certificatePublic: (code: string) => fxsim<Certificate>(`/certificate/public/${encodeURIComponent(code)}`, { public: true, cache: 5 * 60_000 }),

  // ── Payout method ─────────────────────────────────────────────────────
  payoutMethodGet:  () => fxsim<{ method: string; address: string; details: string }>('/payout-method', { cache: 30_000 }),
  payoutMethodSave: (method: string, address: string, details: string) =>
    fxsim<{ success: true }>('/payout-method', { body: { method, address, details } }),

  // ── KYC (identity verification) ───────────────────────────────────────
  kycGet:    () => fxsim<KycInfo>('/kyc', { cache: 10_000 }),
  kycSubmit: (form: FormData) =>
    fxsim<{ success: boolean; message?: string; status?: string }>('/kyc/submit', { form }),

  // ── Payouts (history + availability + cycle) ──────────────────────────
  payouts:   () => fxsim<PayoutsResp>('/payouts', { cache: 10_000 }),

  // ── Payments ──────────────────────────────────────────────────────────
  paymentConfig:    ()           => fxsim<PaymentConfig>('/payment/config', { cache: 60_000 }),
  paymentCreate:    (planId: number, gateway: string, couponCode?: string) =>
    fxsim<{ success: boolean; message?: string; order_id?: number; amount?: number; original?: number; discount?: number }>('/payment/create', { body: { plan_id: planId, gateway, coupon_code: couponCode } }),
  paymentSubmitProof: (form: FormData) =>
    fxsim<{ success: boolean; message?: string }>('/payment/submit-proof', { form }),
  paymentMyOrders:  ()           => fxsim<PaymentOrder[]>('/payment/my-orders', { cache: 10_000 }),
  stripeCheckout:   (planId: number, couponCode?: string) =>
    fxsim<{ success: boolean; message?: string; checkout_url?: string }>('/payment/stripe-checkout', { body: { plan_id: planId, coupon_code: couponCode } }),
  couponValidate:   (code: string, planId: number) =>
    fxsim<{ valid: boolean; message: string; code?: string; type?: string; value?: number; original?: number; discount?: number; final?: number }>('/coupon/validate', { body: { code, plan_id: planId } }),
  affiliateMe:      () => fxsim<AffiliateMe>('/affiliate/me', { cache: 10_000 }),
  affiliateEnroll:  () => fxsim<AffiliateMe>('/affiliate/enroll', { body: {} }),
  affiliateCommissions: () => fxsim<Commission[]>('/affiliate/commissions', { cache: 10_000 }),
  affiliateSetPayout: (method: string, destination: string) =>
    fxsim<{ success: boolean; message?: string }>('/affiliate/payout-method', { body: { method, destination } }),
  affiliateRequestPayout: () =>
    fxsim<{ success: boolean; message?: string; amount?: number }>('/affiliate/payout/request', { method: 'POST', retries: 0 }),
  affiliatePayouts: () => fxsim<AffiliatePayout[]>('/affiliate/payouts', { cache: 5_000 }),

  // ── Notifications ─────────────────────────────────────────────────────
  notifications:    ()           => fxsim<NotificationsResp>('/notifications', { cache: 10_000 }),
  notificationsRead: (ids?: number[]) =>
    fxsim<{ success: true }>('/notifications/read', { body: { ids: ids ?? [] } }),

  // ── API keys ──────────────────────────────────────────────────────────
  apiKeysList:   ()              => fxsim<unknown[]>('/api-keys', { cache: 15_000 }),
  apiKeysCreate: (name: string, scopes: string[], env: string, expires: string) =>
    fxsim<{ success: boolean; key: string; id: number }>('/api-keys', { body: { name, scopes, env, expires } }),
  apiKeysRevoke: (id: number)    => fxsim<{ success: boolean }>(`/api-keys/${id}/revoke`, { method: 'POST' }),

  // ── Admin ─────────────────────────────────────────────────────────────
  admin: {
    stats:        ()                 => fxsim<AdminStats>('/admin/stats',                                { cache: 10_000 }),
    users:        (search?: string)  => fxsim<AdminUserRow[]>('/admin/users',                            { query: { search }, cache: 5_000 }),
    kycList:      (status?: string)  => fxsim<AdminKycRow[]>('/admin/kyc',                                { query: { status }, cache: 5_000 }),
    kycReview:    (id: number, action: 'approve' | 'reject', note: string) =>
      fxsim<{ success: boolean; status?: string; message?: string }>(`/admin/kyc/${id}/review`, { body: { action, note } }),
    payoutsList:  (status?: string)  => fxsim<AdminPayoutRow[]>('/admin/payouts',                         { query: { status }, cache: 5_000 }),
    payoutStatus: (id: number, status: string, note: string, extra?: { tx_reference?: string; proof_url?: string }) =>
      fxsim<{ success: boolean; status?: string; message?: string }>(`/admin/payouts/${id}/status`, { body: { status, note, ...(extra || {}) }, retries: 0 }),
    challenges:   ()                 => fxsim<{ challenges: ChallengeAccount[]; pending_payouts: unknown[] }>('/admin/challenges', { cache: 8_000 }),
    trades:       ()                 => fxsim<Trade[]>('/admin/trades',                                  { cache: 10_000 }),
    log:          ()                 => fxsim<unknown[]>('/admin/log',                                   { cache: 15_000 }),
    pendingOrders: ()                => fxsim<PendingOrder[]>('/admin/pending-orders',                   { cache: 5_000 }),
    pendingReject: (id: number, reason: string) =>
      fxsim<{ success: true }>(`/admin/pending-orders/${id}/reject`, { body: { reason } }),

    adjustBalance: (userId: number, accountId: number, amount: number, note: string) =>
      fxsim<{ success: true; new_balance: number }>('/admin/adjust-balance', { body: { user_id: userId, account_id: accountId, amount, note } }),
    setStatus:    (userId: number, status: string) =>
      fxsim<{ success: boolean; message?: string }>('/admin/set-status', { body: { user_id: userId, status } }),
    userDetail:   (userId: number) => fxsim<AdminUserDetail>(`/admin/user/${userId}`, { cache: 3_000 }),
    risk:         () => fxsim<AdminRisk>('/admin/risk', { cache: 10_000 }),
    bulkPayouts:  (ids: number[], status: string, note?: string) =>
      fxsim<{ success: boolean; processed: number; failed: number }>('/admin/bulk/payouts', { body: { ids, status, note } }),
    bulkKyc:      (ids: number[], action: 'approve' | 'reject', note?: string) =>
      fxsim<{ success: boolean; processed: number; failed: number }>('/admin/bulk/kyc', { body: { ids, action, note } }),
    saveUserNote: (userId: number, note: string) =>
      fxsim<{ success: boolean }>(`/admin/user/${userId}/note`, { body: { note } }),

    plansList:    ()                 => fxsim<ChallengePlan[]>('/admin/plans',                           { cache: 15_000 }),
    planSave:     (data: Partial<ChallengePlan>) =>
      fxsim<{ success: true; id: number }>('/admin/plans/save', { body: data }),

    whitelabelGet:  () => fxsim<Record<string, string>>('/admin/whitelabel',                             { cache: 30_000 }),
    whitelabelSave: (data: Record<string, string>) =>
      fxsim<{ success: true }>('/admin/whitelabel/save', { body: data }),
    brandingUpload: (field: 'logo' | 'login_logo' | 'sidebar_icon' | 'favicon', file: File) => {
      const form = new FormData()
      form.append('field', field)
      form.append('file', file)
      return fxsim<{ success: boolean; url: string; field: string }>('/admin/branding/upload', { form })
    },
    stripeStatus:  () => fxsim<StripeStatus>('/admin/stripe/status', { cache: 0 }),
    demoStatus:    () => fxsim<DemoStatus>('/admin/demo/status', { cache: 10_000 }),
    demoGenerate:  () => fxsim<{ success: boolean; users: number; accounts: number; orders: number; payouts: number; banners: number; message?: string }>('/admin/demo/generate', { body: {} }),
    demoRemove:    () => fxsim<{ success: boolean; removed?: Record<string, number>; message?: string }>('/admin/demo/remove', { body: {} }),
    health:        (deep = true) => fxsim<HealthReport>('/admin/health', { query: { deep: deep ? '1' : '0' }, cache: 0 }),
    cryptoGet:     () => fxsim<{ networks: CryptoNetwork[] }>('/admin/crypto', { cache: 0 }),
    cryptoSave:    (networks: CryptoNetwork[]) =>
      fxsim<{ success: boolean; networks: CryptoNetwork[] }>('/admin/crypto/save', { body: { networks } }),

    paymentsList:    ()              => fxsim<PaymentOrder[]>('/admin/payments',                         { cache: 8_000 }),
    paymentApprove:  (id: number, note: string) =>
      fxsim<{ success: boolean; message?: string }>(`/admin/payments/${id}/approve`, { body: { note } }),
    paymentReject:   (id: number, note: string) =>
      fxsim<{ success: boolean; message?: string }>(`/admin/payments/${id}/reject`, { body: { note } }),

    approvePayout: (challengeId: number, action: 'approve' | 'reject', note: string, reference: string) =>
      fxsim<{ success: true }>(`/admin/challenge/${challengeId}/approve-payout`, { body: { action, note, reference } }),
    saveMt5:       (challengeId: number, body: Record<string, string>) =>
      fxsim<{ success: boolean }>(`/admin/challenge/${challengeId}/mt5-details`, { body }),

    analyticsRevenue:    (period?: string) => fxsim<AnalyticsRevenue>('/admin/analytics/revenue',    { query: { period }, cache: 30_000 }),
    analyticsGrowth:     (period?: string) => fxsim<AnalyticsGrowth>('/admin/analytics/growth',      { query: { period }, cache: 30_000 }),
    analyticsChallenges: () => fxsim<AnalyticsChallenges>('/admin/analytics/challenges',                 { cache: 30_000 }),

    impersonate:  (userId: number)   => fxsim<{ success: boolean; redirect_url: string; message: string }>('/admin/impersonate', { body: { user_id: userId } }),
    impersonateStop: ()              => fxsim<{ success: boolean; nonce?: string; message?: string }>('/admin/impersonate/stop', { body: {} }),
    announcement: (message: string, type: string) =>
      fxsim<{ success: true }>('/admin/announcement', { body: { message, type } }),
    announcementGet: () => fxsim<{ message: string; type: string }>('/admin/announcement'),
    bulkEmail:    (subject: string, message: string, segment: 'all' | 'active' | 'funded' | 'failed') =>
      fxsim<{ success: true; sent: number; errors: number }>('/admin/bulk-email', { body: { subject, message, segment } }),
    notifications:     () => fxsim<AdminNotificationsResp>('/admin/notifications', { cache: 10_000 }),
    bannersList:   () => fxsim<Banner[]>('/admin/banners', { cache: 5_000 }),
    bannerSave:    (b: Partial<Banner>) => fxsim<{ success: boolean; id: number }>('/admin/banners/save', { body: b }),
    bannerToggle:  (id: number) => fxsim<{ success: boolean; active: number }>(`/admin/banners/${id}/toggle`, { body: {} }),
    bannerDelete:  (id: number) => fxsim<{ success: boolean }>(`/admin/banners/${id}/delete`, { body: {} }),
    couponsList:   () => fxsim<Coupon[]>('/admin/coupons', { cache: 5_000 }),
    couponSave:    (c: Omit<Partial<Coupon>, 'plan_ids'> & { plan_ids?: number[] }) => fxsim<{ success: boolean; id: number; message?: string }>('/admin/coupons/save', { body: c }),
    couponToggle:  (id: number) => fxsim<{ success: boolean; active: number }>(`/admin/coupons/${id}/toggle`, { body: {} }),
    couponDelete:  (id: number) => fxsim<{ success: boolean }>(`/admin/coupons/${id}/delete`, { body: {} }),
    affiliatesList: () => fxsim<AdminAffiliate[]>('/admin/affiliates', { cache: 5_000 }),
    affiliateRate:  (id: number, rate: number) => fxsim<{ success: boolean }>(`/admin/affiliates/${id}/rate`, { body: { rate_percent: rate } }),
    affiliateStatus:(id: number, status: 'active' | 'suspended') => fxsim<{ success: boolean }>(`/admin/affiliates/${id}/status`, { body: { status } }),
    affiliatePayouts: (status?: string) => fxsim<AffiliatePayout[]>('/admin/affiliate-payouts', { query: { status }, cache: 5_000 }),
    affiliatePayoutStatus: (id: number, body: { status: 'approved' | 'rejected' | 'paid'; tx_reference?: string; proof_url?: string; note?: string }) =>
      fxsim<{ success: boolean; message?: string }>(`/admin/affiliate-payouts/${id}/status`, { body, retries: 0 }),
    commissionsList:(status?: string) => fxsim<Commission[]>('/admin/commissions', { query: { status }, cache: 5_000 }),
    commissionStatus:(id: number, status: 'approved' | 'paid' | 'reversed') => fxsim<{ success: boolean }>(`/admin/commissions/${id}/status`, { body: { status } }),
    testToolsChallenges: () => fxsim<TestToolChallenge[]>('/admin/test-tools/challenges', { cache: 3_000 }),
    testToolsSet:    (id: number, action: 'phase1' | 'phase2' | 'funded' | 'payout_ready' | 'reset') =>
      fxsim<{ success: boolean; status?: string; message?: string }>(`/admin/test-tools/challenge/${id}/set`, { body: { action } }),
    notificationsRead: (ids?: number[]) =>
      fxsim<{ success: true }>('/admin/notifications/read', { body: { ids: ids ?? [] } }),
    maintenance:  (enabled: boolean, message: string) =>
      fxsim<{ success: true }>('/admin/maintenance', { body: { enabled, message } }),

    smtpGet:  () => fxsim<SmtpConfig>('/admin/smtp', { cache: 0 }),
    smtpSave: (data: Partial<SmtpConfig> & { pass?: string; auth?: boolean }) =>
      fxsim<{ success: boolean }>('/admin/smtp/save', { body: data as Record<string, unknown> }),
    smtpTest: (to?: string) => fxsim<{ success: boolean; message?: string }>('/admin/smtp/test', { body: { to } }),
    priceFeedSave: (data: Record<string, string>) => fxsim<{ success: true }>('/admin/price-feed/save', { body: data }),
    priceFeedHealth: () => fxsim<{
      mode: 'auto' | 'mt5' | 'yahoo'; active_source: string; status: string;
      mt5_last_push_ts: number | null; mt5_age_sec: number | null; mt5_fresh: boolean;
      stale_threshold: number; yahoo_last_ts: number | null; feed_failed: boolean;
      symbol_count: number; secret_set: boolean; market_open: boolean;
    }>('/admin/price-feed/health'),
    forcePrices:  () => fxsim<{ success: true; message: string }>('/admin/force-prices', { method: 'POST' }),
    newsLock:     (locked: boolean) => fxsim<{ success: true; locked: boolean }>('/admin/news-lock', { body: { locked } }),
    rateLimit:    (tier: string, limit: number) => fxsim<{ success: true; tier: string; limit: number }>('/admin/rate-limit', { body: { tier, limit } }),
    symbol:       (id: number, data: Partial<Symbol>) => fxsim<{ success: boolean }>(`/admin/symbol/${id}`, { body: data }),
    symbolsAll:   () => fxsim<Symbol[]>('/admin/symbols'),
  },
}
