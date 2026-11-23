# برومبت Stitch — تطبيق «نور» للجوال

> طريقة الاستخدام: في Stitch اختر **Mobile**، والصق «البرومبت الرئيسي» أولاً. بعدها أضف الشاشات واحدة واحدة بالبرومبتات القصيرة في القسم الثاني، حتى يحافظ Stitch على نفس الهوية في كل الشاشات.

---

## 1) البرومبت الرئيسي (الصقه أولاً)

```
Design a mobile app (iOS & Android, 390×844) called "Noor" (نور) — a medical records platform where patients store their medical files (lab PDFs, photos, X-ray/CT/MRI DICOM studies, videos) and share them securely with doctors and health centers. Similar in purpose to PocketHealth.

LANGUAGE & DIRECTION
- Primary language Arabic, full RTL layout (navigation, icons, back arrows, progress bars all mirrored). Include an English/LTR toggle in settings.
- Font: Tajawal (weights 400, 500, 700, 800). Numbers, emails and phone numbers stay LTR.

BRAND COLORS (use exactly)
- Primary teal #0E8C93, dark teal #0B5F73, light teal #E3F4F4, extra-light teal #F2FAFA
- Navy (headings, dark surfaces, active chips) #0E2A3B
- Body text #1B2B36, secondary text #667985, borders #E3EAEE
- App background #F5F8FA, cards #FFFFFF
- Accent gold #F5B83D (badges, highlights) with light gold #FFF4DB
- Success #1F9D63 / #E5F6EE, Error #D64545 / #FDECEC, Warning #C47F00 / #FFF3D6
- File category colors (icon tile = color on its light tint):
  Imaging #3D6FE0 on #E8EFFD · Lab #1F9D63 on #E5F6EE · Report #8A4FD8 on #F1EAFC · Prescription #E0703D on #FDEEE6 · Other #5F7380 on #EDF1F3
- Medical image viewer uses a dark theme: background #0B1620, panels #0E2A3B, overlay text #9FE3E6.

STYLE
- Clean, calm, trustworthy medical look. Soft shadows (0 4px 16px rgba(14,42,59,.06)), corner radius 14px for cards, 10px for inputs/buttons, pill-shaped filter chips.
- Logo: a small teal rounded-square tile with a light/sun-like mark, wordmark "نور".
- Line icons (2px stroke). Generous spacing, large touch targets (min 48px).
- Primary buttons: solid teal #0E8C93 white text. Secondary: white with #E3EAEE border. Destructive: #D64545.
- Bottom tab bar for patients: ملفاتي (My files) · المشاركات (Shares) · رفع (Upload — prominent center teal button) · حسابي (Account).

Start with the patient home screen "ملفاتي الطبية" (My medical files): header with greeting "أهلاً سارة", 4 small stat cards (5 ملفات · 3 أشعة · 10.2 MB · 1 ملاحظة طبيب), a search field "ابحث باسم الفحص أو المركز…", category chips (الكل, أشعة, تحاليل, تقارير, وصفات, أخرى), then file cards. Each card: colored category icon tile, title (e.g. "أشعة مقطعية للرأس"), subtitle "CT • سلسلتان • 65 صورة", date and hospital name, and small badges (e.g. "ملاحظة طبيب"). Imaging cards show a dark thumbnail of the scan.
```

---

## 2) شاشات إضافية (برومبت لكل شاشة)

**الترحيب وتسجيل الدخول**
```
Same Noor design system. Onboarding + login screen: large logo, tagline "كل فحوصاتك الطبية في مكان واحد", email and password fields, "نسيت كلمة المرور؟" link, teal "تسجيل الدخول" button, and "ليس لديك حساب؟ إنشاء حساب". Register screen adds: full name, mobile number (placeholder 05XXXXXXXX, hint "سيصلك رمز تحقق برسالة نصية"), and a role switch: مريض / طبيب (doctor shows specialty, license number, license file upload).
```

**رمز التحقق بالجوال**
```
Same Noor design system. OTP verification screen: title "تأكيد رقم الجوال", text "أرسلنا رمزاً من 6 أرقام إلى ‎+966 5•• ••• 123", six large LTR digit boxes, countdown "إعادة الإرسال بعد 45 ثانية", teal "تحقق" button, and a back link.
```

**رفع فحص**
```
Same Noor design system. Upload flow as a bottom sheet / full screen: source options (الكاميرا، الصور، الملفات، قرص الأشعة كاملاً). Then a review list with thumbnails and per-file status (✓ green, ✗ red, progress bar while uploading), fields: اسم الفحص، التصنيف، تاريخ الفحص، المركز الصحي، ملاحظات. A terms checkbox "أوافق على شروط الاستخدام" before the first upload. Show a grouped result: "تم تجميع 412 صورة في دراسة واحدة: CT BRAIN".
```

**عارض الأشعة (داكن)**
```
Same Noor design system, dark viewer theme (#0B1620). Full-screen DICOM viewer for a CT study: the image in the center with corner overlays in monospace #9FE3E6 ("Im 24/64  Thk 3.0mm", "W 80 L 40"), a vertical slice scrubber, a horizontal strip of series thumbnails at the bottom (SCOUT · 1 صورة, HEAD WITHOUT CONTRAST · 64 صورة), and a compact toolbar: contrast, zoom, pan, play (cine), presets (دماغ، عظم، رئة), and a gold-outlined "أدوات متقدمة" button. A pull-up panel "ملاحظات الطبيب".
```

**مشاركة فحص**
```
Same Noor design system. Share flow: choose recipient type as 3 cards (طبيب موثّق، مركز صحي، أي شخص), search list of verified doctors with specialty and a green "موثّق" badge, choose method (واتساب، البريد، رابط فقط), validity duration chips (يوم، 7 أيام، 30 يوماً). Success screen: share link card with a 4-digit access code in large LTR digits, copy and WhatsApp buttons, expiry date.
```

**المشاركات**
```
Same Noor design system. "مشاركاتي" list: each share card shows recipient name and type, files included, status pill (فعّالة green / منتهية grey / ملغاة red), expiry date, view count "فُتح 3 مرات", and actions: إلغاء، تمديد، سجل الدخول. Tapping opens an access log timeline (opened / viewed / downloaded with time).
```

**صفحة الرابط للطبيب (بدون حساب)**
```
Same Noor design system. Public share page opened from a link: Noor logo, "سارة أحمد شاركت معك 2 ملف", a 4-digit PIN entry, then the list of shared files with "عرض" and download buttons, and a privacy note with a shield icon.
```

**صندوق الطبيب**
```
Same Noor design system, doctor role. Bottom tabs: الوارد · حسابي. Inbox of patient shares: patient name, message from patient, files with category icons, "تنتهي بعد 5 أيام" pill, and a badge for unread. A pending state for unverified doctors: amber card "حسابك قيد المراجعة".
```

**حسابي والإعدادات**
```
Same Noor design system. Account screen: avatar initial, name, email, verified phone with green ✓ and "تغيير الرقم", change password, language toggle العربية / English, terms & privacy, and a red "تسجيل الخروج".
```
