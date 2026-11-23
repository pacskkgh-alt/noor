// اللغة والاتجاه: العربية (يمين لليسار) والإنجليزية
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import shared from './shared-strings.json';

type Lang = 'ar' | 'en';

const S = {
  ar: {
    brand: 'نور', tagline: 'كل فحوصاتك الطبية في مكان واحد',
    'tab.files': 'ملفاتي', 'tab.shares': 'المشاركات', 'tab.upload': 'رفع', 'tab.account': 'حسابي', 'tab.inbox': 'الوارد',
    'auth.login': 'تسجيل الدخول', 'auth.register': 'إنشاء حساب', 'auth.email': 'البريد الإلكتروني', 'auth.password': 'كلمة المرور',
    'auth.name': 'الاسم الكامل', 'auth.mobile': 'رقم الجوال', 'auth.mobileHint': 'سيصلك رمز تحقق برسالة نصية على هذا الرقم',
    'auth.forgot': 'نسيت كلمة المرور؟', 'auth.noAccount': 'ليس لديك حساب؟', 'auth.haveAccount': 'لديك حساب؟',
    'auth.patient': 'مريض', 'auth.doctor': 'طبيب', 'auth.doctorWeb': 'تسجيل الأطباء يتطلب رفع الرخصة، ويتم من موقع نور. بعد التوثيق تستطيع الدخول من التطبيق.',
    'auth.openSite': 'فتح موقع نور', 'auth.pwHint': '8 أحرف على الأقل', 'auth.welcome': 'أهلاً {name}',
    'auth.forgotTitle': 'استعادة كلمة المرور', 'auth.forgotSub': 'أدخل بريدك أو رقم جوالك المسجل', 'auth.identifier': 'البريد أو رقم الجوال',
    'auth.newPassword': 'كلمة المرور الجديدة', 'auth.send': 'إرسال الرمز', 'auth.secure': 'اتصال مشفّر • لا يرى ملفاتك إلا من تشاركه',
    'otp.title': 'تأكيد رقم الجوال', 'otp.titleLogin': 'التحقق من هويتك', 'otp.sentTo': 'أرسلنا رمزاً من 6 أرقام إلى {phone}',
    'otp.sentGeneric': 'إذا كان الحساب مسجلاً، سيصل رمز من 6 أرقام إلى الجوال المرتبط به.', 'otp.verify': 'تحقق',
    'otp.resendIn': 'إعادة الإرسال بعد {s} ثانية', 'otp.resend': 'إعادة إرسال الرمز', 'otp.dev': 'وضع تجريبي، الرمز هو: {code}',
    'otp.addPhone': 'أضف رقم جوالك', 'otp.addPhoneSub': 'لحماية حسابك، الدخول يتطلب رمز تحقق على الجوال.', 'otp.back': 'رجوع',
    'home.hello': 'أهلاً {name}', 'home.safe': 'ملفاتك محفوظة ولا يراها إلا من تشاركه معه', 'home.search': 'ابحث باسم الفحص أو المركز…',
    'home.latest': 'أحدث الفحوصات والملفات', 'home.files': 'ملفات', 'home.imaging': 'دراسات أشعة', 'home.storage': 'المساحة',
    'home.notes': 'ملاحظات طبيب', 'home.empty': 'لا توجد ملفات بعد', 'home.emptySub': 'ارفع أول فحص لك من زر (+) بالأسفل',
    'home.noResults': 'لا توجد نتائج', 'cat.all': 'الكل', 'home.series': '{n} سلاسل', 'home.images': '{n} صورة',
    'home.hasNotes': 'ملاحظة طبيب', 'home.processing': 'جارٍ الضغط', 'home.dicomPreview': 'معاينة الأشعة', 'home.open': 'عرض',
    'file.details': 'تفاصيل الفحص', 'file.center': 'المركز', 'file.date': 'تاريخ الفحص', 'file.size': 'الحجم',
    'file.openViewer': 'فتح عارض الأشعة الكامل', 'file.open': 'فتح الملف', 'file.share': 'مشاركة الفحص', 'file.delete': 'حذف',
    'file.confirmDelete': 'هل تريد حذف «{title}»؟ سيُزال من حسابك ومن كل المشاركات.', 'file.deleted': 'تم الحذف',
    'file.notes': 'ملاحظات الأطباء', 'file.noNotes': 'لا توجد ملاحظات بعد. شارك الفحص مع طبيبك ليكتب قراءته.', 'file.series': 'سلاسل الدراسة',
    'file.report': 'التقرير المرفق', 'file.notesField': 'ملاحظاتك', 'file.patientNotes': 'ملاحظات المريض',
    'up.title': 'رفع فحص', 'up.camera': 'الكاميرا', 'up.photos': 'الصور', 'up.files': 'الملفات', 'up.filesSub': 'PDF أو أشعة DICOM أو فيديو',
    'up.name': 'اسم الفحص', 'up.category': 'التصنيف', 'up.date': 'تاريخ الفحص', 'up.datePh': 'YYYY-MM-DD', 'up.center': 'المركز الصحي',
    'up.notes': 'ملاحظات', 'up.terms': 'أوافق على شروط الاستخدام وسياسة الخصوصية', 'up.send': 'رفع {n} ملف', 'up.pick': 'اختر الملفات أولاً',
    'up.done': 'تم الرفع', 'up.sending': 'جارٍ الرفع…', 'up.skipped': 'تم تجاهل {n} ملف غير مدعوم', 'up.selected': 'الملفات المختارة',
    'up.cdHint': 'لرفع قرص أشعة كامل (CD) استخدم موقع نور من الكمبيوتر.',
    'sh.title': 'مشاركاتي', 'sh.empty': 'لم تشارك أي فحص بعد', 'sh.active': 'فعّالة', 'sh.expired': 'منتهية', 'sh.revoked': 'ملغاة',
    'sh.until': 'صالحة حتى {date}', 'sh.views': 'فُتح {n} مرة', 'sh.revoke': 'إلغاء', 'sh.confirmRevoke': 'إلغاء هذه المشاركة؟ لن يتمكن المستلم من فتح الرابط.',
    'sh.pin': 'رمز الدخول', 'sh.copyLink': 'نسخ الرابط', 'sh.copied': 'تم النسخ', 'sh.files': '{n} ملف',
    'in.title': 'الفحوصات الواردة', 'in.empty': 'لا توجد فحوصات مشاركة معك حالياً', 'in.pending': 'حسابك قيد المراجعة',
    'in.pendingSub': 'نراجع رخصتك، وستصلك الفحوصات بعد التوثيق.', 'in.from': 'من {name}', 'in.expires': 'تنتهي {date}',
    'acc.title': 'حسابي', 'acc.phone': 'الجوال', 'acc.verified': 'موثّق', 'acc.lang': 'اللغة', 'acc.logout': 'تسجيل الخروج',
    'acc.terms': 'الشروط وسياسة الخصوصية', 'acc.version': 'الإصدار {v}', 'acc.role': 'نوع الحساب', 'acc.confirmLogout': 'تسجيل الخروج من التطبيق؟',
    retry: 'إعادة المحاولة', cancel: 'إلغاء', confirm: 'تأكيد', close: 'إغلاق', loading: 'جارٍ التحميل…',
    'err.network': 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً',
  },
  en: {
    brand: 'Noor', tagline: 'All your medical records in one place',
    'tab.files': 'My files', 'tab.shares': 'Shares', 'tab.upload': 'Upload', 'tab.account': 'Account', 'tab.inbox': 'Inbox',
    'auth.login': 'Sign in', 'auth.register': 'Create account', 'auth.email': 'Email', 'auth.password': 'Password',
    'auth.name': 'Full name', 'auth.mobile': 'Mobile number', 'auth.mobileHint': 'We’ll text a verification code to this number',
    'auth.forgot': 'Forgot password?', 'auth.noAccount': 'No account?', 'auth.haveAccount': 'Have an account?',
    'auth.patient': 'Patient', 'auth.doctor': 'Doctor', 'auth.doctorWeb': 'Doctor sign-up requires uploading a license and is done on the Noor website. Once verified, you can sign in from the app.',
    'auth.openSite': 'Open Noor website', 'auth.pwHint': 'At least 8 characters', 'auth.welcome': 'Welcome, {name}',
    'auth.forgotTitle': 'Reset password', 'auth.forgotSub': 'Enter your registered email or mobile', 'auth.identifier': 'Email or mobile',
    'auth.newPassword': 'New password', 'auth.send': 'Send code', 'auth.secure': 'Encrypted connection • only people you share with can see your files',
    'otp.title': 'Confirm your number', 'otp.titleLogin': 'Verify it’s you', 'otp.sentTo': 'We sent a 6-digit code to {phone}',
    'otp.sentGeneric': 'If the account exists, a 6-digit code will be sent to its mobile.', 'otp.verify': 'Verify',
    'otp.resendIn': 'Resend in {s}s', 'otp.resend': 'Resend code', 'otp.dev': 'Demo mode, the code is: {code}',
    'otp.addPhone': 'Add your mobile', 'otp.addPhoneSub': 'To protect your account, sign-in requires a code sent to your mobile.', 'otp.back': 'Back',
    'home.hello': 'Hello {name}', 'home.safe': 'Your files are private; only people you share with can see them', 'home.search': 'Search by exam or center…',
    'home.latest': 'Latest exams and files', 'home.files': 'Files', 'home.imaging': 'Imaging studies', 'home.storage': 'Storage',
    'home.notes': 'Doctor notes', 'home.empty': 'No files yet', 'home.emptySub': 'Upload your first exam with the (+) button below',
    'home.noResults': 'No results', 'cat.all': 'All', 'home.series': '{n} series', 'home.images': '{n} images',
    'home.hasNotes': 'Doctor note', 'home.processing': 'Compressing', 'home.dicomPreview': 'Imaging preview', 'home.open': 'View',
    'file.details': 'Exam details', 'file.center': 'Center', 'file.date': 'Exam date', 'file.size': 'Size',
    'file.openViewer': 'Open full imaging viewer', 'file.open': 'Open file', 'file.share': 'Share exam', 'file.delete': 'Delete',
    'file.confirmDelete': 'Delete “{title}”? It will be removed from your account and all shares.', 'file.deleted': 'Deleted',
    'file.notes': 'Doctor notes', 'file.noNotes': 'No notes yet. Share the exam with your doctor to get their reading.', 'file.series': 'Study series',
    'file.report': 'Attached report', 'file.notesField': 'Your notes', 'file.patientNotes': 'Patient notes',
    'up.title': 'Upload exam', 'up.camera': 'Camera', 'up.photos': 'Photos', 'up.files': 'Files', 'up.filesSub': 'PDF, DICOM imaging or video',
    'up.name': 'Exam name', 'up.category': 'Category', 'up.date': 'Exam date', 'up.datePh': 'YYYY-MM-DD', 'up.center': 'Health center',
    'up.notes': 'Notes', 'up.terms': 'I agree to the Terms of Use and Privacy Policy', 'up.send': 'Upload {n} files', 'up.pick': 'Pick files first',
    'up.done': 'Uploaded', 'up.sending': 'Uploading…', 'up.skipped': '{n} unsupported files were skipped', 'up.selected': 'Selected files',
    'up.cdHint': 'To upload a full imaging CD, use the Noor website on a computer.',
    'sh.title': 'My shares', 'sh.empty': 'You haven’t shared any exam yet', 'sh.active': 'Active', 'sh.expired': 'Expired', 'sh.revoked': 'Revoked',
    'sh.until': 'Valid until {date}', 'sh.views': 'Opened {n} times', 'sh.revoke': 'Revoke', 'sh.confirmRevoke': 'Revoke this share? The recipient won’t be able to open the link.',
    'sh.pin': 'Access code', 'sh.copyLink': 'Copy link', 'sh.copied': 'Copied', 'sh.files': '{n} files',
    'in.title': 'Incoming exams', 'in.empty': 'No exams are shared with you right now', 'in.pending': 'Your account is under review',
    'in.pendingSub': 'We’re reviewing your license; exams will arrive after verification.', 'in.from': 'From {name}', 'in.expires': 'Expires {date}',
    'acc.title': 'Account', 'acc.phone': 'Mobile', 'acc.verified': 'Verified', 'acc.lang': 'Language', 'acc.logout': 'Sign out',
    'acc.terms': 'Terms & privacy', 'acc.version': 'Version {v}', 'acc.role': 'Account type', 'acc.confirmLogout': 'Sign out of the app?',
    retry: 'Retry', cancel: 'Cancel', confirm: 'Confirm', close: 'Close', loading: 'Loading…',
    'err.network': 'Couldn’t reach the server. Check your connection and try again',
  },
};

const dict: Record<Lang, Record<string, string>> = {
  ar: { ...(shared.ar as Record<string, string>), ...S.ar },
  en: { ...(shared.en as Record<string, string>), ...S.en },
};

type Ctx = {
  lang: Lang;
  rtl: boolean;
  t: (k: string, v?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  // اتجاه الصفوف ومحاذاة النص بحسب اللغة (يعمل سواء فعّل النظام RTL أم لا)
  row: 'row' | 'row-reverse';
  align: 'left' | 'right';
  errMsg: (e: any) => string;
  fmtDate: (d?: string, withTime?: boolean) => string;
  fmtSize: (n?: number) => string;
};
const I18nCtx = createContext<Ctx>(null as unknown as Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const device = (getLocales()[0]?.languageCode || 'ar') === 'en' ? 'en' : 'ar';
  const [lang, setL] = useState<Lang>(device);
  useEffect(() => {
    (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem('noor_lang')) : SecureStore.getItemAsync('noor_lang'))
      .then(v => { if (v === 'ar' || v === 'en') setL(v); })
      .catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    setL(l);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem('noor_lang', l);
    else SecureStore.setItemAsync('noor_lang', l).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(() => {
    const rtl = lang === 'ar';
    // إذا كان النظام نفسه يقلب الاتجاه (جهاز عربي) فلا نقلب مرة ثانية
    const sysRTL = !!(I18nManager.isRTL ?? I18nManager.getConstants?.().isRTL);
    const flip = rtl !== sysRTL;
    const t = (k: string, v?: Record<string, string | number>) => {
      let s = dict[lang][k] ?? dict.ar[k] ?? k;
      if (v) for (const [a, b] of Object.entries(v)) s = s.replace(`{${a}}`, String(b));
      return s;
    };
    const locale = rtl ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    return {
      lang, rtl, t, setLang,
      row: flip ? 'row-reverse' : 'row',
      align: flip ? 'right' : 'left',
      errMsg: (e: any) => {
        const k = 'err.' + (e?.code || 'server_error');
        return dict[lang][k] ? t(k) : t('err.server_error');
      },
      fmtDate: (d, withTime) => {
        if (!d) return '';
        const x = new Date(d);
        if (isNaN(+x)) return d;
        return x.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
      },
      fmtSize: n => {
        if (!n) return '0 KB';
        if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
        if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
        return `${(n / 1024 ** 3).toFixed(2)} GB`;
      },
    };
  }, [lang, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
export const useI18n = () => useContext(I18nCtx);
