// هوية «نور» — نفس ألوان المنصة وتصميم Stitch
export const C = {
  teal: '#0E8C93',
  tealD: '#0B5F73',
  tealL: '#E3F4F4',
  tealXL: '#F2FAFA',
  navy: '#0E2A3B',
  ink: '#1B2B36',
  muted: '#667985',
  line: '#E3EAEE',
  bg: '#F5F8FA',
  card: '#FFFFFF',
  gold: '#F5B83D',
  goldL: '#FFF4DB',
  red: '#D64545',
  redL: '#FDECEC',
  green: '#1F9D63',
  greenL: '#E5F6EE',
  amber: '#C47F00',
  amberL: '#FFF3D6',
  dark: '#0B1620',
  darkPanel: '#0E2A3B',
  overlay: '#9FE3E6',
};

export const CAT: Record<string, { fg: string; bg: string; icon: string }> = {
  imaging: { fg: '#3D6FE0', bg: '#E8EFFD', icon: 'radiology-box-outline' },
  lab: { fg: '#1F9D63', bg: '#E5F6EE', icon: 'test-tube' },
  report: { fg: '#8A4FD8', bg: '#F1EAFC', icon: 'file-document-outline' },
  prescription: { fg: '#E0703D', bg: '#FDEEE6', icon: 'pill' },
  other: { fg: '#5F7380', bg: '#EDF1F3', icon: 'folder-outline' },
};

export const R = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

export const F = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  black: 'Tajawal_800ExtraBold',
};

export const shadow = {
  shadowColor: '#0E2A3B',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
