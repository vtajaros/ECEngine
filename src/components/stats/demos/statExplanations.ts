export interface StatExplanation {
  title: string
  formula: string
  description: string
  takeaway: string
}

export const STAT_EXPLANATIONS: Record<string, StatExplanation> = {
  subjectShare: {
    title: 'Card Share (%)',
    formula: '\\text{share} = \\dfrac{\\text{subject cards}}{\\text{total cards}} \\times 100\\%',
    description: 'This is the percentage of your entire flashcard library that belongs to this subject.\n\nIt is compared against the PRC ToS weight — the official percentage of board exam score allocated to that subject.',
    takeaway: 'A subject below its ToS weight is under-studied relative to how much the exam actually rewards it.',
  },
  totalN: {
    title: 'Sample Size (n)',
    formula: 'n = \\left|\\{\\, c \\in C \\;:\\; \\text{type}(c) = \\text{MCQ} \\,\\}\\right|',
    description: 'This is how many MCQ cards the statistics on this card are computed from.\n\nEvery card in the library whose type is multiple-choice is counted exactly once.',
    takeaway: 'A larger n makes these statistics more stable and less sensitive to a few unusual cards.',
  },
  mean: {
    title: 'Mean (Average)',
    formula: '\\bar{x} = \\frac{\\sum x_i}{n}',
    description: 'The arithmetic average question length, in characters.\n\nBecause every value contributes to the total, a handful of unusually long questions can pull the mean upward on their own.',
    takeaway: 'The mean is sensitive to outliers — always read it next to the median.',
  },
  median: {
    title: 'Median',
    formula: '\\tilde{x} = \\begin{cases} x_{(n+1)/2} & n \\text{ odd} \\\\[4pt] \\dfrac{x_{n/2} + x_{n/2+1}}{2} & n \\text{ even} \\end{cases}',
    description: 'The middle value once all question lengths are sorted from smallest to largest.\n\nWith an odd count it is the single middle value; with an even count it is the average of the two middle values.',
    takeaway: 'When the mean sits noticeably above the median, a few long questions are skewing the average — this is right-skew.',
  },
  chiSquare: {
    title: 'Chi-Square Statistic (χ²)',
    formula: '\\chi^2 = \\sum_{i=1}^{4} \\frac{(O_i - E_i)^2}{E_i}',
    description: 'This measures how far the actual A/B/C/D answer-key counts deviate from a perfectly even 25% split.\n\nEach position contributes the squared gap between what was observed and what was expected, scaled by the expected count.',
    takeaway: 'Near 0 means the positions are well balanced; larger values mean some positions are favoured.',
  },
  pValue: {
    title: 'p-value',
    formula: 'p = P(\\chi^2_{\\text{obs}} \\geq \\chi^2 \\mid H_0 \\text{ true})',
    description: 'The probability of seeing an imbalance at least this large purely by chance, assuming answer positions really were assigned at random.\n\nIt answers whether the pattern is real, not whether it is large.',
    takeaway: 'Below 0.05, the imbalance is unlikely to be random chance alone.',
  },
  cramersW: {
    title: "Cramér's W",
    formula: 'V = \\sqrt{\\dfrac{\\chi^2}{n \\times df}}',
    description: 'This measures how large the imbalance actually is, on a scale from 0 (perfectly even) to 1 (heavily skewed toward certain positions).\n\nIt is the effect size counterpart to the p-value.',
    takeaway: 'A result can be statistically significant yet still have an effect size too small to matter in practice.',
  },
  fStatistic: {
    title: 'F-Statistic',
    formula: 'F = \\dfrac{\\text{MS}_{\\text{between}}}{\\text{MS}_{\\text{within}}}',
    description: 'This is the ratio of variance between group means to variance within groups.\n\nUnder the null hypothesis that all subjects share the same average question length, this ratio should hover near 1.0. A value substantially greater than 1 suggests differences between subjects exceed random variation.',
    takeaway: 'A larger F indicates greater differences in average question length across subjects relative to variation within them.',
  },
  pValueAnova: {
    title: 'p-value (ANOVA)',
    formula: 'p = P(F_{(k-1, N-k)} \\geq F_{\\text{obs}} \\mid H_0)',
    description: 'The probability of observing an F-statistic this large or larger purely by chance, assuming all subjects truly share the same mean question length.\n\nIt tests whether at least one subject differs from the others, without identifying which specific subject pair is responsible.',
    takeaway: 'When p < 0.05, the variation in question length across subjects is statistically significant.',
  },
  anovaDf: {
    title: 'Degrees of Freedom (df)',
    formula: '\\text{df}_b = k - 1, \\quad \\text{df}_w = N - k',
    description: 'The between-group degrees of freedom (df_b) equals the number of subjects minus one, while within-group degrees of freedom (df_w) is total sample size minus the group count.\n\nTogether, these two numbers define the specific F-distribution curve against which the test statistic is evaluated.',
    takeaway: 'Higher within-group df gives the ANOVA more statistical power to detect genuine differences.',
  },
  chiSquareIndependence: {
    title: 'Chi-Square (Independence)',
    formula: '\\chi^2 = \\sum_{i=1}^{r} \\sum_{j=1}^{c} \\dfrac{(O_{ij} - E_{ij})^2}{E_{ij}}',
    description: 'This tests whether the distribution of answer keys across choices A, B, C, and D depends on the subject.\n\nIt sums the squared divergence between observed card counts and expected counts under independence across all 16 subject-choice pairs.',
    takeaway: 'A higher χ² indicates that answer key placement patterns vary meaningfully across subjects.',
  },
  pValueIndependence: {
    title: 'p-value (Independence)',
    formula: 'p = P(\\chi^2_{(r-1)(c-1)} \\geq \\chi^2 \\mid H_0)',
    description: 'The probability of seeing a subject-by-choice imbalance this large purely by chance, if answer keys were assigned independently of subject.\n\nA small p-value indicates the differences across subjects are unlikely to be random noise.',
    takeaway: 'Below 0.05, answer position choice is significantly associated with subject matter.',
  },
  dfIndependence: {
    title: 'Degrees of Freedom (df)',
    formula: '\\text{df} = (r - 1)(c - 1)',
    description: 'Degrees of freedom for a two-way contingency table equals (rows − 1) × (columns − 1).\n\nFor 4 subjects and 4 choices, df = (4 − 1) × (4 − 1) = 9, setting the critical threshold for evaluating χ².',
    takeaway: 'With 9 degrees of freedom, the test assesses position patterns across all 4 subjects simultaneously.',
  },
  responseTimeMean: {
    title: 'Mean Response Time',
    formula: '\\bar{t} = \\frac{\\sum t_i}{n}',
    description: 'The arithmetic average time taken to answer or rate a card, in seconds.\n\nBecause every attempt contributes to the total, pauses or long interruptions can pull the mean upward significantly.',
    takeaway: 'Mean response time is sensitive to outliers and pauses — compare it against the median to detect skew.',
  },
  responseTimeMedian: {
    title: 'Median Response Time',
    formula: '\\tilde{t} = \\begin{cases} t_{(n+1)/2} & n \\text{ odd} \\\\[4pt] \\dfrac{t_{n/2} + t_{n/2+1}}{2} & n \\text{ even} \\end{cases}',
    description: 'The middle response time in seconds once all attempt durations are sorted in order.\n\nHalf of your responses were faster than this value, and half were slower, making it immune to occasional distractions.',
    takeaway: 'The median represents your typical review pace without distortion from extreme delays or breaks.',
  },
  zScoreOutlier: {
    title: 'Outlier Count (|z| > 2)',
    formula: 'z = \\dfrac{x - \\bar{x}}{s}',
    description: 'Questions whose length falls more than 2 standard deviations away from the library-wide average.\n\nIn a standard normal distribution, fewer than 5% of observations naturally exceed this threshold.',
    takeaway: 'A high outlier count suggests questions with unusually lengthy word problems or overly brief definitions.',
  },
  maxZScore: {
    title: 'Maximum Z-Score',
    formula: 'z = \\dfrac{x - \\bar{x}}{s}',
    description: 'The largest standard deviation distance observed for any single question in the library.\n\nA z-score above 3 indicates an extreme statistical outlier that is exceptionally rare under normal variance.',
    takeaway: 'Extreme z-scores pinpoint specific flashcards that may need formatting adjustments or splitting.',
  },
  extremeSubject: {
    title: 'Extreme Outlier Subject',
    formula: 'z = \\dfrac{x - \\bar{x}}{s}',
    description: 'The subject category containing the library\'s single most extreme question length.\n\nCertain subjects like GEAS or EST often feature lengthy scenario problems, while MATH questions can be compact formulas.',
    takeaway: 'Knowing which subject produces extreme questions helps balance study time and exam stamina.',
  },
}


