/**
 * tosRows.ts
 * Per-row exam-item breakdown from the PRC 2022 Table of Specifications
 * (EE2022-10_TOS.pdf), mapped onto the subtopics in ./data.
 *
 * A PDF row is either
 *   - one subtopic (inline badge), or
 *   - a group of subtopics that the PDF scores together (group header with the row label).
 *
 * Levels: K Knowledge, C Comprehension (easy) | A Application (moderate) | An Analysis, S Synthesis, E Evaluation (difficult).
 * Subtopic ids are written as "<n>.<m>" and prefixed with the subject code of the topic key.
 */

export interface TosLevels {
  K?: number
  C?: number
  A?: number
  An?: number
  S?: number
  E?: number
}

export interface TosRow {
  items: number
  levels: TosLevels
  /** Full subtopic ids, e.g. ['GEAS-2.1', 'GEAS-2.2'] */
  subtopicIds: string[]
  /** PDF row label; only set for grouped rows */
  label?: string
}

export interface TosTopicRows {
  rows: TosRow[]
  /** Subtopics that have no row of their own in the PDF */
  unmapped?: string[]
  note?: string
}

export interface TosTiers {
  easy: number
  moderate: number
  difficult: number
}

export function rowTiers(levels: TosLevels): TosTiers {
  return {
    easy: (levels.K ?? 0) + (levels.C ?? 0),
    moderate: levels.A ?? 0,
    difficult: (levels.An ?? 0) + (levels.S ?? 0) + (levels.E ?? 0),
  }
}

const LEVEL_NAMES: Record<keyof TosLevels, string> = {
  K: 'Knowledge',
  C: 'Comprehension',
  A: 'Application',
  An: 'Analysis',
  S: 'Synthesis',
  E: 'Evaluation',
}

/** e.g. "Knowledge 1 · Comprehension 1" (non-zero levels only) */
export function describeLevels(levels: TosLevels): string {
  const keys = Object.keys(LEVEL_NAMES) as (keyof TosLevels)[]
  return keys
    .filter((k) => (levels[k] ?? 0) > 0)
    .map((k) => `${LEVEL_NAMES[k]} ${levels[k]}`)
    .join(' · ')
}

type RowSpec = [items: number, levels: string, ids: string, label?: string]

function parseLevels(s: string): TosLevels {
  const out: TosLevels = {}
  const re = /(An|K|C|A|S|E)(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    out[m[1] as keyof TosLevels] = Number(m[2])
  }
  return out
}

interface TopicSpec {
  rows: RowSpec[]
  unmapped?: string[]
  note?: string
}

const SPEC: Record<string, TopicSpec> = {
  'MATH-1.0': {
    rows: [
      [2, 'K1 C1', '1.1'],
      [3, 'C1 A2', '1.2'],
      [3, 'A2 An1', '1.3'],
      [4, 'C1 A2 An1', '1.4'],
      [3, 'A2 An1', '1.5'],
    ],
  },
  'MATH-2.0': {
    rows: [
      [2, 'K1 C1', '2.1'],
      [4, 'C1 A1 An2', '2.2'],
      [3, 'C1 A1 An1', '2.3'],
      [4, 'K1 C1 A2', '2.4'],
      [2, 'A2', '2.5'],
    ],
  },
  'MATH-3.0': {
    rows: [
      [6, 'K1 C1 A4', '3.1'],
      [4, 'C1 A2 An1', '3.2'],
      [5, 'A4 An1', '3.3'],
    ],
  },
  'MATH-4.0': {
    rows: [
      [2, 'A2', '4.1'],
      [4, 'A2 An2', '4.2'],
      [3, 'A2 An1', '4.3'],
      [3, 'A2 An1', '4.4'],
      [3, 'A2 An1', '4.5'],
    ],
  },
  'MATH-5.0': {
    rows: [
      [2, 'K1 C1', '5.1'],
      [5, 'A3 An2', '5.2'],
      [2, 'K1 C1', '5.3'],
      [2, 'C1 A1', '5.4'],
      [4, 'A2 An2', '5.5'],
    ],
  },
  'MATH-6.0': {
    rows: [
      [3, 'K1 An2', '6.1'],
      [3, 'K1 An2', '6.2'],
      [3, 'K1 C1 An1', '6.3'],
    ],
  },
  'MATH-7.0': {
    rows: [
      [2, 'C1 An1', '7.1'],
      [3, 'K1 C1 An1', '7.2'],
      [3, 'K1 C1 An1', '7.3'],
    ],
  },
  'MATH-8.0': {
    rows: [
      [2, 'C1 An1', '8.1'],
      [3, 'C1 An2', '8.2'],
      [3, 'C1 An2', '8.3'],
    ],
  },
  'GEAS-1.0': {
    rows: [
      [3, 'K2 C1', '1.1'],
      [3, 'K2 C1', '1.2'],
      [2, 'K1 C1', '1.3'],
      [2, 'K1 C1', '1.4'],
    ],
  },
  'GEAS-2.0': {
    rows: [
      [5, 'K3 C2', '2.1,2.2,2.3,2.4,2.5', 'Work, Energy and Power, Impulse and Momentum, Kinematics, Dynamics, Rotation'],
      [4, 'K2 C2', '2.6,2.7', 'Dynamic of Rotation, Elasticity, Oscillations/Waves'],
      [2, 'K2', '2.8,2.9', 'Fluids, Heat Transfer'],
      [4, 'K3 C1', '2.10'],
    ],
  },
  'GEAS-3.0': {
    rows: [
      [1, 'K1', '3.1'],
      [2, 'K2', '3.2,3.3', 'Money-Time Relationship and Equivalence, and Basic Economy Study Methods'],
      [1, 'C1', '3.4'],
      [2, 'C2', '3.5,3.6', 'Decisions Recognizing Risk, and Decision Admitting Uncertainty'],
    ],
  },
  'GEAS-4.0': {
    rows: [
      [2, 'K2', '4.1,4.2', 'Evolution of Mgt Theory, and Management and Its Function'],
      [4, 'K4', '4.3'],
      [1, 'K1', '4.4'],
      [2, 'C2', '4.5'],
    ],
  },
  'GEAS-5.0': {
    note: 'The PDF\'s row breakdown differs by 1 item from its own topic total (topic figure shown above).',
    rows: [
      [3, 'A2 S1', '5.1,5.2', 'Technopreneurship Introduction, Customers, and Value Proposition / Ethics, social responsibility, and Globalization'],
      [2, 'A1 An1', '5.3,5.4', 'Market Identification and Analysis, and Creating Competitive Advantage'],
      [2, 'A1 An1', '5.5'],
      [3, 'An2 S1', '5.6,5.7,5.8', 'Execution and Business Plan, Financial Analysis, Accounting Basics, and Raising Capital'],
    ],
  },
  'GEAS-6.0': {
    rows: [
      [4, 'A2 An1 S1', '6.1'],
      [3, 'A3', '6.2'],
      [2, 'A1 An1', '6.3,6.4', 'Inductance/AC'],
      [1, 'An1', '6.5'],
    ],
  },
  'GEAS-7.0': {
    rows: [
      [2, 'K2', '7.1,7.2', 'Review Fundamentals, Modern material’s atomic structure and interatomic bonding, The structure of crystalline materials, and Crystalline and non-crystalline materials'],
      [2, 'K2', '7.3,7.4,7.5', 'Economic, environmental, and societal issues in Materials science and Engg, Imperfections in solid, Diffusion in solids, Mechanical properties of metals, and Application and Processing of metal alloys'],
      [2, 'K2', '7.6'],
      [2, 'K1 C1', '7.7'],
    ],
  },
  'GEAS-8.0': {
    rows: [
      [4, 'K4', '8.1,8.2', 'Introduction to Object Oriented Programming and UML, and Object-Oriented Analysis and Design'],
      [3, 'K1 C2', '8.3'],
      [1, 'K1', '8.4'],
      [2, 'K1 C1', '8.5'],
    ],
  },
  'GEAS-9.0': {
    rows: [
      [4, 'A4', '9.1,9.2', 'Nature and Ecology, and Natural Systems and Resources'],
      [2, 'A2', '9.3'],
      [2, 'An2', '9.4'],
      [2, 'S2', '9.5'],
    ],
  },
  'GEAS-10.0': {
    note: 'The PDF row \'Practicing the ECE Profession\' (1 item) has no matching subtopic here; it is shown on 10.4.',
    rows: [
      [2, 'A1 S1', '10.1'],
      [3, 'A3', '10.2,10.3', 'Pledge of ECE & CSC Guidelines, The Board Examination, and Regulating the ECE Procession (PRC)'],
      [1, 'An1', '10.4'],
      [4, 'An2 S2', '10.5,10.6', 'Other ECE Related Statutes, Safety Standards, and PEC Codes'],
    ],
  },
  'GEAS-11.0': {
    rows: [
      [2, 'K1 C1', '11.1,11.2,11.3', 'Introduction to CAD Software and its environment, Snapping and construction elements, Dimensioning, Plotting and inputting of images'],
    ],
  },
  'ELECS-1.0': {
    rows: [
      [2, 'A1 An1', '1.1'],
      [3, 'A1 An2', '1.2'],
      [3, 'K1 C1 A1', '1.3'],
      [1, 'An1', '1.4'],
      [3, 'A1 An2', '1.5'],
    ],
  },
  'ELECS-2.0': {
    rows: [
      [3, 'A1 An1 S1', '2.1'],
      [2, 'A1 An1', '2.2'],
      [2, 'A1 An1', '2.3'],
      [2, 'A1 An1', '2.4'],
      [3, 'A1 An1 S1', '2.5'],
    ],
  },
  'ELECS-3.0': {
    rows: [
      [2, 'C2', '3.1'],
      [2, 'C2', '3.2'],
      [2, 'A2', '3.3'],
      [2, 'A2', '3.4'],
    ],
  },
  'ELECS-4.0': {
    rows: [
      [3, 'C2 A1', '4.1'],
      [4, 'A2 An1 S1', '4.2'],
      [1, 'K1', '4.3'],
      [2, 'C2', '4.4'],
      [4, 'K2 C2', '4.5'],
    ],
  },
  'ELECS-5.0': {
    rows: [
      [4, 'K1 C1 A1 An1', '5.1'],
      [2, 'C1 A1', '5.2'],
      [1, 'C1', '5.3'],
      [2, 'C1 A1', '5.4'],
      [5, 'C1 A2 An1 S1', '5.5'],
    ],
  },
  'ELECS-6.0': {
    rows: [
      [2, 'C1 A1', '6.1'],
      [1, 'C1', '6.2'],
      [1, 'C1', '6.3'],
      [1, 'K1', '6.4'],
      [3, 'A1 An1 S1', '6.5,6.6', 'Design and Integration in Building Management Systems and HVAC Controls, Security, Safety, and Surveillance Control Systems, and Audio-Video and Lighting Controls'],
    ],
  },
  'ELECS-7.0': {
    rows: [
      [3, 'A2 An1', '7.1'],
      [4, 'A2 An1 S1', '7.2'],
      [3, 'A1 An1 S1', '7.3'],
      [1, 'A1', '7.4'],
      [1, 'C1', '7.5'],
    ],
  },
  'ELECS-8.0': {
    rows: [
      [3, 'A2 An1', '8.1'],
      [2, 'K1 A1', '8.2'],
      [2, 'K1 A1', '8.3'],
      [2, 'K1 A1', '8.4'],
      [3, 'K1 A1 S1', '8.5'],
    ],
  },
  'ELECS-9.0': {
    rows: [
      [1, 'A1', '9.1'],
      [1, 'A1', '9.2'],
      [2, 'A1 An1', '9.3'],
      [2, 'A1 An1', '9.4'],
      [2, 'A1 An1', '9.5'],
    ],
  },
  'EST-1.0': {
    rows: [
      [2, 'K1 C1', '1.1'],
      [2, 'A1 An1', '1.2'],
      [3, 'C1 A2', '1.3'],
      [3, 'C1 A1 An1', '1.4,1.5,1.6', 'Convolution and correlation, Z transforms, Pole-zero-gain filters, Fourier transforms, Filtering, FiR/IIR'],
    ],
  },
  'EST-2.0': {
    unmapped: ['2.6'],
    note: '2.6 has no separate row in the PDF.',
    rows: [
      [4, 'K1 C1 A2', '2.1'],
      [5, 'A3 An2', '2.2'],
      [6, 'A4 An2', '2.3,2.4', 'Amplitude Modulation, Single-Sideband Techniques, Frequency Modulation'],
      [3, 'C1 A1 An1', '2.5'],
      [7, 'K1 C2 A2 An2', '2.7,2.8', 'Pulse Modulation, Digital Modulation, Broadband Communication System'],
    ],
  },
  'EST-3.0': {
    rows: [
      [2, 'K1 C1', '3.1'],
      [3, 'A2 An1', '3.2,3.3', 'Digital Transmission, PAM, PWM, PPM, Pulse Code Modulation'],
      [4, 'C1 A2 An1', '3.4'],
      [2, 'A1 An1', '3.5'],
      [4, 'C1 A2 An1', '3.6'],
    ],
  },
  'EST-4.0': {
    rows: [
      [5, 'K1 C1 A2 An1', '4.1,4.2,4.3', 'Transmission Lines Circuits, losses and parameters, Matching TL, Smith Chart'],
      [8, 'C1 A5 An2', '4.4,4.5', 'Radio Wave Propagation, Power Density and Field Strength Calculations'],
      [6, 'C2 A2 An2', '4.6'],
      [4, 'A2 An2', '4.7'],
    ],
  },
  'EST-5.0': {
    unmapped: ['5.1'],
    note: '5.1 has no separate row in the PDF.',
    rows: [
      [2, 'C1 An1', '5.2,5.3', 'Optoelectronic Devices and Sensors, Transducers'],
      [2, 'C1 An1', '5.4'],
      [3, 'C1 A1 An1', '5.5'],
    ],
  },
  'EST-6.0': {
    rows: [
      [5, 'K1 C1 A2 An1', '6.1,6.2', 'Introduction to Data Communications, Category of Data Communication, Configurations and Network Topology'],
      [4, 'C2 An2', '6.3'],
      [3, 'K1 C1 A1', '6.4,6.5', 'Types of Synchronization, Network Components (Terminal, multiplexer, concentrators), Network Components (LCU, FEP, Serial Interface), Security, Cryptography'],
      [5, 'K1 C1 A1 An2', '6.6,6.7', 'Open System Interconnection, System Network Architecture, TCP/IP Architecture, Character-Oriented Protocols, Bit-Oriented Protocols'],
      [3, 'A1 An2', '6.8'],
    ],
  },
}

function build(): Record<string, TosTopicRows> {
  const result: Record<string, TosTopicRows> = {}
  for (const topicId of Object.keys(SPEC)) {
    const prefix = topicId.split('-')[0]
    const spec = SPEC[topicId]
    result[topicId] = {
      rows: spec.rows.map(([items, levels, ids, label]) => ({
        items,
        levels: parseLevels(levels),
        subtopicIds: ids.split(',').map((x) => `${prefix}-${x}`),
        ...(label ? { label } : {}),
      })),
      ...(spec.unmapped ? { unmapped: spec.unmapped.map((x) => `${prefix}-${x}`) } : {}),
      ...(spec.note ? { note: spec.note } : {}),
    }
  }
  return result
}

export const TOS_ROWS: Record<string, TosTopicRows> = build()
