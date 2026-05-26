/**
 * FORMULA BANK — How to add formulas
 * ─────────────────────────────────────────────────────────────
 * 1. Find the correct subject (MATH/ELECS/GEAS/EST)
 * 2. Find the correct topic by id (e.g. "EST-3.0")
 * 3. Find the correct subtopic by name
 * 4. Add FormulaEntry objects to the formulas array:
 *    {
 *      id: 'EST-3.1-001',        // subject-subtopic-number
 *      name: 'Formula Name',
 *      latex: 'V = IR',          // KaTeX LaTeX string
 *      description: 'optional',  // plain text
 *      variables: 'optional',    // e.g. "V = voltage (V)"
 *    }
 * 5. Save the file — the UI updates automatically.
 * ─────────────────────────────────────────────────────────────
 */

export interface FormulaEntry {
  id: string           // e.g. "EST-4.1-001"
  name: string         // e.g. "Characteristic Impedance"
  latex: string        // Raw KaTeX string (no $$ wrappers needed)
  description?: string // Plain text explanation
  variables?: string   // e.g. "Z_o = characteristic impedance (Ω)"
  tags?: string[]
}

export interface FormulaSubtopic {
  name: string         // Mirrors TOSSubTopic.name exactly
  formulas: FormulaEntry[]
}

export interface FormulaTopic {
  id: string           // Mirrors TOSTopic.id e.g. "EST-4.0"
  name: string         // Mirrors TOSTopic.name
  subtopics: FormulaSubtopic[]
}

export interface FormulaSubject {
  code: 'MATH' | 'ELECS' | 'GEAS' | 'EST'
  label: string
  topics: FormulaTopic[]
}

export const FORMULA_BANK: FormulaSubject[] = [
  // ─── MATH ────────────────────────────────────────────────────────────────────
  {
    code: 'MATH',
    label: 'Mathematics',
    topics: [
      {
        id: 'MATH-1.0',
        name: '1.0 Differential Calculus',
        subtopics: [
          {
            name: '1.1 Functions, Continuity, Limits',
            formulas: [
              {
                id: 'MATH-1.1-001',
                name: 'Limit Definition',
                latex: '\\lim_{x \\to a} f(x) = L',
                description: 'The limit of f(x) as x approaches a equals L',
              },
              {
                id: 'MATH-1.1-002',
                name: "L'Hôpital's Rule",
                latex: '\\lim_{x \\to a} \\frac{f(x)}{g(x)} = \\lim_{x \\to a} \\frac{f\'(x)}{g\'(x)}',
                description: 'Used when limit gives 0/0 or ∞/∞ indeterminate form',
              },
            ],
          },
          {
            name: '1.2 Derivatives and Its Applications',
            formulas: [
              {
                id: 'MATH-1.2-001',
                name: 'Power Rule',
                latex: '\\frac{d}{dx} x^n = nx^{n-1}',
              },
              {
                id: 'MATH-1.2-002',
                name: 'Product Rule',
                latex: '\\frac{d}{dx}[uv] = u\'v + uv\'',
              },
              {
                id: 'MATH-1.2-003',
                name: 'Chain Rule',
                latex: '\\frac{d}{dx}[f(g(x))] = f\'(g(x)) \\cdot g\'(x)',
              },
              {
                id: 'MATH-1.2-004',
                name: 'Derivative of sin(x)',
                latex: '\\frac{d}{dx}\\sin(x) = \\cos(x)',
              },
              {
                id: 'MATH-1.2-005',
                name: 'Derivative of cos(x)',
                latex: '\\frac{d}{dx}\\cos(x) = -\\sin(x)',
              },
            ],
          },
          { name: '1.3 Higher-Order Derivatives', formulas: [] },
          { name: '1.4 Parametric Equations', formulas: [] },
          { name: '1.5 Partial Differentiation', formulas: [] },
        ],
      },
      {
        id: 'MATH-2.0',
        name: '2.0 Integral Calculus',
        subtopics: [
          {
            name: '2.1 Integration Concepts/Formulas',
            formulas: [
              {
                id: 'MATH-2.1-001',
                name: 'Power Rule (Integration)',
                latex: '\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C, \\quad n \\neq -1',
              },
              {
                id: 'MATH-2.1-002',
                name: 'Fundamental Theorem of Calculus',
                latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)',
              },
            ],
          },
          { name: '2.2 Integration Techniques', formulas: [] },
          { name: '2.3 Improper Integrals', formulas: [] },
          { name: '2.4 Application of Integral', formulas: [] },
          { name: '2.5 Multiple Integration and its Application', formulas: [] },
        ],
      },
      {
        id: 'MATH-3.0',
        name: '3.0 Differential Equation',
        subtopics: [
          { name: '3.1 First-Order, First-Degree ODE and its Application', formulas: [] },
          { name: '3.2 Higher-Order ODE and its Application', formulas: [] },
          { name: '3.3 Laplace Transforms, Inverses, and its Applications', formulas: [] },
        ],
      },
      {
        id: 'MATH-4.0',
        name: '4.0 Advanced Engineering Mathematics for ECE',
        subtopics: [
          { name: '4.1 Complex Numbers and its Applications', formulas: [] },
          { name: '4.2 Series and Transforms (Power Series, Bessel, Legendre, Fourier Series; Fourier Transforms)', formulas: [] },
          { name: '4.3 Partial Differential Equations', formulas: [] },
          { name: '4.4 Simultaneous Linear and Non-Linear Equations', formulas: [] },
          { name: '4.5 Numerical Differentiation, Integration and Optimization', formulas: [] },
        ],
      },
      {
        id: 'MATH-5.0',
        name: '5.0 Engineering Data Analysis',
        subtopics: [
          { name: '5.1 Obtaining Data', formulas: [] },
          { name: '5.2 Statistical Sampling, Distribution, and Intervals', formulas: [] },
          { name: '5.3 Test of Hypothesis', formulas: [] },
          { name: '5.4 Regression and Correlation', formulas: [] },
          { name: '5.5 Design of Experiments', formulas: [] },
        ],
      },
      {
        id: 'MATH-6.0',
        name: '6.0 Electromagnetics',
        subtopics: [
          { name: '6.1 Vector Analysis', formulas: [] },
          { name: '6.2 Directional Derivative, Gradient, Divergence, Curl', formulas: [] },
          { name: "6.3 Integral Theorems (Green's, Divergence, Stokes')", formulas: [] },
        ],
      },
      {
        id: 'MATH-7.0',
        name: '7.0 Signals, Spectra & Signal Processing',
        subtopics: [
          { name: '7.1 Z-Transforms', formulas: [] },
          { name: '7.2 Convolution', formulas: [] },
          { name: '7.3 Correlation', formulas: [] },
        ],
      },
    ],
  },

  // ─── ELECS ───────────────────────────────────────────────────────────────────
  {
    code: 'ELECS',
    label: 'Electronics Engineering',
    topics: [
      {
        id: 'ELECS-1.0',
        name: '1.0 DC Electrical Circuits',
        subtopics: [
          {
            name: '1.1 Resistive Network',
            formulas: [
              {
                id: 'ELECS-1.1-001',
                name: "Ohm's Law",
                latex: 'V = IR',
                description: 'Voltage equals current times resistance',
                variables: 'V = voltage (V), I = current (A), R = resistance (Ω)',
              },
              {
                id: 'ELECS-1.1-002',
                name: 'Power',
                latex: 'P = IV = I^2R = \\frac{V^2}{R}',
                variables: 'P = power (W)',
              },
              {
                id: 'ELECS-1.1-003',
                name: "Kirchhoff's Voltage Law",
                latex: '\\sum V = 0',
                description: 'Sum of voltages around any closed loop is zero',
              },
              {
                id: 'ELECS-1.1-004',
                name: "Kirchhoff's Current Law",
                latex: '\\sum I_{in} = \\sum I_{out}',
                description: 'Sum of currents entering a node equals sum leaving',
              },
            ],
          },
          { name: '1.2 Mesh and Node Equations', formulas: [] },
          { name: '1.3 Network Theorems', formulas: [] },
          { name: '1.4 Transient Analysis', formulas: [] },
          { name: '1.5 Solution to DC Network Problems', formulas: [] },
        ],
      },
      {
        id: 'ELECS-2.0',
        name: '2.0 AC Electrical Circuits',
        subtopics: [
          { name: '2.1 Solution to AC Network Problems', formulas: [] },
          { name: '2.2 Impedance and Admittance', formulas: [] },
          { name: '2.3 Resonance', formulas: [] },
          { name: '2.4 Power in AC Circuits', formulas: [] },
          { name: '2.5 Two-Port Network Parameters and Transfer Function', formulas: [] },
        ],
      },
      {
        id: 'ELECS-3.0',
        name: '3.0 Electromagnetics',
        subtopics: [
          { name: '3.1 Steady Electric and Magnetic Fields', formulas: [] },
          { name: '3.2 Dielectric and Magnetic Materials', formulas: [] },
          { name: '3.3 Coupled and Magnetic Circuits', formulas: [] },
          { name: "3.4 Time-Varying Fields and Maxwell's Equations", formulas: [] },
        ],
      },
      {
        id: 'ELECS-4.0',
        name: '4.0 Electronic Devices and Circuits',
        subtopics: [
          { name: '4.1 Diode Wave Shaping and Special Diode Applications', formulas: [] },
          { name: '4.2 BJT and FET Small Signal Analysis', formulas: [] },
          { name: '4.3 Diode Equivalent Circuits', formulas: [] },
          { name: '4.4 Voltage Multipliers, Power Supply, Voltage Regulation', formulas: [] },
          { name: '4.5 Bipolar Junction Transistor and FET', formulas: [] },
        ],
      },
      {
        id: 'ELECS-5.0',
        name: '5.0 Electronic Circuit Analysis and Design',
        subtopics: [
          { name: '5.1 BJT and FET Frequency Response', formulas: [] },
          { name: '5.2 Cascade and Cascode Connections', formulas: [] },
          { name: '5.3 Current Mirrors and Current Sources', formulas: [] },
          { name: '5.4 Differential and Operational Amplifiers', formulas: [] },
          { name: '5.5 Feedback Systems, Oscillators, and Filters', formulas: [] },
        ],
      },
      {
        id: 'ELECS-6.0',
        name: '6.0 Electronic Systems and Design',
        subtopics: [
          { name: '6.1 SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors', formulas: [] },
          { name: '6.2 Optoelectronic Devices and Sensors', formulas: [] },
          { name: '6.3 Transducers, Data Acquisition, and Interfacing', formulas: [] },
          { name: '6.4 Programmable Logic Controllers', formulas: [] },
          { name: '6.5 Building Management Systems and HVAC Controls', formulas: [] },
          { name: '6.6 Security, Safety, and Surveillance Systems', formulas: [] },
        ],
      },
      {
        id: 'ELECS-7.0',
        name: '7.0 Logic Circuits and Switching Theory',
        subtopics: [
          { name: '7.1 Boolean Algebra and Logic Gates', formulas: [] },
          { name: '7.2 Minimization of Combinational Logic Circuits', formulas: [] },
          { name: '7.3 Sequential Logic Circuits', formulas: [] },
          { name: '7.4 Algorithmic State Machine (ASM)', formulas: [] },
          { name: '7.5 Asynchronous Sequential Logic', formulas: [] },
        ],
      },
      {
        id: 'ELECS-8.0',
        name: '8.0 Microprocessor and Microcontroller Systems',
        subtopics: [
          { name: '8.1 Microprocessor Unit', formulas: [] },
          { name: '8.2 Memory Subsystem', formulas: [] },
          { name: '8.3 I/O Subsystem', formulas: [] },
          { name: '8.4 Instruction Set Architecture and Assembly Programming', formulas: [] },
          { name: '8.5 Microcontrollers', formulas: [] },
        ],
      },
      {
        id: 'ELECS-9.0',
        name: '9.0 Feedback and Control Systems',
        subtopics: [
          { name: '9.1 Block Diagram and Signal Flow Graphs', formulas: [] },
          { name: '9.2 LTI Systems and Transient Analysis', formulas: [] },
          { name: '9.3 System Modeling and Transfer Function', formulas: [] },
          { name: '9.4 Poles, Zeros, Root Locus, and Stability Analysis', formulas: [] },
          { name: '9.5 Steady State Analysis and Frequency Response', formulas: [] },
        ],
      },
    ],
  },

  // ─── GEAS ────────────────────────────────────────────────────────────────────
  {
    code: 'GEAS',
    label: 'General Engineering & Applied Sciences',
    topics: [
      {
        id: 'GEAS-1.0',
        name: '1.0 Chemistry for Engineers',
        subtopics: [
          { name: '1.1 Energy', formulas: [] },
          { name: '1.2 Chemistry of Engineering Materials', formulas: [] },
          { name: '1.3 Chemistry of Nanomaterials', formulas: [] },
          { name: '1.4 Chemistry of the Environment', formulas: [] },
        ],
      },
      {
        id: 'GEAS-2.0',
        name: '2.0 Physics for Engineers',
        subtopics: [
          { name: '2.1 Work, Energy and Power', formulas: [] },
          { name: '2.2 Impulse and Momentum', formulas: [] },
          { name: '2.3 Kinematics', formulas: [] },
          { name: '2.4 Dynamics', formulas: [] },
          { name: '2.5 Rotation and Dynamic of Rotation', formulas: [] },
          { name: '2.6 Elasticity', formulas: [] },
          { name: '2.7 Oscillations and Waves', formulas: [] },
          { name: '2.8 Fluids', formulas: [] },
          { name: '2.9 Heat Transfer', formulas: [] },
          { name: '2.10 Electrostatics, Electricity, Magnetism, Optics', formulas: [] },
        ],
      },
      {
        id: 'GEAS-3.0',
        name: '3.0 Engineering Economics',
        subtopics: [
          {
            name: '3.1 Engineering Economics Terms',
            formulas: [
              {
                id: 'GEAS-3.1-001',
                name: 'Simple Interest',
                latex: 'I = Prt',
                variables: 'I = interest, P = principal, r = rate, t = time',
              },
              {
                id: 'GEAS-3.1-002',
                name: 'Compound Interest',
                latex: 'F = P\\left(1 + \\frac{r}{m}\\right)^{mt}',
                variables: 'F = future value, m = compounding periods per year',
              },
            ],
          },
          { name: '3.2 Money-Time Relationship and Equivalence', formulas: [] },
          { name: '3.3 Basic Economy Study Methods', formulas: [] },
          { name: '3.4 Decisions Under Certainty', formulas: [] },
          { name: '3.5 Decisions Recognizing Risk', formulas: [] },
          { name: '3.6 Decision Admitting Uncertainty', formulas: [] },
        ],
      },
      {
        id: 'GEAS-4.0',
        name: '4.0 Engineering Management',
        subtopics: [
          { name: '4.1 Evolution of Management Theory', formulas: [] },
          { name: '4.2 Management and Its Functions', formulas: [] },
          { name: '4.3 Planning, Leading, Organizing, Controlling', formulas: [] },
          { name: '4.4 Managing Product and Service Operations', formulas: [] },
          { name: '4.5 Managing Marketing and Finance Functions', formulas: [] },
        ],
      },
      {
        id: 'GEAS-5.0',
        name: '5.0 Technopreneurship 101',
        subtopics: [
          { name: '5.1 Introduction, Ethics, Social Responsibility', formulas: [] },
          { name: '5.2 Customers and Value Proposition', formulas: [] },
          { name: '5.3 Market Identification and Analysis', formulas: [] },
          { name: '5.4 Creating Competitive Advantage', formulas: [] },
          { name: '5.5 Business Models and Intellectual Property', formulas: [] },
          { name: '5.6 Execution and Business Plan', formulas: [] },
          { name: '5.7 Financial Analysis and Accounting Basics', formulas: [] },
          { name: '5.8 Raising Capital', formulas: [] },
        ],
      },
      {
        id: 'GEAS-6.0',
        name: '6.0 Physics 2',
        subtopics: [
          { name: '6.1 Thermodynamics', formulas: [] },
          { name: '6.2 Electricity and Magnetism', formulas: [] },
          { name: '6.3 EM Induction and Inductance', formulas: [] },
          { name: '6.4 AC Circuits', formulas: [] },
          { name: '6.5 Optics and Atomic/Nuclear Physics', formulas: [] },
        ],
      },
      {
        id: 'GEAS-7.0',
        name: '7.0 Materials Science and Engineering',
        subtopics: [
          { name: '7.1 Atomic Structure and Interatomic Bonding', formulas: [] },
          { name: '7.2 Structure of Crystalline Materials', formulas: [] },
          { name: '7.3 Imperfections in Solids', formulas: [] },
          { name: '7.4 Diffusion in Solids', formulas: [] },
          { name: '7.5 Mechanical Properties of Metals', formulas: [] },
          { name: '7.6 Metal Alloys, Ceramics, Polymers, Composites', formulas: [] },
          { name: '7.7 Electrical, Dielectric, Magnetic, Optical Properties', formulas: [] },
        ],
      },
      {
        id: 'GEAS-8.0',
        name: '8.0 Computer Programming',
        subtopics: [
          { name: '8.1 Object Oriented Programming and UML', formulas: [] },
          { name: '8.2 Object Oriented Analysis and Design', formulas: [] },
          { name: '8.3 Programming Language Fundamentals', formulas: [] },
          { name: '8.4 Exception Handling', formulas: [] },
          { name: '8.5 Graphical User Interface Programming', formulas: [] },
        ],
      },
      {
        id: 'GEAS-9.0',
        name: '9.0 Environment Science and Engineering',
        subtopics: [
          { name: '9.1 Nature and Ecology', formulas: [] },
          { name: '9.2 Natural Systems and Resources', formulas: [] },
          { name: '9.3 Environmental Concerns and Crises', formulas: [] },
          { name: '9.4 Environmental Impact Assessment', formulas: [] },
          { name: '9.5 Sustainable Development', formulas: [] },
        ],
      },
      {
        id: 'GEAS-10.0',
        name: '10.0 ECE Laws, Contracts, Ethics, Standards and Safety',
        subtopics: [
          { name: '10.1 Laws, Obligations and Contracts', formulas: [] },
          { name: '10.2 Pledge of ECE and CSC Guidelines', formulas: [] },
          { name: '10.3 Board Examination Rules', formulas: [] },
          { name: '10.4 Regulating the ECE Profession (PRC)', formulas: [] },
          { name: '10.5 Other ECE Related Statutes', formulas: [] },
          { name: '10.6 Safety Standards and PEC Codes', formulas: [] },
        ],
      },
      {
        id: 'GEAS-11.0',
        name: '11.0 CAD',
        subtopics: [
          { name: '11.1 Introduction to CAD Software', formulas: [] },
          { name: '11.2 Snapping and Construction Elements', formulas: [] },
          { name: '11.3 Dimensioning, Plotting and Image Input', formulas: [] },
        ],
      },
    ],
  },

  // ─── EST ─────────────────────────────────────────────────────────────────────
  {
    code: 'EST',
    label: 'Electronics Systems & Technologies',
    topics: [
      {
        id: 'EST-1.0',
        name: '1.0 Signals, Spectra, Signal Processing',
        subtopics: [
          { name: '1.1 Classification and Characteristics of Signals', formulas: [] },
          { name: '1.2 Sampling Theorem and Aliasing', formulas: [] },
          { name: '1.3 Difference Equations for FIR and IIR Filters', formulas: [] },
          { name: '1.4 Convolution and Correlation', formulas: [] },
          { name: '1.5 Z-Transforms and Pole-Zero-Gain Filters', formulas: [] },
          { name: '1.6 Fourier Transforms and Filtering', formulas: [] },
        ],
      },
      {
        id: 'EST-2.0',
        name: '2.0 Principles of Communications',
        subtopics: [
          { name: '2.1 Introduction to Communications Systems', formulas: [] },
          { name: '2.2 Noise and Amplitude Modulation', formulas: [] },
          { name: '2.3 Single-Sideband Techniques', formulas: [] },
          { name: '2.4 Frequency Modulation', formulas: [] },
          { name: '2.5 Radio Receivers', formulas: [] },
          { name: '2.6 Radiation and Propagation of Waves', formulas: [] },
          { name: '2.7 Pulse Modulation and Digital Modulation', formulas: [] },
          { name: '2.8 Broadband Communication Systems', formulas: [] },
        ],
      },
      {
        id: 'EST-3.0',
        name: '3.0 Digital Communications',
        subtopics: [
          { name: '3.1 Introduction to Digital Communications', formulas: [] },
          { name: '3.2 Digital Transmission', formulas: [] },
          { name: '3.3 PAM, PWM, PPM, Pulse Code Modulation', formulas: [] },
          { name: '3.4 ASK, FSK, PSK, QAM', formulas: [] },
          { name: '3.5 Basics of Information Theory and Error Detection', formulas: [] },
          { name: '3.6 FDM, TDM, WDM, FDMA, CDMA, TDMA', formulas: [] },
        ],
      },
      {
        id: 'EST-4.0',
        name: '4.0 Transmission and Antenna Systems',
        subtopics: [
          {
            name: '4.1 Transmission Line Circuits',
            formulas: [
              // ── Primary Line Constants ──
              {
                id: 'EST-4.1-001',
                name: 'Parallel-Wire Series Resistance',
                latex: 'R = \\frac{0.1\\sqrt{f_{MHz}}}{r_{in}}',
                variables: 'R = series resistance (Ω/m), f_MHz = frequency (MHz), r_in = conductor radius (inches)',
              },
              {
                id: 'EST-4.1-002',
                name: 'Parallel-Wire Series Inductance',
                latex: 'L = \\frac{\\mu}{\\pi}\\ln\\left(\\frac{2S}{d}\\right)',
                variables: 'L = inductance (H/m), μ = permeability, S = separation, d = conductor diameter',
              },
              {
                id: 'EST-4.1-003',
                name: 'Parallel-Wire Shunt Capacitance',
                latex: 'C = \\frac{\\pi\\varepsilon}{\\ln\\left(\\frac{2S}{d}\\right)}',
                variables: 'C = capacitance (F/m), ε = permittivity',
              },
              {
                id: 'EST-4.1-004',
                name: 'Coaxial Series Resistance',
                latex: 'R = 0.1\\sqrt{f_{MHz}}\\left(\\frac{1}{D_{in}} + \\frac{1}{d_{in}}\\right)',
                variables: 'D_in = outer conductor inner diameter (inches), d_in = inner conductor diameter (inches)',
              },
              {
                id: 'EST-4.1-005',
                name: 'Coaxial Series Inductance',
                latex: 'L = \\frac{\\mu}{2\\pi}\\ln\\left(\\frac{D}{d}\\right)',
                variables: 'D = outer conductor diameter, d = inner conductor diameter',
              },
              {
                id: 'EST-4.1-006',
                name: 'Coaxial Shunt Capacitance',
                latex: 'C = \\frac{2\\pi\\varepsilon}{\\ln\\left(\\frac{D}{d}\\right)}',
              },
              // ── Characteristic Impedance ──
              {
                id: 'EST-4.1-007',
                name: 'Characteristic Impedance (General, Lossy)',
                latex: 'Z_o = \\sqrt{\\frac{R + j\\omega L}{G + j\\omega C}}',
                variables: 'R = series resistance, G = shunt conductance, L = series inductance, C = shunt capacitance',
              },
              {
                id: 'EST-4.1-008',
                name: 'Characteristic Impedance at LF',
                latex: 'Z_o = \\sqrt{\\frac{R}{G}}',
                description: 'Low-frequency (lossy) approximation',
              },
              {
                id: 'EST-4.1-009',
                name: 'Characteristic Impedance at HF (Lossless)',
                latex: 'Z_o = \\sqrt{\\frac{L}{C}}',
                description: 'High-frequency lossless approximation (R≈0, G≈0)',
              },
              {
                id: 'EST-4.1-010',
                name: 'Parallel-Wire Characteristic Impedance',
                latex: 'Z_o = \\frac{120}{\\sqrt{\\varepsilon_r}}\\ln\\left(\\frac{2S}{d}\\right)',
                variables: 'ε_r = relative permittivity of dielectric',
              },
              {
                id: 'EST-4.1-011',
                name: 'Coaxial Cable Characteristic Impedance',
                latex: 'Z_o = \\frac{60}{\\sqrt{\\varepsilon_r}}\\ln\\left(\\frac{D}{d}\\right)',
              },
              // ── Propagation Constant ──
              {
                id: 'EST-4.1-012',
                name: 'Propagation Constant',
                latex: '\\gamma = \\sqrt{(R+j\\omega L)(G+j\\omega C)}',
                description: 'Complex propagation constant of the transmission line',
              },
              {
                id: 'EST-4.1-013',
                name: 'Propagation Constant (Complex Form)',
                latex: '\\gamma = \\alpha + j\\beta',
                variables: 'α = attenuation constant (Np/m), β = phase shift constant (rad/m)',
              },
              {
                id: 'EST-4.1-014',
                name: 'Attenuation Constant',
                latex: '\\alpha = \\frac{R}{2Z_o} + \\frac{GZ_o}{2}',
                variables: 'α = attenuation (Np/m)',
              },
              {
                id: 'EST-4.1-015',
                name: 'Phase Shift Constant (wavelength)',
                latex: '\\beta = \\frac{2\\pi}{\\lambda}',
                variables: 'β = phase constant (rad/m), λ = wavelength (m)',
              },
              {
                id: 'EST-4.1-016',
                name: 'Phase Shift Constant (velocity)',
                latex: '\\beta = \\frac{\\omega}{V_p}',
                variables: 'V_p = phase velocity (m/s)',
              },
              {
                id: 'EST-4.1-017',
                name: 'Phase Shift Constant (LC)',
                latex: '\\beta = \\omega\\sqrt{LC}',
              },
              // ── Velocity of Propagation ──
              {
                id: 'EST-4.1-018',
                name: 'Phase Velocity',
                latex: 'V_p = \\frac{c}{\\sqrt{\\varepsilon_r}}',
                variables: 'c = speed of light (3×10⁸ m/s)',
              },
              {
                id: 'EST-4.1-019',
                name: 'Velocity Factor (ratio)',
                latex: 'V_f = \\frac{V_p}{c}',
                description: 'Ratio of phase velocity to speed of light, between 0 and 1',
              },
              {
                id: 'EST-4.1-020',
                name: 'Velocity Factor (simplified)',
                latex: 'V_f = \\frac{1}{\\sqrt{\\varepsilon_r}}',
              },
              {
                id: 'EST-4.1-021',
                name: 'Electrical Phase Shift',
                latex: '\\Phi = \\beta L',
                variables: 'Φ = phase shift (rad), L = line length (m)',
              },
              {
                id: 'EST-4.1-022',
                name: 'Phase Shift (time domain)',
                latex: '\\Phi = 2\\pi f t',
                variables: 'f = frequency (Hz), t = time (s)',
              },
              // ── Reflection Coefficient ──
              {
                id: 'EST-4.1-023',
                name: 'Reflection Coefficient (voltage)',
                latex: '\\Gamma = \\frac{E^-}{E^+} = \\frac{V_{ref}}{V_{inc}}',
                description: 'Ratio of reflected to incident voltage wave',
              },
              {
                id: 'EST-4.1-024',
                name: 'Reflection Coefficient (impedance)',
                latex: '\\Gamma = \\frac{Z_L - Z_o}{Z_L + Z_o}',
                variables: 'Z_L = load impedance, Z_o = characteristic impedance',
              },
              {
                id: 'EST-4.1-025',
                name: 'Power Reflection Coefficient',
                latex: '|\\Gamma|^2 = \\frac{P_{ref}}{P_{inc}}',
              },
              {
                id: 'EST-4.1-026',
                name: 'Absorbed Power',
                latex: 'P_{abs} = (1 - |\\Gamma|^2)P_{inc}',
              },
              // ── Standing Wave Ratio ──
              {
                id: 'EST-4.1-027',
                name: 'SWR Definition',
                latex: 'SWR = \\frac{E_{max}}{E_{min}}',
                description: 'Standing Wave Ratio is the ratio of maximum to minimum voltage along the line',
              },
              {
                id: 'EST-4.1-028',
                name: 'Maximum Voltage',
                latex: 'E_{max} = E^+ + E^-',
              },
              {
                id: 'EST-4.1-029',
                name: 'Minimum Voltage',
                latex: 'E_{min} = E^+ - E^-',
              },
              {
                id: 'EST-4.1-030',
                name: 'SWR from Gamma',
                latex: 'SWR = \\frac{1+|\\Gamma|}{1-|\\Gamma|}',
              },
              {
                id: 'EST-4.1-031',
                name: 'Gamma from SWR',
                latex: '|\\Gamma| = \\frac{SWR-1}{SWR+1}',
              },
              {
                id: 'EST-4.1-032',
                name: 'SWR (resistive, Z_L > Z_o)',
                latex: 'SWR = \\frac{Z_L}{Z_o}',
              },
              {
                id: 'EST-4.1-033',
                name: 'SWR (resistive, Z_o > Z_L)',
                latex: 'SWR = \\frac{Z_o}{Z_L}',
              },
              // ── TL Input Impedance ──
              {
                id: 'EST-4.1-034',
                name: 'Input Impedance (General)',
                latex: 'Z_{in} = Z_o\\left[\\frac{Z_L + jZ_o\\tan(\\beta l)}{Z_o + jZ_L\\tan(\\beta l)}\\right]',
                variables: 'l = line length, β = phase constant',
              },
              {
                id: 'EST-4.1-035',
                name: 'Case 1: Matched Line (Z_L = Z_o)',
                latex: 'Z_{in} = Z_o',
                description: 'No reflections when load equals characteristic impedance',
              },
              {
                id: 'EST-4.1-036',
                name: 'Case 2: Shorted End (Z_L = 0)',
                latex: 'Z_{in} = jZ_o\\tan(\\beta l)',
                description: 'Short-circuit termination — purely reactive input impedance',
              },
              {
                id: 'EST-4.1-037',
                name: 'Case 3: Open End (Z_L = ∞)',
                latex: 'Z_{in} = -jZ_o\\cot(\\beta l)',
                description: 'Open-circuit termination — purely reactive input impedance',
              },
              {
                id: 'EST-4.1-038',
                name: 'Case 4: λ/4 Transformer',
                latex: 'Z_{in} = \\frac{Z_o^2}{Z_L}',
                description: 'Quarter-wave line acts as impedance inverter',
              },
              {
                id: 'EST-4.1-039',
                name: 'Case 5: λ/2 Line',
                latex: 'Z_{in} = Z_L',
                description: 'Half-wave line repeats the load impedance',
              },
              {
                id: 'EST-4.1-040',
                name: 'Quarter-Wave Transformer (Z\'_o)',
                latex: "Z'_o = \\sqrt{Z_o Z_L}",
                description: 'Characteristic impedance of a λ/4 matching section',
              },
              {
                id: 'EST-4.1-041',
                name: 'TDR Distance',
                latex: 'd = \\frac{V_p \\cdot t}{2}',
                description: 'Time-Domain Reflectometry: distance to fault from round-trip travel time',
                variables: 't = round-trip time (s), V_p = phase velocity (m/s)',
              },
            ],
          },
          { name: '4.2 Losses, Parameters, and Matching', formulas: [] },
          { name: '4.3 Smith Chart', formulas: [] },
          { name: '4.4 Radio Wave Propagation', formulas: [] },
          { name: '4.5 Power Density and Field Strength Calculations', formulas: [] },
          { name: '4.6 Antenna Systems', formulas: [] },
          { name: '4.7 Waveguides and Fiber Optics', formulas: [] },
        ],
      },
      {
        id: 'EST-5.0',
        name: '5.0 Electronics 3: Electronic Systems and Design',
        subtopics: [
          { name: '5.1 SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors', formulas: [] },
          { name: '5.2 Optoelectronic Devices and Sensors', formulas: [] },
          { name: '5.3 Transducers and Interfacing Techniques', formulas: [] },
          { name: '5.4 Programmable Logic Controllers', formulas: [] },
          { name: '5.5 Building Management Systems (HVAC, Security, Audio-Video, Fire and Life Safety, SCADA)', formulas: [] },
        ],
      },
      {
        id: 'EST-6.0',
        name: '6.0 Data Communications',
        subtopics: [
          { name: '6.1 Introduction and Categories of Data Communications', formulas: [] },
          { name: '6.2 Configurations and Network Topology', formulas: [] },
          { name: '6.3 Transmission Modes and Synchronization', formulas: [] },
          { name: '6.4 Network Components (Terminals, Multiplexers, Concentrators, FEP, Serial Interface)', formulas: [] },
          { name: '6.5 Security and Cryptography', formulas: [] },
          { name: '6.6 OSI Model and TCP/IP Architecture', formulas: [] },
          { name: '6.7 SNA, Character and Bit-Oriented Protocols', formulas: [] },
          { name: '6.8 LAN, MAN, WAN, GAN, ISDN, B-ISDN', formulas: [] },
        ],
      },
    ],
  },
]

export function countFormulas(topic: FormulaTopic): number {
  return topic.subtopics.reduce((sum, st) => sum + st.formulas.length, 0)
}

export function countAllFormulas(subject: FormulaSubject): number {
  return subject.topics.reduce((sum, t) => sum + countFormulas(t), 0)
}
