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
import time
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
            r'\bcontinuous\b', r'\bdiscontinuity\b', r'\buniformly continuous\b', r'\bremovable discontinuity\b',
            r'\basymptotes?\b', r'\bl\'?hopital\b', r'\bindeterminate form\b', r'\bdelta-epsilons?\b',
            r'\bdomain and range\b', r'\bone-sided limit\b'
        ],
        'MATH-1.2': [  # Derivatives and Its Applications
            r'\bderivatives?\b', r'\bdy/dx\b', r'\btangent line\b', r'\bnormal line\b', r'\brate of change\b',
            r'\brelated rate\w*', r'\bmaximas?\b', r'\bminimas?\b', r'\b(?:maximum|minimum) value\b',
            r'\b(?:minimize|maximize|minimizing|maximizing)\b', r'\boptimized (?:radius|dimensions?|value|shape)\b',
            r'\bcritical point\w*', r'\boptimization problem\b', r'\bmean value theorem\b', r'\brolle\'?s\b',
            r'\bconcavity\b', r'\binflection point\b', r'\bchain rule\b', r'\bproduct rule\b', r'\bquotient rule\b',
            r'\bimplicit differentiation\b', r'\bdifferentiab\w*\b', r'\bderivative of a function\b',
            r'\bincreasing on an interval\b', r'\bdecreasing on an interval\b', r'\bf\'\(x\)\b',
            # Common calculus exam patterns
            r"\bf'\(x\)\s*=\s*0\b", r"\bf''\(x\)\b", r'\bsecond derivative test\b', r'\bfirst derivative test\b',
            r'\brelative (?:maximum|minimum)\b', r'\blocal (?:maximum|minimum)\b', r'\bglobal (?:maximum|minimum)\b',
            r'\bstationary point\b', r'\bdifferentiate\b', r'\bdifferentiation\b', r'\bvelocity from position\b',
            r'\bacceleration from velocity\b', r"\bs'\(t\)\b", r"\bv'\(t\)\b"
        ],
        'MATH-1.3': [  # Higher-Order Derivatives
            r'\bhigher[- ]order derivative\b', r'\bsecond derivative\b', r'\bd2y/dx2\b', r'\bnth derivative\b',
            r'\bleibniz(?:\'?s)? rule\b', r'\bradius of curvature\b', r'\bcurvature of\b',
            r'\bacceleration from velocity\b'
        ],
        'MATH-1.4': [  # Parametric Equations
            r'\bparametric equation\b', r'\bparametrize\w*', r'\bparametrically\b', r'\bconic sections?\b',
            r'\bvelocity vector at t\b', r'\bcycloids?\b', r'\bastroids?\b',
            r'\bdy/dt\b', r'\bdx/dt\b',
            # Conic sections — ellipse, parabola, hyperbola, circle properties
            r'\bellips\w+\b', r'\bparabol\w+\b', r'\bhyperbol\w+\b',
            r'\bsemi-?major axis\b', r'\bsemi-?minor axis\b', r'\bfocal (?:point|length|chord)\b',
            r'\bdirectrix\b', r'\bfoci\b', r'\beccentricity\b', r'\blatus rectum\b',
            r'\bcenter of (?:the )?(?:ellipse|circle|hyperbola)\b',
            r'\bequation of (?:the )?(?:ellipse|parabola|hyperbola|circle)\b'
        ],
        'MATH-1.5': [  # Partial Differentiation
            r'\bpartial derivative\b', r'\bpartial differentiation\b', r'\btotal differentials?\b',
            r'\beuler\'?s theorem on homogeneous\b', r'\bjacobians?\b', r'\bdel z ?/ ?del x\b',
            # Partial derivative symbol patterns (∂ character and LaTeX \partial)
            r'∂[a-zA-Z]/∂[a-zA-Z]', r'\\partial', r'∂f/∂', r'∂y/∂x', r'∂z/∂',
            r'\bfind ∂\b', r'\bcompute ∂\b', r'\bpartial (?:of|with respect)\b',
            r'\bmarginal cost\b', r'\bmarginal revenue\b',  # economics applications of partials
            r'\bgradient at (?:a )?point\b', r'\bscalar field\b'
        ],

        # 2.0 Integral Calculus
        'MATH-2.1': [  # Integration Concepts/Formulas
            r'\bantiderivatives?\b', r'\bindefinite integral\b', r'\bfundamental theorem of calculus\b',
            r'\bconstant of integration\b', r'\bstandard integral\b', r'\bintegral of\b',
            # Broad integration catch-all patterns
            r'\bintegrals?\b', r'∫', r'\bprimitive function\b', r'\bpower rule of integration\b',
            r'\bintegrating\b', r'\bevaluate the integral\b', r'\bcompute the integral\b'
        ],
        'MATH-2.2': [  # Integration Techniques
            r'\bintegration by parts\b', r'\bu-substitutions?\b', r'\btrigonometric substitution\b',
            r'\bpartial fraction\b', r'\btabular integration\b', r'\brational fraction\b',
            r'\bwhich (?:integration )?technique\b', r'\bwhich pair of integrals\b'
        ],
        'MATH-2.3': [  # Improper Integrals
            r'\bimproper integral\b', r'\binfinite limit of integration\b', r'\bconvergent integral\b',
            r'\bdivergent integral\b', r'\bdiscontinuity in (?:the )?integrand\b'
        ],
        'MATH-2.4': [  # Application of Integral
            r'\barea under\b', r'\barea bounded\b', r'\barea (?:.*?)bounded by\b', r'\bbounded by y\s*=\b',
            r'\bvolume of revolution\b', r'\bdisk method\b',
            r'\bwasher method\b', r'\bcylindrical shell\b', r'\blength of (?:the )?arc\b', r'\barc length\b',
            r'\bsurface of revolution\b', r'\bcentroids?\b', r'\bcenter of mass\b', r'\bpappus\'?s theorem\b',
            r'\bwork done by\b', r'\brevolving\s+.*?\s+about\b', r'\babout the (?:x|y)[- ]axis\b',
            r'\baverage (?:value|area) of (?:a )?function\b', r'\brotated around\b'
        ],
        'MATH-2.5': [  # Multiple Integration and its Application
            r'\bdouble integral\b', r'\btriple integral\b', r'\bmultiple integral\b',
            r'\biterated integral\b', r'\bpolar coordinate\w* integral\b', r'\bcylindrical coordinate\b',
            r'\bspherical coordinate\b', r'\bmoment of inertia by integration\b', r'\bmultiple integrals?\b',
            r'∬', r'∭', r'\bregion bounded by\b'
        ],

        # 3.0 Differential Equation
        'MATH-3.1': [  # First-Order, First-Degree ODE and its Application
            r'\bode\b', r'\bdifferential equation\b', r'\bde\b(?= solution| solv|s are)',
            r'\bdy/dx\b', r'\bdy\s*/\s*dx\b', r'\bdifferential equations?\b',
            r'\bseparable (?:differential )?equation\b', r'\bhomogeneous differential equation\b',
            r'\bexact differential equation\b', r'\bintegrating factor\b', r'\bbernoulli(?:\'?s)? equation\b',
            r'\blinear first[- ]order\b', r'\border and degree\b', r'\borthogonal trajector\w*',
            r'\bgrowth and decay\b', r'\bnewton\'?s law of cooling\b', r'\bfirst[- ]order ode\b',
            r'\bfirst[- ]order de\b', r'\bseries rl circuit\b', r'\bcharging capacitor in an? rc\b',
            r'\bspread of a disease\b', r'\bseries rc circuit\b', r'\brc transient\b', r'\bmixture problems?\b',
            r'\btank (?:initially )?holds\b', r'\bsolute enters\b'
        ],
        'MATH-3.2': [  # Higher-Order ODE and its Application
            r'\bhigher[- ]order (?:ode|differential equation)\b', r'\bauxiliary equation\b',
            r'\bcomplementary function\b', r'\bparticular integral\b', r'\bmethod of undetermined coefficients\b',
            r'\bvariation of parameters\b', r'\bwronskians?\b', r'\bcauchy-euler\b',
            r'\bsecond[- ]order (?:linear )?(?:homogeneous )?(?:differential equations?|ode)\b',
            r'\bseries rlc circuit\b', r'\bseries lc circuit\b', r'\brlc circuit\b',
            r'\bcharacteristic equation\b', r'\bmechanical vibration\w*\b', r'\bspring[- ]mass system\b'
        ],
        'MATH-3.3': [  # Laplace Transforms, Inverses, and its Applications
            r'\blaplace transform\b', r'\binverse laplace\b', r'\bs-domains?\b', r'\bunit step function\b',
            r'\bheavisides?\b', r'\bdirac delta\b', r'\binitial value theorem\b', r'\bfinal value theorem\b',
            r'\bconvolution theorem\b', r'\blaplace transform of (?:a )?derivative\b',
            # L^-1 inverse Laplace / initial value of time-domain response
            r'\bl\^\{?-1\}?\b', r'\bl\^-1\b', r'\bfind l\^?-?1\b', r'\bevaluate l\{\b',
            r'\binitial value of the time[- ]domain response\b',
            r'\binitial[- ]value theorem\b', r'\bfinal[- ]value theorem\b'
        ],



        # 4.0 Advanced Engineering Mathematics for ECE
        'MATH-4.1': [  # Complex Numbers and its Applications
            r'\bcomplex numbers?\b', r'\bimaginary number\b', r'\bargand (?:plane|diagram)\b',
            r'\bde moivre\'?s theorem\b', r'\beuler\'?s formula\b', r'\bcauchy-riemann\b',
            r'\banalytic function\b', r'\bharmonic function\b', r'\bpolar form of a complex\b',
            r'\bcomplex roots?\b', r'\broots of unity\b', r'\bprincipal roots?\b',
            r'\bcomplex exponential\b', r'\bprincipal value of (?:a )?complex\b'
        ],
        'MATH-4.2': [  # Series and Transforms (Power Series, Bessel, Legendre, Fourier)
            r'\bpower series\b', r'\btaylor series\b', r'\bmaclaurin series\b', r'\bbessel function\b',
            r'\blegendre (?:polynomial|equation)\b', r'\blegendre(?:\'s)? differential equation\b',
            r'\bbessel(?:\'s)? differential equation\b', r'\bfourier series\b', r'\bfourier transform\b',
            r'\bdirichlet condition\w*', r'\binfinite series\b', r'\bconverges? absolutely\b',
            r'\bratio test\b', r'\broot test\b',
            # Taylor/Maclaurin term questions (very common in MATH exams)
            r'\btaylor.*polynomial for\b', r'\bmaclaurin expansion for\b',
            r'\bfind the \d+(?:st|nd|rd|th) term of the taylor\b',
            r'\bfind the \d+(?:st|nd|rd|th) term of the maclaurin\b',
            r'\bthird term of the maclaurin\b', r'\bfourth term.*taylor\b',
            r'\bcoefficient of the.*taylor polynomial\b', r'\bgenerated by f\(x\)\b'
        ],

        'MATH-4.3': [  # Partial Differential Equations
            r'\bpartial differential equation\b', r'\bpdes?\b', r'\bheat equation\b',
            r'\bwave equation\b', r'\blaplace\'?s equation\b', r'\bseparation of variables\b',
            r'\bu_xx\b', r'\bboundary conditions?\b'
        ],
        'MATH-4.4': [  # Simultaneous Linear and Non-Linear Equations
            r'\bsimultaneous (?:linear|non-?linear) equations?\b', r'\bmatrixs?\b', r'\bmatrices\b',
            r'\bdeterminants?\b', r'\bcramer\'?s rule\b', r'\beigenvalues?\b', r'\beigenvectors?\b',
            r'\binverse matrix\b', r'\brank of a matrix\b', r'\bgauss-jordans?\b', r'\bgauss(?:ian)? elimination\b',
            r'\bsystem of (?:linear )?equations\b'
        ],
        'MATH-4.5': [  # Numerical Differentiation, Integration and Optimization
            r'\bnewton-raphsons?\b', r'\brunge-kuttas?\b', r'\bsimpson\'?s (?:1/3|3/8)? ?rule\b', r'\btrapezoidal rule\b',
            r'\bnumerical (?:method|methods?|integration|differentiation)\b', r'\bbisection method\b',
            r'\busing computers in solving differential\b',
            r'\bsecant method\b', r'\b(?:forward |backward )?euler(?:\'?s)? method\b', r'\bnumerical optimization\b'
        ],

        # 5.0 Engineering Data Analysis
        'MATH-5.1': [  # Obtaining Data
            r'\bdata collection\b', r'\bsurvey method\b', r'\bcensus\b', r'\brandom sampling\b',
            r'\bqualitative data\b', r'\bquantitative data\b', r'\bdiscrete data\b', r'\bcontinuous data\b',
            r'\bsampling technique\b', r'\bstratified sampling\b', r'\bcluster sampling\b',
            r'\bsimple random sample\b', r'\bsystematic sampling\b', r'\bprimary data\b', r'\bsecondary data\b',
            r'\bsampling error\b', r'\bsampling bias\b', r'\bpopulation (?:of|vs|sample)\b'
        ],
        'MATH-5.2': [  # Statistical Sampling, Distribution, and Intervals
            r'\bmeans?\b', r'\bmedians?\b', r'\bmodes?\b', r'\bstandard deviation\b', r'\bvariances?\b',
            r'\bnormal distribution\b', r'\bz-scores?\b', r'\bbinomial distribution\b', r'\bbinomial experiment\b',
            r'\bpoisson distribution\b',
            r'\bconfidence interval\b', r'\bcentral limit theorem\b', r'\bprobability distribution\b',
            r'\buniformly distributed\b', r'\buniform distribution\b',
            r'\bquartiles?\b', r'\bsampling distribution\b',
            # Broad probability / statistics patterns
            r'\bprobabilit\w+\b', r'\bstatistic\w+\b', r'\bp\(a\)\b', r'\bp\(b\)\b', r'\bp\(a|b\)\b',
            r'\bbayes\b', r'\bconditional probability\b', r'\bindependence of events\b',
            r'\bcombinations?\b', r'\bpermutations?\b', r'\bfair coin\b', r'\bfair die\b', r'\bdice\b',
            r'\bdraw (?:a |one )?card\b', r'\bdeck of cards\b', r'\btosses?\b', r'\bheads? or tails?\b',
            r'\bexpected value\b', r'\bexpected (?:number|frequency)\b', r'\bpdf\b', r'\bcdf\b',
            r'\brandom variable\b', r'\bcontinuous random variable\b', r'\bdiscrete random variable\b',
            r'\bprobability density function\b', r'\bcumulative distribution\b'
        ],
        'MATH-5.3': [  # Test of Hypothesis
            r'\bhypothesis test\w*', r'\bnull hypothesis\b', r'\balternative hypothesis\b',
            r'\btype (?:i|ii) error\b', r'\bp-values?\b', r'\bt-tests?\b', r'\bchi-square test\b',
            r'\bsignificance level\b', r'\bz-tests?\b'
        ],
        'MATH-5.4': [  # Regression and Correlation
            r'\bregression (?:line|analysis|equation)\b', r'\bcorrelation coefficient\b', r'\br-squareds?\b',
            r'\bpearson correlation\b', r'\bscatter plot\b', r'\bleast squares\b', r'\bcovariances?\b',
            r'\bcorrelation analysis\b', r'\blinear regression\b', r'\bregression coefficient\b',
            r'\brelative shift between signals\b',
            # Correlation vs regression distinction question
            r'\bmain difference between correlation and regression\b',
            r'\bdifference between correlation and regression\b',
            r'\bcorrelation.*regression\b', r'\bregression.*correlation\b'
        ],

        'MATH-5.5': [  # Design of Experiments
            r'\bdesign of experiments?\b', r'\banovas?\b', r'\banalysis of variance\b', r'\bfactorial design\b',
            r'\bfactorial experiments?\b', r'\binteraction plots?\b', r'\bmain effects?\b',
            r'\b2\^?2 (?:factorial|design)\b', r'\bfractional replication\b', r'\bconfounding\b', r'\baliasing\b',
            r'\bf-tests?\b', r'\brandomized block design\b', r'\bone-factor-at-a-times?\b', r'\bofats?\b',
            r'\bcontrol(?:led)? experiment\b', r'\bexperimental design\b', r'\btesting machines?\b'
        ],

        # 6.0 Electromagnetics (also shared with ELECS-3.0)
        'MATH-6.1': [  # Vector Analysis
            r'\bdot product\b', r'\bcross product\b', r'\bunit vector\b', r'\bscalar product\b',
            r'\bvector product\b', r'\bdirection cosines\b', r'\bvector analysis\b', r'\bmagnitude of a vector\b',
            r'\bspherical polar\b', r'\bcoordinate transformations?\b', r'\bscalar triple product\b',
            r'\bvector triple product\b',
            # Broad vector patterns
            r'\bvectors?\b', r'\blinearly independent\b', r'\blinearly dependent\b',
            r'\bvector addition\b', r'\bvector subtraction\b', r'\bresultant vector\b',
            r'\bcomponent of (?:a |the )?vector\b', r'\bunit vectors? [ijk]\b', r'\bi\s*\+\s*j\b', r'\bi\s*-\s*j\b'
        ],
        'MATH-6.2': [  # Directional Derivative, Gradient, Divergence, Curl
            r'\bgradient of\b', r'\bdivergence of\b', r'\bcurl of\b', r'\bdel operator\b',
            r'\bdirectional derivative\b', r'\bsolenoidals?\b', r'\birrotationals?\b', r'\blaplacians?\b',
            # Symbol-based patterns and common question forms
            r'∇', r'\bnabla\b', r'\bdiv[\s\(]', r'\bcurl[\s\(]', r'\bgrad[\s\(]',
            r'\bgradient at (?:the )?point\b', r'\bcompute (?:the )?divergence\b', r'\bcompute (?:the )?curl\b',
            r'\bcompute (?:the )?gradient\b', r'\belectric field e\s*=\s*-\s*∇\b',
            r'\bzero divergence\b', r'\boutward flux\b', r'\btotal outward\b',
            r'\bvector field\b', r'\bscalar potential\b', r'\belectric field e = -\b',
            r'\bf\s*=\s*[a-z]+i\s*[+-]\s*[a-z]+j\b'  # F = yi + xj style vector field
        ],
        'MATH-6.3': [  # Integral Theorems (Green's, Divergence, Stokes')
            r'\bgreen\'?s theorem\b', r'\bdivergence theorem\b', r'\bstokes\'? theorem\b',
            r'\bgreen\'?s lemma\b', r'\bstrokes\'? theorem\b',
            r'\bline integral\b', r'\bsurface integral\b', r'\bconservative (?:vector )?field\b'
        ],

        # 7.0 Signals, Spectra & Signal Processing (also shared with EST-1.0)
        'MATH-7.1': [  # Z-Transforms
            r'\bz-transforms?\b', r'\binverse z-transform\b', r'\bregion of convergence\b', r'\broc of\b'
        ],
        'MATH-7.2': [  # Convolution
            r'\bconvolutions?\b', r'\bconvolution (?:sum|integral)\b', r'\bconvolve\b', r'\bimpulse response\b',
            r'\b(?:circular|linear) convolution\b', r'\bconvolution with\b'
        ],
        'MATH-7.3': [  # Correlation
            r'\bauto[- ]?correlations?\b', r'\bcross[- ]?correlations?\b', r'\bcorrelation function\b'
        ],

        # 8.0 Feedback and Control Systems (also shared with ELECS-9.0)
        'MATH-8.1': [  # Pole and Zero Determination
            r'\bpoles? and zeros?\b', r'\broot locus\b', r'\brouth-hurwitzs?\b', r'\brouth array\b',
            r'\bstability criterion\b', r'\bunity[- ]feedback\b', r'\bsystem type\b', r'\btype of (?:a )?system\b',
            r'\bopen[- ]loop transfer function\b', r'\bclosed[- ]loop transfer function\b',
            r'\bfeedback and control systems?\b'
        ],
        'MATH-8.2': [  # Transient Response
            r'\btransient response\b', r'\bdamping ratio\b', r'\bnatural frequency\b',
            r'\bsettling time\b', r'\brise time\b', r'\bpercent overshoot\b', r'\bsteady state error\b'
        ],
        'MATH-8.3': [  # Block Diagram and Signal Flow
            r'\bblock diagram reduction\b', r'\bsignal flow graph\b', r'\bmason\'?s (?:gain )?rule\b',
            r'\bsumming point\b', r'\bsumming junctions?\b', r'\bblock diagrams?\b', r'\btakeoff point\b'
        ]
    },

    'ELECS': {
        # 1.0 DC Electrical Circuits
        'ELECS-1.1': [  # Resistive Network
            r'\bohm\'?s law\b', r'\bresistor network\b', r'\bequivalent resistance\b', r'\bseries circuit\b',
            r'\bparallel circuit\b', r'\bvoltage divider\b', r'\bcurrent divider\b',
            r'\bresistor color code\b', r'\bconductances?\b', r'\bdelta-wye\b', r'\bstar-deltas?\b',
            r'\bdc resistance\b', r'\bdirect current resistance\b', r'\bresistance of a (?:standard )?(?:metallic )?conductor\b',
            r'\baxial[- ]lead resistor\b', r'\bresistor types?\b', r'\bresistance\b',
            # Expansions
            r'\bconnected in series\b', r'\bconnected in parallel\b', r'\bseries combination\b',
            r'\bparallel combination\b', r'\bparallel branches\b', r'\bmore parallel branches\b',
            r'\br_?eq\b', r'\btotal resistance\b', r'\blight bulbs?\b', r'\bbulbs? connected\b',
            r'\bfuses?\b', r'\bblown fuse\b', r'\bcircuit breakers?\b', r'\bthermal breaker\b',
            r'\bbattery is connected\b', r'\bampere-hour\b', r'\bvoltage drop across\b',
            r'\bthree resistors\b', r'\btwo resistors\b', r'\bresistors dissipates?\b',
            r'\br1\s*>\s*r2\b', r'\br1\s*and\s*r2\s*are connected\b', r'\bcarbon[- ]composition\b',
            r'\bwire-wound resistor\b', r'\bpotentiometer\b', r'\bvoltage drop of the (?:third|second|first) resistor\b',
            r'\bhouse wiring\b', r'\bhot wire\b', r'\bneutral wire\b', r'\bcolor-coded.*black or red\b'
        ],
        'ELECS-1.2': [  # Mesh and Node Equations
            r'\bmesh analysis\b', r'\bnode(?:al)? analysis\b', r'\bmesh current\b',
            r'\bnode voltage\b', r'\bkcls?\b', r'\bkvls?\b', r'\bkirchhoff\'?s (?:current|voltage) law\b',
            r'\bsupermeshs?\b', r'\bsupernodes?\b', r'\bmesh equations?\b', r'\bnode equations?\b',
            r'\bindependent mesh\b', r'\bplanar circuit\b',
            # Expansions
            r'\bloop and junction\b', r'\bjunction rules?\b', r'\bloop rules?\b',
            r'\bjunction in the network\b', r'\bthree or more wires are joined\b',
            r'\bcurrent leaving the junction\b', r'\bvoltage at point [a-z]\b',
            r'\bvoltage at node\b', r'\bnode equation\b', r'\bmesh equation\b'
        ],
        'ELECS-1.3': [  # Network Theorems
            r'\bthevenin(?:\'?s)? (?:theorem|circuit|equivalent|voltage|resistance)?\b',
            r'\bnorton(?:\'?s)? (?:theorem|circuit|equivalent|current|resistance)?\b',
            r'\bsuperposition (?:theorem)?\b', r'\bmaximum power transfer\b',
            r'\bsource transformation\b', r'\bmillman\'?s theorem\b', r'\breciprocity theorem\b',
            r'\blinear resistors and ideal voltage sources\b', r'\bsuperposition theorem\b',
            # Expansions
            r'\bmaximum power delivered\b', r'\btellegen\'?s theorem\b', r'\bport a produces a current at port b\b',
            r'\breciprocity\b', r'\bthevenin equivalent\b', r'\bnorton equivalent\b',
            # DC source conversion / equivalent source model
            r'\bequivalent current source model\b', r'\bvoltage source.*to its equivalent current source\b',
            r'\bconverting.*voltage source.*current source\b', r'\bdc network, converting\b'
        ],
        'ELECS-1.4': [  # Transient Analysis
            r'\brc transient\b', r'\brl transient\b', r'\btime constant\b', r'\bcharging (?:a )?capacitor\b',
            r'\bdischarging (?:an )?inductor\b', r'\btransient (?:analysis|response) of (?:an? )?(?:rc|rl) circuit\b',
            r'\bstep response of\b', r'\bseries rl circuit\b', r'\bseries rc circuit\b', r'\brl circuit\b', r'\brc circuit\b',
            # Expansions
            r'\btransient analysis\b', r'\btransient response\b', r'\bsteady-state response of a system\b',
            r'\brc integrator\b', r'\brc differentiator\b', r'\blaplace transform is used in transient\b',
            r'\bdischarging a capacitor\b', r'\binitial conditions? in (?:an? )?(?:rc|rl|transient)\b',
            r'\bswitched at t\s*=\s*0\b', r'\btransient current\b', r'\btransient behavior\b',
            # Battery/capacitor RC charging time (common ELECS exam questions)
            r'\bbattery charges a capacitor.*through a resistor\b',
            r'\bcapacitor.*charged.*through.*resistor.*how long\b',
            r'\bapproximately how long does it take.*charge\b',
            r'\btime for capacitor to reach\b', r'\btime for voltage to reach\b',
            r'\btwo storage elements? (?:are )?present in a circuit\b'
        ],

        'ELECS-1.5': [  # Solution to DC Network Problems
            r'\bwheatstone bridge\b', r'\bdc bridge\b', r'\bpotentiometer circuit\b', r'\bdc network problem\b',
            r'\bbattery bank\b', r'\bslide wire bridge\b',
            # Expansions
            r'\bdmm\b', r'\bdigital multimeter\b', r'\bpotentiometer method of dc\b',
            r'\bslide potentiometer\b', r'\bvoltmeter and ammeter\b', r'\bloading effect of (?:a )?voltmeter\b',
            r'\bsensitivity of (?:a |the )?voltmeter\b', r'\bgalvanometer\b', r'\bkelvin bridge\b',
            r'\bhay bridge\b', r'\bmaxwell bridge\b', r'\bschering bridge\b', r'\bposition of voltmeter\b',
            # Battery testing with capacitance / electronic tester
            r'\bcapacitance.*tester\b', r'\belectronic.*tester\b', r'\bbattery.*tester\b',
            r'\bsurface charge.*(?:removed|battery)\b', r'\bbattery must be fully charged before\b',
            r'\btechnician [ab] says\b'
        ],

        # 2.0 AC Electrical Circuits
        'ELECS-2.1': [  # Solution to AC Network Problems
            r'\bac circuit\b', r'\balternating current circuit\b', r'\bsinusoidal (?:voltage|current|waveform)\b',
            r'\brms value\b', r'\beffective value\b', r'\bpeak value\b', r'\baverage value\b',
            r'\bform factor\b', r'\bcrest factor\b',
            # Expansions
            r'\bcurrent through the capacitor\b', r'\bcurrent through the inductor\b',
            r'\brms current\b', r'\brms voltage\b', r'\bpeak-to-peak\b', r'\bphase angle\b',
            r'\bphasor diagram\b', r'\blags (?:the )?voltage\b', r'\bleads (?:the )?voltage\b',
            r'\blags by \d+°\b', r'\bleads by \d+°\b', r'\bcurrent wave shape.*applied to a circuit element\b',
            r'\bvoltage across the element\b', r'\bseries rlc circuit\b', r'\bcurrent lags the applied emf\b',
            r'\balternation\b', r'\bconnected to a.*mains and takes.*a\b'
        ],
        'ELECS-2.2': [  # Impedance and Admittance
            r'\bcomplex impedance\b', r'\breactances?\b', r'\binductive reactance\b',
            r'\bcapacitive reactance\b', r'\badmittances?\b', r'\bsusceptances?\b', r'\bphasor diagram\b',
            # Expansions
            r'\binput impedance\b', r'\boutput impedance\b', r'\bzin\b', r'\bzout\b',
            r'\bimpedance of the network\b', r'\bz_total\b', r'\bconductance and susceptance\b',
            r'\bseries rc is increased, the impedance\b'
        ],
        'ELECS-2.3': [  # Resonance
            r'\bresonances?\b', r'\bresonant frequency\b', r'\bseries resonance\b',
            r'\bparallel resonance\b', r'\bquality factor\b', r'\bq-factors?\b', r'\btank circuit\b', r'\bbandwidth of a resonant\b',
            r'\bparallel resonant circuit\b', r'\bantiresonance\b',
            # Expansions
            r'\bhalf-power frequencies\b', r'\bbw\s*=\s*f0/q\b', r'\bselectivity of a resonant\b',
            r'\blc tank\b'
        ],
        'ELECS-2.4': [  # Power in AC Circuits
            r'\breal power\b', r'\breactive power\b', r'\bapparent power\b', r'\bpower factor\b',
            r'\bthree-phases?\b', r'\b3-phase\b', r'\bdelta connection\b', r'\bwye connection\b',
            r'\bvolt-ampere reactive\b',
            # Expansions
            r'\btrue power\b', r'\bpower triangle\b', r'\bvolt-amperes?\b', r'\bvars?\b',
            r'\bdelta-connected\b', r'\bwye-connected\b', r'\bbalanced 3-phase\b',
            r'\bline voltage\b', r'\bphase voltage\b', r'\bline current\b',
            r'\bpower loss in an induction coil\b', r'\bthree loads are connected in parallel\b',
            r'\bcapacitive load.*kw\b'
        ],
        'ELECS-2.5': [  # Two-Port Network Parameters and Transfer Function
            r'\btwo-port network\b', r'\bz-parameters?\b', r'\by-parameters?\b', r'\bh-parameters?\b',
            r'\babcd parameter\b', r'\btransmission parameter\b',
            # Expansions
            r'\btwo-port\b', r'\bt-parameters?\b', r'\bsymmetrical network\b', r'\breciprocal network\b',
            r'\bt22 in the t parameters\b', r'\bfilter network must behave identically\b',
            r'\bcascade parameters\b', r'\bopen-circuit impedance parameters\b',
            r'\bshort-circuit admittance parameters\b', r'\bv1\s*=\s*av2\b',
            # s-domain / Laplace circuit representation
            r'\bs-domain\b', r'\blaplace equivalent circuit\b', r'\bimpedance of an inductor.*initial current\b',
            r'\bimpedance of a capacitor.*s-domain\b', r'\brepresentation for the impedance of an inductor\b'
        ],

        # 3.0 Electromagnetics (also shared with MATH-6.0)
        'ELECS-3.1': [  # Steady Electric and Magnetic Fields
            r'\bcoulomb\'?s law\b', r'\belectric field intensity\b', r'\bmagnetic flux density\b',
            r'\bbiot-savart\b', r'\bampere\'?s circuital law\b', r'\belectric potential\b',
            # Expansions
            r'\bmagnetic field\b', r'\belectric field\b', r'\bpoint charge\b', r'\belectric field lines?\b',
            r'\bmagnetic force\b', r'\blorentz force\b', r'\bforce acting on a test charge\b',
            r'\bmotion of electrons in a wire.*pole of a magnet\b', r'\belectron is moving.*magnetic field\b',
            r'\bmagnetic field b inside a long ideal solenoid\b', r'\brectangular coil.*magnetic field\b',
            r'\bdirection of the magnetic field\b', r'\bhall effect\b', r'\bsmall voltage is generated across the width of a conductor\b',
            r'\blines of the magnetic field produced by a long straight wire\b', r'\bmagnetic dipole moment\b',
            r'\bcurrent-carrying loop.*magnetic field\b', r'\belectromagnet.*coil\b',
            r'\bstraight wires carrying\b', r'\btwo long straight wires\b', r'\bcoulomb is\b'
        ],
        'ELECS-3.2': [  # Dielectric and Magnetic Materials
            r'\bpermittivit(?:y|ies)\b', r'\bpermeabilit(?:y|ies)\b', r'\bdielectric materials?\b', r'\bdielectrics?\b',
            r'\bpolarization mechanism\b', r'\belectric polarization\b', r'\bferromagnetics?\b',
            r'\bhysteresis loop\b', r'\bb-h curve\b', r'\bmagnetic susceptibility\b',
            r'\bparamagnetic\b', r'\bferromagnetic\b', r'\bdiamagnetic\b',
            # Expansions
            r'\bcoercivity\b', r'\bremanence\b', r'\bretentivity\b', r'\brelative permeability\b',
            r'\bcoordination number of 12\b', r'\bface-centered cubic\b', r'\bbody-centered cubic\b', r'\bsimple cubic crystal\b'
        ],
        'ELECS-3.3': [  # Coupled and Magnetic Circuits
            r'\bmutual inductance\b', r'\bdot convention\b', r'\breluctances?\b',
            r'\bmagnetic circuit\b', r'\bmagnetomotive force\b', r'\bmmf\b', r'\bcoupling coefficient\b',
            # Expansions
            r'\bcoefficient of coupling\b', r'\bcoupled coils?\b', r'\bself-inductance\b',
            r'\binductors? in series\b', r'\binductors? in parallel\b', r'\btransformer turns ratio\b',
            r'\brelays?\b', r'\bsolenoids?\b', r'\bspdt relay\b', r'\bplunger movement\b',
            r'\brelay allows a small control current\b', r'\bpin 87a is connected to pin 30\b',
            # Uncoupled / parallel inductors with DC current
            r'\buncoupled inductors?\b', r'\binductors? in parallel carrying\b',
            r'\bdc current.*inductor\b', r'\bsmaller inductor\b'
        ],

        'ELECS-3.4': [  # Time-Varying Fields and Maxwell's Equations
            r'\bmaxwell\'?s equations?\b', r'\bfaraday\'?s law\b', r'\blenz\'?s law\b',
            r'\bdisplacement current\b', r'\bpoynting vector\b', r'\btime-varying field\b'
        ],

        # 4.0 Electronic Devices and Circuits
        'ELECS-4.1': [  # Diode Wave Shaping and Special Diode Applications
            r'\bclipper circuit\b', r'\bclamper circuit\b', r'\bclipping circuit\b', r'\bclamping circuit\b',
            r'\bzener diode\b', r'\bzener breakdown\b', r'\bvaractor diode\b',
            r'\btunnel diode\b', r'\bschottky diode\b', r'\bwave shaping circuit\b', r'\bleds?\b', r'\bphotodiodes?\b',
            r'\blight-emitting diode\b', r'\bavalanche diode\b', r'\bpin diode\b', r'\bstep recovery diode\b',
            r'\bgallium arsenide\b', r'\bgaasp\b', r'\bvisible red light\b',
            r'\btransient protection\b', r'\bsnubber\b',
            # Expansions
            r'\bclippers?\b', r'\bclampers?\b', r'\bwave shaping\b', r'\bpractical wave shaping\b',
            r'\bclippers used before\b', r'\bvaristors?\b', r'\btvs diode\b'
        ],
        'ELECS-4.2': [  # BJT and FET Small Signal Analysis
            r'\bre model\b', r'\bhybrid[- .]pi model\b', r'\bhybrid parameters?\b', r'\bh-parameters?\b',
            r'\bsmall[- ]signal model\b', r'\bsmall[- ]signal analysis\b', r'\btransconductances?\b',
            r'\bsmall[- ]signal (?:input|output) impedance\b', r'\bsmall[- ]signal voltage gain\b',
            r'\bac equivalent circuit\b', r'\bmidband gain\b', r'\bac resistance of (?:the )?emitter\b',
            r'\bvoltage gain provided by\b', r'\bcurrent gain provided by\b', r'\binput impedance of\b',
            r'\bpush[- ]pull amplifier\b', r'\bclass b push[- ]pull\b',
            # Expansions
            r'\bsmall[- ]signal\b', r'\bac emitter resistance\b', r'\br_e\b', r'\bpush[- ]pull\b',
            r'\bac compliance\b', r'\bcompliance of (?:the |an )?amplifier\b', r'\bdetermine the compliance\b',
            r'\btransistor compliance\b', r'\boutput compliance\b', r'\bmaximum unclipped peak-to-peak\b'
        ],
        'ELECS-4.3': [  # Diode Equivalent Circuits
            r'\bdiode equivalent circuit\b', r'\bideal diode model\b', r'\bbarrier potential\b',
            r'\bforward resistance\b', r'\breverse saturation current\b', r'\bshockley (?:diode )?equation\b',
            r'\bpn junction\b', r'\bp-n junction\b', r'\bdepletion region\b', r'\bbuilt-in potential\b',
            r'\bforward bias\b', r'\breverse bias\b', r'\bdiode characteristics\b', r'\bdiodes?\b',
            # Expansions
            r'\bpn[- ]junction\b', r'\bdepletion layer\b', r'\bjunction barrier\b',
            r'\bsemi-conductor behaves as\b', r'\bat absolute zero.*semi-conductor\b',
            r'\bconduction band\b', r'\bvalence band\b', r'\be_?g for silicon\b',
            r'\benergy gap\b', r'\bmajority carriers?\b', r'\bminority carriers?\b',
            r'\bn-type semiconductor\b', r'\bp-type semiconductor\b',
            # Superconductivity — critical / transition temperature
            r'\bsuperconducting\b', r'\bsuperconductivit\w+\b', r'\bcritical temperature\b',
            r'\btransition temperature\b', r'\btemperature below which a material becomes superconducting\b',
            # Direct bandgap semiconductors (GaAs), SRH recombination, heterojunction, quantum well
            r'\bdirect bandgap\b', r'\bindirect bandgap\b', r'\bgaas\b',
            r'\brecombination of electron[- ]hole pairs?\b', r'\belectron[- ]hole recombination\b',
            r'\bshockley[- ]read[- ]hall\b', r'\bsrh recombination\b',
            r'\bheterojunction\b', r'\bquantum well\b', r'\bband gap engineering\b',
            # Thin film deposition / semiconductor processing
            r'\bplasma deposition\b', r'\bthin film\b', r'\bsputtering\b',
            r'\bchemical vapor deposition\b', r'\bcvd\b'
        ],

        'ELECS-4.4': [  # Voltage Multipliers, Power Supply, Voltage Regulation
            r'\brectifiers?\b', r'\bhalf-wave rectif\w*', r'\bfull-wave rectif\w*', r'\bbridge rectifier\b',
            r'\bvoltage multiplier\b', r'\bvoltage doubler\b', r'\bvoltage tripler\b', r'\bvoltage quadrupler\b',
            r'\bripple factor\b', r'\bripple voltage\b', r'\bvoltage regulat\w*',
            r'\bpower supply circuit\b', r'\bline regulation\b', r'\bload regulation\b',
            r'\bfilter capacitor\b', r'\bchoke input filter\b', r'\bpi filter\b', r'\b78xx\b', r'\b79xx\b', r'\blm317\b',
            # Expansions
            r'\bswitching regulators?\b', r'\blinear regulators?\b', r'\bswitch-mode power supply\b',
            r'\bsmps\b', r'\bbuck converter\b', r'\bboost converter\b', r'\bbuck-boost\b',
            r'\bstep[- ]up to \d+.*v at \d+.*a\b', r'\bswitching frequency\b', r'\bduty cycle of a boost\b',
            r'\bduty cycle of a buck\b', r'\blinear vs switching\b', r'\blinear regulator differs?\b'
        ],
        'ELECS-4.5': [  # Bipolar Junction Transistor and FET
            r'\bbjts?\b', r'\bbipolar junction transistors?\b', r'\btransistor(?:s)?\b',
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
            r'\bhighest gain provided by\b', r'\bhigher gain provided by\b',
            r'\bmagnetron\b', r'\bklystron\b', r'\btwt\b',
            # Expansions
            r'\bquiescent\b', r'\bvalence shell\b', r'\border of the thickness\b', r'\bdrain-source\b',
            r'\bI_?\{?DSS\}?\b', r'\bV_?\{?DS\}?\b', r'\bV_?\{?GS(?:\(off\))?\}?\b', r'\bI_?\{?D\}?\b',
            r'\bV_?\{?GS\}?\b', r'\bv_\{gs\}\b', r'\bi_\{dss\}\b', r'\bv_\{ds\}\b',
            r'\bpinch[- ]off voltage\b', r'\btransconductance curve\b', r'\bshockley equation for fet\b'
        ],

        # 5.0 Electronic Circuit Analysis and Design
        'ELECS-5.1': [  # BJT and FET Frequency Response
            r'\bfrequency response of (?:a |an )?(?:bjt|fet|amplifier)\b', r'\bcutoff frequency of (?:a |an )?amplifier\b',
            r'\bmiller effect\b', r'\bhigh[- ]frequency response\b', r'\blow[- ]frequency response\b', r'\bbode plot\b',
            # Expansions
            r'\bbode diagram\b', r'\bmagnitude plot of a bode\b', r'\bmiller capacitance\b',
            r'\boctaves? and decades?\b', r'\b-20 db/decade\b', r'\b-3 db frequency\b',
            r'\bgain-bandwidth product\b', r'\bdecade in a direct frequency\b',
            r'\battenuators?\b', r'\battenuation\b', r'\breduces signal power by a factor\b',
            r'\bloss expressed in db\b', r'\bdbw\b', r'\bdbm\b', r'\boutput power in dbw\b',
            r'\bpower in dbw, and in dbm\b', r'\binsertion loss\b',
            # Decibel / logarithmic unit for power-voltage ratio in frequency response
            r'\bdecibels?\b', r'\blogarithmic unit\b', r'\bratio of two values of power or voltage\b',
            r'\bfrequency response of an amplifier\b', r'\bamplifier frequency response\b'
        ],
        'ELECS-5.2': [  # Cascade and Cascode Connections
            r'\bcascode amplifier\b', r'\bcascaded amplifier\b', r'\bdarlington pair\b', r'\bmultistage amplifier\b',
            r'\bgain of the circuit\b', r'\bvoltage gain of the circuit\b', r'\bpower gain of the circuit\b',
            # 2-stage cascade amplifier analysis / bandwidth shrinkage
            r'\bcascade amplifier\b', r'\b2-stage cascade\b', r'\btwo[- ]stage cascade\b',
            r'\bav1\b', r'\bav2\b', r'\bgains of av\b',
            r'\bhigh gain at low frequenc\w+ but.*roll[- ]off\b',
            r'\bbandwidth.*shrinks?\b', r'\bpeaking component\b', r'\bseries.*shunt.*peaking\b'
        ],

        'ELECS-5.3': [  # Current Mirrors and Current Sources
            r'\bcurrent mirror\b', r'\bwidlar current source\b', r'\bwilson current mirror\b',
            r'\bactive load\b', r'\bconstant current source\b'
        ],
        'ELECS-5.4': [  # Differential and Operational Amplifiers
            r'\bop-amps?\b', r'\boperational amplifier\b', r'\bdifferential amplifier\b',
            r'\bcmrr\b', r'\bvirtual ground\b', r'\binverting amplifier\b', r'\bnon-inverting amplifier\b',
            r'\bsumming amplifier\b', r'\binstrumentation amplifier\b', r'\bslew rate\b',
            # Amplifier gain calculation (Av, A'v) from input/output voltages
            r'\bamplifier has an output signal of\b', r'\bwhat is a\'?v\b', r'\bvoltage gain a\'?v\b',
            r'\boutput signal of.*v for an input of\b', r'\bvoltage gain.*input.*output\b'
        ],

        'ELECS-5.5': [  # Feedback Systems, Oscillators, and Filters
            r'\boscillator circuit\b', r'\bbarkhausen criterion\b', r'\bwien bridge oscillator\b',
            r'\brc phase shift oscillator\b', r'\bcolpitts oscillator\b', r'\bhartley oscillator\b',
            r'\bactive filter\b', r'\bbutterworth filter\b', r'\bchebyshev filter\b', r'\bnegative feedback amplifier\b',
            r'\bnegative feedback\b', r'\bfeedback factor\b', r'\bopen[- ]loop gain\b',
            # Expansions
            r'\bpositive feedback.*oscillator\b', r'\bpositive feedback is essential\b',
            r'\blc oscillator\b', r'\bcrystal oscillator\b', r'\bpass filter\b',
            r'\blow-pass filter\b', r'\bhigh-pass filter\b', r'\bband-pass filter\b',
            r'\bnarrow channel centered at\b', r'\bfilter for a comms system\b',
            r'\bvoltage-series feedback\b', r'\bcurrent-series feedback\b',
            r'\bvoltage-shunt feedback\b', r'\bcurrent-shunt feedback\b',
            r'\bfeedback amplifier\b', r'\bseries-shunt feedback\b', r'\bshunt-series feedback\b'
        ],

        # 6.0 Electronic Systems and Design (also shared with EST-5.0)
        'ELECS-6.1': [  # SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors
            r'\bthyristors?\b', r'\bscr\b', r'\btriac\b', r'\bdiac\b', r'\bujt\b',
            r'\bput\b', r'\bfiring angle\b', r'\brelaxation oscillator\b',
            # Expansions
            r'\bscs\b', r'\bsilicon controlled switch\b', r'\bturn scs off\b',
            # Inverter / power electronics
            r'\bprimary function of an inverter\b', r'\bfunction of an? inverter\b',
            r'\binverters? (?:in|for) power\b', r'\bdc-to-ac\b', r'\bdc to ac conversion\b'
        ],

        'ELECS-6.2': [  # Optoelectronic Devices and Sensors
            r'\boptoelectronics?\b', r'\boptocouplers?\b', r'\bphototransistors?\b', r'\bldrs?\b',
            r'\bphotoresistors?\b', r'\bsolar cell\b'
        ],
        'ELECS-6.3': [  # Transducers, Data Acquisition, and Interfacing
            r'\btransducers?\b', r'\bdata acquisition\b', r'\bdaq\b', r'\blvdts?\b',
            r'\bthermocouples?\b', r'\brtds?\b', r'\bstrain gauge\b', r'\bpiezoelectrics?\b',
            # Expansions
            r'\bflash adc\b', r'\bcomparators? required.*flash adc\b', r'\banalog-to-digital converter\b',
            r'\bdigital-to-analog converter\b', r'\bsample and hold\b', r'\bsensors?\b',
            # Renewable energy / grid integration (solar panels into AC grid)
            r'\brenewable energy sources?\b', r'\bsolar panels?.*ac grid\b', r'\bintegrating.*solar panels?\b',
            r'\bac grid.*solar\b', r'\bgrid integration\b', r'\brenewable.*grid\b'
        ],

        'ELECS-6.4': [  # Programmable Logic Controllers
            r'\bplc\b', r'\bprogrammable logic controller\b', r'\bladder logic\b', r'\bladder diagram\b', r'\brungs?\b'
        ],
        'ELECS-6.5': [  # Building Management Systems and HVAC Controls
            r'\bbms\b', r'\bhvac\b', r'\bbuilding management system\b', r'\bbuilding automation\b',
            # Expansions
            r'\bcentralized control of av and lighting\b', r'\blighting systems?\b',
            r'\blighting control\b', r'\bdmx\b', r'\bdmx512\b', r'\bknx\b',
            r'\bav integration\b', r'\btheater lighting\b',
            r'\bbuilding with solar panels\b', r'\benergy management systems?\b', r'\bbems\b',
            r'\blocal grid.*solar panels\b', r'\bsmart contract.*blockchain\b'
        ],
        'ELECS-6.6': [  # Security, Safety, and Surveillance Systems
            r'\bcctv\b', r'\bfire alarm\b', r'\bfire and life safety\b', r'\bsurveillance system\b',
            r'\bburglar alarm\b', r'\baccess control system\b',
            # Expansions
            r'\bdata centers?\b', r'\bserver rooms?\b', r'\bbiometric logging\b', r'\bdual authentication\b',
            r'\bserver room entry\b', r'\baccess control\b', r'\bsmart contract.*blockchain\b',
            r'\bmagnetic locks?\b', r'\bmaglocks?\b', r'\bhigh-security doors?\b', r'\belectric strikes?\b'
        ],

        # 7.0 Logic Circuits and Switching Theory
        'ELECS-7.1': [  # Boolean Algebra and Logic Gates
            r'\bboolean algebra\b', r'\bboolean expression\b', r'\bboolean function\b',
            r'\blogic gate\b', r'\band gate\b', r'\bor gate\b',
            r'\bxor gate\b', r'\bxnor gate\b', r'\bnand gate\b', r'\bnor gate\b', r'\btruth table\b', r'\bde morgan\'?s\b',
            r'\bfull adder\b', r'\bhalf adder\b', r'\bcombinational logic\b',
            r'\bsum[- ]of[- ]products\b', r'\bproduct[- ]of[- ]sums\b', r'\bsop\b', r'\bpos\b',
            # Expansions
            r'\bcombinational circuit\b', r'\bdistinct boolean expressions\b',
            r'\bmajority gate\b', r'\bconsensus theorem\b', r'\babsorption theorem\b',
            r'\bsimplify f\s*=\s*\b', r'\bf\s*=\s*ab\b', r'\bminterms? grouped\b',
            r'\bpropagation delay of \d+\s*ns\b',
            # 74xx IC family and digital circuit output problems
            r'\b74xx\b', r'\b74[ls]?s?\d+\b', r'\bdigital circuit to output (?:low|high)\b',
            r'\bdigital circuit.*output.*only when\b', r'\bimplement this function with minimal gates\b',
            r'\bsum.*carry.*cin\b', r'\bcin\s*=\s*\d\b', r'\bcout\b',
            # ECL / emitter-coupled logic family
            r'\becl logic\b', r'\bemitter-coupled logic\b', r'\badvantage of ecl\b',
            # Full-adder / half-adder carry-sum problems
            r'\bfull[- ]adder\b', r'\bhalf[- ]adder\b', r'\bsum.*and.*carry\b'
        ],
        'ELECS-7.2': [  # Minimization of Combinational Logic Circuits
            r'\bk-maps?\b', r'\bkarnaugh map\b', r'\blogic minimization\b', r'\bdon\'?t care condition\b',
            r'\bquine-mccluskeys?\b', r'\bdecoders?\b', r'\bencoders?\b', r'\bmultiplexers?\b', r'\bdemultiplexers?\b',
            r'\bmux\b', r'\bdemux\b', r'\bline decoders?\b', r'\b3-to-8\b', r'\b4-to-16\b', r'\bcascading decoders?\b',
            r'\bsequential logic system\b', r'\bsequential circuits?\b',
            # Expansions
            r'\boverlapping groups in karnaugh\b', r'\bminimized form\b', r'\bminimized expression\b',
            r'\b4-variable function\b', r'\bgrouping in k-map\b'
        ],
        'ELECS-7.3': [  # Sequential Logic Circuits
            r'\bflip-flops?\b', r'\blatch circuit\b', r'\bsr flip-flop\b', r'\bjk flip-flop\b',
            r'\bd flip-flop\b', r'\bt flip-flop\b', r'\bshift register\b', r'\bripple counter\b', r'\bsynchronous counter\b',
            r'\basynchronous counter\b', r'\bshift registers?\b', r'\bshift a complete binary number\b',
            # Johnson / twisted-ring counter and binary state after N clock pulses
            r'\bjohnson counter\b', r'\btwisted[- ]ring counter\b', r'\binitialized to state 0+\b',
            r'\bbinary state.*after \d+ clock pulses?\b', r'\bclock pulses?\b',
            # Fractional binary conversion (radix point)
            r'\bradix point\b', r'\bfractional decimal.*into binary\b', r'\bconverting.*fractional decimal\b',
            r'\bbits following the radix point\b'
        ],
        'ELECS-7.4': [  # Algorithmic State Machine (ASM)
            r'\basm chart\b', r'\balgorithmic state machine\b', r'\bstate diagram\b', r'\bmealy machine\b', r'\bmoore machine\b'
        ],
        'ELECS-7.5': [  # Asynchronous Sequential Logic
            r'\basynchronous sequential (?:logic|circuit)\b', r'\btiming hazard\b', r'\brace condition\b', r'\bflow table\b',
            r'\bvhdl\b', r'\bverilog\b',
            # Expansions
            r'\bstatic hazard\b', r'\bstatic-1 hazard\b', r'\bstatic-0 hazard\b', r'\bdynamic hazard\b',
            r'\beliminate the static\b',
            # Asynchronous circuits use cases
            r'\basynchronous circuits? (?:are )?useful\b', r'\basynchronous circuits?\b',
            r'\binput signals? may (arrive|change|be)\b'
        ],


        # 8.0 Microprocessor and Microcontroller Systems
        'ELECS-8.1': [  # Microprocessor Unit
            r'\bmicroprocessors?\b', r'\bcentral processing unit\b', r'\bcpu\b', r'\balu\b', r'\bprogram counter\b',
            r'\bstack pointer\b', r'\bstack data structure\b', r'\b8086\b', r'\bfetch-decode-executes?\b', r'\bregister array\b',
            r'\bpush.*the stack\b', r'\bpop.*the stack\b', r'\bmachine level programming\b',
            # Expansions
            r'\bcondition flags?\b', r'\bflag register\b', r'\btrap flag\b', r'\bparity flag\b',
            r'\bauxiliary carry flag\b', r'\bzero flag\b', r'\bsign flag\b', r'\baddress bus\b',
            r'\bdata bus\b', r'\bcontrol bus\b', r'\b8085\b', r'\baccumulator\b'
        ],
        'ELECS-8.2': [  # Memory Subsystem
            r'\bram\b', r'\brom\b', r'\bsram\b', r'\bdram\b', r'\beeprom\b',
            r'\bflash memory\b', r'\bmemory subsystem\b', r'\bcache memory\b',
            # Expansions
            r'\bmemory hierarchy\b', r'\blowest access time\b', r'\bmemory module\b',
            r'\baccess time\b', r'\bmemory bandwidth\b'
        ],
        'ELECS-8.3': [  # I/O Subsystem
            r'\bi/o subsystem\b', r'\binterrupt handling\b', r'\bdma\b', r'\bmemory-mapped i/o\b', r'\bserial i/o interface\b',
            r'\bspi protocol\b', r'\bi2c protocol\b', r'\bspi\b', r'\bi2c\b', r'\bi²c\b',
            # Expansions
            r'\bnon-vectored input\b', r'\bvectored interrupts?\b', r'\brst 7\.5\b', r'\brst 6\.5\b',
            r'\brst 5\.5\b', r'\btrap interrupt\b', r'\bintr\b', r'\binterrupt signal\b',
            # RIM register / RST7.5 interrupt status bits (8085 microprocessor)
            r'\brim output\b', r'\brim register\b', r'\brim instruction\b',
            r'\bstatus of rst7\.?5\b', r'\binterrupt request\b', r'\binterrupt mask\b'
        ],
        'ELECS-8.4': [  # Instruction Set Architecture, Assembly Programming and Programming Concepts
            r'\bassembly language\b', r'\binstruction set\b', r'\baddressing mode\b',
            r'\bopcodes?\b', r'\bmnemonics?\b', r'\bsubroutines?\b',
            r'\bdata copy\b', r'\bdata transfer instruction\b', r'\bassembler to begin memory allocation\b',
            # Programming concepts (C/Python/general) — map to microprocessors under ELECS
            r'\bprogramming concept\b', r'\bc language\b', r'\bc programming\b', r'\bpython programming\b',
            r'\bpseudocode\b', r'\bflowchart\b', r'\bflowcharting\b', r'\balgorithm\b',
            r'\bsource code\b', r'\bobject code\b', r'\bcompiler\b', r'\binterpreter\b',
            r'\bhigh[- ]level language\b', r'\blow[- ]level language\b', r'\bmachine language\b',
            r'\bif[- ]else\b', r'\bwhile loop\b', r'\bfor loop\b', r'\bdo[- ]while\b',
            r'\bfunction call\b', r'\brecursion\b', r'\bstack frame\b', r'\bprogram flow\b',
            r'\bvariable declaration\b', r'\bdata type\b', r'\barray indexing\b', r'\bpointers?\b'
        ],
        'ELECS-8.5': [  # Microcontrollers
            r'\bmicrocontrollers?\b', r'\b8051\b', r'\bpic microcontroller\b', r'\bavr\b', r'\barduino\b', r'\bon-chip peripheral\b',
            r'\bwatchdog timer\b',
            r'\bpwm\b', r'\bpulse width modulation\b', r'\bgpio\b', r'\bgeneral purpose i/o\b',
            r'\bdigital pins?\b', r'\banalog pins?\b', r'\bmicrocontroller component\b',
            r'\bmicrocontroller peripheral\b', r'\btimer/counter\b', r'\bcapture/compare\b',
            r'\batmega\d*\b', r'\battiny\d*\b', r'\besp32\b', r'\besp8266\b', r'\bstm32\b'
        ],

        # 9.0 Feedback and Control Systems (also shared with MATH-8.0)
        'ELECS-9.1': [  # Block Diagram and Signal Flow Graphs
            r'\bblock diagram reduction\b', r'\bsignal flow graphs?\b', r'\bmason\'?s (?:gain )?(?:rule|formula)\b', r'\bforward path\b',
            r'\bopen[- ]loop system\b', r'\bclosed[- ]loop system\b', r'\bfeedback control system\b',
            # Expansions
            r'\bnon touching loops\b', r'\btouching loops\b', r'\boutgoing branches\b',
            r'\binput node\b', r'\boutput node\b', r'\bforward paths?\b', r'\bsfg\b',
            r'\bnon-touching loops?\b', r'\bloop gain in a signal flow\b'
        ],
        'ELECS-9.2': [  # LTI Systems and Transient Analysis
            r'\bltis?\b', r'\blinear time-invariant\b', r'\btransient analysis of (?:a )?control system\b',
            r'\bstep response\b', r'\bimpulse response of a system\b',
            r'\bdamping ratio\b', r'damping ratio ζ', r'\bzeta\b', r'\bsecond[- ]order system\b',
            r'\bunderdamped\b', r'\boverdamped\b', r'\bcritically damped\b', r'\bundamped\b',
            r'\btransient response\b', r'\bnatural frequency\b', r'\bsettling time\b', r'\brise time\b',
            r'\bpercent overshoot\b', r'\bmaximum overshoot\b',
            # H(z) poles stability / z-domain LTI
            r'\bpoles of h\(z\)\b', r'\bpoles.*outside the unit circle\b',
            r'\bunit circle.*stability\b', r'\bsystem is said to be\b'
        ],

        'ELECS-9.3': [  # System Modeling and Transfer Function
            r'\bsystem modeling\b', r'\btransfer function\b', r'\bopen[- ]loop transfer\b', r'\bclosed[- ]loop transfer\b',
            # Expansions
            r'\bcontrol systems?\b', r'\bopen[- ]loop control\b', r'\bclosed[- ]loop control\b',
            r'\bfeature of a good control system\b', r'\bfeature of a modern control system\b',
            r'\bwhat is control system\b', r'\bsensitivity of (?:the )?gain\b',
            r'\bfinal control element\b', r'\bautomatic control system\b',
            r'\bdeterministic control system\b', r'\bstochastic control system\b',
            # Servomotors (DC/AC) — electrical time constant
            r'\bservomotors?\b', r'\bdc servomotors?\b', r'\barmature[- ]controlled\b',
            r'\belectrical time[- ]constant.*servomotor\b', r'\bmechanical time[- ]constant\b'
        ],

        'ELECS-9.4': [  # Poles, Zeros, Root Locus, and Stability Analysis
            r'\broot locus\b', r'\brouth stability\b', r'\bgain margin\b', r'\bphase margin\b', r'\bnyquist criterion\b',
            r'\bpoles? and zeros?\b', r'\bcharacteristic equation\b', r'\bs-plane\b', r'\bstrictly stable\b',
            r'\brouth[- ]hurwitz\b',
            # Finite state machine design methods
            r'\bfinite state machines?\b', r'\bfsm\b', r'\bmethod for designing finite state\b',
            r'\bdesigning finite state machines?\b'
        ],

        'ELECS-9.5': [  # Steady State Analysis and Frequency Response
            r'\bsteady state error\b', r'\bsteady-state error\b', r'\berror constant\b', r'\bpid controller\b', r'\blead-lag compensator\b',
            r'\bfrequency response of a (?:control )?system\b', r'\btype 0\b', r'\btype 1\b', r'\btype 2\b',
            r'\bnyquist plot of the loop transfer function\b', r'\bencloses\b',
            # Expansions
            r'\bpd controller\b', r'\bpi controller\b', r'\bcompensator\b', r'\bcompensated system\b'
        ]
    },

    'GEAS': {
        # 1.0 Chemistry for Engineers
        'GEAS-1.1': [ r'\bthermochemistry\b', r'\bheat of reaction\b',
            r'\bcalorimetry\b', r'\bexothermic\b', r'\bendothermic\b', r'\benthalp(?:y|ies)\b', r'\bhess\'?s law\b',
            r'\bheat capacity\b', r'\bbomb calorimeter\b', r'\bstandard enthalpy\b', r'\bheat of formation\b',
            r'\bheat of combustion\b', r'\blaughing gas\b', r'\bnitrous oxide\b', r'\bn2o\b', r'\banesthetics?\b' ],

        'GEAS-1.2': [ r'\bionic bond\b', r'\bcovalent bond\b', r'\bmetallic bond\b', r'\bcorrosion\b', r'\boxidation\b',
            r'\breduction reaction\b', r'\bredoxs?\b', r'\belectrochemistry\b', r'\bgalvanic cell\b',
            r'\bvoltaic cell\b', r'\belectrolytic cell\b', r'\bcathode\b', r'\banode\b', r'\belectrolysis\b',
            r'\bacids? and bases?\b', r'\bph (?:value|level|of)\b', r'\bph between\b', r'\barrhenius\b',
            r'\bbr[oö]nsted[- ]lowry\b', r'\blewis acid\b', r'\blewis base\b', r'\bbuffer solution\b', r'\bmolarity\b',
            r'\bmolality\b', r'\bnormality\b', r'\bstoichiometry\b', r'\bavogadro\b', r'\bchemical equation\b',
            r'\brust(?:ing)?\b', r'\bpassivation\b', r'\belectrode potential\b',
            # Water hardness / mineral ions
            r'\bhardness of water\b', r'\bions.*hardness\b', r'\bwater hardness\b',
            r'\bcalcium.*magnesium.*ions\b', r'\bca2\+\b', r'\bmg2\+\b' ],


        'GEAS-1.3': [ r'\bnanomaterials?\b', r'\bnanotechnolog(?:y|ies)\b', r'\bgraphenes?\b', r'\bcarbon nanotube\b',
            r'\bfullerenes?\b', r'\bbuckyball\b', r'\bquantum dots?\b', r'\bnanoparticles?\b', r'\bnanowires?\b',
            r'\bnanoscale\b', r'\bsurface-to-volume ratio\b',
            # Gas laws — often misplaced into GEAS-1 family
            r'\bgas sample\b', r'\bcharles\'?s? law\b', r'\bboyle\'?s? law\b',
            r'\bideal gas\b', r'\bpv\s*=\s*nrt\b', r'\bideal gas law\b', r'\bgas law\b',
            r'\bgay-lussac\'?s? law\b', r'\bavogadro\'?s? law\b', r'\batmosphere pressure\b',
            r'\bmoles? of gas\b', r'\bmolar mass\b', r'\bmol\b', r'\bunknown gas\b', r'\bgas occupies\b',
            r'\bgas confined\b', r'\batm\b' ],

        'GEAS-1.4': [ r'\bgreen chemistry\b', r'\bacid rain\b', r'\bgreenhouse gas\b', r'\bwater chemistry\b',
            r'\bocean acidification\b', r'\bchemical pollutants?\b', r'\bcfcs?\b', r'\bchlorofluorocarbons?\b',
            r'\bvolatile organic\b', r'\bvocs?\b', r'\bheavy metal contamination\b',
            # Fuel properties: flash point, calorific value, coal types
            r'\bflash point\b', r'\bfire point\b', r'\bauto-ignition\b', r'\boctane number\b',
            r'\bcalorific value\b', r'\bhighest calorific value\b', r'\bcarbon neutral\b',
            r'\banthracite\b', r'\bbituminous\b', r'\bcoal.*rank\b', r'\bcoal.*carbon content\b',
            r'\bhighest carbon content\b', r'\bwhich type of coal\b', r'\bcoal liquefaction\b',
            r'\bbiogas\b', r'\bbiomass\b', r'\bfossil fuels?\b',
            # Industrial chemistry / steel production
            r'\bostwald process\b', r'\bpig iron into steel\b', r'\bconverting pig iron\b',
            r'\bblast furnace\b', r'\bsteel production\b', r'\bsmelting\b',
            # GHS / hazardous chemical labels
            r'\bghs[- ]compliant\b', r'\bglobally harmonized system\b', r'\bchemical label\b',
            r'\bhazardous chemical\b', r'\bsafety data sheet\b' ],


        # 2.0 Physics for Engineers
        'GEAS-2.1': [ r'\bwork-energy theorem\b', r'\bkinetic energy\b',
            r'\bpotential energy\b', r'\bmechanical power\b', r'\bconservation of (?:mechanical )?energy\b',
            r'\bconservative force\b', r'\bnon[- ]conservative force\b', r'\bpath[- ]independent\b',
            r'\bindependent of the path\b', r'\bwork done on (?:a )?particle\b', r'\bwork done by (?:a |the )?force\b',
            r'\bgravitational potential energy\b', r'\bmechanical energy\b', r'\bpower developed by\b',
            r'\bpower delivered by\b',
            # Collision / momentum — frequently untagged
            r'\bcollides?\b', r'\bcollision\b', r'\bsticks? to\b', r'\bcommon velocity\b',
            r'\bsticks? together\b', r'\bperfectly inelastic\b',
            r'\bsame unit as work\b', r'\bunit as work\b', r'\bunit of work\b', r'\bwork is measured in\b' ],

        'GEAS-2.2': [ r'\bimpulse-momentums?\b', r'\bconservation of momentum\b', r'\belastic collision\b',
            r'\binelastic collision\b', r'\bcoefficient of restitution\b', r'\blinear momentum\b',
            r'\bmomentum of (?:a |the )?\w+\b', r'\bchange in momentum\b', r'\bunit (?:for|of) (?:linear )?momentum\b',
            r'\bkilogram-meter per second\b', r'\bkg[·\.]m/s\b', r'\bimpulse on\b', r'\bcenter of mass\b',
            r'\bstraight line under a (?:time[- ]varying )?force\b', r'\brolls down an? incline\b', r'\bkinematics\b' ],

        'GEAS-2.3': [ r'\bkinematics\b', r'\bprojectile motion\b', r'\brectilinear motion\b', r'\bfree[- ]fall\b',
            r'\buniformly accelerated (?:motion|rectilinear)\b', r'\btrajectory of (?:a )?projectile\b',
            r'\bmaximum height reached\b', r'\brange of (?:a |the )?projectile\b', r'\btime of flight\b',
            r'\bhorizontal range\b', r'\bdisplacement of (?:a |the )?particle\b', r'\bconstant acceleration\b',
            # Projectile angle / parabolic trajectory / vertical velocity at apex
            r'\bparabolic trajectory\b', r'\blaunched at an angle of\b', r'\bfired at an angle\b',
            r'\bvertical velocity.*highest point\b', r'\bvertical velocity.*top of\b',
            r'\bhighest point of its (?:parabolic )?trajectory\b', r'\bangle of \d+ degrees? relative to the horizontal\b',
            r'\bangle of \d+°\s*(?:from|to|above|relative to)?\s*(?:the )?horizontal\b' ],


        'GEAS-2.4': [ r'\bnewton\'?s (?:first|second|third)? ?laws? of motion\b', r'\bcoefficient of friction\b',
            r'\bnormal force\b', r'\bcentripetal force\b', r'\bfree body diagram\b',
            r'\bcoefficient of static friction\b', r'\bcoefficient of kinetic friction\b',
            r'\bbanked (?:circular )?curve\b', r'\bbanking angle\b', r'\bideal banking\b',
            r'\bcentripetal acceleration\b', r'\bterminal velocity\b', r'\bdrag force\b', r'\bair resistance\b',
            r'\bwithout relying on friction\b', r'\btension in (?:the )?cable\b', r'\btension in (?:the )?rope\b',
            r'\bnet force acting\b' ],

        'GEAS-2.5': [ r'\btorques?\b', r'\bmoment of inertia\b', r'\bangular momentum\b', r'\brotational motion\b',
            r'\bangular velocity\b', r'\bangular acceleration\b', r'\brotational kinetic energy\b',
            r'\bparallel axis theorem\b', r'\bradius of gyration\b', r'\brolling without slipping\b',
            r'\brotates at \d+.*rad/s\b', r'\blinear speed of a point on its rim\b' ],

        'GEAS-2.6': [ r'\bhooke\'?s law\b', r'\byoung\'?s modulus\b', r'\bshear modulus\b', r'\bbulk modulus\b',
            r'\belastic (?:limit|deformation)\b', r'\bmodulus of elasticity\b', r'\bproportional limit\b',
            r'\btensile stress\b', r'\bcompressive stress\b', r'\belongation of (?:the )?wire\b' ],

        'GEAS-2.7': [ r'\bsimple harmonic motion\b', r'\bshm\b', r'\bpendulums?\b', r'\bwave speed\b', r'\bsound wave\b',
            r'\bdoppler effect\b', r'\bmass-spring system\b', r'\bspring constant\b', r'\bstiffness of the spring\b',
            r'\bperiod of oscillation\b', r'\bfrequency of oscillation\b', r'\bstanding waves?\b',
            r'\btraveling waves?\b', r'\blongitudinal waves?\b', r'\btransverse waves?\b', r'\bwave superposition\b',
            r'\bnodes? and antinodes?\b', r'\bantinodes?\b', r'\bwave interference\b',
            # Wave/superposition keyword expansions
            r'\bdisplacements? add up\b', r'\btwo waves meet\b', r'\bwaves? meet and their displacements?\b',
            r'\brequires? a medium to propagate\b', r'\bneeds? a medium\b', r'\bmedium to propagate\b',
            r'\bmechanical waves?\b', r'\bphenomenon.*called.*when two waves\b' ],

        'GEAS-2.8': [ r'\bbuoyancy\b', r'\barchimedes\'? principle\b', r'\bpascal\'?s principle\b',
            r'\bbernoulli\'?s (?:principle|equation)\b', r'\bfluid statics\b', r'\bfluid pressure\b',
            r'\bcontinuity equation\b', r'\bhydraulic press\b', r'\bheight of mercury\b', r'\bmercury column\b',
            r'\bgauge pressure\b', r'\babsolute pressure\b', r'\bspecific gravity\b', r'\bdensity of (?:the )?fluid\b',
            r'\bviscosit(?:y|ies)\b', r'\blaminar flow\b', r'\bturbulent flow\b' ],

        'GEAS-2.9': [ r'\bheat transfer\b', r'\bconduction\b', r'\bconvection\b', r'\bradiation heat transfer\b',
            r'\bspecific heat\b', r'\blatent heat\b', r'\bthermal conductivity\b', r'\bthermal expansion\b',
            r'\blinear expansion\b', r'\bstefan-boltzmann\b', r'\bheat flow rate\b',
            # Calorimetry / thermal equilibrium problems
            r'\bthermal equilibrium\b', r'\bq\s*=\s*mc\b', r'\bspecific heat capacity\b',
            r'\bheat gained\b', r'\bheat lost\b', r'\binitial temperature\b', r'\bfinal temperature\b',
            r'\bdisk at \d+°c\b', r'\baluminum disk\b', r'\bplaced in.*alcohol\b', r'\bthermal energy\b' ],

        'GEAS-2.10': [ r'\bsnell\'?s law\b', r'\blaw of refraction\b', r'\blaw of reflection\b', r'\bconverging lens\b',
            r'\bconcave mirror\b', r'\bconvex mirror\b', r'\bcoulomb\'?s law\b', r'\belectrostatic force\b',
            r'\belectric field intensity\b', r'\bmagnetic field intensity\b', r'\bapparent depth\b',
            r'\bindex of refraction\b', r'\brefractive index\b', r'\bcritical angle\b', r'\btotal internal reflection\b',
            r'\bglass prism\b', r'\btriangular prism\b', r'\bdispersion of light\b', r'\bwhite light\b',
            r'\bcomponent colors\b', r'\bfocal length\b', r'\bmirror equation\b', r'\blens equation\b',
            r'\belectric potential\b', r'\bpotential difference\b', r'\belectric charges?\b', r'\bpoint charges?\b',
            r'\bequivalent resistance\b', r'\bresistors? in series\b', r'\bresistors? in parallel\b',
            r'\bequivalent capacitance\b', r'\bcapacitors? in series\b', r'\bcapacitors? in parallel\b',
            r'\bdielectric constant\b', r'\bohm\'?s law\b', r'\bbar magnet\b', r'\bmagnetic poles?\b', r'\bnorth pole\b',
            r'\bsouth pole\b', r'\bmagnetic field lines?\b',
            # Plane mirror / image characteristics
            r'\bplane mirror\b', r'\bimage formed by a.*mirror\b', r'\bcharacteristic of the image\b',
            r'\bimage.*plane mirror\b', r'\bvirtual image\b', r'\bvirtual and upright\b',

            # Optics/light keywords frequently untagged
            r'\bmagnification\b', r'\bimage height\b', r'\bobject height\b', r'\blinear magnification\b',
            r'\boptical system\b', r'\boptic\w+ magnif\w+\b', r'\blens combination\b',
            r'\bimage of (?:the )?first lens\b', r'\bspectrum\b', r'\bwavelength\b',
            r'\bvisible light\b', r'\belectromagnetic spectrum\b', r'\bmonochromatic\b',
            # Light passing between media (Snell's law in plain English)
            r'\blight passes from air\b', r'\bair.*into water\b', r'\bpasses from.*n\s*=\s*1\b',
            r'\bpolarizer\b', r'\bunpolarized light\b', r'\bpolarized light\b',
            r'\bfraction of its intensity\b', r'\bintensity.*through a polarizer\b',
            # Charged glass rod / electrostatics equilibrium
            r'\bcharged glass rod\b', r'\bglass rod near\b',
            r'\bcharge q.*center.*two equal charges\b', r'\bequal charges.*equilibrium\b',
            r'\bcharge.*placed at the center of the line joining\b' ],

        # 3.0 Engineering Economics
        'GEAS-3.1': [ r'\bsimple interest\b', r'\bnominal (?:interest )?rate\b',
            r'\beffective (?:interest )?rate\b', r'\btime value of money\b', r'\binterest rate\b', r'\binflation rate\b',
            r'\brate of return\b', r'\bcompounded quarterly\b', r'\beffective annual\b', r'\binvests?\s+.*?\s+annually\b',
            # Compound interest / deposits — very common in exam questions
            r'\bcompounds?\b', r'\bcompound interest\b', r'\bdeposits?\b', r'\bpays?\s+.*?%\b',
            r'\bmonthly deposit\b', r'\bends? of (?:each|every) month\b', r'\bbank pays\b',
            r'\bcompounded monthly\b', r'\bcompounded annually\b', r'\bcompounded semi-?annually\b',
            r'\binterest\b', r'\bper annum\b', r'\bp\s*\d+ (?:is|was) invested\b',
            r'\bcurrent ratio\b', r'\bquick ratio\b', r'\bacid[- ]test ratio\b',
            r'\bliquidity ratios?\b', r'\bbalance sheet\b', r'\bworking capital\b' ],

        'GEAS-3.2': [ r'\bannuit(?:y|ies)\b', r'\bdeferred annuity\b', r'\bperpetuit(?:y|ies)\b',
            r'\bcash flow diagram\b', r'\bgradient series\b', r'\bcompound interest\b', r'\beconomic equivalence\b',
            r'\bsinking fund\b', r'\bcapital recovery\b', r'\buniform series\b' ],

        'GEAS-3.3': [ r'\bpresent worth\b', r'\bfuture worth\b', r'\bannual worth\b', r'\brate of return\b',
            r'\binternal rate of return\b', r'\birr\b', r'\bbenefit-cost ratio\b', r'\bb/c ratio\b',
            r'\bpayback period\b', r'\bmutually exclusive projects?\b', r'\bmarr\b',
            r'\bminimum attractive rate of return\b', r'\bsensitivity analysis\b' ],

        'GEAS-3.4': [ r'\bbreak-even\b', r'\bbreak even\b', r'\bto break even\b',
            r'\bbreak-even (?:point|analysis|quantity|volume)\b', r'\bvariable costs?\b', r'\bfixed costs?\b',
            r'\baverage selling price\b', r'\bselling price (?:per|of)\b', r'\bproduction capacity\b',
            r'\bdepreciation\b', r'\bstraight[- ]line depreciation\b', r'\bdeclining balance\b', r'\bsum-of-the-years\b',
            r'\bsalvage value\b', r'\bcapitalized cost\b', r'\bbook value\b',
            # Engineering economics opportunity cost (phrase comes before comma in exam questions)
            r'\bopportunity cost\b', r'\bforfeited when one project\b', r'\bpotential financial benefit.*forfeited\b',
            r'\bin engineering economics,\b', r'\bengineering economics,\s+what\b',
            r'\bchosen over another\b', r'\balternative is chosen\b' ],


        'GEAS-3.5': [ r'\bdecision tree\b', r'\bexpected monetary value\b', r'\brisk analysis\b',
            r'\bprobabilistic risk\b', r'\brisk-averse\b', r'\brisk-seeking\b', r'\brisk-neutral\b',
            r'\brisk preference\b', r'\bexpected payoff\b', r'\bpayoff matrix\b',
            r'\bmacroeconomic\b', r'\breserve requirement\b', r'\bcommercial banks\b',
            # Triple Bottom Line (sustainability accounting) / inflation / purchasing power
            r'\btriple bottom line\b', r'\bsustainable businesses\b', r'\bthree critical dimensions\b',
            r'\bpurchasing power of money\b', r'\bcontinuous rise in the price level\b',
            r'\binflation.*price level\b', r'\brise in the price level.*purchasing power\b' ],


        'GEAS-3.6': [ r'\bmaximin criterion\b', r'\bmaximax criterion\b', r'\bminimax regret\b',
            r'\blaplace criterion\b', r'\bhurwicz criterion\b', r'\bdecisions? under uncertainty\b' ],

        # 4.0 Engineering Management
        'GEAS-4.1': [ r'\btaylor\'?s scientific management\b',
            r'\bfayol\'?s principles\b', r'\bhawthorne (?:effect|studies)\b', r'\bscientific management theory\b',
            r'\bmax weber\b', r'\bbureaucracy\b',
            r'\bengineering management\b', r'\bmanagement functions?\b',
            r'\bcontingency theory\b', r'\bmanagement theory\b', r'\bmanagement principle\w*\b',
            r'\btheory x\b', r'\btheory y\b',
            r'\bmanaging the marketing function\b', r'\bmarketing function\b',
            r'\bstandardized work procedures\b', r'\bstrategic decisions?\b',
            r'\bengineer.*wanting to become a manager\b', r'\bengineer enters management\b',
            r'\btype of leadership\b', r'\bleadership is characterized\b',
            r'\bleadership styles?\b', r'\bautocratic leader\b', r'\bdemocratic leader\b',
            r'\bboard of directors\b', r'\bdirector on a board\b' ],

        'GEAS-4.2': [ r'\bmanagerial role\b', r'\bconceptual skill\b', r'\btechnical skill\b',
            r'\bfunctions? of management\b', r'\bfunctions? of (?:an? )?engineer\b', r'\bdecision[- ]making\b',
            r'\bmaslow\'?s hierarchy\b', r'\bherzberg\'?s (?:two[- ]factor )?theory\b', r'\btwo[- ]factor theory\b',
            r'\bhygiene factors?\b', r'\bmotivator factors?\b', r'\bmotivation theory\b',
            r'\btheory x and (?:theory )?y\b', r'\bsmart criteria\b', r'\bgoal setting\b',
            r'\btop management directs\b', r'\bcorporate level\b', r'\bmanagement level\b',
            # Decision matrix / weighted score
            r'\bdecision matrix\b', r'\bweighted score\b', r'\bmanager assigns weights\b',
            r'\bassigns weights.*cost.*reliability\b', r'\bweighted.*score.*supplier\b' ],

        'GEAS-4.3': [ r'\bstrategic planning\b', r'\borganization(?:al)? structure\b', r'\bleadership style\b',
            r'\bcontrolling function\b', r'\borganizing function\b', r'\bplanning and organizing\b',
            r'\bplanning\b', r'\borganizing\b', r'\bleading\b', r'\bcontrolling\b',
            r'\bleading and controlling\b', r'\bdelegation of authority\b', r'\bspan of control\b',
            r'\bmission statement\b', r'\bwhy (?:an? )?organization exists\b', r'\borganization\'?s? purpose\b',
            r'\bbusiness ethics\b', r'\bethical dilemma\b', r'\bstakeholders?\b',
            r'\borganizational control\b', r'\bfeedforward control\b', r'\bconcurrent control\b',
            r'\bprc modernization\b', r'\br\.?a\.?\s*\d{4,5}\b', r'\bra \d{4,5}\b', r'\bpenal provision\b',
            r'\bclean air act\b', r'\benvironmental law\b' ],

        'GEAS-4.4': [ r'\bpert\b', r'\bcpm\b', r'\bcritical path method\b', r'\bgantt chart\b', r'\beoq\b', r'\btqm\b',
            r'\bsix sigma\b', r'\bquality control\b', r'\beconomic order quantity\b', r'\binventory management\b',
            r'\biso 9000\b', r'\bearned value management\b', r'\bevm\b', r'\bproject life cycle\b',
            r'\brepetitions of some standard activities\b', r'\bline of balance\b',
            r'\bwork breakdown structure\b', r'\bwbs\b' ],

        'GEAS-4.5': [ r'\bmarketing mix\b', r'\b4 ps of marketing\b', r'\bbalance sheet\b', r'\bincome statement\b',
            r'\bcash flow statement\b', r'\bworking capital\b' ],

        # 5.0 Technopreneurship 101
        'GEAS-5.1': [ r'\btechnopreneurships?\b', r'\bstartup ethics\b',
            r'\bcorporate social responsibility\b', r'\bglobalization\b', r'\bentrepreneurial mindset\b',
            r'\banalyzes competitors\b', r'\bmarket share\b',
            r'\bstartups? need funding\b', r'\bvalue-based pricing\b',
            r'\bpartnership and a c corporation\b', r'\bforms? of business organization\b',
            r'\bgeneral partnership\b', r'\blimited liability\b', r'\bllc\b',
            r'\bsole proprietorship\b', r'\bpercent-of-sales method\b',
            r'\bfinancial objectives of any firm\b' ],

        'GEAS-5.2': [ r'\bvalue proposition\b', r'\bcustomer segment\b', r'\bpain point\b', r'\bcustomer discovery\b',
            r'\blean canvas\b', r'\blean canvas model\b', r'\bunfair advantage\b', r'\bearly adopters?\b',
            r'\btechnology adoption\b', r'\bchasm\b', r'\bproduct-market fit\b' ],

        'GEAS-5.3': [ r'\btam[- ]?sam[- ]?som\b', r'\bmarket sizing\b', r'\bmarket research\b', r'\btarget market\b' ],

        'GEAS-5.4': [ r'\bporter\'?s five forces\b', r'\bswot analysis\b', r'\bcompetitive advantage\b',
            r'\bblue ocean strategy\b', r'\bdifferentiation strategy\b', r'\bbarriers? to entry\b' ],

        'GEAS-5.5': [ r'\bbusiness models?\b', r'\bbusiness model canvas\b', r'\bb2b\b', r'\bbusiness-to-business\b',
            r'\bb2c\b', r'\bbusiness-to-consumer\b', r'\bc2c\b', r'\bconsumer-to-consumer\b', r'\bb2g\b',
            r'\bbusiness-to-government\b', r'\bonline marketplace\b', r'\be-commerce (?:business )?model\b',
            r'\bfreemium\b', r'\bsubscription model\b', r'\bmarketplace model\b', r'\bpatents?\b',
            r'\bintellectual property\b', r'\btrademarks?\b', r'\bcopyrights?\b' ],

        'GEAS-5.6': [ r'\bmvp\b', r'\bminimum viable product\b', r'\bpitch deck\b', r'\bbusiness plan\b',
            r'\blean startup\b', r'\bgo-to-market\b' ],

        'GEAS-5.7': [ r'\brunways?\b', r'\bburn rate\b', r'\bunit economics\b', r'\bgross margin\b',
            r'\bfinancial statement\b' ],

        'GEAS-5.8': [ r'\bventure capital\b', r'\bangel investor\b', r'\bseed funding\b', r'\bcrowdfunding\b',
            r'\bbootstrapping\b', r'\bequity financing\b' ],

        # 6.0 Physics 2
        'GEAS-6.1': [ r'\bthermodynamics\b', r'\bcarnot (?:cycle|engine)\b', r'\bentropy\b',
            r'\bfirst law of thermodynamics\b', r'\bsecond law of thermodynamics\b', r'\bideal gas law\b',
            r'\bcoefficient of performance\b', r'\brefrigeration cycle\b', r'\bheat engine\b', r'\bheat pump\b',
            r'\bisothermal process\b', r'\badiabatic process\b', r'\bisobaric process\b', r'\bisochoric process\b' ],

        'GEAS-6.2': [ r'\belectric flux\b', r'\bgauss\'?s law\b', r'\bmagnetic force\b', r'\bmagnetic force on\b',
            r'\bmagnetic force experienced\b', r'\belectric charge density\b', r'\bmagnetic field lines?\b',
            r'\bbar magnet\b', r'\bpermanent magnet\b', r'\bnorth pole\b', r'\bsouth pole\b',
            r'\buniform magnetic field\b', r'\blorentz force\b', r'\bbiot-savart\b', r'\bampere\'?s circuital law\b',
            r'\bmagnetic dipole\b', r'\bforce on a (?:current[- ]carrying )?wire\b' ],

        'GEAS-6.3': [ r'\binductances?\b', r'\bself[- ]inductance\b', r'\bmutual induction\b',
            r'\belectromagnetic induction\b', r'\binduced electromotive force\b', r'\binduced emf\b',
            r'\bfaraday\'?s law\b', r'\blenz\'?s law\b', r'\btransformers?\b', r'\bturns ratio\b', r'\bprimary coil\b',
            r'\bsecondary coil\b', r'\bstep-up transformer\b', r'\bstep-down transformer\b', r'\bideal transformer\b',
            r'\binductors?\b', r'\brl circuit\b', r'\brate of (?:change of )?magnetic flux\b',
            r'\benergy stored in (?:an? )?inductor\b', r'\bvoltage across the inductor\b' ],

        'GEAS-6.4': [ r'\brlc series circuit\b', r'\brlc parallel circuit\b', r'\bac circuits?\b',
            r'\balternating voltage\b', r'\balternating current\b', r'\bseries rlc\b', r'\bparallel rlc\b',
            r'\bcapacitive reactance\b', r'\binductive reactance\b', r'\bcomplex impedance\b',
            r'\bequivalent total capacitance\b', r'\btotal capacitance\b', r'\bcapacitors? (?:strictly )?in series\b',
            r'\bcapacitors? in parallel\b', r'\bseries capacitors?\b', r'\bparallel capacitors?\b',
            r'\btuning circuit\b', r'\btune an? rf circuit\b', r'\brf circuit\b', r'\bresonant frequency\b',
            r'\bpower factor\b', r'\bresistor network\b',
            r'\bcool down fastest via radiation\b', r'\bcool down.*radiation\b',
            r'\bblackbody radiation\b', r'\bstefan-boltzmann\b', r'\bemissivity\b',
            r'\bheat transfer by radiation\b', r'\bthermal radiation\b' ],

        'GEAS-6.5': [ r'\bphotoelectric effect\b', r'\bnuclear reaction\b', r'\bnuclear reactor\b', r'\bradioactivity\b',
            r'\bhalf-lifes?\b', r'\bwave optics\b', r'\bmoderators?\b', r'\bcontrol rods?\b', r'\bphotons?\b',
            r'\bplanck\'?s constant\b', r'\bwork function\b', r'\bbohr radius\b', r'\bbohr model\b',
            r'\brydberg constant\b', r'\bhydrogen spectral lines\b', r'\balpha[- ]particles?\b',
            r'\bbeta[- ]particles?\b', r'\bgamma rays?\b', r'\bnuclear fission\b', r'\bnuclear fusion\b',
            r'\bmass defect\b', r'\bbinding energy\b', r'\bmagic numbers? of protons\b', r'\bpositrons?\b',
            r'\bantiparticle\b', r'\benergy per unit mass\b', r'\bfission\b', r'\bfusion\b',
            r'\belectron in hydrogen jumps\b', r'\bpolarizing filters?\b', r'\btransmission axes\b',
            r'\bmalus\'?s law\b', r'\bpolarization of light\b' ],

        # 7.0 Materials Science and Engineering
        'GEAS-7.1': [ r'\batomic bonding\b', r'\bprimary bonding\b',
            r'\belectronegativit(?:y|ies)\b', r'\binteratomic bond\w*', r'\bisotopes?\b', r'\batomic mass(?:es)?\b',
            r'\batomic numbers?\b', r'\bnumber of neutrons\b', r'\bnumber of protons\b', r'\bnumber of electrons\b',
            r'\bcarbon-1[24]\b', r'\bvalence electrons?\b', r'\belectron configuration\b',
            r'\bgraphite conducts electricity\b', r'\bcovalent bonding\b', r'\bmetallic bonding\b', r'\bionic bonding\b',
            r'\bnonlocalized electrons\b', r'\bgood conductors? of electricity and heat\b',
            r'\bstrong yet deformable\b', r'\bferrous metals?\b', r'\bnonferrous metals?\b',
            r'\balloys?\b', r'\bsteel alloys?\b', r'\bbrass and bronze\b' ],

        'GEAS-7.2': [ r'\bunit cell\b', r'\bbcc structure\b', r'\bfcc structure\b', r'\bhcp structure\b',
            r'\bmiller indices\b', r'\bcrystal structure\b', r'\bcrystalline material\b', r'\bcoordination number\b',
            r'\batomic packing factor\b', r'\bapf\b',
            # Amorphous/crystalline distinction — very common exam question pattern
            r'\bcrystalline\b', r'\bamorphous\b', r'\bnon[- ]crystalline\b', r'\bdistinguishes crystalline\b',
            r'\bshort[- ]range order\b', r'\blong[- ]range order\b',
            r'\bcoordination number of \d+\b' ],

        'GEAS-7.3': [ r'\bpoint defect\b', r'\blattice vacancy\b', r'\bdislocations?\b', r'\bgrain boundary\b',
            r'\bsolid solution\b', r'\bsubstitutional (?:solid )?solution\b', r'\binterstitial (?:solid )?solution\b',
            r'\bedge dislocation\b', r'\bscrew dislocation\b',
            r'\bcrystal imperfection\b', r'\binterstitial site\b', r'\bfrenkel defect\b', r'\bschottky defect\b' ],

        'GEAS-7.4': [ r'\bfick\'?s (?:first|second) law\b', r'\bdiffusion in solids?\b', r'\bcarburizing\b',
            r'\bdiffusion coefficient\b' ],

        'GEAS-7.5': [ r'\btensile test\b', r'\bstress-strain (?:curve|diagram)\b', r'\byield point\b', r'\bductility\b',
            r'\bbrinell hardness\b', r'\brockwell hardness\b', r'\bcharpy (?:impact )?test\b',
            r'\bfatigue (?:limit|strength)\b', r'\bcreep (?:test|failure)\b', r'\byield strength\b',
            r'\btensile strength\b', r'\btoughness\b' ],

        'GEAS-7.6': [ r'\bphase diagram\b', r'\biron-carbon (?:diagram|system)\b', r'\bsteel alloy\b',
            r'\bpolymer material\b', r'\bceramic material\b', r'\bcomposite material\b', r'\bcast iron\b',
            r'\beutectic\b', r'\beutectoid\b',
            # Polymer / material classification — common pre-board patterns
            r'\bpolymers?\b', r'\bhigh molecular weight\b', r'\borganic polymer\b', r'\bthermoset\b',
            r'\bthermoplastic\b', r'\belastomer\b', r'\bcopolymer\b', r'\bpolymerization\b',
            r'\bbrittle (?:material|fracture)\b', r'\bthermal shock\b', r'\brapid temperature change\b',
            r'\bnatural resource\b', r'\bnon[- ]renewable\b', r'\brenewable material\b',
            r'\bfiberglass\b', r'\bcomposite materials?\b',
            r'\bmatrix and (?:what serves as the )?reinforcement\b',
            r'\breinforcement and (?:what serves as the )?matrix\b',
            r'\bcarbon fiber\b', r'\bplastics?\b', r'\belastomers?\b',
            r'\bthermosetting\b', r'\bthermosets?\b', r'\bcross-link(?:ed|ing)?\b',
            r'\bmonomers?\b', r'\bvulcaniz(?:ed|ation)\b', r'\brubber\b',
            r'\bsynthetic rubber\b', r'\bepoxy resin\b', r'\bceramics?\b',
            r'\brefractor(?:y|ies)\b', r'\bwithstand extremely high temperatures\b',
            r'\bhigh-temperature ceramic\b', r'\balumina\b', r'\bsilicon carbide\b' ],

        'GEAS-7.7': [ r'\bband theory\b', r'\bdielectric strength\b', r'\bferromagnetism\b', r'\bdiamagnetic\b',
            r'\bparamagnetic\b', r'\bcoercivit(?:y|ies)\b', r'\bretentivit(?:y|ies)\b', r'\bhysteresis loop\b',
            r'\bhysteresis\b', r'\bdemagnetiz\w*\b', r'\bpermanent magnets?\b', r'\bmagnetic material\b',
            r'\bmagnetic permeabilit(?:y|ies)\b', r'\benergy band gap\b', r'\bband gap of\b',
            r'\bintrinsic semiconductor\b', r'\bextrinsic semiconductor\b', r'\bsemiconductor is made of\b',
            r'\bconduction band\b', r'\bvalence band\b', r'\bsemiconductor materials?\b',
            r'\bsilicon and germanium\b', r'\bgallium arsenide\b' ],

        # 8.0 Computer Programming
        'GEAS-8.1': [ r'\bobject[- ]oriented programming\b', r'\binheritance\b',
            r'\bpolymorphism\b', r'\bencapsulation\b', r'\buml (?:use case )?diagrams?\b', r'\buse case diagrams?\b',
            r'\buse cases?\b', r'\bstick figure\b', r'\bactors?\b', r'\bclass diagrams?\b', r'\bsequence diagrams?\b',
            r'\bactivity diagrams?\b', r'\bstate diagrams?\b', r'\buml\b', r'\bclasses and objects\b',
            r'\bobject-oriented concepts\b', r'\boop focuses on\b', r'\binstances? of a class\b', r'\bobject oriented analysis\b',
            r'\bcpi\b', r'\bcycles per instruction\b', r'\bclock cycles?\b',
            r'\baverage cpi of\b', r'\bexecution time of a program\b',
            r'\bharvard architecture\b', r'\bvon neumann architecture\b',
            r'\bseparate memories for program instructions and data\b',
            r'\bdma\b', r'\bdirect memory access\b', r'\binterrupts?\b',
            r'\bcomputer signal that stops the execution\b',
            r'\bascii\b', r'\bcharacter encoding\b', r'\bbytes?\b',
            r'\bword is (?:best )?defined as\b', r'\bwords? in computer architecture\b',
            r'\bwhich of the following best defines a word\b',
            r'\bwhich of the following best defines a byte\b',
            r'\bwhich of the following best defines a bit\b',
            r'\bspreadsheet\b', r'\bformula .* is entered into cell\b',
            r'\bbuffers?\b', r'\bcontroller board has .* 8-bit memory\b' ],

        'GEAS-8.2': [ r'\bdesign pattern\b', r'\bsolid principle\w*\b', r'\bsoftware architecture\b',
            r'\bobject-oriented design\b', r'\bobject-oriented analysis\b', r'\booad\b', r'\booa\b',
            r'\bproblem domain\b', r'\bsoftware complexity\b', r'\bdomain model\b', r'\bsoftware system is designed\b',
            r'\bsoftware requirements?\b' ],

        'GEAS-8.3': [ r'\bprogramming language\b', r'\bdata type\b', r'\bfor loop\b', r'\bwhile loop\b', r'\barrays?\b',
            r'\bpointer variable\b', r'\balgorithms?\b', r'\bpseudocode\b', r'\bstructured programming\b',
            r'\bloop that will iterate\b', r'\bprogram segment\b', r'\bcontrol structures?\b', r'\bif-else\b',
            r'\bswitch-case\b', r'\bvariables?\b', r'\bcompiler\b', r'\binterpreter\b',
            r'\bdynamic typing\b', r'\bweak typing\b', r'\bstrong typing\b', r'\bcomputer programming is also called\b', r'\bfunctional programming\b',
            r'\bjava\b', r'\bpython\b', r'\bc\+\+\b', r'\brust\b', r'\bruby\b',
            r'\bfortran\b', r'\bpascal\b', r'\bbasic\b', r'\bswift\b', r'\bkotlin\b',
            r'\bgolang\b', r'\bjavascript\b', r'\btypescript\b',
            r'\bprogramming languages?\b', r'\bprogramming paradigms?\b',
            r'\bimperative programming\b', r'\bdeclarative programming\b',
            r'\bside[- ]effect free\b', r'\bconcurrent(?:ly)?\b', r'\bconcurrency\b',
            r'\bmultithreading\b', r'\bstatic typing\b', r'\bstrongly typed\b', r'\btype checking\b',
            r'\bgui framework\b', r'\bdesktop applications in python\b',
            # CAD / computer tools keywords frequently in GEAS pre-board exams
            r'\bcad\b', r'\bcomputer[- ]aided design\b', r'\bgui event\b', r'\bcommon gui event\b',
            r'\bsymmetrical copy\b', r'\bwireframe model\b', r'\bsolid modeli\w+\b',
            r'\bblock (?:command|definition)\b', r'\breusable (?:component|entity)\b', r'\bmirror function\b' ],

        'GEAS-8.4': [ r'\bexception handling\b', r'\btry catch\b', r'\berror handling\b', r'\bruntime error\b',
            r'\bthrow exception\b', r'\bcatch block\b' ],

        'GEAS-8.5': [ r'\bgraphical user interface\b', r'\bgui programming\b', r'\bevent-driven programming\b',
            r'\bcallback function\b', r'\bwidgets?\b', r'\bwindows api\b', r'\bcreatewindow\b', r'\bgui window\b',
            r'\bwin32\b', r'\bgraphical application window\b', r'\bevent handler\b',
            r'\bawt\b', r'\bswing\b', r'\bjframe\b', r'\bjpanel\b', r'\bjbutton\b',
            r'\bkey difference between awt and swing\b', r'\bjava swing\b',
            # GUI Layout Manager questions (common in Java/programming GEAS)
            r'\bgui layout manager\b', r'\blayout manager\b',
            r'\barranges components in.*geographic regions\b',
            r'\b(?:north|south|east|west|center).*layout\b',
            r'\bfive.*geographic regions\b', r'\bborderlayout\b', r'\bflowlayout\b', r'\bgridlayout\b' ],

        # 9.0 Environment Science and Engineering
        'GEAS-9.1': [ r'\becosystems?\b', r'\bfood chain\b',
            r'\bfood web\b', r'\btrophic levels?\b', r'\bbiodiversit(?:y|ies)\b', r'\becolog(?:y|ies)\b',
            r'\bnutrient cycles?\b', r'\bbiogeochemical cycles?\b', r'\bhydrologic(?:al)? (?:cycle|process)\b',
            r'\bwater cycle\b', r'\bpart of the water cycle\b', r'\bevaporation\b', r'\bcondensation\b',
            r'\bprecipitation (?:and|or) collection\b', r'\bprecipitation\b', r'\btranspiration\b',
            r'\bevapotranspiration\b', r'\brunoff\b', r'\bpercolation\b', r'\bgroundwater\b', r'\baquifers?\b',
            r'\bnitrogen cycle\b', r'\bcarbon cycle\b', r'\bphosphorus cycle\b', r'\bsulfur cycle\b',
            r'\bproducers? and consumers?\b', r'\bdecomposers?\b', r'\bbiomes?\b', r'\bhabitat\b',
            r'\bcarrying capacity\b', r'\bprimary succession\b', r'\bsecondary succession\b', r'\bphotosynthesis\b',
            r'\becological niche\b', r'\bhydrosphere\b', r'\blithosphere\b', r'\bbiosphere\b',
            r'\becolog(?:y|ical)\b' ],

        'GEAS-9.2': [ r'\brenewable resource\b', r'\bnon-renewable resource\b', r'\bwater resource\b',
            r'\benergy resource\b', r'\bmineral resource\b', r'\bforest resource\b' ],

        'GEAS-9.3': [ r'\bair pollution\b', r'\bwater pollution\b', r'\bsolid waste (?:management)?\b',
            r'\bclimate change\b', r'\bglobal warming\b', r'\bozone layer\b', r'\bozone depletion\b',
            r'\beutrophication\b', r'\bgreenhouse effect\b', r'\bgreenhouse gas(?:es)?\b', r'\bsalinity\b',
            r'\bhalinity\b', r'\bhaloginity\b', r'\bacid rain\b', r'\bphotochemical smog\b', r'\bchlorofluorocarbons?\b',
            r'\bcfcs?\b', r'\bhazardous (?:waste|materials?|chemicals?)\b', r'\bhazardous\b',
            r'\bchemical hazard diamond\b', r'\bparticulate matter\b', r'\bairborne particulate\b',
            r'\bcontrolled combustion process\b', r'\bincinerat(?:ion|or)\b',
            r'\bconcentration in environmental systems\b',
            r'\bvelocity at which the energy of motion of an airborne\b',
            r'\bcapture velocity\b', r'\bindustrial ventilation\b' ],

        'GEAS-9.4': [ r'\benvironmental studies\b', r'\benvironmental impact(?:s)?\b',
            r'\benvironmental impact assessment\b', r'\beia\b', r'\benvironmental compliance certificate\b', r'\becc\b',
            r'\bdirect impact(?:s)?\b', r'\bindirect impact(?:s)?\b', r'\bsocial impact(?:s)?\b',
            r'\bcumulative impact(?:s)?\b', r'\bresidual impact(?:s)?\b',
            r'\ban effect that occurs immediately as a result of an activity\b', r'\benvironmental management plan\b',
            r'\beia process\b', r'\bproject description\b', r'\bmitigation hierarchy\b', r'\benvironmental management\b',
            r'\bmitigation measures?\b', r'\blarge[- ]scale industrial project\b' ],

        'GEAS-9.5': [ r'\bsustainability\b', r'\bsustainable development\b', r'\bcarbon footprint\b',
            r'\brenewable energy\b', r'\bclean energy\b', r'\bcircular economy\b',
            r'\bbiofuels?\b', r'\bsustainable energy\b' ],

        # 10.0 ECE Laws, Contracts, Ethics, Standards and Safety
        'GEAS-10.1': [ r'\bcontract law\b',
            r'\bobligations?\b', r'\bbreach of contract\b', r'\btorts?\b', r'\bcivil code\b', r'\bquasi-delict\b',
            r'\bvoid and voidable\b', r'\bvalid contract\b',
            r'\bfoundation of ethics\b', r'\bethical foundations?\b', r'\bmoral standards?\b' ],

        'GEAS-10.2': [ r'\bcode of ethics\b', r'\bece pledge\b', r'\bethical conduct\b', r'\bcsc guidelines\b',
            r'\bengineer\'?s code of ethics\b', r'\bprofessional conduct\b', r'\bprofessional ethical standards?\b',
            r'\bhealth, safety and public\b', r'\bconflict of interest\b' ],

        'GEAS-10.3': [ r'\bboard exam(?:ination)? rules?\b', r'\bpassing score\b', r'\bprc exam(?:ination)?\b',
            r'\bgeneral rating of 70\b', r'\bremoval examination\b', r'\b70 percent\b' ],

        'GEAS-10.4': [ r'\bra ?9292\b', r'\bece law\b', r'\bpece\b', r'\bprofessional electronics engineer\b',
            r'\bregistered electronics (?:engineer|technician)\b', r'\belectronics engineer\b',
            r'\belectronics technician\b', r'\bprc board of electronics\b', r'\bboard of electronics engineering\b',
            r'\biecep\b', r'\bseal of (?:a )?pece\b', r'\bscope of practice of ece\b',
            r'\broster of registered electronics\b', r'\bprc modernization act\b', r'\bra ?8981\b',
            r'\bunauthorized practice\b', r'\bwithout a valid prc license\b', r'\bunlicensed practice\b',
            r'\bpracticing (?:the )?(?:electronics engineering )?profession\b', r'\bprc license\b',
            r'\bmotu propr?io\b', r'\bminimum punishment.*(?:shall give any )?false\b',
            r'\bfalse or fraudulent statement to the board\b' ],

        'GEAS-10.5': [ r'\bra ?7925\b', r'\bra ?8792\b', r'\be-commerce act\b',
            r'\bpublic telecommunications policy act\b', r'\bra ?10515\b', r'\banti-cable tv\b',
            r'\bcable internet tapping\b', r'\banti-cable tv and cable internet tapping act\b', r'\bra ?10844\b',
            r'\bdict act\b', r'\bdepartment of information and communications technology\b', r'\bra ?10175\b',
            r'\bcybercrime prevention act\b', r'\bra ?10912\b', r'\bcpd act\b',
            r'\bcontinuing professional development\b', r'\bra ?10055\b', r'\btechnology transfer act\b',
            r'\bra ?10889\b', r'\bra ?10982\b', r'\bra ?3846\b', r'\bact (?:no\.?\s*)?3846\b', r'\bradio control law\b',
            r'\bra ?8293\b', r'\bintellectual property code\b', r'\bntc\b',
            r'\bnational telecommunications commission\b', r'\bkbp\b', r'\bkbp broadcast code\b', r'\bfranchise\b',
            r'\btelecommunications? law\b', r'\brepublic act (?:no\.?\s*)?\d+\b', r'\bra\s*\d{3,5}\b' ],

        'GEAS-10.6': [ r'\bphilippine electrical code\b', r'\bpec\b', r'\bosha standard\b', r'\bsafety standard\b',
            r'\bphilippine electronics code\b',
            r'\bppe\b', r'\bpersonal protective equipment\b', r'\bworkplace safety regulations?\b',
            r'\bnfpa\b', r'\bnfpa 704\b', r'\bhazard diamond\b', r'\bhealth hazard under nfpa\b',
            # Machine safety color coding (OSHA / industrial)
            r'\bdesignate dangerous parts of machines\b', r'\bcolor.*danger.*machine\b',
            r'\benergized equipment.*cut.*crush\b', r'\bred.*danger.*machines?\b',
            r'\bwhich color.*dangerous parts\b' ],

        # 11.0 CAD
        'GEAS-11.1': [ r'\bcad software\b', r'\bautocad\b', r'\bcad coordinate system\b',
            r'\bviewports?\b', r'\bcad drawing\b', r'\bzoom extents\b', r'\bzoom scale\b', r'\bpan command\b',
            r'\bpan\b', r'\borbit command\b', r'\bregen command\b', r'\bviewing command\b', r'\bautocad command\b',
            r'\badvanced cad technique\b' ],

        'GEAS-11.2': [ r'\bosnap\b', r'\bobject snap\b', r'\bortho mode\b', r'\bpolar tracking\b',
            r'\bconstruction elements?\b' ],

        'GEAS-11.3': [ r'\bdimensioning\b', r'\bplotting (?:scale|a drawing)\b', r'\bdrawing scale\b',
            r'\bimage input\b', r'\braster image\b' ],
    },

    'EST': {
        # 1.0 Signals, Spectra, Signal Processing
        'EST-1.1': [  # Classification and Characteristics of Signals
            r'\bperiodic signals?\b', r'\baperiodic signals?\b', r'\banalog signals?\b', r'\bdigital signals?\b',
            r'\benergy signals?\b', r'\bpower signals?\b', r'\bdeterministic signals?\b', r'\brandom signals?\b',
            r'\bcontinuous-time signals?\b', r'\bdiscrete-time signals?\b',
            r'\bstationary random signals?\b', r'\bperiodic deterministic signals?\b',
            r'\bergodic signals?\b', r'\bcharacteristics of signals\b',
            r'\bwhich signal is (?:even|odd)\b', r'\bsignal is (?:even|odd)\b',
            r'\bconjugate\s+symmetr\w*\b', r'\beven\s+function\s+of\s+time\b', r'\bodd\s+function\s+of\s+time\b',
            r'\b(?:even|odd)\s+signals?\b', r'\beven\s+and\s+odd\s+components?\b', r'\btime\s+reversal\b',
            r'\bcausal\s+signals?\b', r'\bnon-causal\s+signals?\b',
            # Expansions
            r'\bcausal\s+system\b', r'\bnon-causal\s+system\b', r'\banti-causal\s+system\b',
            r'\banti-casual\b', r'\bcasual\s+system\b', r'\bnon-casual\b',
            r'\boutput of the system is dependent of future values\b',
            r'\boutput of the system is independent of the future values\b',
            r'\bdepends on the input.*at the same value\b',
            r'\bdiscrete exponential signal\b', r'\bdeterministic discrete aperiodic\b',
            r'\bup[- ]sampling\b', r'\bdown[- ]sampling\b', r'\bdecimation\b', r'\binterpolation\b',
            r'x\(n\)\s*=\s*x\(n/2\)', r'\blinear non-linear unstable time-invar\b',
            r'y\(n\)\s*=\s*x\(n\)', r'\bsignals is even\b',
            r'y\(n\)\s*=\s*x\(n\)\s*\*\s*cos\(n\)', r'\btime[- ]variant\b',
            r'\blti system (?:receives|if the input)\b', r'x1\(t\)\s*\+\s*x2\(t\)',
            r'\bcondition of periodicity\b', r'\benergy of the signal f\(2t\)\b',
            r'\bpower in the signal s\(t\)\b'
        ],
        'EST-1.2': [  # Sampling Theorem and Aliasing
            r'\bnyquist (?:rate|theorem|criterion)\b', r'\bsampling theorem\b', r'\baliasing\b',
            r'\banti-aliasing\b', r'\bsampling frequency\b', r'\bnyquist frequency\b',
            # Expansions
            r'\bfoldover distortion\b', r'\baliased frequency\b', r'\bsampled at\b',
            r'\breconstruct a sampled signal\b', r'\bideal reconstruction filter\b',
            r'\bsampling is the process of converting a signal\b',
            r'\bnatural vs\.? flat-top sampling\b', r'\bflat-top sampling\b'
        ],
        'EST-1.3': [  # Difference Equations for FIR and IIR Filters
            r'\bfir filters?\b', r'\biir filters?\b', r'\bdifference equation\b', r'\bdigital filter design\b',
            r'\braised cosine filter\b', r'\broll-off factor\b', r'\bnyquist pulse shaping\b',
            r'\bpulse-shaping filter\b', r'\binter-symbol interference\b', r'\bisi\b',
            r'\bfir filters? (?:are|is) (?:generally )?preferred\b',
            r'\blinear phase response\b', r'\bwhich configuration yields linear phase\b',
            r'\bcharacteristics of matched filter\b', r'\bmatched filter\b',
            r'\bband reject filter\b', r'\bnotch filter\b',
            r'\brecursive systems?\b', r'\brecursive systems? (?:are|is) basically characterized\b'
        ],
        'EST-1.4': [  # Convolution and Correlation
            r'\bconvolution (?:sum|integral)\b', r'\bcircular convolution\b', r'\bcross-correlation\b',
            r'\bauto-correlation\b', r'\bconvolve\b', r'\bconvolutions?\b', r'\bauto[- ]?correlations?\b',
            r'\btwo discrete signals.*convolved\b', r'\blength of the result.*convolved\b',
            r'\boutput can be greater than input amplitude because\b',
            r'\bconvolving\b', r'\bdiscrete convolution\b',
            r'\bcorrelogram\b'
        ],
        'EST-1.5': [  # Z-Transforms and Pole-Zero-Gain Filters
            r'\bz-transforms?\b', r'\bpole-zero plot\b', r'\bpole-zero-gains?\b', r'\broc of\b', r'\bregion of convergence\b',
            r'\bpoles?\s+located\s+at\b', r'\bpoles?\s+and\s+zeros?\b', r'\bzeros?\s+and\s+poles?\b',
            r'\btransfer\s+function\s+(?:has\s+)?poles?\b', r'\b(?:stability|stable|unstable)\s+of\s+a\s+digital\s+system\b',
            r'\bdigital\s+system\s+(?:whose\s+)?transfer\s+function\b', r'\b(?:inside|outside|on)\s+the\s+unit\s+circle\b',
            r'\b(?:magnitude|radius)\s+of\s+(?:all\s+)?poles?\s+is\s+(?:strictly\s+)?less\s+than\s+unity\b',
            r'\bless\s+than\s+unity\b', r'\bz-plane\b', r'\bh\(z\)',
            # Expansions
            r'\bdt system stability\b', r'\bunstable based on dt system\b',
            r'\bh\(z\)\s*=\s*\b', r'\bzeros? at z\b', r'\bpoles? at z\b',
            r'\ball-pass filter\b', r'\bmagnitude response of an all-pass\b',
            r'\bpole is very close to a zero\b', r'\bpole on the jw-axis\b'
        ],
        'EST-1.6': [  # Fourier Transforms and Filtering
            r'\bdft\b', r'\bfft\b', r'\bfast fourier transform\b', r'\bdiscrete fourier transform\b',
            r'\bfourier series\b', r'\bspectral analysis\b', r'\blow-pass filter\b', r'\bhigh-pass filter\b',
            r'\bband-pass filter\b', r'\bband-stop filter\b',
            # Expansions
            r'\bfourier transform\b', r'\bparseval\'?s theorem\b',
            r'x\([Ωω]\)', r'[δd]\(t\)', r'\bdirac delta\b',
            r'x\(t\)\s*=\s*[δd]\(t\)', r'evaluate the x\([Ωω]\)',
            r'\bfourier analysis shows that the sawtooth\b'
        ],

        # 2.0 Principles of Communications
        'EST-2.1': [  # Introduction to Communications Systems
            r'(?<!digital\s)(?<!data\s)(?<!optical\s)\bcommunication(?:s)?\s+(?:systems?|process|medium)\b',
            r'\btransmitters?\b',
            r'\breceiver block diagram\b', r'\belectronic(?:s)? communications?\b',
            r'\bvoice frequency range\b', r'\belectromagnetic spectrum\b',
            r'\bmodulating (?:the )?carrier\b',
            r'\bimpressing intelligence\b', r'\bcarrier signal\b', r'\bmodulation\b',
            # Expansions
            r'\bstages of amplification\b', r'\bdecibel gain\b', r'\bwavelength for a frequency of\b',
            r'\belectromagnetic wave consists of\b', r'\bvoice frequency\b', r'\brf spectrum\b',
            r'\bdigital signals are preferred over analog\b', r'\bdigital vs analog signals?\b',
            r'\badvantages? of digital (?:signals?|communication)\b',
            r'\bconvert a power level of \d+.*into dbm\b',
            r'\breference impedance used for calculating dbm\b', r'\b600-ohm reference\b',
            r'\bmorse code\b', r'\bhf station\b', r'\btransceivers?\b',
            r'\bdummy load\b', r'\bvoice operation\b', r'\bdynamic microphone\b',
            r'\bswitching from receive to transmit\b', r'\bspeed of a radio wave\b',
            r'\bkey-clicks?\b', r'\bharmonic radiation\b',
            r'\baudio-frequency interference\b', r'\baudio rectification\b',
            r'\btelevision interference\b',
            r'\belectrical current flowing through the human body\b',
            r'\baffected by a very small amount of electrical current\b',
            r'\bminimum voltage which is usually dangerous to humans\b',
            r'\bburned by high voltage\b', r'\bremove an unconscious person from contact\b',
            r'\bmains operated power supply\b', r'\belectrical shock\b',
            r'\bground rod driven into the earth\b', r'\bground rod\b',
            r'\bgreen wire in a three wire\b', r'\bthree-wire power cord\b',
            r'\bstation grounding\b', r'\bstray rf energy\b',
            r'\brf energy affect body tissue\b', r'\bheating effects of rf energy\b',
            r'\bunauthorized persons from using (?:your|a mobile) amateur station\b',
            r'\bkey-operated on/off switch\b', r'\bamateur station\b',
            r'\brf oscillator should be electrically and mechanically stable\b',
            r'\bpower source deliver maximum output to the load\b',
            r'\bwavelength corresponding to a frequency of\b'
        ],
        'EST-2.2': [  # Noise and Amplitude Modulation
            r'\bamplitude modulation\b', r'\bam signal\b', r'\bmodulation index\b', r'\bthermal noise\b',
            r'\bjohnson noise\b', r'\bsignal-to-noise ratio\b', r'\bsnr\b', r'\bnoise figure\b',
            r'\bnoise temperature\b', r'\bdsb-fc\b', r'\bdsb-sc\b', r'\bsideband power\b',
            r'\bdouble[- ]sideband\b', r'\bdsb\b', r'\bam modulation\b', r'\bam receiver\b', r'\bam transmitter\b',
            # Expansions
            r'\bam wave\b', r'\bsingle-tone amplitude modulated\b', r'\bmodulating tone\b',
            r'\bthermal agitation noise\b', r'\bshot noise\b', r'\btransit-time noise\b',
            r'\bflicker noise\b', r'\bpink noise\b', r'\bnoise factor\b', r'\bnoise generator\b',
            r'\batmospheric noise\b', r'\bcosmic noise\b', r'\bsolar noise\b',
            r'\bnoise spectral density\b', r'\btotal noise power\b',
            r'\bresistor.*connected in series at.*k\b', r'\bnoise becomes of great importance at high frequencies\b',
            r'\bnoise bandwidth\b', r'\bdynamic resistance\b', r'\bthermal noise voltage\b',
            r'\binput noise power\b', r'\bequivalent noise resistance\b',
            r'\bwhite noise\b', r'\bthermal \(johnson-nyquist\) noise\b',
            r'\bimpulse noise is best described\b', r'\bimpulse noise\b',
            r'\bportion of the power is wasted in transmitting the carrier\b',
            r'\bcarrier power in am\b', r'\bnoise factor ≤ \d+\b',
            r'\bnoise current for a diode\b'
        ],

        'EST-2.3': [  # Single-Sideband Techniques
            r'\bssbs?\b', r'\bssb-scs?\b', r'\bbalanced modulator\b', r'\bvestigial sideband\b', r'\bvsbs?\b',
            r'\bsingle[- ]sideband\b', r'\bsuppressed carrier\b',
            # Expansions
            r'\bonly one sideband is transmitted\b', r'\ba3e\b', r'\bh3e\b', r'\bj3e\b',
            r'\bemission designat\w*\b'
        ],
        'EST-2.4': [  # Frequency Modulation
            r'\bfrequency modulation\b', r'\bfm signal\b', r'\bfrequency deviation\b',
            r'\bpre-emphasis\b', r'\bde-emphasis\b', r'\bphase modulation\b',
            r'\bphase-locked loops?\b', r'\bplls?\b', r'\bcapture range\b', r'\block range\b',
            r'\bcarson(?:\'s)? rule\b', r'\bsidebands on fm\b', r'\bfm receiver\b', r'\bfm transmitter\b',
            # Expansions
            r'\bindirect fm\b', r'\bindirect pm\b', r'\barmstrong modulator\b',
            r'\bphase discriminator\b', r'\bslope detector\b', r'\bratio detector\b',
            r'\bfm stereo\b', r'\bcapture effect in fm\b', r'\bfrequency-deviation constant\b',
            r'\bderive fm from pm\b', r'\bfm from pm\b', r'\bvaractor-tuned oscillator\b',
            r'\bfrequency synthesizer\b', r'\bfm stations?\b', r'\beducational fm\b',
            r'\bfm hand-held\b', r'\bshout into (?:its )?microphone\b',
            r'\bfm voice best for local\b', r'\bbandwidth of a frequency-modulated amateur\b',
            r'\bfm receivers? perform in an unusual manner\b',
            r'\bcapture effect\b', r'\bover[- ]deviation\b',
            r'\bfrequency modulated \(fm\) phone\b', r'\bfm phone\b',
            r'\bamount of frequency shift from the carrier\b',
            r'\bmaximum frequency deviation\b', r'\bconsider an fm wave\b'
        ],
        'EST-2.5': [  # Radio Receivers
            r'\bsuperheterodynes?\b', r'\bintermediate frequency\b', r'\bif stage\b', r'\bimage frequency\b',
            r'\bagc\b', r'\bautomatic gain control\b', r'\bselectivit(?:y|ies)\b', r'\breceiver sensitivity\b',
            r'\bmixer circuits?\b', r'\blocal oscillators?\b',
            r'\bmixers?\b', r'\bradio receivers?\b',
            # Expansions
            r'\bdouble-tuned if amplifier\b', r'\bif amplifier\b', r'\bimage rejection\b',
            r'\breceiver\'?s? specifications? which indicates its sensitivity\b',
            r'\breceivers? of different sensitivity\b',
            r'\bcommunications? receiver has.*filters?\b',
            r'\breceiver sensitivity\b', r'\breceiver selectivity\b',
            r'\bsquelch function\b', r'\bsquelch\b'
        ],
        'EST-2.6': [  # Radiation and Propagation of Waves
            r'\bground wave\b', r'\bsky wave\b', r'\bspace wave\b', r'\bionospheric (?:wave|propagation)\b',
            r'\bmuf\b', r'\bmaximum usable frequency\b', r'\bcritical frequency\b', r'\bskip distance\b',
            r'\bfading\b', r'\bknife-edge diffraction\b',
            # Expansions
            r'\bionosphere\b', r'\bionospheric\b', r'\bionized\b', r'\bionization\b',
            r'\bleast ionized\b', r'\bd region\b', r'\be region\b', r'\bf1 region\b', r'\bf2 region\b',
            r'\blongest distance radio-wave propagation\b', r'\babsorb radio waves.*d region\b',
            r'\bauroral activity\b', r'\bmeteor scatter\b', r'\btropospheric scatter\b',
            r'\bpropagation cycles\b', r'\bsunspot cycle\b', r'\bscatter mode\b',
            r'\bforward scatter\b', r'\bback scatter\b', r'\bspace waves are\b',
            r'\bground waves are most effective\b', r'\brange of sky-wave propagation\b',
            r'\bshort-distance communications during daylight\b',
            r'\bvhf signals (?:are )?propagated\b',
            r'\bradiation from the sun influence propagation\b',
            r'\b80 metr(?:e|er) band\b',
            r'\bportion of the radiation kept close to the earth\b'
        ],
        'EST-2.7': [  # Pulse Modulation and Digital Modulation
            r'\bpulse modulation\b', r'\bdigital modulation\b', r'\banalog-to-digital modulation\b'
        ],
        'EST-2.8': [  # Broadband Communication Systems
            r'\bbroadband (?:communication|network)\b', r'\bcellular system\b', r'\bgsm\b', r'\blte\b',
            r'\b5g\b', r'\bsatellite communication\b',
            r'\bpulsed\s+radar\b', r'\bradar\s+systems?\b', r'\btarget\s+echo\b', r'\bdistance\s+to\s+the\s+target\b',
            r'\bradar\s+range\b', r'\bradar\s+mile\b', r'\bdoppler\s+radar\b', r'\bradar\s+cross[- ]section\b',
            r'\bcontinuous[- ]wave\s+radar\b', r'\bcw\s+radar\b', r'\bradar\s+equation\b',
            # Expansions
            r'\bsatellites?\b', r'\bearth orbit\b', r'\bgeostationary\b', r'\bgeo satellites?\b',
            r'\bleo satellites?\b', r'\bmeo satellites?\b', r'\bapogee\b', r'\bperigee\b',
            r'\bstarlink\b', r'\bhandoff\b', r'\bhandover\b',
            r'\bk-band\b', r'\bku-band\b', r'\bka-band\b', r'\bc-band\b', r'\bx-band\b', r'\bs-band\b',
            r'\bbroadband transmission\b', r'\bwhen is broadband transmission most suitable\b',
            r'\bbroadband system can transmit more data\b',
            r'\bbaseband vs broadband\b'
        ],

        # 3.0 Digital Communications
        'EST-3.1': [  # Introduction to Digital Communications
            r'\bdigital communication system\b', r'\badvantages of digital (?:communication|transmission)\b',
            # Expansions
            r'\bdigital communication\b', r'\bbaseband transmission\b',
            r'\bdigital transmissions use signals called\b',
            r'\bselect(?:ing)? a rtty transmitting frequency\b', r'\brtty\b'
        ],
        'EST-3.2': [  # Digital Transmission
            r'\bdigital transmission\b', r'\bline coding\b', r'\bnrz\b', r'\brz\b', r'\bmanchester (?:code|encoding)\b',
            r'\bami\b', r'\bintersymbol interference\b', r'\bisi\b', r'\beye pattern\b', r'\beye diagram\b',
            r'\bdivisor in a cyclic code\b', r'\bgenerator polynomial\b',
            r'\boutput voltage of a [μu]-law compander\b', r'\bcompander with a maximum voltage\b',
            r'\bscrambling of data\b', r'\bdata scrambl\w*\b'
        ],
        'EST-3.3': [  # PAM, PWM, PPM, Pulse Code Modulation
            r'\bpulse amplitude modulation\b', r'\bpam\b', r'\bpulse width modulation\b', r'\bpwm\b',
            r'\bpulse position modulation\b', r'\bppm\b', r'\bpulse code modulation\b', r'\bpcm\b',
            r'\bquantization\b', r'\bcompanding\b', r'\ba-law\b', r'\bmu-law\b', r'\bdelta modulation\b',
            r'\bdpcm\b', r'\bsqnr\b',
            # Expansions
            r'\bu-law compressor\b', r'\bcompressed code\b', r'\bdynamic range of the digitizer\b',
            r'\badding one bit to the word length\b', r'\b6 db rule\b', r'\bword length\b'
        ],
        'EST-3.4': [  # ASK, FSK, PSK, QAM
            r'\bask\b', r'\bamplitude shift keying\b', r'\bfsk\b', r'\bfrequency shift keying\b',
            r'\bpsk\b', r'\bphase shift keying\b', r'\bbpsk\b', r'\bqpsk\b', r'\bqam\b',
            r'\b(?:binary\s+psk|8-?psk|16-?psk|dbpsk|dqpsk|oqpsk|pi/4-?dqpsk)\b',
            r'\b(?:m-ary\s+psk|m-psk|m-ary\s+qam|16-?qam|64-?qam|256-?qam|m-ary\s+fsk|4-?fsk|8-?fsk|bfsk)\b',
            r'\b(?:symbol\s+rate|baud\s+rate|symbols?\s+per\s+second|bits?\s+per\s+symbol)\b',
            r'\b16-qam\b', r'\b64-qam\b', r'\bconstellation diagram\b', r'\bbit error rate\b', r'\bber\b'
        ],
        'EST-3.5': [  # Basics of Information Theory and Error Detection
            r'\binformation theory\b', r'\bentropy of (?:a )?source\b',
            r'\bdiscrete memoryless source\b', r'\bsource entropy\b',
            r'\bentropy of (?:a )?(?:discrete )?memoryless source\b',
            r'\bshannon limit\b', r'\bparity bit\b',
            r'\bchecksums?\b', r'\bcrc\b', r'\bcyclic redundancy check\b', r'\bhamming codes?\b', r'\bforward error correction\b',
            r'\berror detection\b',
            # Carson's rule & channel bandwidth / capacity
            r'\bcarson\'?s\s+rule\b', r'\btransmission\s+bandwidth\b', r'\bbandwidth\s+required\s+for\b',
            r'\bchannel\s+capacity\b', r'\bshannon(?:-hartley)?\s+(?:theorem|capacity|limit|law)\b',
            r'\bmaximum\s+channel\s+capacity\b', r'\bbandwidth\s+efficiency\b',
            r'\bnyquist\s+(?:capacity|formula|bit\s+rate)\b', r'\bnoiseless\s+channel\b',
            r'\b\d+[- ]level\s+signaling\b', r'\bmultilevel\s+signaling\b',
            r'\bmaximum\s+theoretical\s+data\s+rate\b', r'\bchannel\s+bandwidth\b',
            # Error-correcting block codes & Hamming distance
            r'\bhamming\s+distance\b', r'\bminimum\s+hamming\s+distance\b', r'\bd_?min\b',
            r'\berror-correcting\s+(?:block\s+)?code\w*\b', r'\bblock\s+codes?\b', r'\bcodewords?\b',
            r'\bsimultaneous\s+bit\s+errors?\b', r'\bcorrect\s+(?:up\s+to\s+)?\d+\s+errors?\b',
            r'\berror\s+syndrome\b', r'\blinear\s+block\s+codes?\b',
            # Expansions
            r'\bentropy of the source\b', r'\bjoint entropy\b', r'\bchannel capacity\b',
            r'\bfec\b', r'\bcentral concept in detecting or correcting errors\b',
            r'\bparity-check code can detect\b', r'\bdetecting or correcting errors is\b',
            r'\bmemoryless source refers to\b',
            r'\bshannon(?:\'s)? theorem\b', r'\bpolar coding\b',
            r'\bsource that generates .* symbols with probabilities\b',
            r'\bsource emits symbols\b', r'\brate of information r\s*>\s*c\b'
        ],
        'EST-3.6': [  # FDM, TDM, WDM, FDMA, CDMA, TDMA
            r'\bfdms?\b', r'\bfrequency division multiplex\w*', r'\btdms?\b', r'\btime division multiplex\w*',
            r'\bwdms?\b', r'\bwavelength division multiplex\w*', r'\bfdmas?\b', r'\btdmas?\b', r'\bcdmas?\b',
            r'\bspread spectrum\b', r'\bdsss\b', r'\bfhss\b'
        ],

        # 4.0 Transmission and Antenna Systems
        'EST-4.1': [  # Transmission Line Circuits
            r'\btransmission lines?\b', r'\bcoaxial (?:cable|line)\b', r'\bcharacteristic impedance\b',
            r'\bpropagation velocity\b', r'\btwo-wire line\b',
            # Expansions
            r'\bvelocity of propagation\b', r'\bvelocity factor\b', r'\bunbalanced line\b',
            r'\bbalanced line\b', r'\bparallel-conductor feed line\b', r'\bfeed line with\b',
            r'\bskin effect\b', r'\brf current flow in a conductor\b', r'\blongitudinal balance\b',
            r'\btwo wires side-by-side\b', r'\btwo-wire and four-wire circuits\b',
            r'\btwo-wire circuits\b',
            r'\bbaluns?\b', r'\bfeed lines?\b', r'\btwin[- ]lead\b', r'\bcoaxial feed line\b',
            r'\brf feed line\b', r'\bfeed line losses?\b',
            r'\bline is mismatched and very long\b', r'\breflected signals?\b'
        ],
        'EST-4.2': [  # Losses, Parameters, and Matching
            r'\bstanding wave\b', r'\bswr\b', r'\bvswr\b', r'\breflection coefficient\b',
            r'\bquarter-wave (?:matching|transformer)\b', r'\bstub matching\b', r'\battenuation constant\b', r'\breturn loss\b',
            # Expansions
            r'\bquarter wave line\b', r'\bimpedance inversion\b', r'\bpl-259 connector\b',
            r'\bconnector.*loss at uhf\b',
            r'\bstanding-wave ratio\b', r'\bwhy is impedance matching important\b',
            r'\bimpedance of an electrical load is equal to the internal\b'
        ],
        'EST-4.3': [  # Smith Chart
            r'\bsmith chart\b', r'\bstub tuning\b'
        ],
        'EST-4.4': [  # Radio Wave Propagation
            r'\bradio wave propagation\b', r'\bfree space path loss\b', r'\bfspl\b', r'\bfriis (?:equation|transmission)\b',
            r'\bfresnel zone\b',
            r'\bradio\s+horizon\b', r'\bvisual\s+horizon\b', r'\bk-factor\b', r'\bstandard\s+(?:k-factor|refraction)\b',
            r'\b4/3\s+earth\s+radius\b', r'\b(?:sub|super)[- ]refraction\b', r'\bstandard\s+atmospheric\s+refraction\b',
            r'\bducting\b', r'\btropospheric\s+(?:propagation|ducting|refraction|scatter)\b',
            # Expansions
            r'\buniform plane wave\b', r'\bplane wave is propagating\b', r'\bfade margin\b',
            r'\bmicrowave hop\b', r'\bmicrowave link\b', r'\bpath loss for a.*microwave link\b',
            r'\batmospheric attenuation\b', r'\bobstacle clearance\b', r'\brequired clearance for an obstacle\b',
            r'\bradio waves would most strongly reflect\b', r'\bpolarization change.*propagated over long\b',
            r'\bgroup velocity if the phase velocity\b', r'\bpoynting vector.*linearly polarized\b',
            r'\brelative permittivity of\b', r'\bvhf transceiver\b', r'\bpoynting vector.*electric field\b',
            r'\bintrinsic impedance.*free space\b', r'\bintrinsic impedance η\b',
            r'\bfree-space propagation.*increases the path loss\b',
            r'\bfree-space propagation.*frequency is doubled\b',
            r'\bhigh humidity affect attenuation\b', r'\battenuation in a microwave communication link\b',
            r'\breliability is equivalent to how many hours per year\b',
            r'\bmicrowave link availability\b', r'\bhours per year.*microwave\b',
            r'\bskip zone\b', r'\bsolar flux\b', r'\bsolar[- ]flux index\b',
            r'\bsolar cycle\b', r'\btropospheric bending\b',
            r'\bground[- ]wave or line-of-sight\b', r'\btravelled by ground waves\b',
            r'\benergy density of the rf field\b',
            r'\bhf scatter signals\b', r'\bextended-distance propagation\b',
            r'\bradiation kept close to the earth\'?s surface due to bend\b',
            r'\bdistance to europe.*5000\s*km\b', r'\b5000\s*km\b'
        ],
        'EST-4.5': [  # Power Density and Field Strength Calculations
            r'\bpower density\b', r'\bfield strength\b', r'\beirp\b', r'\berp\b', r'\beffective radiated power\b',
            r'\beffective isotropic radiated power\b'
        ],
        'EST-4.6': [  # Antenna Systems
            r'\bantennas?\b', r'\bdipole antenna\b', r'\byagi antenna\b', r'\bparabolic antenna\b', r'\bhorn antenna\b',
            r'\bantenna gain\b', r'\bdirectivity\b', r'\bradiation pattern\b', r'\bbeamwidth\b', r'\bpolarization of (?:an? )?wave\b',
            # Expansions
            r'\bhalf-wave dipole\b', r'\bhalf-[\s]*wave dipole\b', r'\bphysical length of (?:a )?half-[\s]*wave dipole\b',
            r'\bgain does a half-wave dipole have over an isotropic radiator\b',
            r'\blpda\b', r'\blog-periodic\b', r'\byagi-uda\b', r'\bcassegrain feed\b',
            r'\bparabolic reflector\b', r'\bwave polarization\b', r'\bhorizontal wave polarization\b',
            r'\bvertical wave polarization\b',
            r'\btheoretical gain of an isotropic radiator\b', r'\bisotropic radiator\b',
            r'\bdoubling both the operating frequency and antenna\b',
            r'\bfolded dipole\b', r'\btrap dipole\b', r'\byagi with wide element spacing\b',
            r'\bfeed point of the dipole\b', r'\bshortened radiator\b'
        ],
        'EST-4.7': [  # Waveguides and Fiber Optics
            r'\bwaveguides?\b', r'\bte mode\b', r'\btm mode\b', r'\bwaveguide cutoff frequency\b',
            r'\boptical fiber\b', r'\bfiber[- ]optics?\b', r'\bfiber core\b', r'\bcladdings?\b',
            r'\bnumerical aperture\b', r'\btotal internal reflection\b', r'\bsingle[- ]mode fiber\b', r'\bmultimode fiber\b',
            r'\bfiber attenuation\b', r'\bdecibel loss\b',
            r'\blaser\b', r'\blight waves?\b', r'\bwavelength of light\b', r'\blens\b', r'\bconverging lens\b',
            r'\brefraction\b', r'\bdispersion\b', r'\bwave theory of light\b', r'\bluminance efficiency\b', r'\bfocal point\b',
            # Expansions
            r'\bcavity resonator\b', r'\bcubical cavity resonator\b',
            r'\bfiber[- ]optic systems?\b', r'\bdigital modulator in fiber\b',
            r'\boptical transmitter\b', r'\boptical receiver\b', r'\bwave guides?\b',
            r'\bmultimode step-index fiber\b', r'\bnumber of supported modes\b',
            r'\bloss mechanism is dominant in long-haul\b', r'\bdominant in long-haul fiber\b',
            r'\brayleigh scattering\b', r'\bhigher cutoff frequency than te10\b',
            r'\bte10 mode\b', r'\bdominant mode in rectangular waveguide\b',
            r'\bmagnetrons?\b', r'\bklystrons?\b', r'\btravell?ing[- ]wave tubes?\b', r'\btwt\b',
            r'\binteraction between electrons and (?:the )?rf\b', r'\bcavity magnetron\b',
            r'\bcrossed[- ]field\b', r'\bimpatt diodes?\b', r'\bgunn diodes?\b',
            r'\belectron bunching to generate\b', r'\bvelocity modulation\b',
            r'\bbolometer for attenuation measurement\b', r'\bschottky diode (?:as a )?microwave detector\b',
            r'\bmeridional rays?\b', r'\b850\s*nm\s+window\b',
            r'\bsilica fiber\b', r'\bwhite fiber with a black tracer\b',
            r'\bfiber number\b', r'\bpolishing of a silica fiber\b',
            r'\bcatcher cavity\b', r'\bbuncher[- ]grid\b',
            r'\bparametric amplifiers?\b', r'\bpump frequency\b',
            r'\bat cutoff frequency\b', r'\bproduct of (?:phase|group) velocit\w*\b'
        ],

        # 5.0 Electronics 3: Electronic Systems and Design (also shared with ELECS-6.0)
        'EST-5.1': [  # SCRs, UJT, PUT, TRIAC, DIAC, and Thyristors
            r'\bpower semiconductor\b', r'\bscr\b', r'\btriac\b', r'\bdiac\b', r'\bujt\b', r'\bput\b', r'\bthyristors?\b',
            r'\bphotodiode is operated in the reverse-biased\b', r'\bphotoconductive mode\b',
            r'\bphotovoltaic mode\b', r'\bavalanche photodiode \(apd\)\b',
            r'\bapd preferred over a pin\b',
            r'\bregulated power supply\b', r'\boutput of the rectifier\b',
            r'\boutput of the filter connects to\b', r'\bbetween the transformer and the\b',
            r'\bconnected to the regulator\b'
        ],
        'EST-5.2': [  # Optoelectronic Devices and Sensors
            r'\boptoelectronics?\b', r'\boptical encoder\b', r'\blaser sensor\b', r'\bphotodetectors?\b',
            r'\bavalanche photodiode\b', r'\bapd\b', r'\bpin photodiode\b',
            r'\bapd preferred over a pin photodiode\b'
        ],
        'EST-5.3': [  # Transducers and Interfacing Techniques
            r'\btransducers?\b', r'\b4-20 ?ma\b', r'\bcurrent loop\b', r'\bsignal conditioning\b'
        ],
        'EST-5.4': [  # Programmable Logic Controllers
            r'\bplc\b', r'\bprogrammable logic controller\b', r'\bindustrial automation\b'
        ],
        'EST-5.5': [  # Building Management Systems (HVAC, Security, Audio-Video, Fire and Life Safety, SCADA)
            r'\bbuilding management system\b', r'\bbms\b', r'\bhvac control\b', r'\bpublic address system\b',
            r'\bhvac systems?\b', r'\bchilled water\b',
            r'\bfire (?:and life safety|alarm) system\b', r'\bsecurity system\b', r'\bscada\b',
            r'\baudio-video system\b', r'\baccess control system\b',
            # Expansions
            r'\bsmoke detector\b', r'\bobscuration per meter\b',
            r'\bmagnetic locks?\b', r'\bmaglocks?\b', r'\bhigh-security doors?\b',
            r'\belectric strikes?\b', r'\baccess control systems?\b',
            r'\bnormally closed \(nc\) magnetic door switch\b', r'\bmagnetic door switch\b',
            r'\bconference room av setup\b', r'\bswitching between multiple hdmi\b',
            r'\bhdmi switcher\b', r'\bvideo matrix switcher\b',
            r'\bedge computing.*smart lighting\b', r'\bedge computing.*hvac\b',
            r'\bedge computing.*security\b', r'\bedge computing.*building\b',
            r'\btypes of cable are used when installing video surveillance\b',
            r'\bvideo surveillance components\b',
            r'\bdigital twin.*chiller\b', r'\bdigital twin\b',
            r'\bsupervisory controls? and data acquisition\b', r'\bscada\b',
            r'\bfire and life safety\b'
        ],

        # 6.0 Data Communications
        'EST-6.1': [  # Introduction and Categories of Data Communications
            r'\bdata communications?\b', r'\bsimplexs?\b', r'\bhalf-duplexs?\b', r'\bfull-duplexs?\b',
            r'\bdte\b', r'\bdce\b', r'\bdata terminal equipment\b', r'\bdata circuit-terminating equipment\b',
            r'\binteroperabilit(?:y|ies)\b', r'\bpeer-to-peer\b', r'\bclient-server\b', r'\bpoint-to-multipoint\b',
            r'\blocal\s+area\s+networks?\b', r'\blans?\b', r'\bwide\s+area\s+networks?\b', r'\bwans?\b',
            r'\bmetropolitan\s+area\s+networks?\b', r'\bmans?\b',
            r'\bcsma/cd\b', r'\bcsma/ca\b', r'\bdata\s+collision\b', r'\bcollision\s+detection\b',
            r'\bjam\s+signal\b', r'\brandom\s+backoff\b', r'\bcarrier\s+sense\s+multiple\s+access\b',
            r'\bpackets?\b', r'\bjitter\b', r'\bascii\b', r'\bbinary data code\b',
            # Expansions
            r'\breliability of the equipment.*downtime\b', r'\blatency is made of four components\b',
            r'\btwisting pairs of wires in utp\b', r'\butp cables?\b',
            r'\bredundant paths between switches\b', r'\bdata center\b',
            r'\bweb server.*simultaneous clients\b', r'\bupstream data band\b',
            r'\bbinary data may be organized\b'
        ],
        'EST-6.2': [  # Configurations and Network Topology
            r'\btopology\b', r'\btopologies\b', r'\bpoint-to-point\b', r'\bmultipoint\b', r'\bconfigurations? of a network\b',
            r'\bmesh\s+(?:network|topology)\b', r'\bphysical\s+mesh\b',
            r'\b(?:star|bus|ring|tree|hybrid)\s+topology\b',
            r'\bfully[- ]connected\s+(?:mesh|network)\b',
            r'\bphysical\s+cables\s+required\b', r'\bdedicated\s+physical\s+cables\b',
            r'\btwo-wire telephone system\b', r'\btwo-wire circuit.*signal direction\b',
            r'\blegacy two-wire\b', r'\btwo-wire vs 4-wire\b',
            r'\bfully redundant, fully meshed network\b'
        ],
        'EST-6.3': [  # Transmission Modes and Synchronization
            r'\basynchronous transmission\b', r'\bsynchronous transmission\b', r'\bbaud rate\b',
            r'\bbit rate\b', r'\bdata framing\b',
            # Expansions
            r'\bserial transmission\b', r'\bparallel transmission\b', r'\bserial vs parallel\b',
            r'\basynchronous framing\b', r'\bstart bits?\b', r'\bstop bits?\b',
            r'\btransmission efficiency\b', r'\bframing bits?\b', r'\bcharacter framing\b',
            r'\bisochronous transmission\b',
            r'\bcryptographic technique\b', r'\bunique fixed-size code\b', r'\bmessage digest\b',
            r'\bhash function\b', r'\bdata integrity\b', r'\bhmac\b', r'\bdigital signature\b',
            r'\boverhead bits\b'
        ],
        'EST-6.4': [  # Network Components (Terminals, Multiplexers, Concentrators, FEP, Serial Interface)
            r'\bmultiplexers?\b', r'\bconcentrators?\b', r'\bfront-end processor\b', r'\bfep\b',
            r'\bserial interface\b', r'\brs-232\b', r'\bmodems?\b', r'\bcircuit switch\w*', r'\bpacket switch\w*',
            r'\bmessage switch\w*', r'\bnetwork switch(?:es)?\b', r'\brouters?\b',
            r'\bnetwork components?\b',
            # Expansions
            r'\bline control unit\b', r'\blcu\b',
            r'\bunix environment\b', r'\bcat file\.txt\b', r'\btrue system call\b',
            r'\bsystem call rather than a user-level\b', r'\buser-level command or shell\b',
            r'\bunix component\b', r'\binterprets user commands\b', r'\borganizes files into a hierarchical\b',
            r'\bunix process\b', r'\bconsuming 100% cpu\b', r'\bprofiler\b', r'\bstrace\b',
            r'\bterminal-to-host\b', r'\blu \(logical unit\)', r'\blogical unit\b', r'\blu type\b',
            r'\bfork\(\) system call\b',
            r'\bprovides the interface between user programs and the kernel\b',
            r'\binterface between user programs and the kernel\b'
        ],
        'EST-6.5': [  # Security and Cryptography
            r'\bcryptography\b', r'\bencryption\b', r'\b\bdes encryption\b', r'\baes encryption\b',
            r'\brsa algorithm\b', r'\bnetwork firewall\b', r'\bssl\b', r'\btls\b',
            # Expansions
            r'\bunauthorized user\b', r'\bnetwork security\b', r'\bunique password\b',
            r'\bauthentication\b', r'\bcookies?\b',
            r'\bsecure vpn\b', r'\bvpn.*encapsulated, encrypted\b',
            r'\bsplit tunneling in a vpn\b', r'\bcorporate vpn system\b',
            r'\btunneling protocol.*vpn\b', r'\bipsec\b', r'\bl2tp\b', r'\bpptp\b'
        ],
        'EST-6.6': [  # OSI Model and TCP/IP Architecture
            r'\bosi model\b', r'\btcp/ip\b', r'\bip address\b', r'\bipv4\b', r'\bipv6\b',
            r'\bsubnet(?:ting)?\b', r'\bapplication layer\b', r'\btransport layer\b', r'\bnetwork layer\b',
            r'\bseven layers?\b', r'\b7 layers?\b', r'\bpresentation layer\b', r'\bsession layer\b',
            r'\bdata link layer\b', r'\bphysical layer\b', r'\bprotocol data unit\b', r'\bpdu\b',
            r'\bframes?\b', r'\bnetwork support layer\b', r'\buser support layer\b', r'\bsynchronization points?\b',
            # Expansions
            r'\bosi layer\b', r'\bblock of addresses is granted\b', r'\b205\.16\.\b',
            r'\binteractions between communicating devices\b', r'\budp and tcp\b', r'\btcp and udp\b',
            r'\bconnection-oriented transport-layer\b', r'\bwell-known.*tcp.*udp\b',
            r'\bseparates a message.*adding a sender address\b', r'\biso standard covers all aspects of network\b',
            r'\ballows any two different systems to communicate\b',
            r'\bwaiting for data from a socket\b', r'\bsockets?\b', r'\bnon[- ]blocking socket\b',
            r'\bblocking while waiting for data\b', r'\btcp client programming\b',
            r'\brole of the connect\(\) system call\b', r'\bconnect\(\) system call\b',
            r'\baccept\(\) on a socket\b', r'\bcalls recv\(\) before accept\(\)\b',
            r'\bosi reference model was developed by which\b',
            r'\bosi layers are responsible for hardware addressing\b',
            r'\bprotocol is commonly used to test connectivity\b', r'\bicmp\b',
            r'\binternet engineering steering group\b', r'\bietf\b',
            r'\bconnectionless transport-layer protocol that transmits user datagrams\b',
            r'\buser datagram protocol\b',
            r'\bserver to block until a client\b',
            r'\bmulticast ip address\b', r'\baddress classes identifies multicast\b'
        ],
        'EST-6.7': [  # SNA, Character and Bit-Oriented Protocols
            r'\bhdlc\b', r'\bsna\b', r'\bsystems network architecture\b', r'\barq\b',
            r'\bsliding window protocol\b', r'\bstop-and-waits?\b', r'\bselective repeat\b',
            r'\bcharacter-oriented protocol\b', r'\bbit-oriented protocol\b',
            r'\bbit-oriented framing over character-oriented\b',
            r'\bcharacter-oriented framing\b', r'\bbit-oriented framing\b'
        ],
        'EST-6.8': [  # LAN, MAN, WAN, GAN, ISDN, B-ISDN
            r'\blocal area network\b', r'\blan\b', r'\bwide area network\b', r'\bwan\b',
            r'\bmetropolitan area network\b', r'\bman\b', r'\bglobal area network\b', r'\bgan\b',
            r'\bisdn\b', r'\bb-isdn\b', r'\bintegrated services digital network\b',
            r'\basynchronous transfer mode\b', r'\batm cells?\b',
            r'\bethernets?\b', r'\bieee 802\b', r'\bwi-fis?\b', r'\bbluetooths?\b', r'\bvlan\b',
            # Expansions
            r'\bbri lines?\b', r'\bpri lines?\b', r'\bisdn bri\b',
            r'\bbri interface\b', r'\btotal bandwidth of a bri\b', r'\b2b\+d\b',
            r'\bbasic rate interface\b',
            r'\btoken ring network\b', r'\btoken ring\b', r'\bbroken link can disrupt the network\b'
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
        'ELECS-1.0': [r'\bdc circuits?\b', r'\bdirect current circuits?\b', r'\bohm\'?s law\b', r'\bresistors?\b', r'\bthevenin\b', r'\bnorton\b'],
        'ELECS-2.0': [r'\bac circuits?\b', r'\balternating current circuits?\b', r'\bphasors?\b', r'\brlc circuit\b', r'\b3-phase\b', r'\bthree-phase\b'],
        'ELECS-3.0': [r'\belectromagnetics? field\b', r'\bmagnetic fields?\b', r'\bmagnetic circuit\b', r'\bpermeabilit\w*\b', r'\bpermittivit\w*\b'],
        'ELECS-4.0': [
            r'\bdiode circuits?\b', r'\btransistor circuits?\b', r'\btransistor(?:s)?\b',
            r'\bbjt\b', r'\bfets?\b', r'\bsemiconductor(?: device)?\b', r'\bcommon emitter\b',
            r'\bemitter follower\b', r'\bce configuration\b', r'\bdiodes?\b'
        ],
        'ELECS-5.0': [r'\bop-amp circuits?\b', r'\bamplifier circuits?\b', r'\boscillator circuits?\b', r'\bactive filters?\b', r'\bbode\b'],
        'ELECS-6.0': [r'\bthyristors?\b', r'\btransducers?\b', r'\bplc\b', r'\bbuilding management\b', r'\bscr\b', r'\btriac\b'],
        'ELECS-7.0': [r'\blogic circuits?\b', r'\blogic gates?\b', r'\bboolean algebra\b', r'\bflip-flops?\b', r'\bk-maps?\b'],
        'ELECS-8.0': [r'\bmicroprocessors?\b', r'\bmicrocontrollers?\b', r'\bassembly language\b', r'\b8085\b', r'\b8086\b'],
        'ELECS-9.0': [r'\bfeedback control\b', r'\broot locus\b', r'\bpid controllers?\b', r'\bcontrol systems?\b', r'\btransfer functions?\b'],
    },
    'GEAS': {
        'GEAS-1.0': [r'\bchemistry for engineers?\b', r'\bchemical reactions?\b', r'\bchemical bonds?\b', r'\bchemical compounds?\b', r'\bmolar mass\b', r'\bperiodic table\b', r'\bchemical equations?\b', r'\bacid(?:ic)? or base\b'],
        'GEAS-2.0': [r'\bphysics for engineers?\b', r'\bnewton\'?s laws?\b', r'\bkinetic energy\b', r'\bclassical mechanics\b', r'\bacceleration of gravity\b', r'\bcoefficient of friction\b', r'\bconservation of energy\b', r'\blinear momentum\b'],
        'GEAS-3.0': [r'\bengineering economics?\b', r'\bcompound interest\b', r'\bannuit(?:y|ies)\b', r'\bpresent worth\b', r'\binterest rate\b', r'\btime value of money\b', r'\brate of return\b', r'\bcash flow\b'],
        'GEAS-4.0': [r'\bengineering management\b', r'\bmanagement functions?\b', r'\borganization(?:al)?\b', r'\bmanager(?:s|ial)?\b', r'\bfunctions? of (?:an? )?engineer\b', r'\bproject management\b', r'\bleadership styles?\b', r'\bdecision[- ]making\b'],
        'GEAS-5.0': [r'\btechnopreneurships?\b', r'\bstartups?\b', r'\bbusiness plans?\b', r'\bentrepreneur(?:ship)?\b', r'\bventure capital\b', r'\bbusiness models?\b'],
        'GEAS-6.0': [r'\bthermodynamics\b', r'\bphysics 2\b', r'\bnuclear physics\b', r'\bmodern physics\b', r'\bheat engines?\b', r'\belectromagnetic induction\b', r'\balternating current\b'],
        'GEAS-7.0': [r'\bmaterials? science\b', r'\bcrystal structures?\b', r'\bmetallurg(?:y|ies)\b', r'\bstress-strains?\b', r'\bmaterial properties\b', r'\bsemiconductor materials?\b'],
        'GEAS-8.0': [r'\bcomputer programming\b', r'\bobject[- ]oriented programming\b', r'\bsoftware engineering\b', r'\bprogramming languages?\b', r'\bobject-oriented\b', r'\balgorithms?\b'],
        'GEAS-9.0': [
            r'\benvironmental (?:science|engineering)\b', r'\becolog(?:y|ies)\b', r'\bpollutions?\b',
            r'\bnutrient cycles?\b', r'\becosystems?\b', r'\bhydrologic cycle\b',
            r'\benvironmental impact\b', r'\bsustainable development\b'
        ],
        'GEAS-10.0': [
            r'\bece laws?\b', r'\bengineering ethics\b', r'\bra ?9292\b', r'\bcontract law\b',
            r'\brepublic acts?\b', r'\bra\s*\d{3,5}\b', r'\banti-cable\b', r'\bcode of ethics\b',
            r'\bboard of electronics\b', r'\blicensure examination\b'
        ],
        'GEAS-11.0': [r'\bcad software\b', r'\bautocad\b', r'\bdrafting\b', r'\bcomputer[- ]aided (?:design|drafting)\b', r'\bcad drawing\b'],
    },
    'EST': {
        'EST-1.0': [r'\bsignal processing\b', r'\bsampling theorem\b', r'\bdigital filters?\b', r'\bfourier transform\b', r'\bdsp\b'],
        'EST-2.0': [r'\bcommunication systems?\b', r'\bmodulation techniques?\b', r'\bradio receivers?\b', r'\bam transmitter\b', r'\bfm transmitter\b', r'\bsatellite comms?\b', r'\bradar systems?\b'],
        'EST-3.0': [r'\bdigital communications?\b', r'\bpulse code modulation\b', r'\berror detections?\b', r'\bpcm\b', r'\bpsk\b', r'\bfsk\b', r'\bqam\b'],
        'EST-4.0': [r'\btransmission lines?\b', r'\bantenna systems?\b', r'\bwave propagations?\b', r'\bfiber optics?\b', r'\bwaveguides?\b'],
        'EST-5.0': [r'\belectronic systems? and design\b', r'\btransducers?\b', r'\bplc\b', r'\bbuilding management\b', r'\bcctv\b', r'\bfire alarm\b'],
        'EST-6.0': [r'\bdata communications?\b', r'\bcomputer networks?\b', r'\bosi models?\b', r'\btcp/ip\b', r'\bethernet\b', r'\brouters?\b'],
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. DECK-NAME AND DESCRIPTION SCORING HINTS
# ─────────────────────────────────────────────────────────────────────────────
HINT_WEIGHT = 2

DECK_TOPIC_HINTS = {
    # EST
    'fiber optics': ['EST-4.7', 'EST-4.0'],
    'transmission lines': ['EST-4.1', 'EST-4.0'],
    'transma': ['EST-4.1', 'EST-4.0'],
    'am and fm': ['EST-2.2', 'EST-2.4', 'EST-2.0'],
    'signals-noise-am-fm': ['EST-2.1', 'EST-1.0', 'EST-2.0'],
    'antenna': ['EST-4.6', 'EST-4.0'],
    'digi comms': ['EST-3.1', 'EST-3.0', 'EST-6.0'],
    'digi-data comms': ['EST-3.1', 'EST-3.0', 'EST-6.0'],
    'data comms': ['EST-6.1', 'EST-6.0'],
    'data communications': ['EST-6.1', 'EST-6.0'],
    'radio wave prop': ['EST-4.4', 'EST-2.0', 'EST-4.0'],
    'wave prop-microwave': ['EST-4.4', 'EST-2.0', 'EST-4.0'],
    'noise': ['EST-2.2', 'EST-2.0'],
    'signals': ['EST-1.1', 'EST-1.0'],
    'principle of comms': ['EST-2.1', 'EST-2.0'],
    'review exam est 4': ['EST-2.6', 'EST-4.4'],
    'review exam est 2': ['EST-2.4', 'EST-2.5'],
    'review exam est 5': ['EST-4.1', 'EST-4.2'],
    'review exam est 10': ['EST-6.6', 'EST-6.1'],
    'review exam est - antenna': ['EST-4.6', 'EST-4.0'],
    # ELECS
    'dc circuits': ['ELECS-1.1', 'ELECS-1.0'],
    'microps lecture': ['ELECS-8.1', 'ELECS-8.0'],
    'bjt lecture': ['ELECS-4.2', 'ELECS-4.0'],
    'bjt': ['ELECS-4.2', 'ELECS-4.0'],
    'review exam elecs 12': ['ELECS-9.3', 'ELECS-9.0'],
    'review exam elecs 3': ['ELECS-3.1', 'ELECS-3.0'],
    'review exam elecs 11': ['ELECS-8.1', 'ELECS-8.0'],
    # GEAS
    'cad': ['GEAS-11.1', 'GEAS-11.0'],
    'cprog': ['GEAS-8.3', 'GEAS-8.0'],
    'ece laws': ['GEAS-10.4', 'GEAS-10.0'],
    'eng management': ['GEAS-4.1', 'GEAS-4.0'],
    'engmgmt': ['GEAS-4.1', 'GEAS-4.0'],
    'safety & pec codes': ['GEAS-10.6', 'GEAS-10.0'],
    'techno': ['GEAS-5.1', 'GEAS-5.0'],
    'rc exam geas 26': ['GEAS-8.3', 'GEAS-8.0'],
    'review exam geas 10': ['GEAS-8.1', 'GEAS-8.0'],
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
        (re.compile(r'\b(?:microprocessors?|microcontrollers?|microps|assembly|8085|8086|pic|avr|8051|embedded)\b', re.I), 'ELECS-8.0'),
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
        (re.compile(r'\b(?:satellite|radar|cellular|gsm|5g|lte|microwave comms?|wireless comms?)\b', re.I), 'EST-2.0'),
        (re.compile(r'\b(?:audio|acoustics?|video|television|tv|bms|building management|cctv|fire alarm)\b', re.I), 'EST-5.0'),
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


# ─────────────────────────────────────────────────────────────────────────────
# 1.5 REFINED SUBTOPIC EXPANSIONS
# Patterns derived from keyword analysis of unclassified exam pool cards
# across MATH, ELECS, GEAS, EST.
# ─────────────────────────────────────────────────────────────────────────────
# Clean standalone pattern definitions for classifying remaining ECE cards

REFINED_SUBTOPIC_RULES = {
    'MATH': {
        'MATH-1.1': [
            r'\blim\s*\[?', r'\blim\s+[fgh]\(x\)\b', r'\blim\s+[a-z]\b',
            r'\bas\s+[a-z]\s*(?:approaches|→)\b',
            r'g\(f\(', r'f\(g\(', r'h\(x\)\s*=\s*f\(g\(', r'\bcomposite functions?\b'
        ],
        'MATH-1.2': [
            r'\bthen f\'\(x\)\b', r'f\'\(x\)\s*=', r'\bconcave upward\b', r'\bconcave downward\b',
            r'\bintervals? is f (?:increasing|decreasing)\b',
            r'\bequation of the (?:tangent|normal)\b', r'\btangent to (?:the )?curve\b', r'\bnormal to (?:the )?curve\b',
            r'\bpoint of inflection\b', r'\bcoordinates of the point of inflection\b',
            r'\bladder slides\b', r'\bradius is increasing\b', r'\bradius of a sphere is increasing\b',
            r'\bcircular ripples\b', r'\bradius of the outer one\b',
            r'\baltitude of a right circular cone\b', r'\bincreases at the rate of\b',
            r'\blinear approximation\b', r'\bvertex method\b',
            r'\bheads due north\b', r'\bleave the same place\b',
            r'\bposition is given by s\(t\)\b', r'\bvelocity s\'\(t\)\b', r'\bparticle\'?s position\b',
            r'\bacceleration at time\b', r'\bmoving object whose position is given by\b',
            r'\bposition of a mechanical dampener\b', r'\bvelocity of a linear mechanical actuator\b',
            r'\bmaximum possible measurement error\b', r'\bpercentage error in\b',
            r'i_d\s*=\s*i_s\b', r'\bshockley\'?s diode equation\b',
            r'\bbikes are separated\b', r'\briding north at a rate\b',
            r's\s*=\s*\d+t\^?3', r'\bpoint moves along a straight line\b',
            r'\bbouillon cube\b', r'\bfarmer has .* fencing\b', r'\benclose a rectangular plot\b'
        ],
        'MATH-1.3': [
            r'\bjerk\b', r's\'\'\'\(t\)', r'\bthird derivative\b'
        ],
        'MATH-1.4': [
            r'\bperpendicular to another line\b', r'\bparallel to line\b', r'\bline with an inclination\b',
            r'\bslope of\b', r'\bequation of the line\b', r'\bline passes through\b',
            r'\btwo points in the line\b', r'\bdistance .* from the line\b',
            r'x\s*=\s*t,\s*y\s*=\s*t\^?2', r'x\(t\)\s*=\s*.*y\(t\)\s*=\s*',
            r'\bparametric operating envelope\b',
            r'\bacute angle between the lines\b', r'\bangle between the lines\b',
            r'ax\^?2\s*\+\s*by\^?2', r'\bhas its center at\b', r'\bvertices of the base of an isosceles\b'
        ],
        'MATH-1.5': [
            r'\bthe gradient at\b', r'\bits gradient is\b', r'\bgradient is:\b',
            r'\bgradient at \(\d+\s*,\s*\d+\)\b', r'\bgradient at \(\d+\s*,\s*\d+\s*,\s*\d+\)\b'
        ],
        'MATH-2.2': [
            r'\bpartial fractions?\b', r'\bdecomposing.*partial fraction\b', r'\brational integrand\b'
        ],
        'MATH-2.4': [
            r'\baverage area\b', r'\baverage value of the function\b', r'\barea of the region\b',
            r'\bbetween the curve\b', r'\bhow much work\b', r'\busing hooke\'?s law\b',
            r'\bdistance traveled\b', r'\bdistance travelled\b', r'\bdistance between t\s*=\b',
            r'\bwater accumulated\b', r'\btotal water accumulated\b',
            r'\bparticle moves along a line with acceleration\b',
            r'\blength of the curve\b', r'\binner tube\b', r'\btorus\b',
            r'\baverage value of the amplitude\b', r'\bhalf sine wave\b'
        ],
        'MATH-2.5': [
            r'\bcardioid\b', r'\barea enclosed by the cardioid\b', r'r\s*=\s*\d+\s*\(1\s*\+\s*cos'
        ],
        'MATH-3.1': [
            r'\brl series circuit\b', r'\brc series circuit\b', r'\blr circuit\b',
            r'\bparticular solution\b', r'\bgeneral solution\b', r'\barbitrary constant\b',
            r'\bdecays exponentially\b', r'\bgrows exponentially\b', r'\bdecay rate\b',
            r'\brate proportional to its\b', r'\bsolution curve of y\'\b', r'y\'\s*=\s*y',
            r'\bcharacteristic roots?\b', r'\bcomplementary solution\b',
            r'\\frac\{\\mathrm\{d\}y\}\{\\mathrm\{d\}x\}',
            r'\bscene of a murder\b', r'\bbody\'?s temperature\b', r'\btank initially contains\b',
            r'\bpumped into the tank\b', r'\brate at which people hear about a product\b',
            r'\bhalf-life of a radioactive substance\b', r'\btank is filled with brine\b',
            r'\bdissolved salt\b', r'\bradium-226\b', r'\bdecays at a rate proportional\b',
            r'\bdating fossil remains\b', r'\bcarbon dating\b', r'\bcarbon-14\b'
        ],
        'MATH-3.2': [
            r'\brlc series circuit\b', r'\bseries rlc circuit\b',
            r"y'''", r"y''\b", r'\bthird-order differential\b',
            r"y''\s*\+\s*p\(x\)y'"
        ],
        'MATH-3.3': [
            r'f\(s\)\s*=\s*ln', r'\btime-domain function f\(t\) for f\(s\)\b',
            r'\bl\^?-1\s*\{', r'l\^\{-1\}'
        ],
        'MATH-4.1': [
            r'\bphasors?\b', r'\bphasor voltage\b', r'\bcomplex load\b', r'\bcomplex current phasor\b',
            r'\bcomplex impedance of z\b', r'\bcomplex arithmetic\b', r'\brectangular form\b',
            r'\bcis\b', r'\b12 cis\b', r'[∠∡]', r'\bfind real numbers x and y such that\b',
            r'3x\+2iy', r'\bratio of two power or intensity values\b', r'\blinear scale to a decibel scale\b',
            r'\bpolar form\b', r'\bx \+ iy\b', r'\bf\(z\)\s*=', r'\b[0-9]+i\b',
            r'sqrt\s*\d+\s*-\s*i', r'\bsquare root of \d+\s*[+-]\s*\d+i\b',
            r'\bvertices at .*[0-9]+i\b', r'\bexpress z\s*=\b', r'f\(i\)'
        ],
        'MATH-4.2': [
            r'\balternating series\b', r'\bseries diverges\b', r'\bseries converges\b',
            r'\bseries for ln\b', r'\bmaximum error when approximating\b',
            r'\bopen interval is\b', r'\bseries σ\b', r'\bseries \Σ\b'
        ],
        'MATH-4.4': [
            r'\bsimultaneous linear system\b', r'\binfinitely many solutions\b'
        ],
        'MATH-4.5': [
            r'\bvoltage readings at uniform intervals\b', r'\buniform intervals\b'
        ],
        'MATH-5.1': [
            r'\bdiscrete variable\w*', r'\bcontinuous variable\w*',
            r'\bqualitative variable\w*', r'\bquantitative variable\w*'
        ],
        'MATH-5.2': [
            r'\bmutually exclusive\b', r'\bright-skewed\b', r'\bleft-skewed\b',
            r'\btail extends to the left\b', r'\bjumbling the letters\b',
            r'\burn [ab] has\b', r'\bdistinct (?:red|blue) balls\b', r'\bmajoring in\b'
        ],
        'MATH-6.1': [
            r'\bscalar quantit(?:y|ies)\b', r'\bvector quantit(?:y|ies)\b',
            r'\bprojection of [a-z] on [a-z]\b', r'\bangle between [a-z] and [a-z]\b',
            r'\bparallelepiped\b', r'\belectrostatic force between\b',
            r'\bvolume of a parallelepiped\b', r'[a-z]\s*·\s*[a-z]',
            r'\ba\s*·\s*b\b', r'\|a\|\s*\|b\|', r'\bpoint charges in free space\b',
            r'\bfind the potential at the origin\b', r'\bpotential at the origin\b',
            r'\bcharge q\s*=\s*[-0-9]+\s*[μu]c\b', r'\bcharge q\w* located at the origin\b',
            r'\bproduces a field for which\b', r'\brepulsive force\b', r'\battractive force\b',
            r'\bangle between a\s*=\s*'
        ],
        'MATH-6.2': [
            r'\bgradient at\b', r'\bits gradient\b', r'\bcompute (?:the )?div\b', r'\bdiv\s*f\b',
            r'\bcompute (?:the )?curl\b', r'\bcurl\s*f\b', r'\bgauss\'? law in point form\b',
            r'\bvolume charge density\b', r'\btotal flux through\b',
            r'\bsources of electric (?:e-)?fields\b', r'\bsurface charge density that increases\b',
            r'\bexpressions? is always zero\b', r'\bdiv curl\b', r'\bcurl grad\b'
        ],
        'MATH-7.1': [
            r'\bfind z[\{\[\(]', r'z⁻¹', r'\binverse z\b', r'\beven component\b', r'\bodd component\b',
            r'\bperiod of a signal\b', r'\bfundamental period\b', r'\bsignal x\(t\)\b',
            r'\bcausal system\b', r'\bperiodic signal\b', r'\bsignals? is periodic\b',
            r'\boutput at the present time depends\b',
            r'\binput signal x uniquely by observing\b', r'\binvertible system\b'
        ],
        'MATH-8.1': [
            r'\bclosed-loop poles\b', r'\bpoles at \$?s\s*=\b', r'\bpair of poles at\b',
            r'\bpoles are greater than number of zeroes\b'
        ],
        'MATH-8.2': [
            r'\bsteady state accuracy\b', r'\boscillations in the output response\b'
        ]
    },
    'ELECS': {
        'ELECS-1.1': [
            r'\bthree series resistors\b', r'\bseries resistors\b', r'\bparallel resistors\b',
            r'\bresistors? in series\b', r'\bresistors? in parallel\b', r'\b100 ohm resistor\b',
            r'\bconnected in series with a\b', r'\bdc is favored over ac\b',
            r'\bac replaced direct current\b', r'\balternating current replaced\b',
            r'\bac more suitable than dc\b', r'\bfree-electron density\b'
        ],
        'ELECS-1.3': [
            r'\bsuperposition\b', r'\busing superposition\b', r'\bsource conversion\b',
            r'\bdependent voltage source\b', r'\bdependent current source\b', r'\bdependent sources?\b'
        ],
        'ELECS-1.4': [
            r'\bcapacitor charging through a\b', r'\bcharging through a\b',
            r'\bdigital timing circuit\b', r'\btime constant τ\b'
        ],
        'ELECS-1.5': [
            r'\bdc voltmeter\b', r'\bhigh-input-impedance dc voltmeter\b',
            r'\bwatthour meter\b', r'\benergy meter\b', r'\bmultimeter\b',
            r'\bclamp-on ammeter\b', r'\bammeter\b', r'\bseries multiplier resistor\b',
            r'\bmultiplier resistor\b', r'\binstruments consumes the lowest power\b',
            r'\belectrodynamometer\b', r'\bfixed coil\b', r'\bdeflecting torque\b',
            r'\bindicating instrument\b', r'\bcro can be built\b', r'\bpower of a \d+ kw transmitter\b',
            # DC Machines
            r'\bd\.?c\.? generator\b', r'\bd\.?c\.? motor\b', r'\bdc shunt motor\b',
            r'\bshunt motor\b', r'\bseries motor\b', r'\bshunt generator\b',
            r'\bdc compound motor\b', r'\bcompound motor\b', r'\blap wound\b',
            r'\bwave wound\b', r'\bregenerative braking\b', r'\bretardation test\b',
            r'\btraction motor\b', r'\btraction work\b', r'\bflux per pole\b',
            r'\bvoltage build-up process\b', r'\bover compound\b'
        ],
        'ELECS-2.1': [
            r'\bsignals are in phase\b', r'\bout of phase with each other\b',
            r'\bphase difference of \d+°\b', r'\b90 degrees out of phase\b', r'\b180 degrees out of phase\b',
            r'sin\s*\(\s*377\s*t'
        ],
        'ELECS-2.2': [
            r'\bprecise equivalent impedance\b', r'\bequivalent impedance of \d+\s*[+-]\s*j\d+\b',
            r'\b50 \+ j50\b'
        ],
        'ELECS-2.3': [
            r'\bparallel rlc resonant\b', r'\brlc resonant tank\b', r'\bresonant tank\b'
        ],
        'ELECS-2.5': [
            r'\btransimpedances?\b', r'\btransadmittances?\b', r'\btransfer impedance\b', r'\btransfer admittance\b',
            r'\bt parameters\b', r'\bt-parameters\b', r'\bcascaded networks\b', r'\bchain parameters\b'
        ],
        'ELECS-3.1': [
            r'\bcoulomb is\b', r'\ba "coulomb" is\b', r'\bampere\'?s force law\b',
            r'\bparallel, straight conductors\b', r'\btwo infinitely long, parallel\b', r'\blines of force\b'
        ],
        'ELECS-4.1': [
            r'\bpeak detector circuit\b', r'\bpeak detector\b', r'\bzeners?\b', r'\bzener\b', r'\bcirculating current\b'
        ],
        'ELECS-4.2': [
            r'\bcascading two voltage amplifiers\b', r'\binput and output signals in an amplifier\b',
            r'\bamplifier has a gain of \d+ db\b', r'\bvoltage gain a\'?v\b',
            r'\bmaximum overall voltage gain\b', r'\bz_in2\b', r'\bload power\b',
            r'\bpower dissipation of a 2n3055\b', r'\b2n3055\b', r'\bdetermine efficiency\b'
        ],
        'ELECS-4.3': [
            r'\btwo types of current in a semiconductor\b', r'\bintrinsic semi-conductor\b',
            r'\bdrift and diffusion current\b', r'\bdrift current\b', r'\bdiffusion current\b',
            r'\bnegative electron\b', r'\bpostulate of niels bohr\b', r'\bbohr\'?s atomic model\b',
            r'\batomic mass unit in grams\b', r'\bmonolithic ic fabrication\b', r'\bic fabrication\b',
            r'\bcleaning solder\b',
            r'\bfermi-dirac\b', r'\belectronic state at energy e\b', r'\beinstein relation\b'
        ],
        'ELECS-4.5': [
            r'\bshortcomings of mosfets\b', r'\bmosfets? is that they\b',
            r'\bdetermine vb\b', r'\bdetermine vc\b', r'\bdetermine ve\b', r'\bbjt biasing\b'
        ],
        'ELECS-5.1': [
            r'\boctaves?\b', r'\bdecades?\b', r'\bincreasing it by one octave\b',
            r'\bone octave\b', r'\bhow many octaves\b', r'\bhigh-input-impedance\b'
        ],
        'ELECS-5.2': [
            r'\btransformer coupling\b', r'\brc coupling\b', r'\bdirect coupling\b',
            r'\btuned amplifier\b', r'\bdisadvantage of impedance matching\b'
        ],
        'ELECS-5.4': [
            r'\bop amp has the following open-loop\b', r'\bopen-loop specs\b',
            r'\bdetermine the output voltage for the circuit shown\b',
            r'\btrip point of a comparator\b', r'\boutput voltage, vo\b',
            r'\bnoninverting amplifier\b', r'\bsumming op amp\b', r'\blinear ics?\b'
        ],
        'ELECS-5.5': [
            r'\bphase-shift oscillator\b', r'\brc phase[- ]shift\b', r'\brc sections?\b',
            r'\bphase shift oscillator\b', r'\bclapp oscillator\b', r'\barmstrong oscillator\b',
            r'\bwien-bridge oscillator\b', r'\bhigh-pass rc filter\b', r'\bband-pass rc filter\b',
            r'\blow-pass rc filter\b', r'\bsustain oscillations\b',
            r'\bcrystal frequency\b', r'\blc oscillators? have over rc\b',
            r'\blc oscillators?\b', r'\bgain of an amplifier changes from\b'
        ],
        'ELECS-6.1': [
            r'\bscrs?\b', r'\btriacs?\b', r'\bdiacs?\b', r'\bujts?\b', r'\bputs?\b',
            r'\bforced commutation\b', r'\bcommutation of scr\b', r'\bgate triggering method\b',
            r'\bturn-off time\b', r'\bholding current\b', r'\blatching current\b'
        ],
        'ELECS-6.3': [
            r'\bdac\b', r'\badc\b', r'\br-2r\b', r'\bthree-bit dac\b',
            r'\bdigital-to-analog\b', r'\banalog-to-digital\b',
            r'\bspectrum analyzer\b', r'\bconventional oscilloscope\b',
            r'\bdeflect the beam across the crt\b', r'\bcrt face\b'
        ],
        'ELECS-6.6': [
            r'\b70v distributed paging\b', r'\bpaging system\b'
        ],
        'ELECS-7.1': [
            r'\bwhich gate\b', r'\bgate gives\b', r'\blogic gates?\b',
            r'\bexclusive[- ]or\b', r'\bxor\b', r'\bxnor\b', r'\bxnor function\b',
            r'\bequality detector\b', r'\bdemorgan\b', r'\bde\s*morgan\b',
            r'\bintegrated circuits called "digital"\b', r'\bswitching-type integrated circuits\b',
            r'\bhamming code\b', r'\bparity method of error detection\b',
            r'\bweighted code\b', r'\bself-complementing\b',
            r'\bbcd\b', r'\bbinary-coded decimal\b', r'\bbinary coding\b',
            r'\bex-nor\b', r'\bx-nor\b', r'\bttl family\b', r'\btotem-pole\b'
        ],
        'ELECS-7.3': [
            r'\bsr latch\b', r'\blatches?\b', r'\bnor-based sr latch\b', r'\bnand-based sr latch\b',
            r'\bcross-coupled nor\b', r'\binvalid/forbidden state\b', r'\bforbidden state\b',
            r'\bjohnson counters?\b', r'\bring counters?\b', r'\bbinary counters?\b',
            r'\bmodulus of a.*counter\b', r'\bmod-\d+ counter\b', r'\b4-bit binary counter\b',
            r'\bcounts in a sequence of binary\b',
            r'\bedge triggered\b', r'\bedge-triggered\b'
        ],
        'ELECS-8.1': [
            r'\brisc\b', r'\bcisc\b', r'\bsuperscalar\b', r'\bpipeline hazard\b',
            r'\bdata hazard\b', r'\bstructural hazard\b', r'\bbranch hazard\b', r'\bcontrol hazard\b',
            r'\b5-stage risc\b', r'\binstruction-level parallelism\b', r'\bilp\b',
            r'\bbattery consumption without significantly affecting perf\b', r'\bmobile processor designer\b'
        ],
        'ELECS-8.2': [
            r'\b4 kb memory chip\b', r'\bmemory chip mapped\b', r'\babsolute physical hexadecimal address\b'
        ],
        'ELECS-8.3': [
            r'\binterrupt latency\b'
        ],
        'ELECS-8.4': [
            r'\bc\+\+\b', r'\bembedded systems?\b', r'\bembedded software\b',
            r'\binstruction length\b', r'\bloader\b', r'\blinker\b',
            r'\bdata transfer execution\b', r'\bdivided into modules\b', r'\bseparate modules\b',
            r'\bcompiling each module\b', r'\bjump instruction\b'
        ],
        'ELECS-9.2': [
            r'\bphase lag at ω\b', r'\bincreasing system order\b', r'\bpole very close to the imaginary axis\b'
        ],
        'ELECS-9.4': [
            r'\bangle of 180° minus\b'
        ]
    },
    'GEAS': {
        'GEAS-1.1': [
            r'\bhomogeneous mixture\b', r'\bheterogeneous mixture\b', r'\bmixtures?\b',
            r'\braoult\'?s law\b', r'\bvapor pressure\b', r'\bnonvolatile solute\b',
            r'\ble chatelier\b', r'\breaction equilibrium\b', r'\bchemical equilibrium\b',
            r'\brare gas\b', r'\bnoble gas(?:es)?\b', r'\bargon\b',
            r'\bgraham\'?s law\b', r'\beffusion\b', r'\bchemical formula\b',
            r'\bsecond row of the periodic table\b', r'\bperiodic table \(i\.?e\.? from\b',
            r'\bdistilled water a poor conductor\b', r'\bperiodically recurring chemical\b',
            r'\bhow many times faster will .* gas\b', r'\bgas diffuse\b'
        ],
        'GEAS-1.2': [
            r'\balkali metals?\b', r'\balkaline earth\b', r'\bfuel cells?\b', r'\bneutralization\b',
            r'\bhazardous materials?\b', r'\bbatter(?:y|ies)\b', r'\benergy conversion occurs in a battery\b',
            r'\blarge-scale energy storage in ups\b'
        ],
        'GEAS-1.3': [
            r'\bconstructing nanostructures\b', r'\bbottom-up\b', r'\btop-down\b', r'\bnanostructures?\b'
        ],
        'GEAS-1.4': [
            r'\blowering of ph in seawater\b', r'\bco2 absorption\b'
        ],
        'GEAS-2.1': [
            r'\bwork done by a dissipative\b', r'\bwork on the box\b', r'\bdoes.*work on\b',
            r'\bescalator\b', r'\bconstant power\b', r'\buniform chain\b',
            r'\bstatements is true about work\b', r'\bforce f\(x\) = .* acts on a particle\b'
        ],
        'GEAS-2.2': [
            r'\bmomentum is\b', r'\bimpulse is\b', r'\bbilliard ball\b', r'\bgolf ball\b', r'\bhead of his club\b',
            r'\bball moving at .* strikes a wall\b', r'\bimpulse delivered by\b',
            r'\bhockey puck\b'
        ],
        'GEAS-2.3': [
            r'\bvelocity-versus-time\b', r'\bvelocity-time graph\b', r'\bposition-time graph\b',
            r'\barea under a velocity\b', r'\bslope at a point on a velocity\b', r'\bmuzzle velocity\b',
            r'\baverage velocity equal to the average speed\b', r'\bconstant force is needed to stop it\b',
            r'\bwater drips from the nozzle\b', r'\bdrops fall at regular\b',
            r'\bhunter directs his\b', r'\bmonkey sitting on a tree\b'
        ],
        'GEAS-2.4': [
            r'\bresultant moment\b', r'\bforce-couple\b', r'\bresultant of (?:the )?(?:two|three|forces)\b',
            r'\bdetermine the reactions\b', r'\bforces in the (?:two )?members\b', r'\bresultant force\b',
            r'\btrusses?\b', r'\bmethod of joints\b', r'\bmethod of sections\b',
            r'\bperson weighs\b', r'\bweighs \d+ pounds\b', r'\bweight w\b', r'\bmass m\b',
            r'\bpushing horizontally\b', r'\bmaximum withdrawal force\b',
            r'\binclined plane that has a slope\b', r'\bblock slides with a constant velocity\b',
            r'\bfrictionless surface\b', r'\bbeing pulled to the right\b',
            r'\btwo forces p and q\b', r'\bresultant of p and q\b',
            r'\bforces exerted by wind\b', r'\bsteel frame building\b',
            r'\bfind ra and rc\b', r'\breactions? at [a-d]\b',
            r'\bradius be banked\b', r'\bbanked if no friction\b',
            r'\btwo blocks of masses m1 and m2\b'
        ],
        'GEAS-2.5': [
            r'\brolls down a .* incline\b', r'\bceiling fan rotates\b', r'\btraces a circular path\b'
        ],
        'GEAS-2.6': [
            r'\bthin cylindrical shell\b', r'\bthin spherical shell\b', r'\bhoop stress\b',
            r'\bcircumferential stress\b', r'\blongitudinal stress\b', r'\baxial stress\b',
            r'\bshear stress\b', r'\btorsion\b', r'\bshaft transmits\b', r'\bangle of twist\b',
            r'\btensile force\b', r'\bcompressive load\b', r'\bstepped bar\b',
            r'\belongation produced in a rod\b', r'\bprismatic bars\b'
        ],
        'GEAS-2.7': [
            r'\bwave on a string\b', r'\bacoustic point source\b', r'\bsound intensity level\b',
            r'\bintensity level of \d+.*db\b', r'\bsound waves travels\b',
            r'\bdetector that is moving\b', r'\brailroad tracks\b', r'\bloudness of \d+ db\b',
            r'\bstring fixed at both ends\b', r'\bwave exhibits dispersion\b',
            r'\binterfere destructively\b', r'\bdestructive interference\b', r'\bconstructive interference\b'
        ],
        'GEAS-2.8': [
            r'\bhydrostatic force\b', r'\bsurface tension\b', r'\bspecific volume\b',
            r'\bfloat some ice\b', r'\bfloats above the water\b',
            r'\bsubmarine submerged at\b', r'\bwater flows through a horizontal pipe\b',
            r'\bballoon filled with helium\b', r'\bfloating in air\b',
            r'\bexit speed of water\b', r'\btorricelli\b', r'\bhydrostatic pressure at a certain depth\b',
            r'\bflows from a pipe of area\b', r'\bnarrower pipe\b',
            r'\bu-tube manometer\b', r'\bmanometer\b', r'\bpressure at a given depth\b'
        ],
        'GEAS-2.9': [
            r'\bheat is required to change .* ice\b', r'\bice at -?\d+.*into steam\b'
        ],
        'GEAS-2.10': [
            r'\bshaving mirror\b', r'\bconcave spherical mirror\b', r'\bradius of curvature of a.*mirror\b',
            r'\bluminous intensity\b', r'\bcandela\b', r'\blamps illuminate a screen\b', r'\bsingle slit\b',
            r'\bcharged rod\b', r'\bneutral metal spheres\b', r'\bbrewster(?:\'?s)? angle\b'
        ],
        'GEAS-3.1': [
            r'\bbonds?\b', r'\bsemiannual dividends?\b', r'\bdeposited into a\b',
            r'\breal gdp\b', r'\bnominal gdp\b'
        ],
        'GEAS-3.3': [
            r'\bsums over a given study period\b', r'\blife-cycle cost\b'
        ],
        'GEAS-3.4': [
            r'\blaw of supply and demand\b', r'\blaw of diminishing returns\b',
            r'\bperfect competition\b', r'\bphysical assets\b', r'\bfunctional worth\b',
            r'\bcost which has not yet been paid\b', r'\bmonetary measure of the properties\b'
        ],
        'GEAS-4.1': [
            r'\befficiency and effectiveness in management\b', r'\beffectiveness in management\b',
            r'\blabor productivity through systematic\b', r'\btransactional leader\b',
            r'\brewards and punishments to influence\b', r'\bbusiness strategy focuses on\b',
            r'\bprimary focus of strategic management\b',
            r'\bhiring employees\b', r'\bhuman resource\b', r'\bpersonnel management\b',
            r'\blowers its production costs\b'
        ],
        'GEAS-4.4': [
            r'\bahead of schedule and under budget\b'
        ],
        'GEAS-4.5': [
            r'\bstatement of cash flows\b', r'\bcash flows? is divided\b',
            r'\btrust or estate\b', r'\baccounting is the recording\b',
            r'\bfinancial records of individuals or businesses\b',
            r'\bgross profit\b', r'\bcosts of goods sold\b', r'\bcogs\b'
        ],
        'GEAS-5.1': [
            r'\bscalability\b', r'\bscale operations\b', r'\belectric vehicles\b',
            r'\bcharging stations?\b', r'\bstartup a: innovative product\b',
            r'\bfounders can\'?t adjust\b'
        ],
        'GEAS-5.2': [
            r'\bniche market\b'
        ],
        'GEAS-5.3': [
            r'\bresearch consists of data that has been collected\b',
            r'\bprimary research\b', r'\bsecondary research\b'
        ],
        'GEAS-5.4': [
            r'\bswot approach assesses\b'
        ],
        'GEAS-5.5': [
            r'\be-commerce platforms\b', r'\bdistribution channels?\b'
        ],
        'GEAS-5.8': [
            r'\bevaluating early-stage\b', r'\bventure capitalists consider\b',
            r'\bfounding team often given greater weight\b',
            r'\bventure capitalist is assessing\b', r'\bventure capitalist\b'
        ],
        'GEAS-6.1': [
            r'\bcarnot refrigerator\b', r'\bmonoatomic gas is heated\b',
            r'\bcyclic process\b', r'\bchange in internal energy is\b',
            r'\bextensive property\b', r'\bintensive property\b',
            r'\brefrigerator removes\b', r'\bcold space using\b',
            r'\bsystem absorbs heat and does work\b', r'\babsorbs heat and does work\b',
            r'\bpolytropic process\b'
        ],
        'GEAS-6.4': [
            r'\bsupercapacitors?\b', r'\benergy .* stored in a supercapacitor\b'
        ],
        'GEAS-6.5': [
            r'\bplank\'?s constant\b', r'\bplanck\'?s constant\b',
            r'\btwo protons and two neutrons\b', r'\bhelium nucleus\b',
            r'\balpha radiation\b', r'\bpenetrating power\b',
            r'\bradioactive material has .* remaining after\b',
            r'\bfour fundamental forces\b', r'\bstrong nuclear force\b'
        ],
        'GEAS-7.1': [
            r'\balloy\w*\b', r'\balloying\b', r'\belectronegativ\w*\b', r'\bground-state electron in a hydrogen\b',
            r'\bnucleus of (?:a )?hydrogen atom\b', r'\bhydrogen atom consists\b',
            r'\bsecond most abundant metal\b', r'\bstatements about metals is false\b',
            r'\bgalvanized steel\b', r'\bgalvaniz\w*\b'
        ],
        'GEAS-7.2': [
            r'\bcrystal lattice\b', r'\btype of lattice\b', r'\bface-centered cubic\b',
            r'\bbody-centered cubic\b', r'\bhexagonal close-packed\b',
            r'\bfcc\b', r'\bbcc\b', r'\bhcp\b', r'\bpolymorphism\b', r'\ballotrop(?:y|ies)\b',
            r'\bin bcc crystal, the lattice parameter\b'
        ],
        'GEAS-7.5': [
            r'\bcreep\b', r'\btime-dependent permanent strain\b'
        ],
        'GEAS-7.6': [
            r'\belectrical steel\b', r'\bsilicon steel\b'
        ],
        'GEAS-8.1': [
            r'\boperating systems?\b', r'\breal-time operating system\b', r'\brtos\b',
            r'\brate of \d+\.?\d*\s*kbps\b'
        ],
        'GEAS-8.3': [
            r'\bcaptcha\b', r'\bfunction in c\+\+ that calls itself\b',
            r'\brecursion\b', r'\bsecure web communication\b', r'\bhttps\b',
            r'\bexample of a url\b', r'\bexample of input in a program\b',
            r'\bartificial intelligence\b', r'\bgeneral ai\b', r'\bagi\b'
        ],
        'GEAS-9.1': [
            r'\bdensity-independent factor\b', r'\bactive zone of atmosphere\b',
            r'\bcarbon dioxide in the atmosphere\b'
        ],
        'GEAS-9.2': [
            r'\bforest biomass\b', r'\bsustainable yield\b'
        ],
        'GEAS-9.3': [
            r'\bair quality standard\b', r'\bcarbon monoxide\b', r'\bppmv\b',
            r'\bmass balance analysis\b', r'\bchemical oxygen demand\b', r'\bcod\b',
            r'\bbod\b', r'\bbiochemical oxygen demand\b', r'\bdry deposition\b',
            r'\bwet deposition\b', r'\btroposphere\b', r'\bstratosphere\b', r'\blapse rate\b'
        ],
        'GEAS-10.1': [
            r'\bethics\b', r'\bcanon\b', r'\bcanons of ethics\b',
            r'\ba code is defined as\b', r'\ba rule is defined as\b', r'\ba canon is defined as\b',
            r'\bessential element of a contract\b', r'\bscope of services to be provided is not well defined\b',
            r'\bliquidated damages\b'
        ],
        'GEAS-10.2': [
            r'\bindustry-determined specifications of proficiency\b', r'\bcompetency standards?\b',
            r'\bsubstandard materials in a public\b'
        ],
        'GEAS-10.4': [
            r'r\.?\s*a\.?\s*(?:no\.?\s*)?9292\b', r'\brepublic act (?:no\.?\s*)?9292\b',
            r'\bterm of office of the board\b', r'\broster of professional electronics\b',
            r'\bsection \d+ of r\.?\s*a\.?\s*(?:no\.?\s*)?9292\b',
            r'\bseal certified by the board\b', r'\bacpe\b', r'\basean chartered professional engineer\b',
            r'\bdilg memorandum circular\b'
        ],
        'GEAS-10.5': [
            r'\bpatentable\b', r'\bpatentabilit\w*\b', r'\bnon-patentable\b',
            r'\bcaller id spoofing\b', r'\bspoofing\b'
        ],
        'GEAS-10.6': [
            r'\bosh standards?\b', r'\boccupational safety and health\b', r'\bsafety officers?\b',
            r'\bplace of employment\b', r'\bra 11058\b', r'\br\.?\s*a\.?\s*(?:no\.?\s*)?11058\b',
            r'\bact strengthening compliance with occupational\b',
            r'\ban occupation shall be considered critical\b',
            r'\bsparks from an outlet before the breaker trips\b',
            r'\bindustrial safety signage\b', r'\bcolor code is typically used to indicate danger\b',
            r'\bdesignated dangerous parts of machines\b',
            r'\bclearance for installation of cable over\b',
            r'\bfire code of the philippines\b', r'\bra 9514\b',
            r'\boccupational health and safety management systems\b', r'\biso 45001\b'
        ],
        'GEAS-11.1': [
            r'\bfillet command\b', r'\bchamfer command\b', r'\bisometric view\b',
            r'\borthographic views?\b', r'\borthographic projection\b'
        ]
    },
    'EST': {
        'EST-1.1': [
            r'\btime scaling\b', r'\bsine function\b', r'\bdecaying exponential signal\b',
            r'\bdiscrete time in terms of\b', r'\bsignals is/are periodic\b',
            r'\bpower in the signal\b', r's\(t\)\s*=\s*\d+cos'
        ],
        'EST-1.6': [
            r'\bband pass filter will\b'
        ],
        'EST-2.1': [
            r'\binterlock switch\b', r'\bcabinet is opened\b', r'\bmains operated power supply\b',
            r'\bheating effects of rf\b', r'\brf pickup\b', r'\bspeaker leads\b',
            r'\bblocks rf energy\b', r'\bfrequency multipliers?\b'
        ],
        'EST-2.2': [
            r'\bdbrnc0\b', r'\bdbrn\b', r'\btest point level\b', r'\btransistor\'?s nf\b',
            r'\boutput noise signal\b', r'\bdetermine the rms output signals\b'
        ],
        'EST-2.4': [
            r'\bphase modulator\b', r'\bfrequency modulator\b', r'\bphase constant\b', r'\bfrequency constant\b'
        ],
        'EST-2.6': [
            r'\bcommunication frequencies throughout the spectrum\b',
            r'\btoo far for ground-wave\b', r'\bskywave propagation\b',
            r'\baffected in varying degrees\b'
        ],
        'EST-3.1': [
            r'\bin a digital system, the\b'
        ],
        'EST-3.4': [
            r'\bdpsk transmission\b', r'\bdpsk\b'
        ],
        'EST-3.5': [
            r'\bstatistically independent\b'
        ],
        'EST-4.7': [
            r'\belectron that enters an electrostatic field\b'
        ],
        'EST-5.1': [
            r'\bpin diode\b'
        ],
        'EST-5.4': [
            r'\bthat of the plcs\b', r'\bconventional relay systems\b'
        ],
        'EST-6.1': [
            r'\bno station is superior\b', r'\btesting the state of the medium\b'
        ]
    }
}


# Merge refined patterns into SUBTOPIC_RULES
for _subj, _topics in REFINED_SUBTOPIC_RULES.items():
    if _subj not in SUBTOPIC_RULES:
        SUBTOPIC_RULES[_subj] = {}
    for _sub_id, _pats in _topics.items():
        if _sub_id not in SUBTOPIC_RULES[_subj]:
            SUBTOPIC_RULES[_subj][_sub_id] = []
        for _p in _pats:
            if _p not in SUBTOPIC_RULES[_subj][_sub_id]:
                SUBTOPIC_RULES[_subj][_sub_id].append(_p)

# Additional high-frequency keyword patterns discovered from unclassified question analysis
ADDITIONAL_SUBTOPIC_RULES = {
    'GEAS': {
        'GEAS-7.2': [  # Structure of Crystalline Materials
            r'\bcrystals?\b', r'\bcrystalline\b', r'\bcrystal (?:structure|lattice|systems?|defects?)\b',
            r'\bbody-centered cubic\b', r'\bface-centered cubic\b', r'\bhexagonal close-packed\b',
            r'\bpolycrystalline\b', r'\bmonocrystalline\b', r'\bamorphous solid\b',
            r'\bcoordination number\b', r'\blattice parameter\b',
        ],
        'GEAS-4.2': [  # Management and Its Functions
            r'\bfunctions? of management\b', r'\bmanagement principles?\b', r'\bmanagerial\b',
            r'\bleadership styles?\b', r'\bmanagement is defined\b', r'\bsynonym for the others\b',
            r'\btheory of management\b', r'\bmanagement theories\b',
        ],
        'GEAS-4.3': [  # Planning, Leading, Organizing, Controlling
            r'\bcontrolling function\b', r'\borganizing function\b', r'\bleading function\b',
            r'\bplanning,? leading,? organizing\b', r'\bspan of control\b', r'\bunity of command\b',
        ],
        'GEAS-4.4': [  # Managing Product and Service Operations
            r'\boperations? management\b', r'\btotal quality management\b', r'\btqm\b',
            r'\bquality control\b', r'\bsupply chain\b', r'\binventory management\b',
        ],
        'GEAS-4.5': [  # Managing Marketing and Finance Functions
            r'\bmarketing (?:management|functions?|mix|strategy)\b', r'\bfinance functions?\b',
            r'\bproduct life cycle\b', r'\bmarket research\b', r'\bpricing strateg\w+\b',
            r'\bmarket segmentation\b',
        ],
        'GEAS-2.3': [  # Kinematics
            r'\bacceleration is constant\b', r'\bconstant acceleration\b',
            r'\buniformly accelerated motion\b',
        ],
        'GEAS-2.6': [  # Elasticity & Strength
            r'\bstrain in the cable\b', r'\btension in the cable\b', r'\belongation of the cable\b',
            r'\byoung\'?s modulus\b',
        ],
    },
    'MATH': {
        'MATH-6.1': [  # Vector Analysis / Electromagnetics
            r'\belectric charges?\b', r'\belectric \(?e-?\)? fields?\b', r'\bcoulombs?\b',
            r'\bspace distribution of charge\b', r'\bpoint charge\b',
        ],
        'MATH-3.1': [  # First-Order ODE and its Application
            r'\byearly exponential\b', r'\bpetroleum consumption\b',
            r'\bmodeled by (?:the )?differential equation\b',
            r'\bexponential growth (?:and|or) decay\b',
        ],
    },
    'ELECS': {
        'ELECS-1.5': [  # Solution to DC Network Problems & DC Machines
            r'\bgenerators? does not need equalizers?\b',
            r'\bequalizers? for (?:satisfactory )?parallel operation\b',
        ],
        'ELECS-8.1': [  # Microprocessor Unit
            r'\b\d+-bit register\b', r'\bregister store\b',
        ],
    },
}

for _subj, _topics in ADDITIONAL_SUBTOPIC_RULES.items():
    if _subj not in SUBTOPIC_RULES:
        SUBTOPIC_RULES[_subj] = {}
    for _sub_id, _pats in _topics.items():
        if _sub_id not in SUBTOPIC_RULES[_subj]:
            SUBTOPIC_RULES[_subj][_sub_id] = []
        for _p in _pats:
            if _p not in SUBTOPIC_RULES[_subj][_sub_id]:
                SUBTOPIC_RULES[_subj][_sub_id].append(_p)

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


# Cross-subject mapping: when a question is in GEAS, physics and engineering science
# questions that match ELECS circuit/EM/device rules map directly to official GEAS topics.
ELECS_TO_GEAS_MAP = {
    'ELECS-1.1': 'GEAS-6.4',  # Resistive Network -> AC/DC circuits
    'ELECS-1.2': 'GEAS-6.4',  # Mesh and Node Equations
    'ELECS-1.3': 'GEAS-6.4',  # Network Theorems
    'ELECS-1.4': 'GEAS-6.3',  # Transient Analysis (charging capacitor, inductor)
    'ELECS-1.5': 'GEAS-6.4',  # DC Network Problems
    'ELECS-1.0': 'GEAS-6.4',
    'ELECS-2.1': 'GEAS-6.4',  # AC Network Problems
    'ELECS-2.2': 'GEAS-6.4',  # Impedance and Admittance
    'ELECS-2.3': 'GEAS-6.4',  # Resonance
    'ELECS-2.4': 'GEAS-6.4',  # Power in AC Circuits
    'ELECS-2.5': 'GEAS-6.4',  # Two-Port Network
    'ELECS-2.0': 'GEAS-6.4',
    'ELECS-3.1': 'GEAS-6.2',  # Steady Electric and Magnetic Fields
    'ELECS-3.2': 'GEAS-7.7',  # Dielectric and Magnetic Materials -> Materials Science
    'ELECS-3.3': 'GEAS-6.3',  # Coupled and Magnetic Circuits -> EM Induction
    'ELECS-3.4': 'GEAS-6.3',  # Time-Varying Fields and Maxwell -> EM Induction
    'ELECS-3.0': 'GEAS-6.2',
    'ELECS-4.1': 'GEAS-7.7',  # Diodes & Semiconductor devices -> Materials Science
    'ELECS-4.2': 'GEAS-7.7',
    'ELECS-4.3': 'GEAS-7.7',
    'ELECS-4.4': 'GEAS-6.4',
    'ELECS-4.5': 'GEAS-7.7',  # Transistors & semiconductors -> Materials Science
    'ELECS-4.0': 'GEAS-7.7',
    'ELECS-5.5': 'GEAS-6.4',  # Oscillators and filters -> AC circuits
    'ELECS-6.1': 'GEAS-7.7',  # Power semiconductors (SCRs, TRIACs) -> Materials Science
    'ELECS-7.1': 'GEAS-8.3',  # Logic -> Programming fundamentals
    'ELECS-7.2': 'GEAS-8.3',
    'ELECS-8.1': 'GEAS-8.3',  # Microprocessors -> Programming fundamentals
    'ELECS-8.4': 'GEAS-8.3',
    'ELECS-8.0': 'GEAS-8.3',
}

SHARED_TOPIC_PARTNERS = {
    'MATH': [
        ('ELECS', {
            'ELECS-3.1': 'MATH-6.1', 'ELECS-3.2': 'MATH-6.1', 'ELECS-3.3': 'MATH-6.2', 'ELECS-3.4': 'MATH-6.2',
            'ELECS-9.1': 'MATH-8.3', 'ELECS-9.2': 'MATH-8.2', 'ELECS-9.3': 'MATH-8.1', 'ELECS-9.4': 'MATH-8.1', 'ELECS-9.5': 'MATH-8.1',
        }),
        ('EST', {
            'EST-1.1': 'MATH-7.1', 'EST-1.2': 'MATH-7.1', 'EST-1.3': 'MATH-7.1',
            'EST-1.4': 'MATH-7.2', 'EST-1.5': 'MATH-7.1', 'EST-1.6': 'MATH-7.2',
        }),
    ],
    'ELECS': [
        ('MATH', {
            'MATH-6.1': 'ELECS-3.1', 'MATH-6.2': 'ELECS-3.4', 'MATH-6.3': 'ELECS-3.4',
            'MATH-8.1': 'ELECS-9.3', 'MATH-8.2': 'ELECS-9.2', 'MATH-8.3': 'ELECS-9.1',
        }),
        ('EST', {
            'EST-5.1': 'ELECS-6.1', 'EST-5.2': 'ELECS-6.2', 'EST-5.3': 'ELECS-6.3',
            'EST-5.4': 'ELECS-6.4', 'EST-5.5': 'ELECS-6.6',
        }),
    ],
    'EST': [
        ('MATH', {
            'MATH-7.1': 'EST-1.5', 'MATH-7.2': 'EST-1.4', 'MATH-7.3': 'EST-1.4',
        }),
        ('ELECS', {
            'ELECS-6.1': 'EST-5.1', 'ELECS-6.2': 'EST-5.2', 'ELECS-6.3': 'EST-5.3',
            'ELECS-6.4': 'EST-5.4', 'ELECS-6.5': 'EST-5.3', 'ELECS-6.6': 'EST-5.5',
        }),
    ],
}

POOL_DECK_INDICATORS = [
    re.compile(r'\bpre[- ]?boards?\b', re.I),
    re.compile(r'\bexams?\b', re.I),
    re.compile(r'\breviews?\b', re.I),
    re.compile(r'\brefreshers?\b', re.I),
    re.compile(r'\bcoachings?\b', re.I),
    re.compile(r'\bmocks?\b', re.I),
    re.compile(r'\bdiagnostics?\b', re.I),
    re.compile(r'\bmixed\b', re.I),
    re.compile(r'\bcompilations?\b', re.I),
    re.compile(r'\bcomprehensives?\b', re.I),
    re.compile(r'\bquizz?ers?\b', re.I),
    re.compile(r'\btests?\b', re.I),
    re.compile(r'\ball topics?\b', re.I),
    re.compile(r'\bpools?\b', re.I),
]

def is_mixed_pool_deck(deck_name, deck_desc=None):
    """Check if deck is a generic mixed/exam pool deck that should not be biased to a single topic."""
    combined = f"{deck_name or ''} {deck_desc or ''}".strip().lower()
    for pat in POOL_DECK_INDICATORS:
        if pat.search(combined):
            return True
    return False


def detect_deck_topic(deck_name, deck_desc, subject_code):
    """Detect a primary parent topic from deck title and deck description."""
    if is_mixed_pool_deck(deck_name, deck_desc):
        # Generic pool decks (Pre-Boards, Reviews, Exams) carry no single-topic signal
        return None

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
    - Bidirectional shared topic keywords mapping
    - Deck Default TOS Category bias and fallback
    - Deck Name & Description topic hints (with generic pool deck immunity)
    - Cross-subject physics/circuits mapping for GEAS
    - Best-effort within-subject classification
    Returns (topic_id, is_confident)
    """
    if subject_code not in COMPILED_SUBTOPIC_RULES:
        return None, False

    # 1. Determine deck primary context
    primary_parent = None
    target_subtopic = None
    if default_tos:
        default_tos_clean = str(default_tos).strip()
        m_sub = re.search(r'([A-Z]+-)?(\d+\.\d+)', default_tos_clean)
        m_parent = re.search(r'([A-Z]+-)?(\d+\.0)', default_tos_clean)
        if m_sub and not m_sub.group(2).endswith('.0'):
            code = m_sub.group(2)
            prefix = (m_sub.group(1) or f"{subject_code}-").rstrip('-')
            candidate_id = f"{prefix}-{code}"
            target_subtopic = candidate_id
            primary_parent = SUBTOPIC_TO_PARENT.get(candidate_id, f"{prefix}-{code.split('.')[0]}.0")
        elif m_parent:
            code = m_parent.group(2)
            prefix = (m_parent.group(1) or f"{subject_code}-").rstrip('-')
            primary_parent = f"{prefix}-{code}"
        else:
            primary_parent = default_tos_clean
    else:
        detected = detect_deck_topic(deck_name, deck_desc, subject_code)
        if detected:
            if '.' in detected and not detected.endswith('.0'):
                target_subtopic = detected
                primary_parent = SUBTOPIC_TO_PARENT.get(detected, f"{detected.split('.')[0]}.0")
            else:
                primary_parent = detected

    # 2. Score subtopics with raw keyword matches
    raw_subtopic_scores = Counter()
    for sub_id, patterns in COMPILED_SUBTOPIC_RULES[subject_code].items():
        for pat in patterns:
            cnt = len(pat.findall(text))
            if cnt > 0:
                # Carson's rule / transmission bandwidth override to EST-3.5
                if sub_id == 'EST-3.5' and any(k in pat.pattern for k in ["carson", r"transmission\s+bandwidth"]):
                    weight = 10
                else:
                    clean_pat = re.sub(r'\\[a-zA-Z]|[^a-zA-Z0-9\s]', ' ', pat.pattern)
                    words_in_pat = len(clean_pat.split())
                    if words_in_pat >= 3:
                        weight = 5
                    elif words_in_pat == 2 or any(k in pat.pattern.lower() for k in ['b2b', 'b2c', 'c2c', 'b2g', 'eia', 'ecc', '8-psk', '16-psk', 'qpsk', 'd_min', 'k-factor']):
                        weight = 3
                    else:
                        weight = 1
                raw_subtopic_scores[sub_id] += cnt * weight

    # Cross-subject shared topic partner evaluation
    for partner_subj, mapping in SHARED_TOPIC_PARTNERS.get(subject_code, []):
        if partner_subj in COMPILED_SUBTOPIC_RULES:
            for p_sub_id, native_sub_id in mapping.items():
                p_patterns = COMPILED_SUBTOPIC_RULES[partner_subj].get(p_sub_id, [])
                for pat in p_patterns:
                    cnt = len(pat.findall(text))
                    if cnt > 0:
                        clean_pat = re.sub(r'\\[a-zA-Z]|[^a-zA-Z0-9\s]', ' ', pat.pattern)
                        words_in_pat = len(clean_pat.split())
                        weight = 3 if words_in_pat >= 2 else 1
                        raw_subtopic_scores[native_sub_id] += cnt * weight

    # Apply deck bias if available
    subtopic_scores = Counter(raw_subtopic_scores)
    if primary_parent:
        for sub_id in COMPILED_SUBTOPIC_RULES[subject_code]:
            if SUBTOPIC_TO_PARENT.get(sub_id) == primary_parent:
                if sub_id in raw_subtopic_scores:
                    # Give bonus to matches in the deck's primary topic
                    subtopic_scores[sub_id] += 3
        if target_subtopic:
            if target_subtopic in raw_subtopic_scores:
                subtopic_scores[target_subtopic] += 4
            else:
                subtopic_scores[target_subtopic] += 2

    # Parent family aggregate scores
    parent_family_scores = Counter()
    for sub_id, score in subtopic_scores.items():
        p_id = SUBTOPIC_TO_PARENT.get(sub_id, sub_id)
        parent_family_scores[p_id] += score

    if subtopic_scores:
        top_parent_id, top_parent_score = parent_family_scores.most_common(1)[0]
        top_family_subs = [
            (s_id, s_score)
            for s_id, s_score in subtopic_scores.items()
            if SUBTOPIC_TO_PARENT.get(s_id) == top_parent_id
        ]
        top_family_subs.sort(key=lambda x: x[1], reverse=True)

        # If deck has a verified primary topic
        if primary_parent:
            primary_subs = [
                (s_id, s_score)
                for s_id, s_score in subtopic_scores.items()
                if SUBTOPIC_TO_PARENT.get(s_id) == primary_parent
            ]
            primary_subs.sort(key=lambda x: x[1], reverse=True)
            best_primary_sub = primary_subs[0][0] if primary_subs else None
            best_primary_score = primary_subs[0][1] if primary_subs else 0

            top_id, top_score = subtopic_scores.most_common(1)[0]
            top_parent = SUBTOPIC_TO_PARENT.get(top_id, top_id)

            if top_parent == primary_parent:
                if target_subtopic and best_primary_sub != target_subtopic:
                    raw_best = raw_subtopic_scores.get(best_primary_sub, 0)
                    if raw_best >= 2:
                        return best_primary_sub, True
                    else:
                        return target_subtopic, True
                confident = (top_score >= MIN_CONFIDENCE_SCORE)
                return top_id, True if confident else (default_tos if default_tos else top_id)
            else:
                # Top match is from a different topic family
                raw_top = raw_subtopic_scores.get(top_id, 0)

                # Only allow cross-topic classification if foreign match is strongly confident (>= 6)
                # and clearly dominates any match within the primary family
                if raw_top >= 6 and raw_top >= (best_primary_score + 4):
                    return top_id, True

                # Otherwise, maintain deck family loyalty:
                if best_primary_sub and raw_subtopic_scores.get(best_primary_sub, 0) >= 1:
                    return best_primary_sub, True
                if target_subtopic:
                    return target_subtopic, True
                if default_tos and not default_tos.endswith('.0'):
                    return default_tos, True
                if best_primary_sub:
                    return best_primary_sub, True
                if raw_top >= 4:
                    return top_id, True
                return (target_subtopic or default_tos or top_id), False

        # No primary parent or pool deck (e.g. Pre-Board, Coaching, Review Exam):
        if top_family_subs:
            best_sub_id, best_sub_score = top_family_subs[0]
            second_sub_score = top_family_subs[1][1] if len(top_family_subs) > 1 else 0

            # If there's a single subtopic match or a clear margin over other subtopics in this parent
            if len(top_family_subs) == 1 or (best_sub_score - second_sub_score >= MIN_CONFIDENCE_MARGIN):
                return best_sub_id, True
            else:
                # Multiple close subtopics within the same parent family:
                # Never assign parent x.0 topic. Return the top subtopic if confident
                if best_sub_score >= MIN_CONFIDENCE_SCORE:
                    return best_sub_id, True
                return None, False

    # 3. Parent-level rules for this subject (only used for cross-bridge mapping, never assigned as direct tag)

    # 4. Cross-subject bridge: physics/circuits overlap between ELECS and GEAS
    if subject_code == 'GEAS' and 'ELECS' in COMPILED_SUBTOPIC_RULES:
        elecs_scores = Counter()
        for e_sub_id, patterns in COMPILED_SUBTOPIC_RULES['ELECS'].items():
            for pat in patterns:
                cnt = len(pat.findall(text))
                if cnt > 0:
                    words_in_pat = len(re.findall(r'[a-zA-Z0-9]+', pat.pattern))
                    weight = 3 if words_in_pat >= 2 else 1
                    elecs_scores[e_sub_id] += cnt * weight

        if elecs_scores:
            top_eid, _ = elecs_scores.most_common(1)[0]
            mapped_geas = ELECS_TO_GEAS_MAP.get(top_eid) or ELECS_TO_GEAS_MAP.get(SUBTOPIC_TO_PARENT.get(top_eid, ''))
            if mapped_geas and not mapped_geas.endswith('.0'):
                return mapped_geas, True

    # 5. Fallback hierarchy: target_subtopic -> default_tos -> first subtopic of default parent -> Untagged (None)
    if target_subtopic:
        return target_subtopic, True
    if default_tos:
        if not default_tos.endswith('.0'):
            return default_tos, False
        else:
            # default_tos is a parent (.0) topic — assign first available subtopic under it
            parent_id = default_tos
            subs_under_parent = [
                s_id for s_id in COMPILED_SUBTOPIC_RULES.get(subject_code, {})
                if SUBTOPIC_TO_PARENT.get(s_id) == parent_id
            ]
            if subs_under_parent:
                return subs_under_parent[0], False

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
            raw_text = ' '.join(parts)
            # Expand KaTeX / LaTeX subscripts: e.g. I_{DSS} -> I_DSS IDSS, V_{GS(off)} -> V_GS(off) VGS(off)
            expanded = re.sub(r'([A-Za-z]+)_\{([A-Za-z0-9\(\)]+)\}', r'\1_\2 \1\2', raw_text)
            return (raw_text + ' ' + expanded) if expanded != raw_text else raw_text
        return str(data_str)
    except Exception:
        return str(data_str)





def get_groq_api_key():
    if os.environ.get('GROQ_API_KEY'):
        return os.environ['GROQ_API_KEY'].strip()
    config_paths = [
        os.path.expanduser('~/.config/ECEngine/config.json'),
        os.path.expanduser('~/.config/ecengine/config.json'),
    ]
    for cp in config_paths:
        if os.path.exists(cp):
            try:
                with open(cp, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                    key = cfg.get('groqApiKey')
                    if key and str(key).strip():
                        return str(key).strip()
            except Exception:
                pass
    return None


def classify_batch_with_groq(batch_cards, api_key, model='openai/gpt-oss-120b', retry_count=3):
    """
    Classifies a batch of up to 20 cards using Groq chat completion API.
    batch_cards: list of dicts: [{'id': ..., 'subject': ..., 'text': ...}]
    Returns dict: { card_id: subtopic_code }
    """
    import urllib.request
    import urllib.error

    if not batch_cards or not api_key:
        return {}

    items_payload = []
    for c in batch_cards:
        items_payload.append({
            'id': c['id'],
            'subject': c['subject'],
            'question_snippet': c['text'][:350]
        })

    prompt = (
        "You are an expert PRC Electronics Engineering Licensure Exam (ECE) Table of Specifications (TOS) classifier.\n"
        "Given the following questions, map each card id to the single most accurate Table of Specifications (TOS) decimal subtopic code.\n"
        "Valid codes follow the official PECE syllabus, such as:\n"
        "- MATH: MATH-1.1 to MATH-8.3 (e.g. MATH-1.2, MATH-2.4, MATH-3.1, MATH-4.1, MATH-5.2, MATH-6.1, MATH-7.1, MATH-8.1)\n"
        "- ELECS: ELECS-1.1 to ELECS-9.5 (e.g. ELECS-1.1, ELECS-2.3, ELECS-3.2, ELECS-4.5, ELECS-5.1, ELECS-7.1, ELECS-8.1, ELECS-9.2)\n"
        "- GEAS: GEAS-1.1 to GEAS-11.3 (e.g. GEAS-1.1, GEAS-2.3, GEAS-3.1, GEAS-4.2, GEAS-5.1, GEAS-6.1, GEAS-7.2, GEAS-8.1, GEAS-10.1)\n"
        "- EST: EST-1.1 to EST-6.6 (e.g. EST-1.2, EST-2.2, EST-3.3, EST-4.6, EST-5.1, EST-6.1)\n\n"
        f"Questions to classify:\n{json.dumps(items_payload, indent=2)}\n\n"
        "Return ONLY a JSON object mapping each card id string to its assigned TOS subtopic code string, like:\n"
        '{"card_123": "GEAS-4.2", "card_456": "MATH-6.1"}'
    )

    req_data = json.dumps({
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.1,
        'response_format': {'type': 'json_object'}
    }).encode('utf-8')

    endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    for attempt in range(retry_count):
        try:
            req = urllib.request.Request(
                endpoint,
                data=req_data,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'ECEngine/1.0'
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_data = json.loads(resp.read().decode('utf-8'))
                content = resp_data['choices'][0]['message']['content']
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    valid_results = {}
                    for cid, code in parsed.items():
                        if isinstance(code, str) and re.match(r'^[A-Z]+-\d+\.\d+$', code):
                            valid_results[cid] = code
                    return valid_results
                return {}
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(20)
                continue
            else:
                print(f"[Groq AI] HTTP {e.code} error: {e.read().decode('utf-8', errors='ignore')[:200]}", file=sys.stderr)
                break
        except Exception as e:
            print(f"[Groq AI] Attempt {attempt+1} error: {e}", file=sys.stderr)
            time.sleep(5)

    return {}


def run_classification(db_path=DEFAULT_DB_PATH, deck_id=None, apply_changes=False,
                        output_json=False, card_type='all', review_csv=None,
                        force_reclassify_all=False, no_ai_fallback=False):
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
        SELECT c.id, t.subject, t.name, c.type, c.data, c.tos_topic_id, t.id, t.description, {select_default}, c.tags
        FROM cards c
        JOIN topics t ON c.topic_id = t.id
    """
    conditions = []
    params = []
    if not force_reclassify_all:
        conditions.append("(c.tos_topic_id IS NULL OR c.tos_topic_id = '')")
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
    tag_updates = []
    review_rows = []
    distribution = Counter()
    subject_distribution = Counter()
    subtopic_count = 0
    parent_count = 0
    review_count = 0
    needs_image_review_count = 0

    for r in rows:
        card_id, subject_raw, deck_name, card_type_val, data_raw, existing_tos, d_id, deck_desc, default_tos, tags_raw = r
        subject_code = normalize_subject(subject_raw)

        card_text = extract_card_text(data_raw, card_type_val)
        assigned_topic, confident = classify_text(card_text, subject_code, deck_name=deck_name, deck_desc=deck_desc, default_tos=default_tos)

        # Check if card has an image attached to the QUESTION itself
        # (do NOT tag cards that only have solution/explanation images like solutionImagePath)
        has_image = False
        try:
            d = json.loads(data_raw) if data_raw else {}
            if isinstance(d, dict):
                has_image = bool(d.get('imagePath'))
        except Exception:
            pass

        # Parse existing tags
        curr_tags = []
        if tags_raw:
            try:
                parsed = json.loads(tags_raw) if isinstance(tags_raw, str) else list(tags_raw)
                if isinstance(parsed, list):
                    curr_tags = [str(x) for x in parsed]
                else:
                    curr_tags = [str(tags_raw)]
            except Exception:
                curr_tags = [str(tags_raw)]

        orig_tags = list(curr_tags)

        if assigned_topic and not assigned_topic.endswith('.0') and confident:
            updates.append((assigned_topic, card_id))
            distribution[assigned_topic] += 1
            subject_distribution[subject_code] += 1
            subtopic_count += 1
            # Clean up 'needs-image-review' tag if card is now classified
            if 'needs-image-review' in curr_tags:
                curr_tags.remove('needs-image-review')
        else:
            if assigned_topic and not assigned_topic.endswith('.0'):
                review_count += 1
                if review_csv:
                    review_rows.append({
                        'card_id': card_id, 'deck_id': d_id, 'deck_name': deck_name,
                        'subject': subject_raw, 'existing_tos_topic_id': existing_tos,
                        'proposed_topic_id': assigned_topic,
                        'card_text_preview': card_text[:200],
                    })

            # For unclassified / untagged cards with images, tag with 'needs-image-review'
            if has_image:
                needs_image_review_count += 1
                if 'needs-image-review' not in curr_tags:
                    curr_tags.append('needs-image-review')
            else:
                if 'needs-image-review' in curr_tags:
                    curr_tags.remove('needs-image-review')

        if curr_tags != orig_tags:
            tag_updates.append((json.dumps(curr_tags), card_id))

    ai_classified_count = 0
    if apply_changes:
        if updates:
            cursor.executemany("UPDATE cards SET tos_topic_id = ? WHERE id = ?", updates)
        if tag_updates:
            cursor.executemany("UPDATE cards SET tags = ? WHERE id = ?", tag_updates)
        conn.commit()

        # Groq AI Redundancy Fallback for unclassified cards
        if not no_ai_fallback:
            classified_card_ids = set(c_id for _, c_id in updates)
            unclassified_cards = [
                {'id': r[0], 'subject': normalize_subject(r[1]), 'text': extract_card_text(r[4], r[3])}
                for r in rows
                if r[0] not in classified_card_ids
            ]
            if unclassified_cards:
                groq_key = get_groq_api_key()
                if groq_key:
                    if not output_json:
                        print(f"\n[Groq AI Fallback] Found {len(unclassified_cards)} unclassified cards. Running AI batch classification in batches of 20...", flush=True)
                    batch_size = 20
                    ai_updates = []
                    for b_idx in range(0, len(unclassified_cards), batch_size):
                        batch = unclassified_cards[b_idx:b_idx + batch_size]
                        batch_num = (b_idx // batch_size) + 1
                        total_batches = (len(unclassified_cards) + batch_size - 1) // batch_size
                        if not output_json:
                            print(f"  -> Sending batch {batch_num}/{total_batches} ({len(batch)} cards) to Groq...", flush=True)

                        batch_res = classify_batch_with_groq(batch, groq_key)
                        for cid, assigned_topic in batch_res.items():
                            ai_updates.append((assigned_topic, cid))
                            distribution[assigned_topic] += 1
                            subj_code = next((c['subject'] for c in batch if c['id'] == cid), None)
                            if subj_code:
                                subject_distribution[subj_code] += 1
                            subtopic_count += 1
                            ai_classified_count += 1

                        if b_idx + batch_size < len(unclassified_cards):
                            if not output_json:
                                print("     Throttling 15s to respect Groq 8,000 TPM limit...", flush=True)
                            time.sleep(15)

                    if ai_updates:
                        cursor.executemany("UPDATE cards SET tos_topic_id = ? WHERE id = ?", ai_updates)
                        conn.commit()
                        updates.extend(ai_updates)
                        if not output_json:
                            print(f"[Groq AI Fallback] Successfully classified {len(ai_updates)} cards with Groq AI!\n", flush=True)
                else:
                    if not output_json:
                        print("\n[Groq AI Fallback] Notice: No Groq API key found in ~/.config/ECEngine/config.json or environment. Skipped AI fallback.", flush=True)

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
        "groq_ai_classified": ai_classified_count,
        "flagged_for_review": review_count,
        "cards_tagged_needs_image_review": needs_image_review_count,
        "tag_updates_count": len(tag_updates),
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
        print(f"Unclassified cards with images flagged with 'needs-image-review': {needs_image_review_count}")
        print(f"Card tag updates queued/applied: {len(tag_updates)}")
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
        if assigned in hinted_topics or parent in hinted_topics:
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
    parser.add_argument('--card-type', default='all', choices=['mcq', 'flashcard', 'formula', 'all'],
                         help="Which card type(s) to classify (default: all)")
    parser.add_argument('--review-csv', default=None, help="Write low-confidence/ambiguous cards to this CSV instead of silently applying them")
    parser.add_argument('--validate', action='store_true', help="Run deck-name proxy accuracy check instead of classifying")
    parser.add_argument('--stdin', action='store_true', help="Read cards JSON array from stdin and output classifications JSON")
    parser.add_argument('--force-reclassify-all', action='store_true',
                        help="Reclassify all cards even if they already have a tos_topic_id (default protects existing/manual tags)")
    parser.add_argument('--no-ai-fallback', action='store_true',
                        help="Disable automatic Groq AI fallback for unclassified cards during --apply")

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
        force_reclassify_all=args.force_reclassify_all,
        no_ai_fallback=args.no_ai_fallback,
    ))


if __name__ == '__main__':
    main()