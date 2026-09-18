/** Every judge-facing string. One language renders at a time (spec §2).
 * Arabic now tracks the operator's 2026-09-18 English framing; still operator-correctable —
 * the judges' own terms win; correct here in one place. Numerals stay western via {n} slots. */
export const JUDGE_LABELS = {
  // sections
  hifz:            { en: 'Hifz · Memorization',        ar: 'الحفظ' },
  tajweed:         { en: 'Tajweed · Recitation',       ar: 'التجويد' },
  voice:           { en: "Sawt wal-Adā' · Voice & Delivery", ar: 'الصوت والأداء' },
  // deduction names
  self_corrected:  { en: 'Hesitation',                 ar: 'تردُّد' },
  prompted_fixed:  { en: 'Prompted',                   ar: 'لُقِّن' },
  prompted_failed: { en: 'Unable to continue',         ar: 'لم يستطع المواصلة' },
  tajweed_major:   { en: 'Tajweed major',              ar: 'لحن جليّ' },
  tajweed_minor:   { en: 'Tajweed minor',              ar: 'لحن خفيّ' },
  // deduction descriptions (cards + popover)
  self_corrected_desc:  { en: 'Corrected without prompting. No deduction.', ar: 'صحّح نفسه دون تلقين. لا خصم.' },
  prompted_fixed_desc:  { en: 'Needed a prompt, then continued reciting.', ar: 'احتاج إلى تلقين ثم واصل التلاوة.' },
  prompted_failed_desc: { en: 'Unable to continue after being prompted.', ar: 'لم يستطع المواصلة بعد التلقين.' },
  tajweed_major_desc:   { en: 'Clear error in pronunciation or application of a tajweed rule.', ar: 'خطأ واضح في النطق أو في تطبيق حكم من أحكام التجويد.' },
  tajweed_minor_desc:   { en: 'Minor imperfection in pronunciation or application of a tajweed rule.', ar: 'خلل يسير في النطق أو في تطبيق حكم من أحكام التجويد.' },
  // header / status
  sessionScore:    { en: 'Average score',              ar: 'متوسط الدرجات' },
  tieBreakScore:   { en: 'Tie-break score',            ar: 'درجة كسر التعادل' },
  saved:           { en: 'Saved',                      ar: 'تم الحفظ' },
  saving:          { en: 'Saving…',                    ar: 'جارٍ الحفظ…' },
  offlineSaved:    { en: 'Offline · saved on this device', ar: 'غير متصل · محفوظ على هذا الجهاز' },
  gradedLocked:    { en: 'Graded · locked',            ar: 'مُقيَّم · مقفل' },
  // actions
  finish:          { en: 'Finish',                     ar: 'إنهاء' },
  saveExit:        { en: 'Save & exit',                ar: 'حفظ وخروج' },
  backToQueue:     { en: 'Back to queue',              ar: 'العودة إلى القائمة' },
  reopenEdit:      { en: 'Reopen for editing',         ar: 'إعادة فتح للتعديل' },
  cancel:          { en: 'Cancel',                     ar: 'إلغاء' },
  submitTieBreak:  { en: 'Submit tie-break',           ar: 'إرسال كسر التعادل' },
  resetPoints:     { en: 'Reset scores',               ar: 'إعادة تصفير الدرجات' },
  disqualifyQ:     { en: 'Score question as zero',     ar: 'تصفير السؤال' },
  restoreQ:        { en: 'Restore question',           ar: 'استرجاع السؤال' },
  addQuestion:     { en: '+ Add question',             ar: '+ أضف سؤالًا' },
  addChip:         { en: '+ Add',                      ar: '+ أضف' },
  rules:           { en: 'Rules',                      ar: 'القوانين' },
  close:           { en: 'Close',                      ar: 'إغلاق' },
  // question rail / chips
  questions:       { en: 'Questions',                  ar: 'الأسئلة' },
  question:        { en: 'Question',                   ar: 'السؤال' },
  addedQuestion:   { en: 'Added question',             ar: 'سؤال مضاف' },
  marks:           { en: 'points',                     ar: 'نقاط' },
  notRated:        { en: 'not rated',                  ar: 'لم يُقيَّم' },
  voiceNotRatedDot:{ en: 'Voice & delivery not rated', ar: 'لم يُقيَّم الصوت والأداء' },
  removeQuestion:  { en: 'Remove question',            ar: 'حذف السؤال' },
  // DQ
  dqTitle:         { en: 'Hifz mistake limit reached', ar: 'بلغ حدّ أخطاء الحفظ' },
  dqKeep:          { en: 'Keep question',              ar: 'إبقاء السؤال' },
  dqConfirm:       { en: 'Score as zero',              ar: 'صفِّر السؤال' },
  dqBanner:        { en: 'Question scored as zero',    ar: 'سؤال مُصفَّر' },
  dqBannerDetail:  { en: 'All scores for this question have been set to zero.', ar: 'صُفِّرت جميع درجات هذا السؤال.' },
  // side panel
  scoreBreakdown:  { en: 'Score breakdown',            ar: 'تفصيل الدرجات' },
  notes:           { en: 'Notes',                      ar: 'ملاحظات' },
  notesPlaceholder:{ en: 'Private notes for this contestant…', ar: 'ملاحظات خاصة بهذا المتسابق…' },
  panelCompleteness:{ en: 'Panel completeness',        ar: 'اكتمال اللجنة' },
  judgesStarted:   { en: 'judges started',             ar: 'من الحكام بدأوا' },
  rateAsYouGo:     { en: 'Beauty, flow & delivery',    ar: 'الجمال والانسياب وحسن الأداء' },
  // banners
  lockedBanner:    { en: '✓ This session is graded and locked. Reopen it to make changes.', ar: '✓ هذه الجلسة مُقيَّمة ومقفلة. أعد فتحها لإجراء التغييرات.' },
  voiceNudge:      { en: "Voice & delivery is still unrated. We've taken you to the next unrated question.", ar: 'لم يُقيَّم الصوت والأداء بعد. نقلناك إلى أول سؤال غير مقيَّم.' },
  tieBreakHeader:  { en: '⚖︎ Sudden-death tie-break · 1 question', ar: '⚖︎ جولة حاسمة لكسر التعادل · سؤال واحد' },
  // dashboard
  queue:           { en: 'Queue',                      ar: 'القائمة' },
  tieBreaks:       { en: 'Tie-breaks',                 ar: 'كسر التعادل' },
  toGrade:         { en: 'remaining',                  ar: 'متبقٍّ' },
  graded:          { en: 'graded',                     ar: 'تم تقييمهم' },
  gradedStatus:    { en: 'Graded',                     ar: 'تم التقييم' },
  inProgress:      { en: 'In progress',                ar: 'قيد التقييم' },
  notStarted:      { en: 'Not started',                ar: 'لم يبدأ' },
  notYetGraded:    { en: 'Not yet graded',             ar: 'لم يُقيَّم بعد' },
  emptyQueue:      { en: 'No contestants have been assigned to your panel yet.', ar: 'لم يُعيَّن أي متسابق للجنتك بعد.' },
  gradeArrow:      { en: 'Grade →',                    ar: 'قيِّم ←' },
  suddenDeath:     { en: 'sudden-death',               ar: 'جولة حاسمة' },
  noTieBreaks:     { en: 'No tie-breaks right now.',   ar: 'لا يوجد كسر تعادل حاليًا.' },
  noTieBreaksDetail:{ en: 'Tied contestants will appear here when the admin starts a sudden-death round.', ar: 'سيظهر المتعادلون هنا عند بدء المشرف جولةً حاسمة.' },
  getStarted:      { en: 'Get started',                ar: 'ابدأ' },
  welcomeGreeting: { en: 'Welcome, {name}',             ar: 'مرحبًا، {name}' },
  judgeFallback:   { en: 'Judge',                       ar: 'الحكم' },
  yourAssigned:    { en: 'Your assigned contestants',   ar: 'المتسابقون المعيّنون لك' },
  // misc / composed
  loading:         { en: 'Loading…',                   ar: 'جارٍ التحميل…' },
  contestant:      { en: 'Contestant',                  ar: 'المتسابق' },
  of:              { en: 'of',                          ar: 'من' },
  youAreJudge:     { en: 'You are Judge',                ar: 'أنت الحكم' },
  removeOne:       { en: 'Remove one',                  ar: 'أنقص واحدًا' },
  addOne:          { en: 'Add one',                     ar: 'أضف واحدًا' },
  voiceDelivery:   { en: 'Voice & delivery',            ar: 'الصوت والأداء' },
  pending:         { en: 'pending',                     ar: 'قيد الانتظار' },
  dqAbbrev:        { en: '0',                            ar: '0' },
  // DQ overlay body (count-based auto-flag)
  dqBody:          { en: 'This question has reached the limit of {n} hifz mistakes. Score the question as zero, or keep it and retain the remaining points.', ar: 'بلغ هذا السؤال حدّ {n} من أخطاء الحفظ. صفِّر السؤال، أو أبقِه واحتسب النقاط المتبقية.' },
  // per-deduction ⓘ popover (live model-aware costs)
  moreInfo:        { en: 'About this mistake',           ar: 'عن هذا الخطأ' },
  noPenalty:       { en: 'No penalty — tracked only',    ar: 'لا خصم — يُسجَّل فقط' },
  costRawPoints:      { en: '−{n} points',                                    ar: 'يُخصم {n} من النقاط' },
  costPercentHifz:    { en: "−{n}% of this question's memorization",         ar: 'يُخصم {n}٪ من حفظ هذا السؤال' },
  costPercentTajweed: { en: "−{n}% of this question's tajweed",              ar: 'يُخصم {n}٪ من تجويد هذا السؤال' },
  escalatesStep:      { en: ' · each repeat in this question costs {step} more percentage points', ar: ' · كل تكرار في هذا السؤال يزيد الخصم {step} نقطة مئوية' },
} as const;

export type LabelKey = keyof typeof JUDGE_LABELS;
export type JudgeLang = 'en' | 'ar';

export function t(key: LabelKey, lang: JudgeLang): string {
  return JUDGE_LABELS[key][lang];
}

/** "3 questions" (en) / "3 أسئلة" (ar) — numerals stay western. */
export function nQuestions(n: number, lang: JudgeLang): string {
  return lang === 'ar' ? `${n} أسئلة` : `${n} questions`;
}

/** Renders the ONE selected language; Arabic isolated rtl (layout stays LTR). */
export function L({ k, lang, style }: { k: LabelKey; lang: JudgeLang; style?: React.CSSProperties }) {
  const s = t(k, lang);
  return lang === 'ar'
    ? <span lang="ar" dir="rtl" style={{ unicodeBidi: 'isolate', ...style }}>{s}</span>
    : <span style={style}>{s}</span>;
}
