import { Calculator, FlaskConical, Zap, Cpu, LucideIcon } from 'lucide-react'

export interface SubTopic {
  id: string
  name: string
}

export interface Topic {
  id: string
  name: string
  subtopics: SubTopic[]
}

export interface SubjectArea {
  id: string
  name: string
  icon: LucideIcon
  topics: Topic[]
}

export const TOC_DATA: SubjectArea[] = [
  // ─── 1. MATHEMATICS (MATH) ───
  {
    id: 'MATH',
    name: 'MATHEMATICS',
    icon: Calculator,
    topics: [
      {
        id: 'MATH-1.0',
        name: '1.0 Differential Calculus',
        subtopics: [
          { id: 'MATH-1.1', name: '1.1 Functions, Continuity, Limits' },
          { id: 'MATH-1.2', name: '1.2 Derivatives and Its Applications' },
          { id: 'MATH-1.3', name: '1.3 Higher-Order Derivatives' },
          { id: 'MATH-1.4', name: '1.4 Parametric Equations' },
          { id: 'MATH-1.5', name: '1.5 Partial Differentiation' },
        ]
      },
      {
        id: 'MATH-2.0',
        name: '2.0 Integral Calculus',
        subtopics: [
          { id: 'MATH-2.1', name: '2.1 Integration Concepts/Formulas' },
          { id: 'MATH-2.2', name: '2.2 Integration Techniques' },
          { id: 'MATH-2.3', name: '2.3 Improper Integrals' },
          { id: 'MATH-2.4', name: '2.4 Application of Integral' },
          { id: 'MATH-2.5', name: '2.5 Multiple Integration and its Application' },
        ]
      },
      {
        id: 'MATH-3.0',
        name: '3.0 Differential Equation',
        subtopics: [
          { id: 'MATH-3.1', name: '3.1 First-Order, First-Degree ODE and its Application' },
          { id: 'MATH-3.2', name: '3.2 Higher-Order ODE and its Application' },
          { id: 'MATH-3.3', name: '3.3 Laplace Transforms, Inverses, and its Applications' },
        ]
      },
      {
        id: 'MATH-4.0',
        name: '4.0 Advanced Engineering Mathematics for ECE',
        subtopics: [
          { id: 'MATH-4.1', name: '4.1 Complex Numbers and its Applications' },
          { id: 'MATH-4.2', name: '4.2 Series and Transforms (Power Series, Bessel, Legendre, Fourier Series; Fourier Transforms)' },
          { id: 'MATH-4.3', name: '4.3 Partial Differential Equations' },
          { id: 'MATH-4.4', name: '4.4 Simultaneous Linear and Non-Linear Equations' },
          { id: 'MATH-4.5', name: '4.5 Numerical Differentiation, Integration and Optimization' },
        ]
      },
      {
        id: 'MATH-5.0',
        name: '5.0 Engineering Data Analysis',
        subtopics: [
          { id: 'MATH-5.1', name: '5.1 Obtaining Data' },
          { id: 'MATH-5.2', name: '5.2 Statistical Sampling, Distribution, and Intervals' },
          { id: 'MATH-5.3', name: '5.3 Test of Hypothesis' },
          { id: 'MATH-5.4', name: '5.4 Regression and Correlation' },
          { id: 'MATH-5.5', name: '5.5 Design of Experiments' },
        ]
      },
      {
        id: 'MATH-6.0',
        name: '6.0 Electromagnetics',
        subtopics: [
          { id: 'MATH-6.1', name: '6.1 Vector Analysis' },
          { id: 'MATH-6.2', name: '6.2 Directional Derivative, Gradient, Divergence, Curl' },
          { id: 'MATH-6.3', name: '6.3 Integral Theorems (Green\'s, Divergence, Stokes\')' },
        ]
      },
      {
        id: 'MATH-7.0',
        name: '7.0 Signals, Spectra & Signal Processing',
        subtopics: [
          { id: 'MATH-7.1', name: '7.1 Z-Transforms' },
          { id: 'MATH-7.2', name: '7.2 Convolution' },
          { id: 'MATH-7.3', name: '7.3 Correlation' },
        ]
      }
    ]
  },

  // ─── 2. ELECTRONICS ENGINEERING (ELECS) ───
  {
    id: 'ELECS',
    name: 'ELECTRONICS ENGINEERING',
    icon: Zap,
    topics: [
      {
        id: 'ELECS-1.0',
        name: '1.0 DC Electrical Circuits',
        subtopics: [
          { id: 'ELECS-1.1', name: '1.1 Resistive Network' },
          { id: 'ELECS-1.2', name: '1.2 Mesh and Node Equations' },
          { id: 'ELECS-1.3', name: '1.3 Network Theorems' },
          { id: 'ELECS-1.4', name: '1.4 Transient Analysis' },
          { id: 'ELECS-1.5', name: '1.5 Solution to DC Network Problems' },
        ]
      },
      {
        id: 'ELECS-2.0',
        name: '2.0 AC Electrical Circuits',
        subtopics: [
          { id: 'ELECS-2.1', name: '2.1 Solution to AC Network Problems' },
          { id: 'ELECS-2.2', name: '2.2 Impedance and Admittance' },
          { id: 'ELECS-2.3', name: '2.3 Resonance' },
          { id: 'ELECS-2.4', name: '2.4 Power in AC Circuits' },
          { id: 'ELECS-2.5', name: '2.5 Two-Port Network Parameters and Transfer Function' },
        ]
      },
      {
        id: 'ELECS-3.0',
        name: '3.0 Electromagnetics',
        subtopics: [
          { id: 'ELECS-3.1', name: '3.1 Steady Electric and Magnetic Fields' },
          { id: 'ELECS-3.2', name: '3.2 Dielectric and Magnetic Materials' },
          { id: 'ELECS-3.3', name: '3.3 Coupled and Magnetic Circuits' },
          { id: 'ELECS-3.4', name: '3.4 Time-Varying Fields and Maxwell\'s Equations' },
        ]
      },
      {
        id: 'ELECS-4.0',
        name: '4.0 Electronic Devices and Circuits',
        subtopics: [
          { id: 'ELECS-4.1', name: '4.1 Diode Wave Shaping and Special Diode Applications' },
          { id: 'ELECS-4.2', name: '4.2 BJT and FET Small Signal Analysis' },
          { id: 'ELECS-4.3', name: '4.3 Diode Equivalent Circuits' },
          { id: 'ELECS-4.4', name: '4.4 Voltage Multipliers, Power Supply, Voltage Regulation' },
          { id: 'ELECS-4.5', name: '4.5 Bipolar Junction Transistor and FET' },
        ]
      },
      {
        id: 'ELECS-5.0',
        name: '5.0 Electronic Circuit Analysis and Design',
        subtopics: [
          { id: 'ELECS-5.1', name: '5.1 BJT and FET Frequency Response' },
          { id: 'ELECS-5.2', name: '5.2 Cascade and Cascode Connections' },
          { id: 'ELECS-5.3', name: '5.3 Current Mirrors and Current Sources' },
          { id: 'ELECS-5.4', name: '5.4 Differential and Operational Amplifiers' },
          { id: 'ELECS-5.5', name: '5.5 Feedback Systems, Oscillators, and Filters' },
        ]
      },
      {
        id: 'ELECS-6.0',
        name: '6.0 Electronic Systems and Design',
        subtopics: [
          { id: 'ELECS-6.1', name: '6.1 SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors' },
          { id: 'ELECS-6.2', name: '6.2 Optoelectronic Devices and Sensors' },
          { id: 'ELECS-6.3', name: '6.3 Transducers, Data Acquisition, and Interfacing' },
          { id: 'ELECS-6.4', name: '6.4 Programmable Logic Controllers' },
          { id: 'ELECS-6.5', name: '6.5 Building Management Systems and HVAC Controls' },
          { id: 'ELECS-6.6', name: '6.6 Security, Safety, and Surveillance Systems' },
        ]
      },
      {
        id: 'ELECS-7.0',
        name: '7.0 Logic Circuits and Switching Theory',
        subtopics: [
          { id: 'ELECS-7.1', name: '7.1 Boolean Algebra and Logic Gates' },
          { id: 'ELECS-7.2', name: '7.2 Minimization of Combinational Logic Circuits' },
          { id: 'ELECS-7.3', name: '7.3 Sequential Logic Circuits' },
          { id: 'ELECS-7.4', name: '7.4 Algorithmic State Machine (ASM)' },
          { id: 'ELECS-7.5', name: '7.5 Asynchronous Sequential Logic' },
        ]
      },
      {
        id: 'ELECS-8.0',
        name: '8.0 Microprocessor and Microcontroller Systems',
        subtopics: [
          { id: 'ELECS-8.1', name: '8.1 Microprocessor Unit' },
          { id: 'ELECS-8.2', name: '8.2 Memory Subsystem' },
          { id: 'ELECS-8.3', name: '8.3 I/O Subsystem' },
          { id: 'ELECS-8.4', name: '8.4 Instruction Set Architecture and Assembly Programming' },
          { id: 'ELECS-8.5', name: '8.5 Microcontrollers' },
        ]
      },
      {
        id: 'ELECS-9.0',
        name: '9.0 Feedback and Control Systems',
        subtopics: [
          { id: 'ELECS-9.1', name: '9.1 Block Diagram and Signal Flow Graphs' },
          { id: 'ELECS-9.2', name: '9.2 LTI Systems and Transient Analysis' },
          { id: 'ELECS-9.3', name: '9.3 System Modeling and Transfer Function' },
          { id: 'ELECS-9.4', name: '9.4 Poles, Zeros, Root Locus, and Stability Analysis' },
          { id: 'ELECS-9.5', name: '9.5 Steady State Analysis and Frequency Response' },
        ]
      }
    ]
  },

  // ─── 3. GENERAL ENGINEERING AND APPLIED SCIENCES (GEAS) ───
  {
    id: 'GEAS',
    name: 'GENERAL ENGINEERING AND APPLIED SCIENCES',
    icon: FlaskConical,
    topics: [
      {
        id: 'GEAS-1.0',
        name: '1.0 Chemistry for Engineers',
        subtopics: [
          { id: 'GEAS-1.1', name: '1.1 Energy' },
          { id: 'GEAS-1.2', name: '1.2 Chemistry of Engineering Materials' },
          { id: 'GEAS-1.3', name: '1.3 Chemistry of Nanomaterials' },
          { id: 'GEAS-1.4', name: '1.4 Chemistry of the Environment' },
        ]
      },
      {
        id: 'GEAS-2.0',
        name: '2.0 Physics for Engineers',
        subtopics: [
          { id: 'GEAS-2.1', name: '2.1 Work, Energy and Power' },
          { id: 'GEAS-2.2', name: '2.2 Impulse and Momentum' },
          { id: 'GEAS-2.3', name: '2.3 Kinematics' },
          { id: 'GEAS-2.4', name: '2.4 Dynamics' },
          { id: 'GEAS-2.5', name: '2.5 Rotation and Dynamic of Rotation' },
          { id: 'GEAS-2.6', name: '2.6 Elasticity' },
          { id: 'GEAS-2.7', name: '2.7 Oscillations and Waves' },
          { id: 'GEAS-2.8', name: '2.8 Fluids' },
          { id: 'GEAS-2.9', name: '2.9 Heat Transfer' },
          { id: 'GEAS-2.10', name: '2.10 Electrostatics, Electricity, Magnetism, Optics' },
        ]
      },
      {
        id: 'GEAS-3.0',
        name: '3.0 Engineering Economics',
        subtopics: [
          { id: 'GEAS-3.1', name: '3.1 Engineering Economics Terms' },
          { id: 'GEAS-3.2', name: '3.2 Money-Time Relationship and Equivalence' },
          { id: 'GEAS-3.3', name: '3.3 Basic Economy Study Methods' },
          { id: 'GEAS-3.4', name: '3.4 Decisions Under Certainty' },
          { id: 'GEAS-3.5', name: '3.5 Decisions Recognizing Risk' },
          { id: 'GEAS-3.6', name: '3.6 Decision Admitting Uncertainty' },
        ]
      },
      {
        id: 'GEAS-4.0',
        name: '4.0 Engineering Management',
        subtopics: [
          { id: 'GEAS-4.1', name: '4.1 Evolution of Management Theory' },
          { id: 'GEAS-4.2', name: '4.2 Management and Its Functions' },
          { id: 'GEAS-4.3', name: '4.3 Planning, Leading, Organizing, Controlling' },
          { id: 'GEAS-4.4', name: '4.4 Managing Product and Service Operations' },
          { id: 'GEAS-4.5', name: '4.5 Managing Marketing and Finance Functions' },
        ]
      },
      {
        id: 'GEAS-5.0',
        name: '5.0 Technopreneurship 101',
        subtopics: [
          { id: 'GEAS-5.1', name: '5.1 Introduction, Ethics, Social Responsibility' },
          { id: 'GEAS-5.2', name: '5.2 Customers and Value Proposition' },
          { id: 'GEAS-5.3', name: '5.3 Market Identification and Analysis' },
          { id: 'GEAS-5.4', name: '5.4 Creating Competitive Advantage' },
          { id: 'GEAS-5.5', name: '5.5 Business Models and Intellectual Property' },
          { id: 'GEAS-5.6', name: '5.6 Execution and Business Plan' },
          { id: 'GEAS-5.7', name: '5.7 Financial Analysis and Accounting Basics' },
          { id: 'GEAS-5.8', name: '5.8 Raising Capital' },
        ]
      },
      {
        id: 'GEAS-6.0',
        name: '6.0 Physics 2',
        subtopics: [
          { id: 'GEAS-6.1', name: '6.1 Thermodynamics' },
          { id: 'GEAS-6.2', name: '6.2 Electricity and Magnetism' },
          { id: 'GEAS-6.3', name: '6.3 EM Induction and Inductance' },
          { id: 'GEAS-6.4', name: '6.4 AC Circuits' },
          { id: 'GEAS-6.5', name: '6.5 Optics and Atomic/Nuclear Physics' },
        ]
      },
      {
        id: 'GEAS-7.0',
        name: '7.0 Materials Science and Engineering',
        subtopics: [
          { id: 'GEAS-7.1', name: '7.1 Atomic Structure and Interatomic Bonding' },
          { id: 'GEAS-7.2', name: '7.2 Structure of Crystalline Materials' },
          { id: 'GEAS-7.3', name: '7.3 Imperfections in Solids' },
          { id: 'GEAS-7.4', name: '7.4 Diffusion in Solids' },
          { id: 'GEAS-7.5', name: '7.5 Mechanical Properties of Metals' },
          { id: 'GEAS-7.6', name: '7.6 Metal Alloys, Ceramics, Polymers, Composites' },
          { id: 'GEAS-7.7', name: '7.7 Electrical, Dielectric, Magnetic, Optical Properties' },
        ]
      },
      {
        id: 'GEAS-8.0',
        name: '8.0 Computer Programming',
        subtopics: [
          { id: 'GEAS-8.1', name: '8.1 Object Oriented Programming and UML' },
          { id: 'GEAS-8.2', name: '8.2 Object Oriented Analysis and Design' },
          { id: 'GEAS-8.3', name: '8.3 Programming Language Fundamentals' },
          { id: 'GEAS-8.4', name: '8.4 Exception Handling' },
          { id: 'GEAS-8.5', name: '8.5 Graphical User Interface Programming' },
        ]
      },
      {
        id: 'GEAS-9.0',
        name: '9.0 Environment Science and Engineering',
        subtopics: [
          { id: 'GEAS-9.1', name: '9.1 Nature and Ecology' },
          { id: 'GEAS-9.2', name: '9.2 Natural Systems and Resources' },
          { id: 'GEAS-9.3', name: '9.3 Environmental Concerns and Crises' },
          { id: 'GEAS-9.4', name: '9.4 Environmental Impact Assessment' },
          { id: 'GEAS-9.5', name: '9.5 Sustainable Development' },
        ]
      },
      {
        id: 'GEAS-10.0',
        name: '10.0 ECE Laws, Contracts, Ethics, Standards and Safety',
        subtopics: [
          { id: 'GEAS-10.1', name: '10.1 Laws, Obligations and Contracts' },
          { id: 'GEAS-10.2', name: '10.2 Pledge of ECE and CSC Guidelines' },
          { id: 'GEAS-10.3', name: '10.3 Board Examination Rules' },
          { id: 'GEAS-10.4', name: '10.4 Regulating the ECE Profession (PRC)' },
          { id: 'GEAS-10.5', name: '10.5 Other ECE Related Statutes' },
          { id: 'GEAS-10.6', name: '10.6 Safety Standards and PEC Codes' },
        ]
      },
      {
        id: 'GEAS-11.0',
        name: '11.0 CAD',
        subtopics: [
          { id: 'GEAS-11.1', name: '11.1 Introduction to CAD Software' },
          { id: 'GEAS-11.2', name: '11.2 Snapping and Construction Elements' },
          { id: 'GEAS-11.3', name: '11.3 Dimensioning, Plotting and Image Input' },
        ]
      }
    ]
  },

  // ─── 4. ELECTRONICS SYSTEMS AND TECHNOLOGIES (EST) ───
  {
    id: 'EST',
    name: 'ELECTRONICS SYSTEMS AND TECHNOLOGIES',
    icon: Cpu,
    topics: [
      {
        id: 'EST-1.0',
        name: '1.0 Signals, Spectra, Signal Processing',
        subtopics: [
          { id: 'EST-1.1', name: '1.1 Classification and Characteristics of Signals' },
          { id: 'EST-1.2', name: '1.2 Sampling Theorem and Aliasing' },
          { id: 'EST-1.3', name: '1.3 Difference Equations for FIR and IIR Filters' },
          { id: 'EST-1.4', name: '1.4 Convolution and Correlation' },
          { id: 'EST-1.5', name: '1.5 Z-Transforms and Pole-Zero-Gain Filters' },
          { id: 'EST-1.6', name: '1.6 Fourier Transforms and Filtering' },
        ]
      },
      {
        id: 'EST-2.0',
        name: '2.0 Principles of Communications',
        subtopics: [
          { id: 'EST-2.1', name: '2.1 Introduction to Communications Systems' },
          { id: 'EST-2.2', name: '2.2 Noise and Amplitude Modulation' },
          { id: 'EST-2.3', name: '2.3 Single-Sideband Techniques' },
          { id: 'EST-2.4', name: '2.4 Frequency Modulation' },
          { id: 'EST-2.5', name: '2.5 Radio Receivers' },
          { id: 'EST-2.6', name: '2.6 Radiation and Propagation of Waves' },
          { id: 'EST-2.7', name: '2.7 Pulse Modulation and Digital Modulation' },
          { id: 'EST-2.8', name: '2.8 Broadband Communication Systems' },
        ]
      },
      {
        id: 'EST-3.0',
        name: '3.0 Digital Communications',
        subtopics: [
          { id: 'EST-3.1', name: '3.1 Introduction to Digital Communications' },
          { id: 'EST-3.2', name: '3.2 Digital Transmission' },
          { id: 'EST-3.3', name: '3.3 PAM, PWM, PPM, Pulse Code Modulation' },
          { id: 'EST-3.4', name: '3.4 ASK, FSK, PSK, QAM' },
          { id: 'EST-3.5', name: '3.5 Basics of Information Theory and Error Detection' },
          { id: 'EST-3.6', name: '3.6 FDM, TDM, WDM, FDMA, CDMA, TDMA' },
        ]
      },
      {
        id: 'EST-4.0',
        name: '4.0 Transmission and Antenna Systems',
        subtopics: [
          { id: 'EST-4.1', name: '4.1 Transmission Line Circuits' },
          { id: 'EST-4.2', name: '4.2 Losses, Parameters, and Matching' },
          { id: 'EST-4.3', name: '4.3 Smith Chart' },
          { id: 'EST-4.4', name: '4.4 Radio Wave Propagation' },
          { id: 'EST-4.5', name: '4.5 Power Density and Field Strength Calculations' },
          { id: 'EST-4.6', name: '4.6 Antenna Systems' },
          { id: 'EST-4.7', name: '4.7 Waveguides and Fiber Optics' },
        ]
      },
      {
        id: 'EST-5.0',
        name: '5.0 Electronics 3: Electronic Systems and Design',
        subtopics: [
          { id: 'EST-5.1', name: '5.1 SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors' },
          { id: 'EST-5.2', name: '5.2 Optoelectronic Devices and Sensors' },
          { id: 'EST-5.3', name: '5.3 Transducers and Interfacing Techniques' },
          { id: 'EST-5.4', name: '5.4 Programmable Logic Controllers' },
          { id: 'EST-5.5', name: '5.5 Building Management Systems (HVAC, Security, Audio-Video, Fire and Life Safety, SCADA)' },
        ]
      },
      {
        id: 'EST-6.0',
        name: '6.0 Data Communications',
        subtopics: [
          { id: 'EST-6.1', name: '6.1 Introduction and Categories of Data Communications' },
          { id: 'EST-6.2', name: '6.2 Configurations and Network Topology' },
          { id: 'EST-6.3', name: '6.3 Transmission Modes and Synchronization' },
          { id: 'EST-6.4', name: '6.4 Network Components (Terminals, Multiplexers, Concentrators, FEP, Serial Interface)' },
          { id: 'EST-6.5', name: '6.5 Security and Cryptography' },
          { id: 'EST-6.6', name: '6.6 OSI Model and TCP/IP Architecture' },
          { id: 'EST-6.7', name: '6.7 SNA, Character and Bit-Oriented Protocols' },
          { id: 'EST-6.8', name: '6.8 LAN, MAN, WAN, GAN, ISDN, B-ISDN' },
        ]
      }
    ]
  }
]
