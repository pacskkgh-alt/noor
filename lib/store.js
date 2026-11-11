// تخزين البيانات في ملف JSON (مناسب للنموذج الأولي — يُستبدل بقاعدة بيانات عند الإطلاق)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makePdf, makeDicom, makeHeadCT } = require('./samples');

const DATA = process.env.NOOR_DATA || path.join(__dirname, '..', 'data');
const UPLOADS = path.join(DATA, 'uploads');
const DB_FILE = path.join(DATA, 'db.json');
const SECRET_FILE = path.join(DATA, 'secret.key');
fs.mkdirSync(UPLOADS, { recursive: true });

if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

const empty = () => ({ users: [], files: [], shares: [], notes: [], centers: [], activity: [], sessions: {} });
const db = fs.existsSync(DB_FILE) ? { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } : empty();

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}
const uid = () => crypto.randomBytes(9).toString('base64url');

function writeUpload(buf, ext) {
  const name = crypto.randomBytes(16).toString('hex') + ext;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return { storedName: name, size: buf.length };
}

function ensureSeed(hashPassword) {
  if (db.users.length) return;
  const now = Date.now();
  const iso = d => new Date(now - d * 864e5).toISOString();

  const admin = { id: uid(), name: 'مدير المنصة', email: 'admin@noor.app', phone: '', role: 'admin', status: 'active', passwordHash: hashPassword('Admin@1234'), createdAt: iso(30) };
  const patient = { id: uid(), name: 'سارة أحمد', email: 'patient@noor.app', phone: '966500000001', role: 'patient', status: 'active', passwordHash: hashPassword('Patient@1234'), createdAt: iso(20) };

  const lic1 = writeUpload(makePdf([[20, 'Medical Practice License', true], [12, 'Name: Dr. Khalid Al-Omari'], [12, 'Specialty: Radiology'], [12, 'License No: 12-RA-45821'], [12, 'Valid until: 2028-06-30']]), '.pdf');
  const doctor = {
    id: uid(), name: 'د. خالد العمري', email: 'doctor@noor.app', phone: '966500000002', role: 'doctor', status: 'active',
    passwordHash: hashPassword('Doctor@1234'), createdAt: iso(18),
    doctor: { specialty: 'أشعة تشخيصية', licenseNumber: '12-RA-45821', verification: 'approved', reviewedAt: iso(17), licenseFile: { ...lic1, originalName: 'license.pdf', mime: 'application/pdf', kind: 'pdf' } },
  };
  const lic2 = writeUpload(makePdf([[20, 'Medical Practice License', true], [12, 'Name: Dr. Mona Al-Harbi'], [12, 'Specialty: Internal Medicine'], [12, 'License No: 09-IM-77310']]), '.pdf');
  const pending = {
    id: uid(), name: 'د. منى الحربي', email: 'mona@noor.app', phone: '966500000003', role: 'doctor', status: 'active',
    passwordHash: hashPassword('Doctor@1234'), createdAt: iso(1),
    doctor: { specialty: 'باطنية', licenseNumber: '09-IM-77310', verification: 'pending', licenseFile: { ...lic2, originalName: 'license.pdf', mime: 'application/pdf', kind: 'pdf' } },
  };
  db.users.push(admin, patient, doctor, pending);

  db.centers.push(
    { id: uid(), name: 'مستشفى الشفاء التخصصي', nameEn: 'Al-Shifa Specialist Hospital', city: 'الرياض', type: 'hospital', email: 'records@alshifa.example', whatsapp: '966110000001', createdAt: iso(25) },
    { id: uid(), name: 'مختبرات الدقة الطبية', nameEn: 'Precision Medical Labs', city: 'جدة', type: 'lab', email: 'lab@precision.example', whatsapp: '966120000002', createdAt: iso(25) },
    { id: uid(), name: 'مركز الرؤية للأشعة', nameEn: 'Vision Radiology Center', city: 'الدمام', type: 'radiology', email: 'info@vision.example', whatsapp: '966130000003', createdAt: iso(24) },
  );

  const pdf = writeUpload(makePdf([
    [22, 'Precision Medical Labs', true], [11, 'Complete Blood Count (CBC) - Lab Report'], [11, 'Patient: Sara Ahmed      Date: 2026-10-28'], [6, ' '],
    [12, 'Test                    Result     Unit         Reference', true],
    [12, 'Hemoglobin              13.2       g/dL         12.0 - 15.5'],
    [12, 'WBC                     6.8        x10^9/L      4.0 - 11.0'],
    [12, 'Platelets               265        x10^9/L      150 - 450'],
    [12, 'Glucose (fasting)       92         mg/dL        70 - 100'],
    [12, 'Vitamin D               18         ng/mL        30 - 100   (LOW)'],
    [6, ' '], [10, 'This is a SAMPLE document generated for the Noor demo.'],
  ]), '.pdf');
  const dcm = writeUpload(makeDicom({ patientName: 'AHMED^SARA', studyDate: '20261101' }), '.dcm');
  const f1 = { id: uid(), ownerId: patient.id, title: 'تحليل صورة دم كاملة', category: 'lab', examDate: '2026-10-28', center: 'مختبرات الدقة الطبية', notes: '', originalName: 'cbc-report.pdf', storedName: pdf.storedName, mime: 'application/pdf', size: pdf.size, kind: 'pdf', createdAt: iso(10) };
  const f2 = { id: uid(), ownerId: patient.id, title: 'أشعة صدر سينية', category: 'imaging', examDate: '2026-11-01', center: 'مركز الرؤية للأشعة', notes: 'متابعة سعال مستمر', originalName: 'chest-xray.dcm', storedName: dcm.storedName, mime: 'application/dicom', size: dcm.size, kind: 'dicom', createdAt: iso(7) };
  const ct = makeHeadCT().map(buf => writeUpload(buf, '.dcm'));
  const f3 = { id: uid(), ownerId: patient.id, title: 'أشعة مقطعية للرأس', category: 'imaging', examDate: '2026-11-05', center: 'مستشفى الشفاء التخصصي', notes: '', originalName: 'CT HEAD WITHOUT CONTRAST.zip', storedName: ct[0].storedName, slices: ct.map(c => c.storedName), mime: 'application/dicom', size: ct.reduce((a, c) => a + c.size, 0), kind: 'dicom', createdAt: iso(4) };
  db.files.push(f1, f2, f3);

  db.shares.push({
    id: uid(), ownerId: patient.id, fileIds: [f2.id], recipientType: 'doctor', doctorId: doctor.id, centerId: null,
    recipientName: doctor.name, recipientPhone: doctor.phone, recipientEmail: doctor.email, method: 'whatsapp',
    message: 'دكتور، أرجو الاطلاع على الأشعة قبل موعدي القادم.',
    token: crypto.randomBytes(18).toString('base64url'), pin: '2468',
    expiresAt: new Date(now + 6 * 864e5).toISOString(), revoked: false, failedAttempts: 0,
    accessLog: [{ at: iso(5), ip: '127.0.0.1', action: 'opened' }], createdAt: iso(6),
  });
  db.notes.push({ id: uid(), fileId: f2.id, doctorId: doctor.id, text: 'الرئتان سليمتان ولا توجد علامات التهاب. يُنصح بالمتابعة إذا استمر السعال أكثر من أسبوعين.', createdAt: iso(5) });

  const act = (userId, action, details, d) => db.activity.push({ id: uid(), userId, action, details, ip: '127.0.0.1', at: iso(d) });
  act(doctor.id, 'note_added', { fileId: f2.id, title: f2.title, ownerId: patient.id }, 5);
  act(patient.id, 'share_created', { recipient: doctor.name, recipientType: 'doctor', files: 1 }, 6);
  act(patient.id, 'file_uploaded', { title: f2.title }, 7);
  act(patient.id, 'file_uploaded', { title: f1.title }, 10);
  db.activity.sort((a, b) => b.at.localeCompare(a.at));
  save();
  console.log('تم إنشاء البيانات التجريبية.');
}

module.exports = { db, save, uid, UPLOADS, SECRET, ensureSeed };
