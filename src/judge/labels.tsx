/** Every judge-facing string. One language renders at a time (spec §2).
 * Arabic strings are operator-correctable drafts (2026-09-16) — the judges' own
 * terms win; correct here in one place. Numerals stay western via {n} slots. */
export const JUDGE_LABELS = {
  // sections
  hifz:            { en: 'Hifz — memorization',        ar: 'الحفظ' },
  tajweed:         { en: 'Tajweed — recitation',       ar: 'التجويد' },
  voice:           { en: "Sawt wal-Adā' — voice & delivery", ar: 'الصوت والأداء' },
  // deduction names
  self_corrected:  { en: 'Self-corrected',             ar: 'صحّح نفسه' },
  prompted_fixed:  { en: 'Prompted',                   ar: 'لُقِّن' },
  prompted_failed: { en: 'Prompted-failed',            ar: 'لُقِّن ولم يُكمل' },
  tajweed_major:   { en: 'Tajweed major',              ar: 'لحن جليّ' },
  tajweed_minor:   { en: 'Tajweed minor',              ar: 'لحن خفيّ' },
  // deduction descriptions (cards + popover)
  self_corrected_desc:  { en: 'Slipped but caught and fixed it themselves — no penalty, tracked only.', ar: 'أخطأ ثم صحّح نفسه بنفسه — لا خصم، يُسجَّل فقط.' },
  prompted_fixed_desc:  { en: 'Needed a hint to recall the next word, then continued.', ar: 'احتاج إلى تلقين ليتذكّر الكلمة التالية ثم واصل.' },
  prompted_failed_desc: { en: 'Hint given, but still could not continue the passage.', ar: 'لُقِّن ومع ذلك لم يستطع المواصلة.' },
  tajweed_major_desc:   { en: 'A clear tajweed rule was broken (e.g. a missed elongation or rule of nūn).', ar: 'خطأ واضح في أحكام التجويد (كترك مدّ أو حكم نون).' },
  tajweed_minor_desc:   { en: 'A slight imperfection in articulation or pronunciation.', ar: 'خلل يسير في النطق أو الأداء.' },
  // header / status
  sessionScore:    { en: 'Session score',              ar: 'مجموع الجلسة' },
  tieBreakScore:   { en: 'Tie-break score',            ar: 'درجة كسر التعادل' },
  saved:           { en: 'Saved',                      ar: 'تم الحفظ' },
  saving:          { en: 'Saving…',                    ar: 'جارٍ الحفظ…' },
  offlineSaved:    { en: 'Offline · saved on device',  ar: 'غير متصل · محفوظ على الجهاز' },
  gradedLocked:    { en: 'Graded · locked',            ar: 'مُقيَّم · مقفل' },
  // actions
  finish:          { en: 'Finish',                     ar: 'إنهاء' },
  saveExit:        { en: 'Save & exit',                ar: 'حفظ وخروج' },
  backToQueue:     { en: 'Back to queue',              ar: 'العودة إلى القائمة' },
  reopenEdit:      { en: 'Reopen to edit',             ar: 'إعادة فتح للتعديل' },
  cancel:          { en: 'Cancel',                     ar: 'إلغاء' },
  submitTieBreak:  { en: 'Submit tie-break',           ar: 'إرسال كسر التعادل' },
  resetPoints:     { en: 'Reset points',               ar: 'إعادة تصفير' },
  disqualifyQ:     { en: 'Disqualify question',        ar: 'إلغاء السؤال' },
  restoreQ:        { en: 'Restore question',           ar: 'استرجاع السؤال' },
  addQuestion:     { en: '+ Add question',             ar: '+ أضف سؤالًا' },
  rules:           { en: 'Rules',                      ar: 'القوانين' },
  // question rail / chips
  questions:       { en: 'Questions',                  ar: 'الأسئلة' },
  question:        { en: 'Question',                   ar: 'السؤال' },
  addedQuestion:   { en: 'Added question',             ar: 'سؤال مضاف' },
  marks:           { en: 'marks',                      ar: 'علامات' },
  notRated:        { en: 'not rated',                  ar: 'لم يُقيَّم' },
  voiceNotRatedDot:{ en: 'Voice not rated yet',        ar: 'الصوت لم يُقيَّم بعد' },
  removeQuestion:  { en: 'Remove question',            ar: 'حذف السؤال' },
  // DQ
  dqTitle:         { en: 'Call it?',                   ar: 'أتحسمها؟' },
  dqKeep:          { en: 'Keep it',                    ar: 'أبقِه' },
  dqConfirm:       { en: 'Disqualify',                 ar: 'ألغِ السؤال' },
  dqBanner:        { en: 'Disqualified question',      ar: 'سؤال ملغى' },
  dqBannerDetail:  { en: 'All components zeroed — written off.', ar: 'صُفِّرت جميع المكوّنات — شُطب السؤال.' },
  // side panel
  scoreBreakdown:  { en: 'Score breakdown',            ar: 'تفصيل الدرجات' },
  notes:           { en: 'Notes',                      ar: 'ملاحظات' },
  notesPlaceholder:{ en: 'Private notes for this contestant…', ar: 'ملاحظات خاصة بهذا المتسابق…' },
  panelCompleteness:{ en: 'Panel completeness',        ar: 'اكتمال اللجنة' },
  judgesStarted:   { en: 'judges started',             ar: 'من الحكام بدأوا' },
  rateAsYouGo:     { en: 'rate as you go',             ar: 'قيّم أولًا بأول' },
  // banners
  lockedBanner:    { en: '✓ This session is graded & locked — scores are read-only. Tap “Reopen to edit” to change anything.', ar: '✓ هذه الجلسة مُقيَّمة ومقفلة — الدرجات للقراءة فقط. اضغط «إعادة فتح للتعديل» لأي تغيير.' },
  voiceNudge:      { en: 'Rate voice on every question before finishing — jumped you to the next unrated one.', ar: 'قيّم الصوت في كل سؤال قبل الإنهاء — نقلناك إلى أول سؤال غير مقيَّم.' },
  tieBreakHeader:  { en: '⚖︎ Sudden-death tie-break — grade one question', ar: '⚖︎ جولة حاسمة لكسر التعادل — قيّم سؤالًا واحدًا' },
  // dashboard
  queue:           { en: 'Queue',                      ar: 'القائمة' },
  tieBreaks:       { en: 'Tie-breaks',                 ar: 'كسر التعادل' },
  toGrade:         { en: 'to grade',                   ar: 'للتقييم' },
  graded:          { en: 'graded',                     ar: 'تم تقييمهم' },
  gradedStatus:    { en: 'Graded',                     ar: 'تم التقييم' },
  inProgress:      { en: 'In progress',                ar: 'قيد التقييم' },
  notStarted:      { en: 'Not started',                ar: 'لم يبدأ' },
  notYetGraded:    { en: 'Not yet graded',             ar: 'لم يُقيَّم بعد' },
  emptyQueue:      { en: 'No contestants assigned to your panel yet.', ar: 'لا يوجد متسابقون معيّنون للجنتك بعد.' },
  gradeArrow:      { en: 'Grade →',                    ar: 'قيِّم ←' },
  suddenDeath:     { en: 'sudden-death',               ar: 'جولة حاسمة' },
  noTieBreaks:     { en: 'No tie-breaks right now.',   ar: 'لا يوجد كسر تعادل حاليًا.' },
  noTieBreaksDetail:{ en: 'When the admin starts a sudden-death, the tied contestants appear here for you to re-grade.', ar: 'عند بدء المشرف جولةً حاسمة، يظهر المتعادلون هنا لإعادة تقييمهم.' },
  getStarted:      { en: 'Get Started',                ar: 'ابدأ' },
} as const;

export type LabelKey = keyof typeof JUDGE_LABELS;
export type JudgeLang = 'en' | 'ar';

export function t(key: LabelKey, lang: JudgeLang): string {
  return JUDGE_LABELS[key][lang];
}

/** Renders the ONE selected language; Arabic isolated rtl (layout stays LTR). */
export function L({ k, lang, style }: { k: LabelKey; lang: JudgeLang; style?: React.CSSProperties }) {
  const s = t(k, lang);
  return lang === 'ar'
    ? <span lang="ar" dir="rtl" style={{ unicodeBidi: 'isolate', ...style }}>{s}</span>
    : <span style={style}>{s}</span>;
}
