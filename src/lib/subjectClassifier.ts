/**
 * subjectClassifier.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Intelligent subject classification engine for ECEngine decks and cards.
 *
 * Key Capabilities:
 * 1. Card-Level Classification: Evaluates each card individually with regex token/word
 *    boundaries and phrase matching to eliminate partial-word collisions.
 * 2. Mathematical Intent & Operator Recognition: Detects LaTeX notation, formulas,
 *    and calculus/analysis patterns, preventing Math questions that mention situational
 *    physics/engineering context (e.g., velocity, acceleration, circuits, cooling)
 *    from falsely triggering GEAS, ELECS, or EST.
 * 3. Deck-Level Aggregation & Minority Filtering: If incidental keywords for another
 *    subject appear in only a minority of cards (< 20% or heavily outweighed by the
 *    dominant subject), they are suppressed so the true subject is selected.
 * 4. Rich Taxonomy: Extracted and aligned with the Philippine ECE Board Exam Table
 *    of Specifications (TOS), TOC, and Formula Bank.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type SubjectFullName =
  | 'Mathematics'
  | 'General Engineering & Applied Sciences'
  | 'Electronics Engineering'
  | 'Electronics Systems & Technologies'

export type SubjectCode = 'MATH' | 'GEAS' | 'ELECS' | 'EST'

export const CODE_TO_FULL_SUBJECT: Record<SubjectCode, SubjectFullName> = {
  MATH: 'Mathematics',
  GEAS: 'General Engineering & Applied Sciences',
  ELECS: 'Electronics Engineering',
  EST: 'Electronics Systems & Technologies',
}

export const FULL_TO_CODE_SUBJECT: Record<SubjectFullName, SubjectCode> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

export interface SubjectDetectionResult {
  /** Full subject name */
  subject: SubjectFullName
  /** Subject short code */
  code: SubjectCode
  /** Classification confidence (0 to 1) */
  confidence: number
  /** Card vote counts per subject */
  cardVotes: Record<SubjectCode, number>
  /** Aggregated signal points per subject */
  scores: Record<SubjectCode, number>
  /** Total non-empty cards analyzed */
  analyzedCardCount: number
  /** Human-readable explanation of why this subject was picked */
  reasoning: string
}

export interface GenericCardInput {
  type?: string
  data?: any
  // Direct text fields if flat
  question?: string
  choices?: string[]
  explanation?: string
  front?: string
  back?: string
  name?: string
  latex?: string
  description?: string
  variables?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base Definition
// ─────────────────────────────────────────────────────────────────────────────

interface WeightedRule {
  pattern: RegExp
  weight: number
}

const MATH_PATTERNS: WeightedRule[] = [
  // LaTeX & Mathematical Operators (Strong signal)
  { pattern: /\\(int|iint|iiint|oint)\b/i, weight: 6 },
  { pattern: /\\(frac|dfrac|cfrac)\b/i, weight: 4 },
  { pattern: /\\(sqrt|sum|prod|partial|lim|to\s*\\infty|nabla|cdot|times|pm|approx|leq|geq|neq)\b/i, weight: 4 },
  { pattern: /\\(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|log|ln|theta|phi|lambda|omega|alpha|beta|gamma|pi)\b/i, weight: 3 },
  { pattern: /\\(pmatrix|bmatrix|vmatrix|matrix|begin\{cases\})/i, weight: 5 },
  { pattern: /\b(d[xyzt]\/[dxyzt]|d\^2[xy]\/d[xy]\^2|f'\([xyt]\)|f''\([xyt]\)|y'|y''|f\([xyt]\)|g\([xyt]\))\b/i, weight: 5 },
  { pattern: /\b(d[xyz]|dt)\b/i, weight: 3 },
  { pattern: /\b(\\[a-zA-Z]+\{[^}]*\})/i, weight: 2 },

  // Calculus & Differential Equations Phrasing
  { pattern: /\b(find|evaluate|calculate|compute)\s+(the\s+)?(derivative|derivatives|integral|integrals|antiderivative|limit|limits)\b/i, weight: 6 },
  { pattern: /\b(evaluate|integrate|differentiate)\s*:\b/i, weight: 5 },
  { pattern: /\b(rate\s+of\s+change|related\s+rates|maxima\s+and\s+minima|maximum\s+value|minimum\s+value|inflection\s+point|critical\s+point|critical\s+numbers?)\b/i, weight: 5 },
  { pattern: /\b(area\s+bounded\s+by|volume\s+of\s+revolution|volume\s+(generated|formed)\s+by|centroid\s+of|moment\s+of\s+inertia\s+of\s+the\s+area)\b/i, weight: 5 },
  { pattern: /\b(differential\s+equations?|ordinary\s+differential\s+equation|ode|pde|integrating\s+factor|separable|bernoulli\s+equation|cauchy-euler|auxiliary\s+equation|particular\s+integral|complementary\s+function|undetermined\s+coefficients|variation\s+of\s+parameters)\b/i, weight: 6 },
  { pattern: /\b(laplace\s+transforms?|inverse\s+laplace|fourier\s+series|fourier\s+transforms?|z-transforms?|unit\s+step\s+function|dirac\s+delta|heaviside)\b/i, weight: 6 },
  { pattern: /\b(tangent\s+line|normal\s+line|radius\s+of\s+curvature|center\s+of\s+curvature|length\s+of\s+arc|arc\s+length|surface\s+area\s+of\s+revolution)\b/i, weight: 5 },
  { pattern: /\b(l'hopital|l'hospital|taylor\s+series|maclaurin\s+series|power\s+series|bessel\s+function|legendre\s+polynomial)\b/i, weight: 5 },

  // Linear Algebra & Advanced Math
  { pattern: /\b(eigenvalues?|eigenvectors?|determinants?|matrix|matrices|inverse\s+matrix|rank\s+of\s+(the\s+)?matrix|cayley-hamilton|cramer's\s+rule|system\s+of\s+linear\s+equations|simultaneous\s+equations)\b/i, weight: 5 },
  { pattern: /\b(complex\s+numbers?|argand\s+diagram|de\s+moivre|euler's\s+formula|analytic\s+function|cauchy-riemann|residue\s+theorem)\b/i, weight: 5 },
  { pattern: /\b(numerical\s+methods|newton-raphson|bisection\s+method|secant\s+method|simpson's\s+rule|trapezoidal\s+rule|runge-kutta|euler's\s+method)\b/i, weight: 5 },
  { pattern: /\b(vector\s+analysis|cross\s+product|dot\s+product|gradient|divergence|curl|directional\s+derivative|green's\s+theorem|stokes'\s+theorem|divergence\s+theorem)\b/i, weight: 5 },

  // Probability, Statistics, Data Analysis
  { pattern: /\b(probability\s+that|in\s+how\s+many\s+ways|permutations?|combinations?|bayes\s+theorem|conditional\s+probability|independent\s+events|expected\s+value|mathematical\s+expectation)\b/i, weight: 5 },
  { pattern: /\b(standard\s+deviation|variance|mean|median|mode|normal\s+distribution|gaussian\s+distribution|z-score|binomial\s+distribution|poisson\s+distribution|exponential\s+distribution|hypothesis\s+test|null\s+hypothesis|alternative\s+hypothesis|p-value|t-test|chi-square|regression\s+line|correlation\s+coefficient)\b/i, weight: 5 },

  // Algebra, Geometry, Trigonometry
  { pattern: /\b(arithmetic\s+progression|geometric\s+progression|harmonic\s+progression|binomial\s+theorem|partial\s+fractions?|synthetic\s+division|remainder\s+theorem|factor\s+theorem)\b/i, weight: 5 },
  { pattern: /\b(quadratic\s+equations?|discriminant|polynomials?|logarithms?|logarithmic)\b/i, weight: 3 },
  { pattern: /\b(conic\s+sections?|parabola|ellipse|hyperbola|eccentricity|directrix|foci|focus\s+of\s+the|asymptotes\s+of\s+the\s+hyperbola|vertices\s+of\s+the)\b/i, weight: 4 },
  { pattern: /\b(trigonometric|trigonometry|law\s+of\s+sines|law\s+of\s+cosines|pythagorean|angle\s+of\s+elevation|angle\s+of\s+depression|bearing\s+of)\b/i, weight: 4 },
  { pattern: /\b(frustum|polyhedron|spherical\s+triangle|altitude\s+of\s+the\s+cone|volume\s+of\s+a\s+sphere)\b/i, weight: 4 },
  { pattern: /\b(solve\s+for\s+[xyz]|find\s+the\s+roots?\s+of|value\s+of\s+[xyz]\b|simplify\s*:)/i, weight: 3 },
]

const GEAS_PATTERNS: WeightedRule[] = [
  // Chemistry
  { pattern: /\b(chemistry|stoichiometry|periodic\s+table|atomic\s+weight|molecular\s+weight|molar\s+mass|molarity|molality|avogadro|covalent\s+bond|ionic\s+bond|oxidation\s+number|redox|galvanic\s+cell|electrolysis|faraday's\s+law\s+of\s+electrolysis|titration|buffer\s+solution|le\s+chatelier|ideal\s+gas\s+law|boyle's\s+law|charles's\s+law|dalton's\s+law|precipitate|corrosion|galvanizing)\b/i, weight: 5 },
  { pattern: /\b(acid|base|ph\s+value|alloy|monomer|valence\s+electrons?|solubility\s+product)\b/i, weight: 4 },

  // Engineering Economics (Split into distinct sub-rules)
  { pattern: /\b(engineering\s+economics?|engineering\s+economy|present\s+worth|future\s+worth|annual\s+worth|capitalized\s+cost|annuity|ordinary\s+annuity|annuity\s+due|deferred\s+annuity|perpetuity|gradient\s+series)\b/i, weight: 6 },
  { pattern: /\b(depreciation|straight\s+line\s+depreciation|sum\s+of\s+years\s+digits|soyd|declining\s+balance|double\s+declining\s+balance|sinking\s+fund)\b/i, weight: 6 },
  { pattern: /\b(salvage\s+value|book\s+value|first\s+cost|initial\s+cost|useful\s+life)\b/i, weight: 5 },
  { pattern: /\b(rate\s+of\s+return|internal\s+rate\s+of\s+return|irr|marr|minimum\s+attractive\s+rate|benefit-cost\s+ratio|payback\s+period|break-?even\s+point)\b/i, weight: 5 },
  { pattern: /\b(compound\s+interest|nominal\s+interest|effective\s+interest|continuous\s+compounding|interest\s+rate)\b/i, weight: 4 },

  // Engineering Management & Technopreneurship
  { pattern: /\b(engineering\s+management|henri\s+fayol|frederick\s+taylor|scientific\s+management|total\s+quality\s+management|tqm|pert|cpm|critical\s+path\s+method|gantt\s+chart|swot\s+analysis|six\s+sigma|iso\s+9000|decision\s+tree|span\s+of\s+control|technopreneurship|entrepreneurship|business\s+plan|value\s+proposition|intellectual\s+property|patent|trademark|copyright|trade\s+secret|venture\s+capital|angel\s+investor)\b/i, weight: 5 },

  // Materials Science & Strength of Materials
  { pattern: /\b(materials\s+science|crystal\s+structure|unit\s+cell|body-centered\s+cubic|bcc|face-centered\s+cubic|fcc|hexagonal\s+close-packed|hcp|miller\s+indices|bragg's\s+law|grain\s+boundary|dislocation|slip\s+plane)\b/i, weight: 5 },
  { pattern: /\b(stress-strain|shear\s+stress|tensile\s+stress|compressive\s+stress|proportional\s+limit|yield\s+point|yield\s+strength|ultimate\s+tensile\s+strength|young's\s+modulus|modulus\s+of\s+elasticity|shear\s+modulus|modulus\s+of\s+rigidity|bulk\s+modulus|poisson's\s+ratio|hooke's\s+law|ductility|malleability|brittleness|toughness|resilience|hardness|brinell|rockwell|vickers|charpy|phase\s+diagram|eutectic|ferrite|austenite|martensite|pearlite|heat\s+treatment|annealing|quenching|tempering)\b/i, weight: 5 },

  // Thermodynamics & Fluid Mechanics (Physics context)
  { pattern: /\b(first\s+law\s+of\s+thermodynamics|second\s+law\s+of\s+thermodynamics|carnot\s+cycle|carnot\s+engine|carnot\s+efficiency|otto\s+cycle|diesel\s+cycle|rankine\s+cycle|refrigeration\s+cycle|coefficient\s+of\s+performance|enthalpy|entropy|isothermal|adiabatic|isobaric|isochoric|polytropic|heat\s+transfer|conduction|convection|radiation|fourier's\s+law\s+of\s+conduction|stefan-boltzmann|blackbody|thermal\s+conductivity|thermal\s+expansion|specific\s+heat|latent\s+heat)\b/i, weight: 5 },
  { pattern: /\b(fluid\s+mechanics|fluid\s+statics|hydrostatics|pascal's\s+law|pascal's\s+principle|archimedes\s+principle|buoyant\s+force|buoyancy|bernoulli's\s+equation|bernoulli's\s+principle|continuity\s+equation|torricelli's\s+theorem|viscosity|poiseuille|reynolds\s+number|laminar\s+flow|turbulent\s+flow|surface\s+tension|manometer|venturi\s+meter|pitot\s+tube)\b/i, weight: 5 },
  { pattern: /\b(projectile\s+motion|centripetal\s+acceleration|centripetal\s+force|torque|rotational\s+dynamics|angular\s+momentum|conservation\s+of\s+momentum|impulse|coefficient\s+of\s+restitution|elastic\s+collision|inelastic\s+collision|work-energy\s+theorem|simple\s+harmonic\s+motion)\b/i, weight: 4 },

  // ECE Laws & Ethics
  { pattern: /\b(ra\s+9292|republic\s+act\s+(no\.\s*)?9292|electronics\s+engineering\s+law|professional\s+electronics\s+engineer|pece|registered\s+electronics\s+engineer|electronics\s+technician|ect|board\s+of\s+electronics\s+engineering|bece|prc|professional\s+regulation\s+commission|code\s+of\s+ethics|oath\s+of\s+professional|continuing\s+professional\s+development|cpd|cpe\s+units|seal\s+of\s+pece|ra\s+7925|public\s+telecommunications\s+policy|ntc|national\s+telecommunications\s+commission|kbp|philippine\s+electrical\s+code|pec|obligations\s+and\s+contracts|quasi-contract|quasi-delict)\b/i, weight: 6 },
  { pattern: /\b(cad|autocad|object\s+oriented\s+programming|uml|exception\s+handling|environmental\s+impact\s+assessment)\b/i, weight: 4 },
]

const ELECS_PATTERNS: WeightedRule[] = [
  // Solid-State Devices & Diodes
  { pattern: /\b(semiconductor|intrinsic\s+semiconductor|extrinsic\s+semiconductor|pn\s+junction|depletion\s+region|barrier\s+potential|zener\s+diode|zener\s+breakdown|avalanche\s+breakdown|schottky\s+diode|varactor\s+diode|tunnel\s+diode|pin\s+diode|diode\s+clipper|diode\s+clamper|half-wave\s+rectifier|full-wave\s+rectifier|bridge\s+rectifier|peak\s+inverse\s+voltage|piv|ripple\s+factor|voltage\s+multiplier|voltage\s+doubler)\b/i, weight: 5 },

  // Transistors (BJT, FET, MOSFET)
  { pattern: /\b(bipolar\s+junction\s+transistor|bjt|npn|pnp|common\s+emitter|common\s+base|common\s+collector|emitter\s+follower|transistor\s+biasing|emitter\s+bias|voltage\s+divider\s+bias|dc\s+load\s+line|ac\s+load\s+line|q-point|quiescent\s+point|saturation\s+region|cutoff\s+region|active\s+region|transistor\s+alpha|transistor\s+beta|h-parameters|field\s+effect\s+transistor|jfet|pinch-off\s+voltage|idss|transconductance|gm|mosfet|enhancement\s+mosfet|depletion\s+mosfet|n-channel|p-channel|cmos)\b/i, weight: 5 },

  // Amplifiers & Analog Circuits
  { pattern: /\b(small-signal\s+amplifier|power\s+amplifier|class\s+a\s+amplifier|class\s+b\s+amplifier|class\s+ab|class\s+c\s+amplifier|push-pull\s+amplifier|crossover\s+distortion|multistage\s+amplifier|cascode|darlington\s+pair|frequency\s+response|cutoff\s+frequency|gain-bandwidth\s+product|differential\s+amplifier|cmrr|common-mode\s+rejection)\b/i, weight: 5 },
  { pattern: /\b(operational\s+amplifier|op-?amp|inverting\s+amplifier|non-inverting\s+amplifier|voltage\s+follower|summing\s+amplifier|difference\s+amplifier|instrumentation\s+amplifier|integrator\s+circuit|differentiator\s+circuit|schmitt\s+trigger|slew\s+rate|input\s+offset\s+voltage|input\s+bias\s+current|negative\s+feedback|positive\s+feedback|barkhausen\s+criterion|wien\s+bridge\s+oscillator|colpitts\s+oscillator|hartley\s+oscillator|crystal\s+oscillator|555\s+timer|astable\s+multivibrator|monostable\s+multivibrator|active\s+filter|butterworth\s+filter|chebyshev\s+filter)\b/i, weight: 5 },

  // Power Electronics & Industrial
  { pattern: /\b(thyristor|silicon\s+controlled\s+rectifier|scr|triac|diac|unijunction\s+transistor|ujt|programmable\s+ujt|put|igbt|gate\s+turn-off|gto|optocoupler|optoisolator|transducer|thermocouple|rtd|strain\s+gauge|lvdt|piezoelectric\s+sensor|hall\s+effect\s+sensor|programmable\s+logic\s+controller|plc|ladder\s+logic|ladder\s+diagram|building\s+management\s+system|bms|scada)\b/i, weight: 5 },

  // Digital Logic & Switching Theory
  { pattern: /\b(boolean\s+algebra|de\s+morgan's\s+laws?|logic\s+gates?|truth\s+table|karnaugh\s+map|k-map|sum\s+of\s+products|sop|product\s+of\s+sums|pos|nand\s+gate|nor\s+gate|xor\s+gate|xnor\s+gate|half\s+adder|full\s+adder|half\s+subtractor|full\s+subtractor|multiplexer|mux|demultiplexer|demux|priority\s+encoder|seven\s+segment\s+display|bcd\s+to\s+7)\b/i, weight: 5 },
  { pattern: /\b(flip-flop|sr\s+flip-flop|jk\s+flip-flop|d\s+flip-flop|t\s+flip-flop|master-slave\s+flip-flop|shift\s+register|siso|sipo|piso|pipo|binary\s+counter|synchronous\s+counter|asynchronous\s+counter|ripple\s+counter|modulus\s+counter|ring\s+counter|johnson\s+counter|finite\s+state\s+machine|fsm|mealy\s+machine|moore\s+machine|asm\s+chart|digital-to-analog\s+converter|dac|analog-to-digital\s+converter|adc|r-2r\s+ladder)\b/i, weight: 5 },

  // Microprocessors & Control Systems
  { pattern: /\b(microprocessor|microcontroller|8085|8086|instruction\s+set|assembly\s+language|opcode|operand|addressing\s+modes|accumulator|program\s+counter|stack\s+pointer|flag\s+register|interrupt\s+service\s+routine|dma\s+controller)\b/i, weight: 5 },
  { pattern: /\b(control\s+systems?|open-loop|closed-loop|block\s+diagram\s+reduction|mason's\s+gain|signal\s+flow\s+graph|poles\s+and\s+zeros|characteristic\s+equation|routh-hurwitz|routh\s+array|root\s+locus|bode\s+plot|nyquist\s+plot|nyquist\s+stability|gain\s+margin|phase\s+margin|damping\s+ratio|natural\s+frequency|peak\s+overshoot|settling\s+time|steady-state\s+error|pid\s+controller|lead\s+compensator|lag\s+compensator|state\s+space)\b/i, weight: 5 },
  { pattern: /\b(thevenin|norton|kirchhoff|mesh\s+current|nodal\s+analysis|two-port\s+network|admittance|impedance\s+matching)\b/i, weight: 3 },
]

const EST_PATTERNS: WeightedRule[] = [
  // Analog Communications & Receivers
  { pattern: /\b(amplitude\s+modulation|am\s+modulation|modulation\s+index|percentage\s+modulation|dsb-fc|dsb-sc|double\s+sideband|single\s+sideband|ssb|ssb-sc|vestigial\s+sideband|vsb|sideband\s+power|carrier\s+power|frequency\s+modulation|fm\s+modulation|frequency\s+deviation|modulation\s+index\s+beta|deviation\s+ratio|carson's\s+rule|bessel\s+functions?\s+fm|narrowband\s+fm|wideband\s+fm|phase\s+modulation|pre-emphasis|de-emphasis)\b/i, weight: 5 },
  { pattern: /\b(superheterodyne\s+receiver|rf\s+amplifier|local\s+oscillator|intermediate\s+frequency|if\s+frequency|image\s+frequency|image\s+rejection\s+ratio|envelope\s+detector|discriminator|phase\s+locked\s+loop|pll|automatic\s+gain\s+control|agc|squelch|noise\s+figure|noise\s+temperature|thermal\s+noise|johnson-nyquist|shot\s+noise|signal\s+to\s+noise\s+ratio|snr|sinad|noise\s+factor)\b/i, weight: 5 },

  // Digital Communications & Information Theory
  { pattern: /\b(sampling\s+theorem|nyquist\s+rate|nyquist\s+sampling|aliasing|anti-aliasing\s+filter|pulse\s+amplitude\s+modulation|pam|pulse\s+width\s+modulation|pwm|pulse\s+position\s+modulation|ppm|pulse\s+code\s+modulation|pcm|quantization\s+error|quantization\s+noise|companding|mu-law|a-law|sqnr|differential\s+pcm|dpcm|delta\s+modulation|slope\s+overload|granular\s+noise)\b/i, weight: 5 },
  { pattern: /\b(amplitude\s+shift\s+keying|ask|frequency\s+shift\s+keying|fsk|phase\s+shift\s+keying|psk|binary\s+psk|bpsk|quadrature\s+psk|qpsk|8-psk|quadrature\s+amplitude\s+modulation|qam|16-qam|64-qam|constellation\s+diagram|bit\s+error\s+rate|ber|baud\s+rate|bit\s+rate|information\s+theory|entropy|shannon-hartley\s+theorem|channel\s+capacity|hartley's\s+law|huffman\s+coding|hamming\s+code|cyclic\s+redundancy\s+check|crc|error\s+detection\s+and\s+correction)\b/i, weight: 5 },

  // Multiplexing & Multiple Access
  { pattern: /\b(multiplexing|frequency\s+division\s+multiplexing|fdm|time\s+division\s+multiplexing|tdm|wavelength\s+division\s+multiplexing|wdm|dwdm|fdma|tdma|cdma|code\s+division\s+multiple\s+access|spread\s+spectrum|dsss|fhss|ofdm|ofdma|mimo)\b/i, weight: 5 },

  // Transmission Lines, Waveguides & Antennas
  { pattern: /\b(transmission\s+lines?|characteristic\s+impedance|propagation\s+constant|attenuation\s+constant|phase\s+constant|velocity\s+factor|standing\s+wave\s+ratio|swr|vswr|reflection\s+coefficient|return\s+loss|quarter\s+wave\s+transformer|stub\s+matching|smith\s+chart|waveguides?|rectangular\s+waveguide|cutoff\s+frequency\s+waveguide|dominant\s+mode|te10|tm\s+mode|guide\s+wavelength)\b/i, weight: 5 },
  { pattern: /\b(isotropic\s+antenna|half-wave\s+dipole|hertzian\s+dipole|quarter-wave\s+monopole|folded\s+dipole|yagi-uda|yagi\s+antenna|parabolic\s+reflector|parabolic\s+dish|horn\s+antenna|helical\s+antenna|patch\s+antenna|antenna\s+gain|directivity|eirp|radiation\s+resistance|antenna\s+efficiency|radiation\s+pattern|beamwidth|hpbw|polarization|friis\s+transmission\s+equation|free\s+space\s+path\s+loss|fspl)\b/i, weight: 5 },
  { pattern: /\b(radio\s+wave\s+propagation|ground\s+wave|surface\s+wave|space\s+wave|sky\s+wave|ionospheric\s+propagation|critical\s+frequency|maximum\s+usable\s+frequency|muf|optimum\s+working\s+frequency|owf|skip\s+distance|skip\s+zone|fading|diversity\s+reception)\b/i, weight: 5 },

  // Fiber Optics
  { pattern: /\b(fiber\s+optics?|optical\s+fiber|total\s+internal\s+reflection|critical\s+angle|core\s+and\s+cladding|refractive\s+index|numerical\s+aperture|acceptance\s+angle|acceptance\s+cone|v-number|single\s+mode\s+fiber|smf|multimode\s+fiber|mmf|step\s+index\s+fiber|graded\s+index\s+fiber|fiber\s+attenuation|db\/km|rayleigh\s+scattering|dispersion|modal\s+dispersion|chromatic\s+dispersion|otdr|avalanche\s+photodiode|apd|edfa)\b/i, weight: 5 },

  // Data Communications & Networking
  { pattern: /\b(data\s+communications|osi\s+model|physical\s+layer|data\s+link\s+layer|network\s+layer|transport\s+layer|session\s+layer|presentation\s+layer|application\s+layer|tcp\/ip|tcp|udp|three-way\s+handshake|ip\s+addressing|ipv4|ipv6|subnet\s+mask|subnetting|cidr|mac\s+address|arp|icmp|dhcp|dns|http|https|ethernet|ieee\s+802\.3|csma\/cd|csma\/ca|wi-fi|star\s+topology|bus\s+topology|ring\s+topology|mesh\s+topology|vlan|router|switch|routing\s+algorithm|rip|ospf|bgp|cryptography|rsa|aes)\b/i, weight: 5 },

  // Satellite, Radar, Mobile Wireless
  { pattern: /\b(satellite\s+communications?|geostationary\s+orbit|geo|low\s+earth\s+orbit|leo|medium\s+earth\s+orbit|meo|molniya\s+orbit|apogee|perigee|azimuth\s+angle|elevation\s+angle|uplink|downlink|transponder|cellular\s+network|cellular\s+communications|frequency\s+reuse|cell\s+cluster|co-channel\s+interference|handoff|handover|roaming|base\s+station|bsc|msc|bts|gsm|gprs|edge|umts|3g|lte|4g|5g|volte|radar\s+equation|radar\s+range\s+equation|pulse\s+repetition\s+frequency|prf|doppler\s+radar|continuous\s+wave\s+radar|moving\s+target\s+indicator|mti|blind\s+speed)\b/i, weight: 5 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Card Text Extractor
// ─────────────────────────────────────────────────────────────────────────────

export function extractCardText(card: GenericCardInput): string {
  if (!card) return ''

  const parts: string[] = []

  // If card is an EditCard with .data object
  if (card.data && typeof card.data === 'object') {
    const d = card.data
    if (d.question) parts.push(String(d.question))
    if (Array.isArray(d.choices)) parts.push(d.choices.filter(Boolean).join(' '))
    if (d.explanation) parts.push(String(d.explanation))
    if (d.name) parts.push(String(d.name))
    if (d.latex) parts.push(String(d.latex))
    if (d.description) parts.push(String(d.description))
    if (d.variables) parts.push(String(d.variables))
    if (d.front) parts.push(String(d.front))
    if (d.back) parts.push(String(d.back))
  }

  // Flat fields if present
  if (card.question) parts.push(card.question)
  if (Array.isArray(card.choices)) parts.push(card.choices.filter(Boolean).join(' '))
  if (card.explanation) parts.push(card.explanation)
  if (card.name) parts.push(card.name)
  if (card.latex) parts.push(card.latex)
  if (card.description) parts.push(card.description)
  if (card.variables) parts.push(card.variables)
  if (card.front) parts.push(card.front)
  if (card.back) parts.push(card.back)

  return parts.join(' ').trim()
}

/** Check if card contains non-empty user content */
export function hasCardContent(card: GenericCardInput): boolean {
  return extractCardText(card).length > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Card Scorer
// ─────────────────────────────────────────────────────────────────────────────

export interface CardScoreBreakdown {
  scores: Record<SubjectCode, number>
  winner: SubjectCode | 'NEUTRAL'
  confidence: number
}

export function scoreCardText(text: string): CardScoreBreakdown {
  if (!text || text.trim().length === 0) {
    return {
      scores: { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 },
      winner: 'NEUTRAL',
      confidence: 0,
    }
  }

  const scores: Record<SubjectCode, number> = {
    MATH: 0,
    GEAS: 0,
    ELECS: 0,
    EST: 0,
  }

  // 1. Evaluate MATH rules
  for (const rule of MATH_PATTERNS) {
    if (rule.pattern.test(text)) {
      scores.MATH += rule.weight
    }
  }

  // 2. Evaluate GEAS rules
  for (const rule of GEAS_PATTERNS) {
    if (rule.pattern.test(text)) {
      scores.GEAS += rule.weight
    }
  }

  // 3. Evaluate ELECS rules
  for (const rule of ELECS_PATTERNS) {
    if (rule.pattern.test(text)) {
      scores.ELECS += rule.weight
    }
  }

  // 4. Evaluate EST rules
  for (const rule of EST_PATTERNS) {
    if (rule.pattern.test(text)) {
      scores.EST += rule.weight
    }
  }

  // Rank subjects for this single card
  const entries = (Object.entries(scores) as [SubjectCode, number][]).sort((a, b) => b[1] - a[1])
  const [first, second] = entries

  if (first[1] === 0) {
    return { scores, winner: 'NEUTRAL', confidence: 0 }
  }

  // If top score has a margin
  const margin = first[1] - second[1]
  const winner = margin >= 1 ? first[0] : 'NEUTRAL'
  const confidence = Math.min(first[1] / 15, 1.0)

  return {
    scores,
    winner,
    confidence,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deck-Level Classifier with Minority Filtering
// ─────────────────────────────────────────────────────────────────────────────

export function detectSubjectFromCards(
  cards: GenericCardInput[],
  existingTopics?: Array<{ name: string; subject: string }>
): SubjectDetectionResult {
  const nonEmptyCards = cards.filter(hasCardContent)

  const initialVotes: Record<SubjectCode, number> = { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }
  const totalScores: Record<SubjectCode, number> = { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }

  if (nonEmptyCards.length === 0) {
    return {
      subject: 'Electronics Engineering',
      code: 'ELECS',
      confidence: 0,
      cardVotes: initialVotes,
      scores: totalScores,
      analyzedCardCount: 0,
      reasoning: 'No card content provided; defaulted to Electronics Engineering.',
    }
  }

  // 1. Score each card individually
  let neutralCount = 0
  for (const card of nonEmptyCards) {
    const text = extractCardText(card)
    const breakdown = scoreCardText(text)

    // Accumulate total raw points
    totalScores.MATH += breakdown.scores.MATH
    totalScores.GEAS += breakdown.scores.GEAS
    totalScores.ELECS += breakdown.scores.ELECS
    totalScores.EST += breakdown.scores.EST

    // Cast card vote
    if (breakdown.winner !== 'NEUTRAL') {
      initialVotes[breakdown.winner]++
    } else {
      neutralCount++
    }
  }

  const totalVotedCards = Object.values(initialVotes).reduce((sum, n) => sum + n, 0)

  // 2. Minority Filtering Algorithm
  // If a subject only got < 20% of card votes (in decks with >= 3 voted cards)
  // and another subject has a commanding majority (>= 50% of voted cards or >= 2x votes),
  // discount the minority subject's incidental points.
  const sortedVotes = (Object.entries(initialVotes) as [SubjectCode, number][]).sort((a, b) => b[1] - a[1])
  const [topVote, secondVote] = sortedVotes

  let isDominantMajority = false
  if (totalVotedCards >= 3 && topVote[1] > 0) {
    const topShare = topVote[1] / totalVotedCards
    if (topShare >= 0.5 || (secondVote[1] > 0 && topVote[1] >= secondVote[1] * 2)) {
      isDominantMajority = true
    }
  }

  // 3. Optional DB topic boost
  // If any cards or deck titles strongly match an existing known subject topic
  if (existingTopics && existingTopics.length > 0) {
    const allTextSample = nonEmptyCards.slice(0, 10).map(extractCardText).join(' ').toLowerCase()
    for (const t of existingTopics) {
      if (t.name && t.name.length > 4 && allTextSample.includes(t.name.toLowerCase())) {
        const mappedCode = FULL_TO_CODE_SUBJECT[t.subject as SubjectFullName] || (t.subject as SubjectCode)
        if (mappedCode && totalScores[mappedCode] !== undefined) {
          totalScores[mappedCode] += 10
        }
      }
    }
  }

  // 4. Determine final winner
  let winnerCode: SubjectCode

  if (totalVotedCards > 0 && topVote[1] > 0) {
    if (isDominantMajority) {
      // Dominant subject won by clear card-level consensus
      winnerCode = topVote[0]
    } else {
      // Close race: combine normalized card votes (60% weight) + score points (40% weight)
      const combinedScores = (Object.keys(initialVotes) as SubjectCode[]).map(code => {
        const voteWeight = (initialVotes[code] / Math.max(totalVotedCards, 1)) * 60
        const maxScore = Math.max(...Object.values(totalScores), 1)
        const scoreWeight = (totalScores[code] / maxScore) * 40
        return { code, combined: voteWeight + scoreWeight }
      }).sort((a, b) => b.combined - a.combined)

      winnerCode = combinedScores[0].code
    }
  } else {
    // If card votes were inconclusive (e.g., all neutral), fall back to raw score points
    const sortedScores = (Object.entries(totalScores) as [SubjectCode, number][]).sort((a, b) => b[1] - a[1])
    winnerCode = sortedScores[0][1] > 0 ? sortedScores[0][0] : 'ELECS'
  }

  const winnerFullName = CODE_TO_FULL_SUBJECT[winnerCode]
  const winnerVotes = initialVotes[winnerCode]
  const confidence = totalVotedCards > 0
    ? Math.min(0.5 + (winnerVotes / totalVotedCards) * 0.5, 0.99)
    : 0.2

  const reasoning = isDominantMajority
    ? `${winnerFullName} selected by strong majority (${winnerVotes}/${totalVotedCards} cards). Incidental keywords from minority subjects filtered.`
    : `${winnerFullName} selected based on overall domain score (${totalScores[winnerCode]} pts, ${winnerVotes} card votes).`

  return {
    subject: winnerFullName,
    code: winnerCode,
    confidence: Number(confidence.toFixed(2)),
    cardVotes: initialVotes,
    scores: totalScores,
    analyzedCardCount: nonEmptyCards.length,
    reasoning,
  }
}
