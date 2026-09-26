#!/usr/bin/env python3
"""
scripts/classify_database_tos.py
─────────────────────────────────────────────────────────────────────────────
High-accuracy Table of Specifications (TOS) classifier for ECEngine database.
Supports both parent topics (x.0) and granular decimal subtopics (x.x)
across all 4 official PRC ECE subjects (MATH, ELECS, GEAS, EST).

Rewritten [2026-09] to fix a structural mismatch against the app's real TOS
data (`tosData`): the old EST-1.0 only encoded 3 of the real 6 subtopics
under the wrong numbers, and PAM/PWM/PPM were miscoded under EST-2.7 instead
of EST-3.3. All 4 subjects' SUBTOPIC_RULES now mirror the app's actual TOS
topic/subtopic structure 1:1. See TOS_REFERENCE below for the full map this
was built against.

Features:
- Subtopic-level regex rules, verified against the app's real TOS structure
- Parent topic fallback (broader multi-word phrases only — no bare common
  words, which previously caused false positives, e.g. `work`, `filter`)
- Deck-name scoring: a curated, explicit allowlist of decks whose titles are
  unambiguous single-topic signals (see DECK_TOPIC_HINTS). NOT applied to
  generic pool decks (RC Exam/Review Exam/Refresher/Coaching/Pre-Boards),
  which carry no topic signal in their name.
- Confidence gating: ties or low-margin calls are NOT silently applied; they
  are written to a --review-csv for manual review instead.
- --validate mode: self-check against deck-name ground truth (no manual
  labeling required) to make rule changes measurable instead of eyeballed.
- CLI flags for dry-run testing, single-deck targeting, machine-readable
  JSON output, and card-type scoping (defaults to mcq only).

Usage:
  python3 scripts/classify_database_tos.py --dry-run
  python3 scripts/classify_database_tos.py --apply
  python3 scripts/classify_database_tos.py --apply --review-csv review.csv
  python3 scripts/classify_database_tos.py --validate
  python3 scripts/classify_database_tos.py --apply --json
  python3 scripts/classify_database_tos.py --deck-id <id> --json
  python3 scripts/classify_database_tos.py --apply --card-type all
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
import re
import csv
import json
import sqlite3
import argparse
from collections import Counter

DEFAULT_DB_PATH = os.path.expanduser('~/.config/ECEngine/ecengine.sqlite')

# Minimum score for a subtopic pick to be treated as "confident" enough to
# auto-apply. A single generic word match will not clear this on its own if
# it's the *only* signal (most subtopic patterns are multi-word phrases, so
# a lone match is already fairly specific; this guards against 1-off noise).
MIN_CONFIDENCE_SCORE = 1
# If the top two candidates are within this margin of each other, treat the
# pick as ambiguous rather than silently choosing the first one alphabetically
# (Counter.most_common tie-breaking is insertion-order, which is arbitrary).
MIN_CONFIDENCE_MARGIN = 1

# ─────────────────────────────────────────────────────────────────────────────
# 1. SUBTOPIC RULES (Granular Decimal x.x Classifications)
# Verified 1:1 against the app's real TOS structure (screenshots, Sept 2026).
# ─────────────────────────────────────────────────────────────────────────────
SUBTOPIC_RULES = {
    'MATH': {
        # 1.0 Differential Calculus
        'MATH-1.1': [  # Functions, Continuity, Limits
            r'\blimits?\b', r'\bcontinuity\b', r'\bcontinuous function\b', r'\bdiscontinuous\b',
            r'\basymptotes?\b', r'\bl\'?hopital\b', r'\bindeterminate form\b', r'\bdelta-epsilons?\b',
            r'\bdomain and range\b', r'\bone-sided limit\b'
        ],
        'MATH-1.2': [  # Derivatives and Its Applications
            r'\bderivatives?\b', r'\bdy/dx\b', r'\btangent line\b', r'\bnormal line\b', r'\brate of change\b',
            r'\brelated rate\w*', r'\bmaximas?\b', r'\bminimas?\b', r'\b(?:maximum|minimum) value\b',
            r'\bcritical point\w*', r'\boptimization problem\b', r'\bmean value theorem\b', r'\brolle\'?s\b',
            r'\bconcavity\b', r'\binflection point\b', r'\bchain rule\b', r'\bproduct rule\b', r'\bquotient rule\b',
            r'\bimplicit differentiation\b'
        ],
        'MATH-1.3': [  # Higher-Order Derivatives
            r'\bhigher[- ]order derivative\b', r'\bsecond derivative\b', r'\bd2y/dx2\b', r'\bnth derivative\b',
            r'\bleibniz(?:\'?s)? rule\b', r'\bradius of curvature\b', r'\bcurvature of\b',
            r'\bacceleration from velocity\b'
        ],
        'MATH-1.4': [  # Parametric Equations
            r'\bparametric equation\b', r'\bparametrize\w*', r'\bcycloids?\b', r'\bastroids?\b',
            r'\bdy/dt\b', r'\bdx/dt\b'
        ],
        'MATH-1.5': [  # Partial Differentiation
            r'\bpartial derivative\b', r'\bpartial differentiation\b', r'\btotal differential\b',
            r'\beuler\'?s theorem on homogeneous\b', r'\bjacobians?\b', r'\bdel z ?/ ?del x\b'
        ],

        # 2.0 Integral Calculus
        'MATH-2.1': [  # Integration Concepts/Formulas
            r'\bantiderivatives?\b', r'\bindefinite integral\b', r'\bfundamental theorem of calculus\b',
            r'\bconstant of integration\b', r'\bstandard integral\b', r'\bintegral of\b'
        ],
        'MATH-2.2': [  # Integration Techniques
            r'\bintegration by parts\b', r'\bu-substitutions?\b', r'\btrigonometric substitution\b',
            r'\bpartial fraction\b', r'\btabular integration\b', r'\brational fraction\b'
        ],
        'MATH-2.3': [  # Improper Integrals
            r'\bimproper integral\b', r'\binfinite limit of integration\b', r'\bconvergent integral\b',
            r'\bdivergent integral\b', r'\bdiscontinuity in (?:the )?integrand\b'
        ],
        'MATH-2.4': [  # Application of Integral
            r'\barea under\b', r'\barea bounded\b', r'\bvolume of revolution\b', r'\bdisk method\b',
            r'\bwasher method\b', r'\bcylindrical shell\b', r'\blength of (?:the )?arc\b', r'\barc length\b',
            r'\bsurface of revolution\b', r'\bcentroids?\b', r'\bcenter of mass\b', r'\bpappus\'?s theorem\b',
            r'\bwork done by\b'
        ],
        'MATH-2.5': [  # Multiple Integration and its Application
            r'\bdouble integral\b', r'\btriple integral\b', r'\bmultiple integral\b',
            r'\biterated integral\b', r'\bpolar coordinate\w* integral\b', r'\bcylindrical coordinate\b',
            r'\bspherical coordinate\b', r'\bmoment of inertia by integration\b'
        ],

        # 3.0 Differential Equation
        'MATH-3.1': [  # First-Order, First-Degree ODE and its Application
            r'\bseparable (?:differential )?equation\b', r'\bhomogeneous differential equation\b',
            r'\bexact differential equation\b', r'\bintegrating factor\b', r'\bbernoulli(?:\'?s)? equation\b',
            r'\blinear first[- ]order\b', r'\border and degree\b', r'\borthogonal trajector\w*',
            r'\bgrowth and decay\b', r'\bnewton\'?s law of cooling\b', r'\bfirst[- ]order ode\b'
        ],
        'MATH-3.2': [  # Higher-Order ODE and its Application
            r'\bhigher[- ]order (?:ode|differential equation)\b', r'\bauxiliary equation\b',
            r'\bcomplementary function\b', r'\bparticular integral\b', r'\bmethod of undetermined coefficients\b',
            r'\bvariation of parameters\b', r'\bwronskians?\b', r'\bcauchy-euler\b',
            r'\bcharacteristic equation\b', r'\bmechanical vibration\w*\b', r'\bspring[- ]mass system\b'
        ],
        'MATH-3.3': [  # Laplace Transforms, Inverses, and its Applications
            r'\blaplace transform\b', r'\binverse laplace\b', r'\bs-domains?\b', r'\bunit step function\b',
            r'\bheavisides?\b', r'\bdirac delta\b', r'\binitial value theorem\b', r'\bfinal value theorem\b',
            r'\bconvolution theorem\b', r'\blaplace transform of (?:a )?derivative\b'
        ],

        # 4.0 Advanced Engineering Mathematics for ECE
        'MATH-4.1': [  # Complex Numbers and its Applications
            r'\bcomplex numbers?\b', r'\bimaginary number\b', r'\bargand (?:plane|diagram)\b',
            r'\bde moivre\'?s theorem\b', r'\beuler\'?s formula\b', r'\bcauchy-riemann\b',
            r'\banalytic function\b', r'\bharmonic function\b', r'\bpolar form of a complex\b'
        ],
        'MATH-4.2': [  # Series and Transforms (Power Series, Bessel, Legendre, Fourier)
            r'\bpower series\b', r'\btaylor series\b', r'\bmaclaurin series\b', r'\bbessel function\b',
            r'\blegendre (?:polynomial|equation)\b', r'\bfourier series\b', r'\bfourier transform\b',
            r'\bdirichlet condition\w*'
        ],
        'MATH-4.3': [  # Partial Differential Equations
            r'\bpartial differential equation\b', r'\bpdes?\b', r'\bheat equation\b',
            r'\bwave equation\b', r'\blaplace\'?s equation\b', r'\bseparation of variables\b'
        ],
        'MATH-4.4': [  # Simultaneous Linear and Non-Linear Equations
            r'\bsimultaneous (?:linear|non-?linear) equations?\b', r'\bmatrixs?\b', r'\bmatrices\b',
            r'\bdeterminants?\b', r'\bcramer\'?s rule\b', r'\beigenvalues?\b', r'\beigenvectors?\b',
            r'\binverse matrix\b', r'\brank of a matrix\b', r'\bgauss-jordans?\b', r'\bgauss(?:ian)? elimination\b',
            r'\bsystem of (?:linear )?equations\b'
        ],
        'MATH-4.5': [  # Numerical Differentiation, Integration and Optimization
            r'\bnewton-raphsons?\b', r'\brunge-kuttas?\b', r'\bsimpson\'?s rule\b', r'\btrapezoidal rule\b',
            r'\bnumerical (?:method|integration|differentiation)\b', r'\bbisection method\b',
            r'\bsecant method\b', r'\beuler\'?s method\b', r'\bnumerical optimization\b'
        ],

        # 5.0 Engineering Data Analysis
        'MATH-5.1': [  # Obtaining Data
            r'\bdata collection\b', r'\bsurvey method\b', r'\bcensus\b', r'\brandom sampling\b',
            r'\bqualitative data\b', r'\bquantitative data\b', r'\bdiscrete data\b', r'\bcontinuous data\b',
            r'\bsampling technique\b', r'\bstratified sampling\b', r'\bcluster sampling\b'
        ],
        'MATH-5.2': [  # Statistical Sampling, Distribution, and Intervals
            r'\bmeans?\b', r'\bmedians?\b', r'\bmodes?\b', r'\bstandard deviation\b', r'\bvariances?\b',
            r'\bnormal distribution\b', r'\bz-scores?\b', r'\bbinomial distribution\b', r'\bpoisson distribution\b',
            r'\bconfidence interval\b', r'\bcentral limit theorem\b', r'\bprobability distribution\b',
            r'\bquartiles?\b', r'\bsampling distribution\b'
        ],
        'MATH-5.3': [  # Test of Hypothesis
            r'\bhypothesis test\w*', r'\bnull hypothesis\b', r'\balternative hypothesis\b',
            r'\btype (?:i|ii) error\b', r'\bp-values?\b', r'\bt-tests?\b', r'\bchi-square test\b',
            r'\bsignificance level\b', r'\bz-tests?\b'
        ],
        'MATH-5.4': [  # Regression and Correlation
            r'\bregression (?:line|analysis|equation)\b', r'\bcorrelation coefficient\b', r'\br-squareds?\b',
            r'\bpearson correlation\b', r'\bscatter plot\b', r'\bleast squares\b', r'\bcovariances?\b'
        ],
        'MATH-5.5': [  # Design of Experiments
            r'\bdesign of experiments?\b', r'\banovas?\b', r'\banalysis of variance\b', r'\bfactorial design\b',
            r'\bf-tests?\b', r'\brandomized block design\b', r'\bone-factor-at-a-times?\b', r'\bofats?\b',
            r'\bcontrol(?:led)? experiment\b', r'\bexperimental design\b'
        ],

        # 6.0 Electromagnetics (also shared with ELECS-3.0)
        'MATH-6.1': [  # Vector Analysis
            r'\bdot product\b', r'\bcross product\b', r'\bunit vector\b', r'\bscalar product\b',
            r'\bvector product\b', r'\bdirection cosines\b', r'\bvector analysis\b', r'\bmagnitude of a vector\b'
        ],
        'MATH-6.2': [  # Directional Derivative, Gradient, Divergence, Curl
            r'\bgradient of\b', r'\bdivergence of\b', r'\bcurl of\b', r'\bdel operator\b',
            r'\bdirectional derivative\b', r'\bsolenoidals?\b', r'\birrotationals?\b', r'\blaplacians?\b'
        ],
        'MATH-6.3': [  # Integral Theorems (Green's, Divergence, Stokes')
            r'\bgreen\'?s theorem\b', r'\bdivergence theorem\b', r'\bstokes\'? theorem\b',
            r'\bline integral\b', r'\bsurface integral\b', r'\bconservative (?:vector )?field\b'
        ],

        # 7.0 Signals, Spectra & Signal Processing (also shared with EST-1.0)
        'MATH-7.1': [  # Z-Transforms
            r'\bz-transforms?\b', r'\binverse z-transform\b', r'\bregion of convergence\b', r'\broc of\b'
        ],
        'MATH-7.2': [  # Convolution
            r'\bconvolution (?:sum|integral)\b', r'\bconvolve\b', r'\bimpulse response\b'
        ],
        'MATH-7.3': [  # Correlation
            r'\bcross-correlation\b', r'\bauto-correlation\b', r'\bcorrelation function\b'
        ],

        # 8.0 Feedback and Control Systems (also shared with ELECS-9.0)
        'MATH-8.1': [  # Pole and Zero Determination
            r'\bpoles? and zeros?\b', r'\broot locus\b', r'\brouth-hurwitzs?\b', r'\brouth array\b',
            r'\bstability criterion\b'
        ],
        'MATH-8.2': [  # Transient Response
            r'\btransient response\b', r'\bdamping ratio\b', r'\bnatural frequency\b',
            r'\bsettling time\b', r'\brise time\b', r'\bpercent overshoot\b', r'\bsteady state error\b'
        ],
        'MATH-8.3': [  # Block Diagram and Signal Flow
            r'\bblock diagram reduction\b', r'\bsignal flow graph\b', r'\bmason\'?s (?:gain )?rule\b',
            r'\bsumming point\b', r'\btakeoff point\b'
        ]
    },

    'ELECS': {
        # 1.0 DC Electrical Circuits
        'ELECS-1.1': [  # Resistive Network
            r'\bohm\'?s law\b', r'\bresistor network\b', r'\bequivalent resistance\b', r'\bseries circuit\b',
            r'\bparallel circuit\b', r'\bvoltage divider\b', r'\bcurrent divider\b',
            r'\bresistor color code\b', r'\bconductances?\b', r'\bdelta-wye\b', r'\bstar-deltas?\b'
        ],
        'ELECS-1.2': [  # Mesh and Node Equations
            r'\bmesh analysis\b', r'\bnode(?:al)? analysis\b', r'\bmesh current\b',
            r'\bnode voltage\b', r'\bkcls?\b', r'\bkvls?\b', r'\bkirchhoff\'?s (?:current|voltage) law\b',
            r'\bsupermeshs?\b', r'\bsupernodes?\b'
        ],
        'ELECS-1.3': [  # Network Theorems
            r'\bthevenin\'?s theorem\b', r'\bnorton\'?s theorem\b', r'\bsuperposition theorem\b',
            r'\bmaximum power transfer\b', r'\bsource transformation\b', r'\bmillman\'?s theorem\b',
            r'\breciprocity theorem\b'
        ],
        'ELECS-1.4': [  # Transient Analysis
            r'\brc transient\b', r'\brl transient\b', r'\btime constant\b', r'\bcharging (?:a )?capacitor\b',
            r'\bdischarging (?:an )?inductor\b', r'\btransient (?:analysis|response) of (?:an? )?(?:rc|rl) circuit\b',
            r'\bstep response of\b'
        ],
        'ELECS-1.5': [  # Solution to DC Network Problems
            r'\bwheatstone bridge\b', r'\bdc bridge\b', r'\bpotentiometer circuit\b', r'\bdc network problem\b',
            r'\bbattery bank\b', r'\bslide wire bridge\b'
        ],

        # 2.0 AC Electrical Circuits
        'ELECS-2.1': [  # Solution to AC Network Problems
            r'\bac circuit\b', r'\balternating current circuit\b', r'\bsinusoidal (?:voltage|current|waveform)\b',
            r'\brms value\b', r'\beffective value\b', r'\bpeak value\b', r'\baverage value\b',
            r'\bform factor\b', r'\bcrest factor\b'
        ],
        'ELECS-2.2': [  # Impedance and Admittance
            r'\bcomplex impedance\b', r'\breactances?\b', r'\binductive reactance\b',
            r'\bcapacitive reactance\b', r'\badmittances?\b', r'\bsusceptances?\b', r'\bphasor diagram\b'
        ],
        'ELECS-2.3': [  # Resonance
            r'\bresonances?\b', r'\bresonant frequency\b', r'\bseries resonance\b',
            r'\bparallel resonance\b', r'\bquality factor\b', r'\bq-factors?\b', r'\btank circuit\b', r'\bbandwidth of a resonant\b'
        ],
        'ELECS-2.4': [  # Power in AC Circuits
            r'\breal power\b', r'\breactive power\b', r'\bapparent power\b', r'\bpower factor\b',
            r'\bthree-phases?\b', r'\b3-phase\b', r'\bdelta connection\b', r'\bwye connection\b',
            r'\bvolt-ampere reactive\b'
        ],
        'ELECS-2.5': [  # Two-Port Network Parameters and Transfer Function
            r'\btwo-port network\b', r'\bz-parameters?\b', r'\by-parameters?\b', r'\bh-parameters?\b',
            r'\babcd parameter\b', r'\btransmission parameter\b'
        ],

        # 3.0 Electromagnetics (also shared with MATH-6.0)
        'ELECS-3.1': [  # Steady Electric and Magnetic Fields
            r'\bcoulomb\'?s law\b', r'\belectric field intensity\b', r'\bmagnetic flux density\b',
            r'\bbiot-savart\b', r'\bampere\'?s circuital law\b', r'\belectric potential\b'
        ],
        'ELECS-3.2': [  # Dielectric and Magnetic Materials
            r'\bpermittivit(?:y|ies)\b', r'\bpermeabilit(?:y|ies)\b', r'\bdielectric material\b', r'\bferromagnetics?\b',
            r'\bhysteresis loop\b', r'\bb-h curve\b', r'\bmagnetic susceptibility\b'
        ],
        'ELECS-3.3': [  # Coupled and Magnetic Circuits
            r'\bmutual inductance\b', r'\bdot convention\b', r'\breluctances?\b',
            r'\bmagnetic circuit\b', r'\bmagnetomotive force\b', r'\bmmf\b', r'\bcoupling coefficient\b'
        ],
        'ELECS-3.4': [  # Time-Varying Fields and Maxwell's Equations
            r'\bmaxwell\'?s equations?\b', r'\bfaraday\'?s law\b', r'\blenz\'?s law\b',
            r'\bdisplacement current\b', r'\bpoynting vector\b', r'\btime-varying field\b'
        ],

        # 4.0 Electronic Devices and Circuits
        'ELECS-4.1': [  # Diode Wave Shaping and Special Diode Applications
            r'\bclipper circuit\b', r'\bclamper circuit\b', r'\bclipping circuit\b', r'\bclamping circuit\b',
            r'\bzener diode\b', r'\bzener breakdown\b', r'\bvaractor diode\b',
            r'\btunnel diode\b', r'\bschottky diode\b', r'\bwave shaping circuit\b', r'\bled\b', r'\bphotodiodes?\b',
            r'\blight-emitting diode\b', r'\bavalanche diode\b', r'\bpin diode\b', r'\bstep recovery diode\b'
        ],
        'ELECS-4.2': [  # BJT and FET Small Signal Analysis
            r'\bre model\b', r'\bhybrid[- .]pi model\b', r'\bhybrid parameters?\b', r'\bh-parameters?\b',
            r'\bsmall[- ]signal model\b', r'\bsmall[- ]signal analysis\b', r'\btransconductances?\b',
            r'\bsmall[- ]signal (?:input|output) impedance\b', r'\bsmall[- ]signal voltage gain\b',
            r'\bac equivalent circuit\b', r'\bmidband gain\b', r'\bac resistance of (?:the )?emitter\b',
            r'\bvoltage gain provided by\b', r'\bcurrent gain provided by\b', r'\binput impedance of\b'
        ],
        'ELECS-4.3': [  # Diode Equivalent Circuits
            r'\bdiode equivalent circuit\b', r'\bideal diode model\b', r'\bbarrier potential\b',
            r'\bforward resistance\b', r'\breverse saturation current\b', r'\bshockley (?:diode )?equation\b',
            r'\bpn junction\b', r'\bp-n junction\b', r'\bdepletion region\b', r'\bbuilt-in potential\b',
            r'\bforward bias\b', r'\breverse bias\b', r'\bdiode characteristics\b', r'\bdiodes?\b'
        ],
        'ELECS-4.4': [  # Voltage Multipliers, Power Supply, Voltage Regulation
            r'\brectifiers?\b', r'\bhalf-wave rectif\w*', r'\bfull-wave rectif\w*', r'\bbridge rectifier\b',
            r'\bvoltage multiplier\b', r'\bvoltage doubler\b', r'\bvoltage tripler\b', r'\bvoltage quadrupler\b',
            r'\bripple factor\b', r'\bripple voltage\b', r'\bvoltage regulat\w*',
            r'\bpower supply circuit\b', r'\bline regulation\b', r'\bload regulation\b',
            r'\bfilter capacitor\b', r'\bchoke input filter\b', r'\bpi filter\b', r'\b78xx\b', r'\b79xx\b', r'\blm317\b'
        ],
        'ELECS-4.5': [  # Bipolar Junction Transistor and FET
            r'\bbjt\b', r'\bbipolar junction transistors?\b', r'\btransistor(?:s)?\b',
            r'\btransistor biasing\b', r'\bnpn\b', r'\bpnp\b', r'\bnpn transistor\b', r'\bpnp transistor\b',
            r'\bcommon emitter\b', r'\bcommon base\b', r'\bcommon collector\b',
            r'\bce configuration\b', r'\bcb configuration\b', r'\bcc configuration\b',
            r'\bce amplifier\b', r'\bcb amplifier\b', r'\bcc amplifier\b',
            r'\bemitter follower\b', r'\bsource follower\b',
            r'\bcollector\b', r'\bemitter\b', r'\bbase region\b', r'\bbase terminal\b',
            r'\bcollector terminal\b', r'\bemitter terminal\b', r'\bterminals? in a transistor\b',
            r'\bactive region\b', r'\bsaturation (?:mode|region)?\b', r'\bcutoff (?:mode|region)?\b',
            r'\bdc load line\b', r'\bac load line\b', r'\bload line\b', r'\bq[- ]point\b', r'\bquiescent point\b',
            r'\boperating point\b', r'\bcurrent gain\b',
            r'\bhfe\b', r'\bbeta dc\b', r'\balpha dc\b', r'\btransistor parameter\b',
            r'\bdop(?:ing|ed|ants?)\b', r'\border of doping\b', r'\bdoping (?:order|level|concentration)?\b', r'\bearly effect\b', r'\bbase-width modulation\b',
            r'\bjfet\b', r'\bmosfet\b', r'\bfets?\b', r'\bfield effect transistor\b',
            r'\bjunction field effect transistor\b', r'\bmetal oxide semiconductor\b',
            r'\bpinch-offs?\b', r'\bdrain current\b', r'\bgate voltage\b', r'\bthreshold voltage\b',
            r'\bdepletion[- ]mode\b', r'\benhancement[- ]mode\b', r'\bcmos\b', r'\bgate-to-source\b', r'\bdrain-to-source\b',
            r'\bcollector current\b', r'\bbase current\b', r'\bemitter current\b',
            r'\bvoltage divider bias\b', r'\bfixed bias\b', r'\bemitter bias\b', r'\bcollector feedback bias\b',
            r'\btransistor acts as (?:a )?switch\b', r'\bswitch and an? amplifier\b',
            r'\bhighest gain provided by\b', r'\bhigher gain provided by\b'
        ],

        # 5.0 Electronic Circuit Analysis and Design
        'ELECS-5.1': [  # BJT and FET Frequency Response
            r'\bfrequency response of (?:a |an )?(?:bjt|fet|amplifier)\b', r'\bcutoff frequency of (?:a |an )?amplifier\b',
            r'\bmiller effect\b', r'\bhigh[- ]frequency response\b', r'\blow[- ]frequency response\b', r'\bbode plot\b'
        ],
        'ELECS-5.2': [  # Cascade and Cascode Connections
            r'\bcascode amplifier\b', r'\bcascaded amplifier\b', r'\bdarlington pair\b', r'\bmultistage amplifier\b'
        ],
        'ELECS-5.3': [  # Current Mirrors and Current Sources
            r'\bcurrent mirror\b', r'\bwidlar current source\b', r'\bwilson current mirror\b',
            r'\bactive load\b', r'\bconstant current source\b'
        ],
        'ELECS-5.4': [  # Differential and Operational Amplifiers
            r'\bop-amps?\b', r'\boperational amplifier\b', r'\bdifferential amplifier\b',
            r'\bcmrr\b', r'\bvirtual ground\b', r'\binverting amplifier\b', r'\bnon-inverting amplifier\b',
            r'\bsumming amplifier\b', r'\binstrumentation amplifier\b', r'\bslew rate\b'
        ],
        'ELECS-5.5': [  # Feedback Systems, Oscillators, and Filters
            r'\boscillator circuit\b', r'\bbarkhausen criterion\b', r'\bwien bridge oscillator\b',
            r'\brc phase shift oscillator\b', r'\bcolpitts oscillator\b', r'\bhartley oscillator\b',
            r'\bactive filter\b', r'\bbutterworth filter\b', r'\bchebyshev filter\b', r'\bnegative feedback amplifier\b'
        ],

        # 6.0 Electronic Systems and Design (also shared with EST-5.0)
        'ELECS-6.1': [  # SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors
            r'\bthyristors?\b', r'\bscr\b', r'\btriac\b', r'\bdiac\b', r'\bujt\b',
            r'\bput\b', r'\bfiring angle\b', r'\brelaxation oscillator\b'
        ],
        'ELECS-6.2': [  # Optoelectronic Devices and Sensors
            r'\boptoelectronics?\b', r'\boptocouplers?\b', r'\bphototransistors?\b', r'\bldrs?\b',
            r'\bphotoresistors?\b', r'\bsolar cell\b'
        ],
        'ELECS-6.3': [  # Transducers, Data Acquisition, and Interfacing
            r'\btransducers?\b', r'\bdata acquisition\b', r'\bdaq\b', r'\blvdts?\b',
            r'\bthermocouples?\b', r'\brtds?\b', r'\bstrain gauge\b', r'\bpiezoelectrics?\b'
        ],
        'ELECS-6.4': [  # Programmable Logic Controllers
            r'\bplc\b', r'\bprogrammable logic controller\b', r'\bladder logic\b', r'\bladder diagram\b', r'\brungs?\b'
        ],
        'ELECS-6.5': [  # Building Management Systems and HVAC Controls
            r'\bbms\b', r'\bhvac\b', r'\bbuilding management system\b', r'\bbuilding automation\b'
        ],
        'ELECS-6.6': [  # Security, Safety, and Surveillance Systems
            r'\bcctv\b', r'\bfire alarm\b', r'\bfire and life safety\b', r'\bsurveillance system\b',
            r'\bburglar alarm\b', r'\baccess control system\b'
        ],

        # 7.0 Logic Circuits and Switching Theory
        'ELECS-7.1': [  # Boolean Algebra and Logic Gates
            r'\bboolean algebra\b', r'\blogic gate\b', r'\band gate\b', r'\bor gate\b',
            r'\bxor gate\b', r'\bxnor gate\b', r'\bnand gate\b', r'\bnor gate\b', r'\btruth table\b', r'\bde morgan\'?s\b'
        ],
        'ELECS-7.2': [  # Minimization of Combinational Logic Circuits
            r'\bk-maps?\b', r'\bkarnaugh map\b', r'\blogic minimization\b', r'\bdon\'?t care condition\b',
            r'\bquine-mccluskeys?\b'
        ],
        'ELECS-7.3': [  # Sequential Logic Circuits
            r'\bflip-flops?\b', r'\blatch circuit\b', r'\bsr flip-flop\b', r'\bjk flip-flop\b',
            r'\bd flip-flop\b', r'\bt flip-flop\b', r'\bshift register\b', r'\bripple counter\b', r'\bsynchronous counter\b',
            r'\basynchronous counter\b'
        ],
        'ELECS-7.4': [  # Algorithmic State Machine (ASM)
            r'\basm chart\b', r'\balgorithmic state machine\b', r'\bstate diagram\b', r'\bmealy machine\b', r'\bmoore machine\b'
        ],
        'ELECS-7.5': [  # Asynchronous Sequential Logic
            r'\basynchronous sequential (?:logic|circuit)\b', r'\btiming hazard\b', r'\brace condition\b', r'\bflow table\b'
        ],

        # 8.0 Microprocessor and Microcontroller Systems
        'ELECS-8.1': [  # Microprocessor Unit
            r'\bmicroprocessors?\b', r'\bcentral processing unit\b', r'\bcpu\b', r'\balu\b', r'\bprogram counter\b',
            r'\bstack pointer\b', r'\b8086\b', r'\bfetch-decode-executes?\b', r'\bregister array\b'
        ],
        'ELECS-8.2': [  # Memory Subsystem
            r'\bram\b', r'\brom\b', r'\bsram\b', r'\bdram\b', r'\beeprom\b',
            r'\bflash memory\b', r'\bmemory subsystem\b', r'\bcache memory\b'
        ],
        'ELECS-8.3': [  # I/O Subsystem
            r'\bi/o subsystem\b', r'\binterrupt handling\b', r'\bdma\b', r'\bmemory-mapped i/o\b', r'\bserial i/o interface\b'
        ],
        'ELECS-8.4': [  # Instruction Set Architecture and Assembly Programming
            r'\bassembly language\b', r'\binstruction set\b', r'\baddressing mode\b',
            r'\bopcodes?\b', r'\bmnemonics?\b', r'\bsubroutines?\b'
        ],
        'ELECS-8.5': [  # Microcontrollers
            r'\bmicrocontrollers?\b', r'\b8051\b', r'\bpic microcontroller\b', r'\bavr\b', r'\barduino\b', r'\bon-chip peripheral\b'
        ],

        # 9.0 Feedback and Control Systems (also shared with MATH-8.0)
        'ELECS-9.1': [  # Block Diagram and Signal Flow Graphs
            r'\bblock diagram reduction\b', r'\bsignal flow graph\b', r'\bmason\'?s (?:gain )?rule\b', r'\bforward path\b'
        ],
        'ELECS-9.2': [  # LTI Systems and Transient Analysis
            r'\bltis?\b', r'\blinear time-invariant\b', r'\btransient analysis of (?:a )?control system\b',
            r'\bstep response\b', r'\bimpulse response of a system\b'
        ],
        'ELECS-9.3': [  # System Modeling and Transfer Function
            r'\bsystem modeling\b', r'\btransfer function\b', r'\bopen[- ]loop transfer\b', r'\bclosed[- ]loop transfer\b'
        ],
        'ELECS-9.4': [  # Poles, Zeros, Root Locus, and Stability Analysis
            r'\broot locus\b', r'\brouth stability\b', r'\bgain margin\b', r'\bphase margin\b', r'\bnyquist criterion\b',
            r'\bpoles? and zeros? of\b'
        ],
        'ELECS-9.5': [  # Steady State Analysis and Frequency Response
            r'\bsteady state error\b', r'\berror constant\b', r'\bpid controller\b', r'\blead-lag compensator\b',
            r'\bfrequency response of a (?:control )?system\b'
        ]
    },

    'GEAS': {
        # 1.0 Chemistry for Engineers
        'GEAS-1.1': [  # Energy
            r'\bthermochemistry\b', r'\bheat of reaction\b', r'\bcalorimetry\b', r'\bexothermic\b', r'\bendothermic\b',
            r'\benthalp(?:y|ies)\b'
        ],
        'GEAS-1.2': [  # Chemistry of Engineering Materials
            r'\bionic bond\b', r'\bcovalent bond\b', r'\bmetallic bond\b', r'\bcorrosion\b',
            r'\boxidation\b', r'\breduction reaction\b', r'\bredoxs?\b', r'\belectrochemistry\b', r'\bgalvanic cell\b'
        ],
        'GEAS-1.3': [  # Chemistry of Nanomaterials
            r'\bnanomaterials?\b', r'\bnanotechnolog(?:y|ies)\b', r'\bgraphenes?\b', r'\bcarbon nanotube\b', r'\bfullerenes?\b'
        ],
        'GEAS-1.4': [  # Chemistry of the Environment
            r'\bgreen chemistry\b', r'\bacid rain\b', r'\bgreenhouse gas\b', r'\bwater chemistry\b'
        ],

        # 2.0 Physics for Engineers
        'GEAS-2.1': [  # Work, Energy and Power
            r'\bwork-energy theorem\b', r'\bkinetic energy\b', r'\bpotential energy\b', r'\bmechanical power\b',
            r'\bconservation of (?:mechanical )?energy\b'
        ],
        'GEAS-2.2': [  # Impulse and Momentum
            r'\bimpulse-momentums?\b', r'\bconservation of momentum\b', r'\belastic collision\b',
            r'\binelastic collision\b', r'\bcoefficient of restitution\b'
        ],
        'GEAS-2.3': [  # Kinematics
            r'\bkinematics\b', r'\bprojectile motion\b', r'\brectilinear motion\b', r'\bfree[- ]fall\b',
            r'\buniformly accelerated motion\b'
        ],
        'GEAS-2.4': [  # Dynamics
            r'\bnewton\'?s (?:first|second|third)? ?laws? of motion\b', r'\bcoefficient of friction\b',
            r'\bnormal force\b', r'\bcentripetal force\b', r'\bfree body diagram\b'
        ],
        'GEAS-2.5': [  # Rotation and Dynamic of Rotation
            r'\btorques?\b', r'\bmoment of inertia\b', r'\bangular momentum\b', r'\brotational motion\b',
            r'\bangular velocity\b', r'\bangular acceleration\b'
        ],
        'GEAS-2.6': [  # Elasticity
            r'\bhooke\'?s law\b', r'\byoung\'?s modulus\b', r'\bshear modulus\b', r'\bbulk modulus\b',
            r'\belastic (?:limit|deformation)\b'
        ],
        'GEAS-2.7': [  # Oscillations and Waves
            r'\bsimple harmonic motion\b', r'\bpendulums?\b', r'\bwave speed\b', r'\bsound wave\b', r'\bdoppler effect\b'
        ],
        'GEAS-2.8': [  # Fluids
            r'\bbuoyancy\b', r'\barchimedes\'? principle\b', r'\bpascal\'?s principle\b',
            r'\bbernoulli\'?s (?:principle|equation)\b', r'\bfluid statics\b', r'\bfluid pressure\b'
        ],
        'GEAS-2.9': [  # Heat Transfer
            r'\bheat transfer\b', r'\bconduction\b', r'\bconvection\b', r'\bradiation heat transfer\b',
            r'\bspecific heat\b', r'\blatent heat\b'
        ],
        'GEAS-2.10': [  # Electrostatics, Electricity, Magnetism, Optics
            r'\bsnell\'?s law\b', r'\blaw of refraction\b', r'\blaw of reflection\b', r'\bconverging lens\b',
            r'\bconcave mirror\b', r'\bconvex mirror\b', r'\bcoulomb\'?s law\b', r'\belectrostatic force\b',
            r'\belectric field intensity\b', r'\bmagnetic field intensity\b', r'\bapparent depth\b'
        ],

        # 3.0 Engineering Economics
        'GEAS-3.1': [  # Engineering Economics Terms
            r'\bsimple interest\b', r'\bnominal (?:interest )?rate\b', r'\beffective (?:interest )?rate\b',
            r'\btime value of money\b', r'\binterest rate\b'
        ],
        'GEAS-3.2': [  # Money-Time Relationship and Equivalence
            r'\bannuit(?:y|ies)\b', r'\bdeferred annuity\b', r'\bperpetuit(?:y|ies)\b', r'\bcash flow diagram\b',
            r'\bgradient series\b', r'\bcompound interest\b', r'\beconomic equivalence\b'
        ],
        'GEAS-3.3': [  # Basic Economy Study Methods
            r'\bpresent worth\b', r'\bfuture worth\b', r'\bannual worth\b', r'\brate of return\b',
            r'\binternal rate of return\b', r'\birr\b', r'\bbenefit-cost ratio\b'
        ],
        'GEAS-3.4': [  # Decisions Under Certainty
            r'\bbreak-even\b', r'\bbreak even\b', r'\bto break even\b',
            r'\bbreak-even (?:point|analysis|quantity|volume)\b',
            r'\bvariable costs?\b', r'\bfixed costs?\b',
            r'\baverage selling price\b', r'\bselling price (?:per|of)\b',
            r'\bproduction capacity\b',
            r'\bdepreciation\b', r'\bstraight[- ]line depreciation\b',
            r'\bdeclining balance\b', r'\bsum-of-the-years\b',
            r'\bsalvage value\b', r'\bcapitalized cost\b', r'\bbook value\b'
        ],
        'GEAS-3.5': [  # Decisions Recognizing Risk
            r'\bdecision tree\b', r'\bexpected monetary value\b', r'\brisk analysis\b', r'\bprobabilistic risk\b'
        ],
        'GEAS-3.6': [  # Decision Admitting Uncertainty
            r'\bmaximin criterion\b', r'\bmaximax criterion\b', r'\bminimax regret\b', r'\blaplace criterion\b'
        ],

        # 4.0 Engineering Management
        'GEAS-4.1': [  # Evolution of Management Theory
            r'\btaylor\'?s scientific management\b', r'\bfayol\'?s principles\b', r'\bhawthorne (?:effect|studies)\b',
            r'\bscientific management theory\b'
        ],
        'GEAS-4.2': [  # Management and Its Functions
            r'\bmanagerial role\b', r'\bconceptual skill\b', r'\btechnical skill\b', r'\bfunctions? of management\b',
            r'\bfunctions? of (?:an? )?engineer\b', r'\bdecision[- ]making\b',
            r'\bmaslow\'?s hierarchy\b', r'\bherzberg\'?s theory\b', r'\bmotivation theory\b'
        ],
        'GEAS-4.3': [  # Planning, Leading, Organizing, Controlling
            r'\bstrategic planning\b', r'\borganization(?:al)? structure\b', r'\bleadership style\b',
            r'\bcontrolling function\b', r'\borganizing function\b', r'\bplanning and organizing\b',
            r'\bleading and controlling\b', r'\bdelegation of authority\b', r'\bspan of control\b'
        ],
        'GEAS-4.4': [  # Managing Product and Service Operations
            r'\bpert\b', r'\bcpm\b', r'\bcritical path method\b', r'\bgantt chart\b', r'\beoq\b',
            r'\btqm\b', r'\bsix sigma\b', r'\bquality control\b', r'\beconomic order quantity\b'
        ],
        'GEAS-4.5': [  # Managing Marketing and Finance Functions
            r'\bmarketing mix\b', r'\b4 ps of marketing\b', r'\bbalance sheet\b', r'\bincome statement\b'
        ],

        # 5.0 Technopreneurship 101
        'GEAS-5.1': [  # Introduction, Ethics, Social Responsibility
            r'\btechnopreneurships?\b', r'\bstartup ethics\b', r'\bcorporate social responsibility\b', r'\bglobalization\b'
        ],
        'GEAS-5.2': [  # Customers and Value Proposition
            r'\bvalue proposition\b', r'\bcustomer segment\b', r'\bpain point\b'
        ],
        'GEAS-5.3': [  # Market Identification and Analysis
            r'\btam[- ]?sam[- ]?som\b', r'\bmarket sizing\b', r'\bmarket research\b', r'\btarget market\b'
        ],
        'GEAS-5.4': [  # Creating Competitive Advantage
            r'\bporter\'?s five forces\b', r'\bswot analysis\b', r'\bcompetitive advantage\b'
        ],
        'GEAS-5.5': [  # Business Models and Intellectual Property
            r'\bbusiness models?\b', r'\bbusiness model canvas\b',
            r'\bb2b\b', r'\bbusiness-to-business\b',
            r'\bb2c\b', r'\bbusiness-to-consumer\b',
            r'\bc2c\b', r'\bconsumer-to-consumer\b',
            r'\bb2g\b', r'\bbusiness-to-government\b',
            r'\bonline marketplace\b', r'\be-commerce (?:business )?model\b',
            r'\bfreemium\b', r'\bsubscription model\b', r'\bmarketplace model\b',
            r'\bpatents?\b', r'\bintellectual property\b', r'\btrademarks?\b', r'\bcopyrights?\b'
        ],
        'GEAS-5.6': [  # Execution and Business Plan
            r'\bmvp\b', r'\bminimum viable product\b', r'\bpitch deck\b', r'\bbusiness plan\b'
        ],
        'GEAS-5.7': [  # Financial Analysis and Accounting Basics
            r'\brunways?\b', r'\bburn rate\b', r'\bunit economics\b', r'\bgross margin\b', r'\bfinancial statement\b'
        ],
        'GEAS-5.8': [  # Raising Capital
            r'\bventure capital\b', r'\bangel investor\b', r'\bseed funding\b', r'\bcrowdfunding\b'
        ],

        # 6.0 Physics 2
        'GEAS-6.1': [  # Thermodynamics
            r'\bthermodynamics\b', r'\bcarnot (?:cycle|engine)\b', r'\bentropy\b',
            r'\bfirst law of thermodynamics\b', r'\bsecond law of thermodynamics\b', r'\bideal gas law\b',
            r'\bcoefficient of performance\b', r'\brefrigeration cycle\b', r'\bheat engine\b', r'\bheat pump\b'
        ],
        'GEAS-6.2': [  # Electricity and Magnetism
            r'\belectric flux\b', r'\bgauss\'?s law\b', r'\bmagnetic force on a\b', r'\belectric charge density\b'
        ],
        'GEAS-6.3': [  # EM Induction and Inductance
            r'\binductances?\b', r'\bself[- ]inductance\b', r'\bmutual induction\b', r'\belectromagnetic induction\b'
        ],
        'GEAS-6.4': [  # AC Circuits
            r'\brlc series circuit\b', r'\brlc parallel circuit\b'
        ],
        'GEAS-6.5': [  # Optics and Atomic/Nuclear Physics
            r'\bphotoelectric effect\b', r'\bnuclear reaction\b', r'\bnuclear reactor\b', r'\bradioactivity\b',
            r'\bhalf-lifes?\b', r'\bwave optics\b', r'\bmoderators?\b', r'\bcontrol rods?\b'
        ],

        # 7.0 Materials Science and Engineering
        'GEAS-7.1': [  # Atomic Structure and Interatomic Bonding
            r'\batomic bonding\b', r'\bprimary bonding\b', r'\belectronegativit(?:y|ies)\b', r'\binteratomic bond\w*'
        ],
        'GEAS-7.2': [  # Structure of Crystalline Materials
            r'\bunit cell\b', r'\bbcc structure\b', r'\bfcc structure\b', r'\bhcp structure\b',
            r'\bmiller indices\b', r'\bcrystal structure\b', r'\bcrystalline material\b'
        ],
        'GEAS-7.3': [  # Imperfections in Solids
            r'\bpoint defect\b', r'\blattice vacancy\b', r'\bdislocations?\b', r'\bgrain boundary\b',
            r'\bsolid solution\b', r'\bsubstitutional (?:solid )?solution\b', r'\binterstitial (?:solid )?solution\b'
        ],
        'GEAS-7.4': [  # Diffusion in Solids
            r'\bfick\'?s (?:first|second) law\b', r'\bdiffusion in solids?\b', r'\bcarburizing\b'
        ],
        'GEAS-7.5': [  # Mechanical Properties of Metals
            r'\btensile test\b', r'\bstress-strain (?:curve|diagram)\b', r'\byield point\b', r'\bductility\b',
            r'\bbrinell hardness\b', r'\brockwell hardness\b', r'\bcharpy (?:impact )?test\b', r'\bfatigue (?:limit|strength)\b',
            r'\bcreep (?:test|failure)\b'
        ],
        'GEAS-7.6': [  # Metal Alloys, Ceramics, Polymers, Composites
            r'\bphase diagram\b', r'\biron-carbon (?:diagram|system)\b', r'\bsteel alloy\b',
            r'\bpolymer material\b', r'\bceramic material\b', r'\bcomposite material\b'
        ],
        'GEAS-7.7': [  # Electrical, Dielectric, Magnetic, Optical Properties
            r'\bband theory\b', r'\bdielectric strength\b', r'\bferromagnetism\b', r'\bdiamagnetic\b', r'\bparamagnetic\b'
        ],

        # 8.0 Computer Programming
        'GEAS-8.1': [  # Object Oriented Programming and UML
            r'\bobject[- ]oriented programming\b', r'\binheritance\b', r'\bpolymorphism\b', r'\bencapsulation\b', r'\buml diagram\b'
        ],
        'GEAS-8.2': [  # Object Oriented Analysis and Design
            r'\bdesign pattern\b', r'\bsolid principle\w*\b', r'\bsoftware architecture\b', r'\bobject-oriented design\b'
        ],
        'GEAS-8.3': [  # Programming Language Fundamentals
            r'\bprogramming language\b', r'\bdata type\b', r'\bfor loop\b', r'\bwhile loop\b',
            r'\barrays?\b', r'\bpointer variable\b', r'\balgorithms?\b'
        ],
        'GEAS-8.4': [  # Exception Handling
            r'\bexception handling\b', r'\btry catch\b', r'\berror handling\b'
        ],
        'GEAS-8.5': [  # Graphical User Interface Programming
            r'\bgraphical user interface\b', r'\bgui programming\b', r'\bevent-driven programming\b', r'\bcallback function\b', r'\bwidgets?\b'
        ],

        # 9.0 Environment Science and Engineering
        'GEAS-9.1': [  # Nature and Ecology
            r'\becosystems?\b', r'\bfood chain\b', r'\bfood web\b', r'\btrophic levels?\b',
            r'\bbiodiversit(?:y|ies)\b', r'\becolog(?:y|ies)\b',
            r'\bnutrient cycles?\b', r'\bbiogeochemical cycles?\b',
            r'\bhydrologic(?:al)? (?:cycle|process)\b', r'\bwater cycle\b',
            r'\bpart of the water cycle\b', r'\bevaporation\b', r'\bcondensation\b',
            r'\bprecipitation (?:and|or) collection\b', r'\bprecipitation\b',
            r'\btranspiration\b', r'\bevapotranspiration\b', r'\brunoff\b',
            r'\bpercolation\b', r'\bgroundwater\b', r'\baquifers?\b',
            r'\bnitrogen cycle\b', r'\bcarbon cycle\b', r'\bphosphorus cycle\b', r'\bsulfur cycle\b',
            r'\bproducers? and consumers?\b', r'\bdecomposers?\b', r'\bbiomes?\b', r'\bhabitat\b',
            r'\bcarrying capacity\b', r'\bprimary succession\b', r'\bsecondary succession\b',
            r'\bphotosynthesis\b', r'\becological niche\b', r'\bhydrosphere\b', r'\blithosphere\b', r'\bbiosphere\b'
        ],
        'GEAS-9.2': [  # Natural Systems and Resources
            r'\brenewable resource\b', r'\bnon-renewable resource\b', r'\bwater resource\b',
            r'\benergy resource\b', r'\bmineral resource\b', r'\bforest resource\b'
        ],
        'GEAS-9.3': [  # Environmental Concerns and Crises
            r'\bair pollution\b', r'\bwater pollution\b', r'\bsolid waste (?:management)?\b',
            r'\bclimate change\b', r'\bglobal warming\b', r'\bozone layer\b', r'\bozone depletion\b',
            r'\beutrophication\b', r'\bgreenhouse effect\b', r'\bgreenhouse gas(?:es)?\b',
            r'\bsalinity\b', r'\bhalinity\b', r'\bhaloginity\b', r'\bacid rain\b',
            r'\bphotochemical smog\b', r'\bchlorofluorocarbons?\b', r'\bcfcs?\b'
        ],
        'GEAS-9.4': [  # Environmental Impact Assessment
            r'\benvironmental studies\b', r'\benvironmental impact(?:s)?\b',
            r'\benvironmental impact assessment\b', r'\beia\b',
            r'\benvironmental compliance certificate\b', r'\becc\b',
            r'\bdirect impact(?:s)?\b', r'\bindirect impact(?:s)?\b',
            r'\bsocial impact(?:s)?\b', r'\bcumulative impact(?:s)?\b',
            r'\bresidual impact(?:s)?\b',
            r'\ban effect that occurs immediately as a result of an activity\b',
            r'\benvironmental management plan\b', r'\beia process\b', r'\bproject description\b'
        ],
        'GEAS-9.5': [  # Sustainable Development
            r'\bsustainability\b', r'\bsustainable development\b', r'\bcarbon footprint\b',
            r'\brenewable energy\b', r'\bclean energy\b', r'\bcircular economy\b'
        ],

        # 10.0 ECE Laws, Contracts, Ethics, Standards and Safety
        'GEAS-10.1': [  # Laws, Obligations and Contracts
            r'\bcontract law\b', r'\bobligations?\b', r'\bbreach of contract\b', r'\btorts?\b', r'\bcivil code\b',
            r'\bquasi-delict\b', r'\bvoid and voidable\b', r'\bvalid contract\b'
        ],
        'GEAS-10.2': [  # Pledge of ECE and CSC Guidelines
            r'\bcode of ethics\b', r'\bece pledge\b', r'\bethical conduct\b', r'\bcsc guidelines\b',
            r'\bengineer\'?s code of ethics\b', r'\bprofessional conduct\b'
        ],
        'GEAS-10.3': [  # Board Examination Rules
            r'\bboard exam(?:ination)? rules?\b', r'\bpassing score\b', r'\bprc exam(?:ination)?\b',
            r'\bgeneral rating of 70\b', r'\bremoval examination\b', r'\b70 percent\b'
        ],
        'GEAS-10.4': [  # Regulating the ECE Profession (PRC)
            r'\bra ?9292\b', r'\bece law\b', r'\bpece\b', r'\bprofessional electronics engineer\b',
            r'\bregistered electronics (?:engineer|technician)\b', r'\belectronics engineer\b',
            r'\belectronics technician\b', r'\bprc board of electronics\b', r'\bboard of electronics engineering\b',
            r'\biecep\b', r'\bseal of (?:a )?pece\b', r'\bscope of practice of ece\b',
            r'\broster of registered electronics\b', r'\bprc modernization act\b', r'\bra ?8981\b'
        ],
        'GEAS-10.5': [  # Other ECE Related Statutes
            r'\bra ?7925\b', r'\bra ?8792\b', r'\be-commerce act\b', r'\bpublic telecommunications policy act\b',
            r'\bra ?10515\b', r'\banti-cable tv\b', r'\bcable internet tapping\b', r'\banti-cable tv and cable internet tapping act\b',
            r'\bra ?10844\b', r'\bdict act\b', r'\bdepartment of information and communications technology\b',
            r'\bra ?10175\b', r'\bcybercrime prevention act\b',
            r'\bra ?10912\b', r'\bcpd act\b', r'\bcontinuing professional development\b',
            r'\bra ?10055\b', r'\btechnology transfer act\b',
            r'\bra ?10889\b', r'\bra ?10982\b', r'\bra ?3846\b', r'\bact (?:no\.?\s*)?3846\b', r'\bradio control law\b',
            r'\bra ?8293\b', r'\bintellectual property code\b',
            r'\bntc\b', r'\bnational telecommunications commission\b',
            r'\bkbp\b', r'\bkbp broadcast code\b', r'\bfranchise\b', r'\btelecommunications? law\b',
            r'\brepublic act (?:no\.?\s*)?\d+\b', r'\bra\s*\d{3,5}\b'
        ],
        'GEAS-10.6': [  # Safety Standards and PEC Codes
            r'\bphilippine electrical code\b', r'\bpec\b', r'\bosha standard\b', r'\bsafety standard\b'
        ],

        # 11.0 CAD
        'GEAS-11.1': [  # Introduction to CAD Software
            r'\bcad software\b', r'\bautocad\b', r'\bcad coordinate system\b', r'\bviewports?\b'
        ],
        'GEAS-11.2': [  # Snapping and Construction Elements
            r'\bosnap\b', r'\bobject snap\b', r'\bortho mode\b', r'\bpolar tracking\b'
        ],
        'GEAS-11.3': [  # Dimensioning, Plotting and Image Input
            r'\bdimensioning\b', r'\bplotting (?:scale|a drawing)\b', r'\bdrawing scale\b', r'\bimage input\b', r'\braster image\b'
        ]
    },

    'EST': {
        # 1.0 Signals, Spectra, Signal Processing — REBUILT to match the real
        # 6-subtopic structure (old version had only 3, wrongly numbered).
        'EST-1.1': [  # Classification and Characteristics of Signals
            r'\bperiodic signal\b', r'\baperiodic signal\b', r'\banalog signal\b', r'\bdigital signal\b',
            r'\benergy signal\b', r'\bpower signal\b', r'\bdeterministic signal\b', r'\brandom signal\b',
            r'\bcontinuous-time signal\b', r'\bdiscrete-time signal\b'
        ],
        'EST-1.2': [  # Sampling Theorem and Aliasing
            r'\bnyquist (?:rate|theorem|criterion)\b', r'\bsampling theorem\b', r'\baliasing\b',
            r'\banti-aliasing\b', r'\bsampling frequency\b', r'\bnyquist frequency\b'
        ],
        'EST-1.3': [  # Difference Equations for FIR and IIR Filters
            r'\bfir filter\b', r'\biir filter\b', r'\bdifference equation\b', r'\bdigital filter design\b'
        ],
        'EST-1.4': [  # Convolution and Correlation
            r'\bconvolution (?:sum|integral)\b', r'\bcircular convolution\b', r'\bcross-correlation\b',
            r'\bauto-correlation\b', r'\bconvolve\b'
        ],
        'EST-1.5': [  # Z-Transforms and Pole-Zero-Gain Filters
            r'\bz-transforms?\b', r'\bpole-zero plot\b', r'\bpole-zero-gains?\b', r'\broc of\b', r'\bregion of convergence\b'
        ],
        'EST-1.6': [  # Fourier Transforms and Filtering
            r'\bdft\b', r'\bfft\b', r'\bfast fourier transform\b', r'\bdiscrete fourier transform\b',
            r'\bfourier series\b', r'\bspectral analysis\b', r'\blow-pass filter\b', r'\bhigh-pass filter\b',
            r'\bband-pass filter\b', r'\bband-stop filter\b'
        ],

        # 2.0 Principles of Communications
        'EST-2.1': [  # Introduction to Communications Systems
            r'\bcommunication(?:s)? (?:systems?|process|medium)\b', r'\btransmitters?\b',
            r'\breceiver block diagram\b', r'\belectronic(?:s)? communications?\b',
            r'\bvoice frequency range\b', r'\belectromagnetic spectrum\b',
            r'\bmodulating (?:the )?carrier\b', r'\bchannel capacity\b',
            r'\bshannon(?:-hartley)? (?:theorem|capacity)\b'
        ],
        'EST-2.2': [  # Noise and Amplitude Modulation
            r'\bamplitude modulation\b', r'\bam signal\b', r'\bmodulation index\b', r'\bthermal noise\b',
            r'\bjohnson noise\b', r'\bsignal-to-noise ratio\b', r'\bsnr\b', r'\bnoise figure\b',
            r'\bnoise temperature\b', r'\bdsb-fc\b', r'\bdsb-sc\b', r'\bsideband power\b'
        ],
        'EST-2.3': [  # Single-Sideband Techniques
            r'\bssbs?\b', r'\bssb-scs?\b', r'\bbalanced modulator\b', r'\bvestigial sideband\b', r'\bvsbs?\b'
        ],
        'EST-2.4': [  # Frequency Modulation
            r'\bfrequency modulation\b', r'\bfm signal\b', r'\bcarson\'?s rule\b', r'\bfrequency deviation\b',
            r'\bpre-emphasis\b', r'\bde-emphasis\b', r'\bphase modulation\b'
        ],
        'EST-2.5': [  # Radio Receivers
            r'\bsuperheterodynes?\b', r'\bintermediate frequency\b', r'\bif stage\b', r'\bimage frequency\b',
            r'\bagc\b', r'\bautomatic gain control\b', r'\bselectivit(?:y|ies)\b', r'\breceiver sensitivity\b'
        ],
        'EST-2.6': [  # Radiation and Propagation of Waves
            r'\bground wave\b', r'\bsky wave\b', r'\bspace wave\b', r'\bionospheric (?:wave|propagation)\b',
            r'\bmuf\b', r'\bmaximum usable frequency\b', r'\bcritical frequency\b', r'\bskip distance\b',
            r'\bfading\b', r'\bknife-edge diffraction\b'
        ],
        'EST-2.7': [  # Pulse Modulation and Digital Modulation
            r'\bpulse modulation\b', r'\bdigital modulation\b', r'\banalog-to-digital modulation\b'
        ],
        'EST-2.8': [  # Broadband Communication Systems
            r'\bbroadband (?:communication|network)\b', r'\bcellular system\b', r'\bgsm\b', r'\blte\b',
            r'\b5g\b', r'\bsatellite communication\b'
        ],

        # 3.0 Digital Communications
        'EST-3.1': [  # Introduction to Digital Communications
            r'\bdigital communication system\b', r'\badvantages of digital (?:communication|transmission)\b'
        ],
        'EST-3.2': [  # Digital Transmission
            r'\bdigital transmission\b', r'\bline coding\b', r'\bnrz\b', r'\brz\b', r'\bmanchester (?:code|encoding)\b',
            r'\bami\b', r'\bintersymbol interference\b', r'\bisi\b', r'\beye pattern\b', r'\beye diagram\b'
        ],
        'EST-3.3': [  # PAM, PWM, PPM, Pulse Code Modulation
            r'\bpulse amplitude modulation\b', r'\bpam\b', r'\bpulse width modulation\b', r'\bpwm\b',
            r'\bpulse position modulation\b', r'\bppm\b', r'\bpulse code modulation\b', r'\bpcm\b',
            r'\bquantization\b', r'\bcompanding\b', r'\ba-law\b', r'\bmu-law\b', r'\bdelta modulation\b',
            r'\bdpcm\b', r'\bsqnr\b'
        ],
        'EST-3.4': [  # ASK, FSK, PSK, QAM
            r'\bask\b', r'\bamplitude shift keying\b', r'\bfsk\b', r'\bfrequency shift keying\b',
            r'\bpsk\b', r'\bphase shift keying\b', r'\bbpsk\b', r'\bqpsk\b', r'\bqam\b',
            r'\b16-qam\b', r'\b64-qam\b', r'\bconstellation diagram\b', r'\bbit error rate\b', r'\bber\b'
        ],
        'EST-3.5': [  # Basics of Information Theory and Error Detection
            r'\binformation theory\b', r'\bentropy of (?:a )?source\b', r'\bshannon limit\b', r'\bparity bit\b',
            r'\bchecksums?\b', r'\bcrc\b', r'\bcyclic redundancy check\b', r'\bhamming code\b', r'\bforward error correction\b',
            r'\berror detection\b'
        ],
        'EST-3.6': [  # FDM, TDM, WDM, FDMA, CDMA, TDMA
            r'\bfdms?\b', r'\bfrequency division multiplex\w*', r'\btdms?\b', r'\btime division multiplex\w*',
            r'\bwdms?\b', r'\bwavelength division multiplex\w*', r'\bfdmas?\b', r'\btdmas?\b', r'\bcdmas?\b',
            r'\bspread spectrum\b', r'\bdsss\b', r'\bfhss\b'
        ],

        # 4.0 Transmission and Antenna Systems
        'EST-4.1': [  # Transmission Line Circuits
            r'\btransmission line\b', r'\bcoaxial (?:cable|line)\b', r'\bcharacteristic impedance\b',
            r'\bpropagation velocity\b', r'\btwo-wire line\b'
        ],
        'EST-4.2': [  # Losses, Parameters, and Matching
            r'\bstanding wave\b', r'\bswr\b', r'\bvswr\b', r'\breflection coefficient\b',
            r'\bquarter-wave (?:matching|transformer)\b', r'\bstub matching\b', r'\battenuation constant\b', r'\breturn loss\b'
        ],
        'EST-4.3': [  # Smith Chart
            r'\bsmith chart\b', r'\bstub tuning\b'
        ],
        'EST-4.4': [  # Radio Wave Propagation
            r'\bradio wave propagation\b', r'\bfree space path loss\b', r'\bfspl\b', r'\bfriis (?:equation|transmission)\b',
            r'\bfresnel zone\b'
        ],
        'EST-4.5': [  # Power Density and Field Strength Calculations
            r'\bpower density\b', r'\bfield strength\b', r'\beirp\b', r'\berp\b', r'\beffective radiated power\b',
            r'\beffective isotropic radiated power\b'
        ],
        'EST-4.6': [  # Antenna Systems
            r'\bantennas?\b', r'\bdipole antenna\b', r'\byagi antenna\b', r'\bparabolic antenna\b', r'\bhorn antenna\b',
            r'\bantenna gain\b', r'\bdirectivity\b', r'\bradiation pattern\b', r'\bbeamwidth\b', r'\bpolarization of (?:an? )?wave\b'
        ],
        'EST-4.7': [  # Waveguides and Fiber Optics
            r'\bwaveguides?\b', r'\bte mode\b', r'\btm mode\b', r'\bwaveguide cutoff frequency\b',
            r'\boptical fiber\b', r'\bfiber optic\b', r'\bfiber core\b', r'\bcladdings?\b',
            r'\bnumerical aperture\b', r'\btotal internal reflection\b', r'\bsingle[- ]mode fiber\b', r'\bmultimode fiber\b',
            r'\bfiber attenuation\b', r'\bdecibel loss\b'
        ],

        # 5.0 Electronics 3: Electronic Systems and Design (also shared with ELECS-6.0)
        'EST-5.1': [  # SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors
            r'\bpower semiconductor\b', r'\bscr\b', r'\btriac\b', r'\bdiac\b', r'\bujt\b', r'\bput\b', r'\bthyristors?\b'
        ],
        'EST-5.2': [  # Optoelectronic Devices and Sensors
            r'\boptoelectronics?\b', r'\boptical encoder\b', r'\blaser sensor\b', r'\bphotodetectors?\b'
        ],
        'EST-5.3': [  # Transducers and Interfacing Techniques
            r'\btransducers?\b', r'\b4-20 ?ma\b', r'\bcurrent loop\b', r'\bsignal conditioning\b'
        ],
        'EST-5.4': [  # Programmable Logic Controllers
            r'\bplc\b', r'\bprogrammable logic controller\b', r'\bindustrial automation\b'
        ],
        'EST-5.5': [  # Building Management Systems (HVAC, Security, Audio-Video, Fire and Life Safety, SCADA)
            r'\bbuilding management system\b', r'\bbms\b', r'\bhvac control\b', r'\bpublic address system\b',
            r'\bfire (?:and life safety|alarm) system\b', r'\bsecurity system\b', r'\bscada\b',
            r'\baudio-video system\b', r'\baccess control system\b'
        ],

        # 6.0 Data Communications
        'EST-6.1': [  # Introduction and Categories of Data Communications
            r'\bdata communications?\b', r'\bsimplexs?\b', r'\bhalf-duplexs?\b', r'\bfull-duplexs?\b',
            r'\bdte\b', r'\bdce\b', r'\bdata terminal equipment\b', r'\bdata circuit-terminating equipment\b',
            r'\binteroperabilit(?:y|ies)\b', r'\bpeer-to-peer\b', r'\bclient-server\b', r'\bpoint-to-multipoint\b'
        ],
        'EST-6.2': [  # Configurations and Network Topology
            r'\btopology\b', r'\btopologies\b', r'\bpoint-to-point\b', r'\bmultipoint\b', r'\bconfigurations? of a network\b'
        ],
        'EST-6.3': [  # Transmission Modes and Synchronization
            r'\basynchronous transmission\b', r'\bsynchronous transmission\b', r'\bbaud rate\b',
            r'\bbit rate\b', r'\bdata framing\b'
        ],
        'EST-6.4': [  # Network Components (Terminals, Multiplexers, Concentrators, FEP, Serial Interface)
            r'\bmultiplexers?\b', r'\bconcentrators?\b', r'\bfront-end processor\b', r'\bfep\b',
            r'\bserial interface\b', r'\brs-232\b', r'\bmodems?\b', r'\bcircuit switch\w*', r'\bpacket switch\w*',
            r'\bmessage switch\w*', r'\bnetwork switch(?:es)?\b', r'\brouters?\b'
        ],
        'EST-6.5': [  # Security and Cryptography
            r'\bcryptography\b', r'\bencryption\b', r'\b\bdes encryption\b', r'\baes encryption\b',
            r'\brsa algorithm\b', r'\bnetwork firewall\b', r'\bssl\b', r'\btls\b'
        ],
        'EST-6.6': [  # OSI Model and TCP/IP Architecture
            r'\bosi model\b', r'\btcp/ip\b', r'\bip address\b', r'\bipv4\b', r'\bipv6\b',
            r'\bsubnet(?:ting)?\b', r'\bapplication layer\b', r'\btransport layer\b', r'\bnetwork layer\b'
        ],
        'EST-6.7': [  # SNA, Character and Bit-Oriented Protocols
            r'\bhdlc\b', r'\bsna\b', r'\bsystems network architecture\b', r'\barq\b',
            r'\bsliding window protocol\b', r'\bstop-and-waits?\b', r'\bselective repeat\b',
            r'\bcharacter-oriented protocol\b', r'\bbit-oriented protocol\b'
        ],
        'EST-6.8': [  # LAN, MAN, WAN, GAN, ISDN, B-ISDN
            r'\blocal area network\b', r'\blan\b', r'\bwide area network\b', r'\bwan\b',
            r'\bmetropolitan area network\b', r'\bman\b', r'\bglobal area network\b', r'\bgan\b',
            r'\bisdn\b', r'\bb-isdn\b', r'\bintegrated services digital network\b',
            r'\bethernets?\b', r'\bieee 802\b', r'\bwi-fis?\b', r'\bbluetooths?\b', r'\bvlan\b'
        ]
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. PARENT TOPIC FALLBACK RULES
# Tightened: every pattern below requires a specific phrase or an
# ECE-specific term, never a bare common English word (the previous version's
# `\bwork\b`, `\bfilter\b`, `\bsignals\b`, `\bsampling\b`, `\bfourier\b` as
# standalone patterns were the main source of false-positive misclassification
# found in the real card sample).
# ─────────────────────────────────────────────────────────────────────────────
PARENT_RULES = {
    'MATH': {
        'MATH-1.0': [r'\bdifferential calculus\b', r'\bderivative of\b', r'\blimits? of a function\b'],
        'MATH-2.0': [r'\bintegral calculus\b', r'\bintegration of\b', r'\bantiderivatives?\b'],
        'MATH-3.0': [r'\bdifferential equation\b', r'\bordinary differential equation\b', r'\bodes?\b'],
        'MATH-4.0': [r'\badvanced engineering math\w*', r'\bcomplex number\b', r'\bpower series\b', r'\bmatrixs?\b'],
        'MATH-5.0': [r'\bengineering data analysis\b', r'\bstatistics problem\b', r'\bprobability of\b'],
        'MATH-6.0': [r'\belectromagnetics? theory\b', r'\bvector field\b', r'\bmaxwell\'?s equations?\b'],
        'MATH-7.0': [r'\bsignals? and spectra\b', r'\bsignal processing\b'],
        'MATH-8.0': [r'\bcontrol system\b', r'\bfeedback system\b', r'\btransfer function\b'],
    },
    'ELECS': {
        'ELECS-1.0': [r'\bdc circuit\b', r'\bdirect current circuit\b', r'\bohm\'?s law\b'],
        'ELECS-2.0': [r'\bac circuit\b', r'\balternating current circuit\b', r'\bphasors?\b'],
        'ELECS-3.0': [r'\belectromagnetics? field\b', r'\bmagnetic field\b'],
        'ELECS-4.0': [
            r'\bdiode circuit\b', r'\btransistor circuit\b', r'\btransistor(?:s)?\b',
            r'\bbjt\b', r'\bfets?\b', r'\bsemiconductor(?: device)?\b', r'\bcommon emitter\b',
            r'\bemitter follower\b', r'\bce configuration\b', r'\bdiodes?\b'
        ],
        'ELECS-5.0': [r'\bop-amp circuit\b', r'\bamplifier circuit\b', r'\boscillator circuit\b', r'\bactive filter\b'],
        'ELECS-6.0': [r'\bthyristors?\b', r'\btransducers?\b', r'\bplc\b', r'\bbuilding management\b'],
        'ELECS-7.0': [r'\blogic circuit\b', r'\blogic gate\b', r'\bboolean algebra\b', r'\bflip-flops?\b'],
        'ELECS-8.0': [r'\bmicroprocessors?\b', r'\bmicrocontrollers?\b', r'\bassembly language\b'],
        'ELECS-9.0': [r'\bfeedback control\b', r'\broot locus\b', r'\bpid controller\b'],
    },
    'GEAS': {
        'GEAS-1.0': [r'\bchemistry for engineers?\b', r'\bchemical reaction\b', r'\bchemical bond\b'],
        'GEAS-2.0': [r'\bphysics for engineers?\b', r'\bnewton\'?s laws?\b', r'\bkinetic energy\b'],
        'GEAS-3.0': [r'\bengineering economics?\b', r'\bcompound interest\b', r'\bannuit(?:y|ies)\b', r'\bpresent worth\b'],
        'GEAS-4.0': [r'\bengineering management\b', r'\bmanagement function\b', r'\borganization(?:al)?\b', r'\bmanager(?:s|ial)?\b', r'\bfunctions? of (?:an? )?engineer\b'],
        'GEAS-5.0': [r'\btechnopreneurships?\b', r'\bstartups?\b', r'\bbusiness plan\b'],
        'GEAS-6.0': [r'\bthermodynamics\b', r'\bphysics 2\b', r'\bnuclear physics\b'],
        'GEAS-7.0': [r'\bmaterials? science\b', r'\bcrystal structure\b', r'\bmetallurg(?:y|ies)\b', r'\bstress-strains?\b'],
        'GEAS-8.0': [r'\bcomputer programming\b', r'\bobject-oriented programming\b'],
        'GEAS-9.0': [
            r'\benvironmental (?:science|engineering)\b', r'\becolog(?:y|ies)\b', r'\bpollutions?\b',
            r'\bnutrient cycles?\b', r'\becosystems?\b', r'\bhydrologic cycle\b'
        ],
        'GEAS-10.0': [
            r'\bece laws?\b', r'\bengineering ethics\b', r'\bra ?9292\b', r'\bcontract law\b',
            r'\brepublic acts?\b', r'\bra\s*\d{3,5}\b', r'\banti-cable\b', r'\bcode of ethics\b'
        ],
        'GEAS-11.0': [r'\bcad software\b', r'\bautocad\b', r'\bdrafting\b'],
    },
    'EST': {
        'EST-1.0': [r'\bsignal processing\b', r'\bsampling theorem\b', r'\bdigital filter\b', r'\bfourier transform\b'],
        'EST-2.0': [r'\bcommunication system\b', r'\bmodulation technique\b', r'\bradio receiver\b'],
        'EST-3.0': [r'\bdigital communication\b', r'\bpulse code modulation\b', r'\berror detection\b'],
        'EST-4.0': [r'\btransmission line\b', r'\bantenna system\b', r'\bwave propagation\b', r'\bfiber optic\b'],
        'EST-5.0': [r'\belectronic systems? and design\b', r'\btransducers?\b', r'\bplc\b'],
        'EST-6.0': [r'\bdata communication\b', r'\bcomputer network\b', r'\bosi model\b', r'\btcp/ip\b'],
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. DECK-NAME AND DESCRIPTION SCORING HINTS
# ─────────────────────────────────────────────────────────────────────────────
HINT_WEIGHT = 2

DECK_TOPIC_HINTS = {
    # EST
    'fiber optics': ['EST-4.0'],
    'transmission lines': ['EST-4.0'],
    'am and fm': ['EST-2.0'],
    'signals-noise-am-fm': ['EST-1.0', 'EST-2.0'],
    'antenna': ['EST-4.0'],
    'digi comms': ['EST-3.0', 'EST-6.0'],
    'digi-data comms': ['EST-3.0', 'EST-6.0'],
    'data comms': ['EST-6.0'],
    'data communications': ['EST-6.0'],
    'radio wave prop': ['EST-2.0', 'EST-4.0'],
    'wave prop-microwave': ['EST-2.0', 'EST-4.0'],
    'noise': ['EST-2.0'],
    'signals': ['EST-1.0'],
    'principle of comms': ['EST-2.0'],
    'transma': ['EST-4.0'],
    # ELECS
    'dc circuits': ['ELECS-1.0'],
    'microps lecture': ['ELECS-8.0'],
    'bjt lecture': ['ELECS-4.0'],
    'bjt': ['ELECS-4.0'],
    # GEAS
    'cad': ['GEAS-11.0'],
    'cprog': ['GEAS-8.0'],
    'ece laws': ['GEAS-10.0'],
    'eng management': ['GEAS-4.0'],
    'engmgmt': ['GEAS-4.0'],
    'safety & pec codes': ['GEAS-10.0'],
    'techno': ['GEAS-5.0'],
}

DECK_KEYWORD_PATTERNS = {
    'ELECS': [
        (re.compile(r'\b(?:bjt|transistor(?:s)?|solid state|diodes?|rectifier|fets?|mosfet|jfet)\b', re.I), 'ELECS-4.0'),
        (re.compile(r'\b(?:dc circuits?|resistive|thevenin|norton|mesh|node)\b', re.I), 'ELECS-1.0'),
        (re.compile(r'\b(?:ac circuits?|alternating current|impedance|resonance|phasor|3-phase|three-phase)\b', re.I), 'ELECS-2.0'),
        (re.compile(r'\b(?:electromagnetics?|maxwell|magnetic circuit)\b', re.I), 'ELECS-3.0'),
        (re.compile(r'\b(?:op-amp|operational amplifier|differential amplifier|multistage|cascade|cascode|feedback amplifier|oscillator|filter)\b', re.I), 'ELECS-5.0'),
        (re.compile(r'\b(?:power electronics|thyristor|scr|triac|diac|ujt|transducer|plc|sensors?)\b', re.I), 'ELECS-6.0'),
        (re.compile(r'\b(?:digital electronics|logic circuits?|boolean|k-map|flip-flop|counter|sequential logic|combinational logic)\b', re.I), 'ELECS-7.0'),
        (re.compile(r'\b(?:microprocessor|microcontroller|assembly|8085|8086|pic|avr|8051|embedded)\b', re.I), 'ELECS-8.0'),
        (re.compile(r'\b(?:control systems?|feedback and control|root locus|bode|nyquist|state space)\b', re.I), 'ELECS-9.0'),
    ],
    'GEAS': [
        (re.compile(r'\b(?:laws?|ethics|pece|ece law|ra ?9292|ra ?10515|pec|safety|contracts?|code of ethics)\b', re.I), 'GEAS-10.0'),
        (re.compile(r'\b(?:environment\w*|ecology|nutrient cycle|ecosystem|pollution|waste management|eia|green|water cycle|hydrolog\w*)\b', re.I), 'GEAS-9.0'),
        (re.compile(r'\b(?:economics?|interest|annuit\w*|cash flow|present worth|future worth|depreciation|break-even|break even|variable cost|fixed cost)\b', re.I), 'GEAS-3.0'),
        (re.compile(r'\b(?:management|pert|cpm|organization\w*|fayol|taylor|six sigma|tqm)\b', re.I), 'GEAS-4.0'),
        (re.compile(r'\b(?:technopreneur\w*|startup|business plan|business model|venture capital|mvp|b2b|b2c|c2c)\b', re.I), 'GEAS-5.0'),
        (re.compile(r'\b(?:thermodynamics?|carnot|entropy|heat engine|heat pump)\b', re.I), 'GEAS-6.0'),
        (re.compile(r'\b(?:materials? science|crystal|bcc|fcc|hcp|miller indices|metallurg\w*|defect)\b', re.I), 'GEAS-7.0'),
        (re.compile(r'\b(?:programming|c\+\+|java|python|cprog|oop|flowchart|algorithm)\b', re.I), 'GEAS-8.0'),
        (re.compile(r'\b(?:chemistry|chemical|stoichiometry|periodic table|molarity|reaction)\b', re.I), 'GEAS-1.0'),
        (re.compile(r'\b(?:physics|mechanics|kinematics|dynamics|newton|projectile|work|energy|momentum|fluids?|rotation)\b', re.I), 'GEAS-2.0'),
        (re.compile(r'\b(?:cad|autocad|drafting|osnap|plotting)\b', re.I), 'GEAS-11.0'),
    ],
    'EST': [
        (re.compile(r'\b(?:fiber optics?|transmission lines?|antenna|antennas?|wave propagation|microwaves?|waveguide|transma)\b', re.I), 'EST-4.0'),
        (re.compile(r'\b(?:principles? of comms?|modulation|am|fm|radio|receiver|transmitter|noise|noise figure)\b', re.I), 'EST-2.0'),
        (re.compile(r'\b(?:digital comms?|digi comms?|pcm|pam|pwm|fsk|psk|qam|multiplexing|tdm|fdm)\b', re.I), 'EST-3.0'),
        (re.compile(r'\b(?:data comms?|data communications?|computer networks?|osi model|tcp/ip|ethernet|routing|lan|wan)\b', re.I), 'EST-6.0'),
        (re.compile(r'\b(?:signals?|dsp|sampling|nyquist|fourier|spectral|digital signal processing)\b', re.I), 'EST-1.0'),
        (re.compile(r'\b(?:audio|acoustics?|video|television|tv|satellite|radar|telephony|cellular|gsm|5g|lte)\b', re.I), 'EST-5.0'),
    ],
    'MATH': [
        (re.compile(r'\b(?:differential calculus|derivatives?|maxima|minima|limits?)\b', re.I), 'MATH-1.0'),
        (re.compile(r'\b(?:integral calculus|integration|integrals?|area bounded|volume of revolution)\b', re.I), 'MATH-2.0'),
        (re.compile(r'\b(?:differential equations?|de|ode|laplace transforms?)\b', re.I), 'MATH-3.0'),
        (re.compile(r'\b(?:advanced math|complex numbers?|matrices|matrix|vectors?|power series)\b', re.I), 'MATH-4.0'),
        (re.compile(r'\b(?:probability|statistics|data analysis|permutation|combination|hypothesis)\b', re.I), 'MATH-5.0'),
        (re.compile(r'\b(?:electromagnetics?|maxwell|vector field|divergence|curl)\b', re.I), 'MATH-6.0'),
        (re.compile(r'\b(?:signals?|spectra|fourier transform|z-transform)\b', re.I), 'MATH-7.0'),
        (re.compile(r'\b(?:control systems?|feedback|transfer function|root locus)\b', re.I), 'MATH-8.0'),
    ]
}

# Precompile all regex rules and build subtopic-to-parent mapping
COMPILED_SUBTOPIC_RULES = {}
for subj, sub_dict in SUBTOPIC_RULES.items():
    COMPILED_SUBTOPIC_RULES[subj] = {}
    for sub_id, patterns in sub_dict.items():
        COMPILED_SUBTOPIC_RULES[subj][sub_id] = [re.compile(p, re.IGNORECASE) for p in patterns]

COMPILED_PARENT_RULES = {}
for subj, p_dict in PARENT_RULES.items():
    COMPILED_PARENT_RULES[subj] = {}
    for p_id, patterns in p_dict.items():
        COMPILED_PARENT_RULES[subj][p_id] = [re.compile(p, re.IGNORECASE) for p in patterns]

# Mapping each decimal subtopic to its parent topic (e.g. 'MATH-1.4' -> 'MATH-1.0')
SUBTOPIC_TO_PARENT = {}
for subj, topic_dict in SUBTOPIC_RULES.items():
    for sub_id in topic_dict:
        m = re.match(r'^([A-Z]+-\d+)\.\d+$', sub_id)
        if m:
            SUBTOPIC_TO_PARENT[sub_id] = f"{m.group(1)}.0"


def normalize_subject(subj_str):
    if not subj_str:
        return 'ALL'
    s = subj_str.upper().strip()
    if 'MATH' in s:
        return 'MATH'
    if 'GEAS' in s or 'APPLIED' in s:
        return 'GEAS'
    if 'SYSTEM' in s or 'EST' in s or 'COMM' in s:
        return 'EST'
    if 'ELEC' in s:
        return 'ELECS'
    return 'ALL'


def detect_deck_topic(deck_name, deck_desc, subject_code):
    """Detect a primary parent topic from deck title and deck description."""
    combined = f"{deck_name or ''} {deck_desc or ''}".strip().lower()
    if not combined:
        return None

    name_clean = (deck_name or '').strip().lower()
    if name_clean in DECK_TOPIC_HINTS:
        return DECK_TOPIC_HINTS[name_clean][0]

    patterns = DECK_KEYWORD_PATTERNS.get(subject_code, [])
    for pat, target_topic in patterns:
        if pat.search(combined):
            return target_topic
    return None


def classify_text(text, subject_code, deck_name=None, deck_desc=None, default_tos=None):
    """
    Score text against all decimal subtopics for the given subject.
    Incorporates:
    - Expanded subtopic regex rules
    - Deck Default TOS Category bias and fallback
    - Deck Name & Description topic hints
    Returns (topic_id, is_confident)
    """
    if subject_code not in COMPILED_SUBTOPIC_RULES:
        return None, False

    # 1. Determine deck primary context
    primary_parent = None
    target_subtopic = None
    if default_tos:
        if '.' in default_tos and not default_tos.endswith('.0'):
            target_subtopic = default_tos
            primary_parent = SUBTOPIC_TO_PARENT.get(default_tos, f"{default_tos.split('.')[0]}.0")
        else:
            primary_parent = default_tos
    else:
        primary_parent = detect_deck_topic(deck_name, deck_desc, subject_code)

    # 2. Score subtopics with raw keyword matches
    raw_subtopic_scores = Counter()
    for sub_id, patterns in COMPILED_SUBTOPIC_RULES[subject_code].items():
        for pat in patterns:
            cnt = len(pat.findall(text))
            if cnt > 0:
                words_in_pat = len(re.findall(r'[a-zA-Z0-9]+', pat.pattern))
                if words_in_pat >= 2 or any(k in pat.pattern.lower() for k in ['b2b', 'b2c', 'c2c', 'b2g', 'eia', 'ecc']):
                    weight = 3
                else:
                    weight = 1
                raw_subtopic_scores[sub_id] += cnt * weight

    # Apply deck bias if available
    subtopic_scores = Counter(raw_subtopic_scores)
    if primary_parent:
        for sub_id in COMPILED_SUBTOPIC_RULES[subject_code]:
            if SUBTOPIC_TO_PARENT.get(sub_id) == primary_parent:
                if sub_id in raw_subtopic_scores:
                    # Give bonus to matches in the deck's primary topic
                    subtopic_scores[sub_id] += 3
        if target_subtopic and target_subtopic in raw_subtopic_scores:
            subtopic_scores[target_subtopic] += 2

    if subtopic_scores:
        ranked = subtopic_scores.most_common(2)
        top_id, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0

        # If deck has a primary topic
        if primary_parent:
            top_parent = SUBTOPIC_TO_PARENT.get(top_id, top_id)
            if top_parent == primary_parent:
                confident = (top_score >= MIN_CONFIDENCE_SCORE)
                if confident:
                    return top_id, True
                elif default_tos:
                    return default_tos, False
                else:
                    return None, False
            else:
                # Top match is from a different topic family
                raw_top = raw_subtopic_scores.get(top_id, 0)
                # Allow cross-topic classification ONLY if strong confident keyword match (>= 3 raw points)
                if raw_top >= 3:
                    return top_id, True

                # If weak/coincidental match from another topic, check if primary parent had any subtopic matches
                best_primary_sub = None
                best_primary_score = 0
                for s_id, s_cnt in raw_subtopic_scores.items():
                    if SUBTOPIC_TO_PARENT.get(s_id) == primary_parent and s_cnt > best_primary_score:
                        best_primary_score = s_cnt
                        best_primary_sub = s_id

                if best_primary_sub and best_primary_score >= MIN_CONFIDENCE_SCORE:
                    return best_primary_sub, True
                # Otherwise fallback to the deck's default or None
                if default_tos:
                    return default_tos, False
                return None, False

        confident = (top_score >= MIN_CONFIDENCE_SCORE) and (top_score - second_score >= MIN_CONFIDENCE_MARGIN)
        if confident:
            return top_id, True
        elif default_tos:
            return default_tos, False
        else:
            return None, False

    # 3. Parent-level rules
    parent_scores = Counter()
    if subject_code in COMPILED_PARENT_RULES:
        for p_id, patterns in COMPILED_PARENT_RULES[subject_code].items():
            for pat in patterns:
                cnt = len(pat.findall(text))
                if cnt > 0:
                    words_in_pat = len(re.findall(r'[a-zA-Z0-9]+', pat.pattern))
                    weight = 3 if words_in_pat >= 2 else 1
                    parent_scores[p_id] += cnt * weight

    if parent_scores:
        top_pid, top_pscore = parent_scores.most_common(1)[0]
        if top_pscore >= 3:
            return top_pid, True
        if default_tos:
            return default_tos, False
        return None, False

    # 4. Fallback hierarchy: default_tos -> Untagged (None)
    if default_tos:
        return default_tos, False

    return None, False


def extract_card_text(data_str, card_type):
    if not data_str:
        return ''
    try:
        data = json.loads(data_str)
        if isinstance(data, dict):
            parts = []
            if data.get('question'):
                parts.append(str(data['question']))
            if data.get('front'):
                parts.append(str(data['front']))
            if data.get('back'):
                parts.append(str(data['back']))
            if isinstance(data.get('choices'), list):
                parts.extend([str(c) for c in data['choices']])
            if data.get('explanation'):
                parts.append(str(data['explanation']))
            # formula cards: `name` is the single highest-signal field
            # (e.g. "Wire Temperature", "Resistance") — previously dropped.
            if data.get('name'):
                parts.append(str(data['name']))
            if data.get('description'):
                parts.append(str(data['description']))
            return ' '.join(parts)
        return str(data_str)
    except Exception:
        return str(data_str)





def run_classification(db_path=DEFAULT_DB_PATH, deck_id=None, apply_changes=False,
                        output_json=False, card_type='mcq', review_csv=None):
    if not os.path.exists(db_path):
        err_msg = f"Database not found at {db_path}"
        if output_json:
            print(json.dumps({"success": False, "error": err_msg}))
        else:
            print(f"Error: {err_msg}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(topics)")
    topic_cols = [col[1] for col in cursor.fetchall()]
    has_default_tos_col = 'default_tos_topic_id' in topic_cols
    select_default = "t.default_tos_topic_id" if has_default_tos_col else "NULL"

    query = f"""
        SELECT c.id, t.subject, t.name, c.type, c.data, c.tos_topic_id, t.id, t.description, {select_default}
        FROM cards c
        JOIN topics t ON c.topic_id = t.id
    """
    conditions = []
    params = []
    if deck_id:
        conditions.append("t.id = ?")
        params.append(deck_id)
    if card_type and card_type != 'all':
        conditions.append("c.type = ?")
        params.append(card_type)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    total = len(rows)

    updates = []
    review_rows = []
    distribution = Counter()
    subject_distribution = Counter()
    subtopic_count = 0
    parent_count = 0
    review_count = 0

    for r in rows:
        card_id, subject_raw, deck_name, card_type_val, data_raw, existing_tos, d_id, deck_desc, default_tos = r
        subject_code = normalize_subject(subject_raw)

        card_text = extract_card_text(data_raw, card_type_val)
        assigned_topic, confident = classify_text(card_text, subject_code, deck_name=deck_name, deck_desc=deck_desc, default_tos=default_tos)

        if not assigned_topic:
            continue

        if confident:
            updates.append((assigned_topic, card_id))
            distribution[assigned_topic] += 1
            subject_distribution[subject_code] += 1
            if '.' in assigned_topic and not assigned_topic.endswith('.0'):
                subtopic_count += 1
            else:
                parent_count += 1
        else:
            review_count += 1
            if not existing_tos:
                # Assign parent fallback to previously untagged cards
                updates.append((assigned_topic, card_id))
                distribution[assigned_topic] += 1
                subject_distribution[subject_code] += 1
                parent_count += 1
            if review_csv:
                review_rows.append({
                    'card_id': card_id, 'deck_id': d_id, 'deck_name': deck_name,
                    'subject': subject_raw, 'existing_tos_topic_id': existing_tos,
                    'proposed_topic_id': assigned_topic,
                    'card_text_preview': card_text[:200],
                })

    if apply_changes and updates:
        cursor.executemany("UPDATE cards SET tos_topic_id = ? WHERE id = ?", updates)
        conn.commit()

    if review_csv and review_rows:
        with open(review_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(review_rows[0].keys()))
            writer.writeheader()
            writer.writerows(review_rows)

    conn.close()

    result = {
        "success": True,
        "mode": "applied" if apply_changes else "dry-run",
        "card_type_scope": card_type,
        "total_cards": total,
        "auto_classified_cards": len(updates),
        "flagged_for_review": review_count,
        "subtopic_count": subtopic_count,
        "parent_count": parent_count,
        "subject_distribution": dict(subject_distribution),
        "top_classifications": dict(distribution.most_common(20)),
    }
    if review_csv:
        result["review_csv"] = review_csv if review_rows else None

    if output_json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\nECEngine TOS Classification ({result['mode'].upper()}) — card type scope: {card_type}")
        print(f"Total cards processed: {total}")
        print(f"Auto-classified (confident): {len(updates)} ({len(updates)/max(total,1)*100:.1f}%)")
        print(f"  - into decimal subtopics: {subtopic_count} ({subtopic_count/max(total,1)*100:.1f}%)")
        print(f"  - into parent topics:     {parent_count} ({parent_count/max(total,1)*100:.1f}%)")
        print(f"Flagged for manual review (low confidence / ambiguous): {review_count} ({review_count/max(total,1)*100:.1f}%)")
        if review_csv:
            print(f"  -> written to {review_csv}" if review_rows else "  -> (nothing to write)")
        print("\n--- By Subject (confident only) ---")
        for subj, cnt in sorted(subject_distribution.items()):
            print(f"  {subj:8s}: {cnt:5d} cards")
        print("\n--- Top 20 TOS Classifications (confident only) ---")
        for tid, cnt in distribution.most_common(20):
            print(f"  {tid:12s}: {cnt:5d} cards")
        if not apply_changes:
            print("\n[NOTE] Ran in DRY-RUN mode. Use --apply to commit changes to database.")

    return 0


def run_validation(db_path=DEFAULT_DB_PATH, output_json=False):
    """
    Self-check: for the subset of decks with an unambiguous deck-name hint
    (DECK_TOPIC_HINTS), check what fraction of MCQ cards the classifier
    assigns to a topic consistent with that deck's known topic. This is a
    proxy metric only (a deck-level match, not a verified subtopic-level
    label) but requires no manual labeling and catches regressions.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, t.subject, t.name, c.type, c.data, t.id, t.description
        FROM cards c JOIN topics t ON c.topic_id = t.id
        WHERE c.type = 'mcq'
    """)
    rows = cursor.fetchall()
    conn.close()

    per_deck = Counter()
    per_deck_match = Counter()
    for card_id, subject_raw, deck_name, card_type_val, data_raw, d_id, deck_desc in rows:
        name_lower = (deck_name or '').strip().lower()
        hinted_topics = DECK_TOPIC_HINTS.get(name_lower)
        if not hinted_topics:
            continue
        subject_code = normalize_subject(subject_raw)
        text = extract_card_text(data_raw, card_type_val)
        assigned, confident = classify_text(text, subject_code, deck_name=deck_name, deck_desc=deck_desc)
        if not assigned or not confident:
            continue
        parent = SUBTOPIC_TO_PARENT.get(assigned, assigned)
        per_deck[deck_name] += 1
        if parent in hinted_topics:
            per_deck_match[deck_name] += 1

    result = {}
    total_checked = 0
    total_match = 0
    for deck_name, total_n in per_deck.items():
        matched = per_deck_match[deck_name]
        total_checked += total_n
        total_match += matched
        result[deck_name] = {"confident_classified": total_n, "matched_deck_hint": matched,
                              "accuracy": round(matched / total_n, 3) if total_n else None}

    overall = round(total_match / total_checked, 3) if total_checked else None
    if output_json:
        print(json.dumps({"overall_accuracy": overall, "checked": total_checked, "by_deck": result}, indent=2))
    else:
        print(f"\nDeck-name proxy validation (confident, auto-classified cards only)")
        print(f"Overall: {total_match}/{total_checked} = {overall}")
        print("\n--- By Deck ---")
        for deck_name, stats in sorted(result.items()):
            print(f"  {deck_name:30s}: {stats['matched_deck_hint']:4d}/{stats['confident_classified']:4d} "
                  f"({stats['accuracy']})")
    return 0


def run_stdin_classification():
    """
    Read an array of card objects from stdin and output an array of classifications.
    Each input object: { "id": "...", "subject": "...", "text"?: "...", "data"?: "...", "type"?: "...", "deckName"?: "...", "deckDescription"?: "...", "defaultTosTopicId"?: "..." }
    Output JSON array: [ { "id": "...", "tosTopicId": "...", "confident": bool }, ... ]
    """
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps([]))
            return 0
        cards = json.loads(raw_input)
        if not isinstance(cards, list):
            print(json.dumps({"error": "Expected JSON array of cards"}), file=sys.stderr)
            return 1

        results = []
        for c in cards:
            cid = c.get("id")
            subject_raw = c.get("subject", "")
            deck_name = c.get("deckName") or c.get("deck_name")
            deck_desc = c.get("deckDescription") or c.get("deck_description")
            default_tos = c.get("defaultTosTopicId") or c.get("default_tos_topic_id")
            text = c.get("text")
            if not text:
                text = extract_card_text(c.get("data", ""), c.get("type", "mcq"))
            subject_code = normalize_subject(subject_raw)
            assigned, confident = classify_text(text, subject_code, deck_name=deck_name, deck_desc=deck_desc, default_tos=default_tos)
            results.append({
                "id": cid,
                "tosTopicId": assigned,
                "confident": confident
            })
        print(json.dumps(results))
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(description="Classify ECEngine database into PRC TOS topics & subtopics")
    parser.add_argument('--apply', action='store_true', help="Commit changes to database (default is dry-run)")
    parser.add_argument('--dry-run', action='store_true', help="Run in dry-run mode without writing to database")
    parser.add_argument('--json', action='store_true', help="Output results in JSON format")
    parser.add_argument('--db', default=DEFAULT_DB_PATH, help=f"Path to SQLite database (default: {DEFAULT_DB_PATH})")
    parser.add_argument('--deck-id', default=None, help="Target a specific deck/topic ID")
    parser.add_argument('--card-type', default='mcq', choices=['mcq', 'flashcard', 'formula', 'all'],
                         help="Which card type(s) to classify (default: mcq)")
    parser.add_argument('--review-csv', default=None, help="Write low-confidence/ambiguous cards to this CSV instead of silently applying them")
    parser.add_argument('--validate', action='store_true', help="Run deck-name proxy accuracy check instead of classifying")
    parser.add_argument('--stdin', action='store_true', help="Read cards JSON array from stdin and output classifications JSON")

    args = parser.parse_args()
    apply_mode = args.apply and not args.dry_run

    if args.stdin:
        sys.exit(run_stdin_classification())

    if args.validate:
        sys.exit(run_validation(db_path=args.db, output_json=args.json))

    sys.exit(run_classification(
        db_path=args.db,
        deck_id=args.deck_id,
        apply_changes=apply_mode,
        output_json=args.json,
        card_type=args.card_type,
        review_csv=args.review_csv,
    ))


if __name__ == '__main__':
    main()