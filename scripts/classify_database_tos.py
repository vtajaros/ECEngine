#!/usr/bin/env python3
"""
scripts/classify_database_tos.py
─────────────────────────────────────────────────────────────────────────────
High-accuracy Table of Specifications (TOS) classifier for ECEngine database.
Supports both parent topics (x.0) and granular decimal subtopics (x.x)
across all 4 official PRC ECE subjects (MATH, ELECS, GEAS, EST).

Features:
- Subtopic-level regex and keyword pattern rules (e.g. MATH-1.1, ELECS-2.3)
- Parent topic fallbacks (e.g. MATH-1.0, ELECS-2.0)
- Deck title context heuristics
- CLI flags for dry-run testing, single-deck targeting, and machine-readable JSON output
- Designed for seamless in-app button execution via Electron IPC

Usage:
  python3 scripts/classify_database_tos.py --dry-run
  python3 scripts/classify_database_tos.py --apply
  python3 scripts/classify_database_tos.py --apply --json
  python3 scripts/classify_database_tos.py --deck-id <id> --json
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import os
import re
import json
import sqlite3
import argparse
from collections import Counter

DEFAULT_DB_PATH = os.path.expanduser('~/.config/ECEngine/ecengine.sqlite')

# ─────────────────────────────────────────────────────────────────────────────
# 1. SUBTOPIC RULES (Granular Decimal x.x Classifications)
# ─────────────────────────────────────────────────────────────────────────────
SUBTOPIC_RULES = {
    'MATH': {
        # 1.0 Differential Calculus
        'MATH-1.1': [
            r'\blimit\b', r'\blimits\b', r'\bcontinuity\b', r'\bcontinuous\b', r'\bdiscontinuous\b',
            r'\basymptote\b', r'\bl\'?hopital\b', r'\bindeterminate\b', r'\bdelta-epsilon\b',
            r'\bdomain and range\b'
        ],
        'MATH-1.2': [
            r'\bderivative\b', r'\bdy/dx\b', r'\btangent line\b', r'\bnormal line\b', r'\brate of change\b',
            r'\brelated rate\w*', r'\bmaxima\b', r'\bminima\b', r'\bmaximum\b', r'\bminimum\b',
            r'\bcritical point\w*', r'\boptimization\b', r'\bmean value theorem\b', r'\brolle\'?s\b',
            r'\bconcavity\b', r'\binflection\b', r'\bchain rule\b', r'\bproduct rule\b', r'\bquotient rule\b'
        ],
        'MATH-1.3': [
            r'\bhigher[- ]order derivative\b', r'\bsecond derivative\b', r'\bd2y/dx2\b',
            r'\bleibniz(?:\'?s)? rule\b', r'\bradius of curvature\b', r'\bcurvature\b', r'\bacceleration from velocity\b'
        ],
        'MATH-1.4': [
            r'\bparametric\b', r'\bparameter t\b', r'\bcycloid\b', r'\bastroid\b',
            r'\bdy/dt\b', r'\bdx/dt\b', r'\bparametric equation\b'
        ],
        'MATH-1.5': [
            r'\bpartial diff\w*', r'\bpartial derivative\b', r'\btotal differential\b',
            r'\beuler\'?s theorem on homogeneous\b', r'\bjacobian\b', r'\bdel z / del x\b'
        ],

        # 2.0 Integral Calculus
        'MATH-2.1': [
            r'\bantiderivative\b', r'\bindefinite integral\b', r'\bfundamental theorem of calculus\b',
            r'\bconstant of integration\b', r'\bstandard integral\b', r'\bintegral of\b'
        ],
        'MATH-2.2': [
            r'\bby parts\b', r'\bu-substitution\b', r'\btrigonometric substitution\b',
            r'\bpartial fraction\b', r'\btabular integration\b', r'\brational fraction\b'
        ],
        'MATH-2.3': [
            r'\bimproper integral\b', r'\binfinite limit\b', r'\bconvergent integral\b',
            r'\bdivergent integral\b', r'\bdiscontinuity in integrand\b'
        ],
        'MATH-2.4': [
            r'\barea under\b', r'\barea bounded\b', r'\bvolume of revolution\b', r'\bdisk method\b',
            r'\bwasher method\b', r'\bcylindrical shell\b', r'\blength of arc\b', r'\barc length\b',
            r'\bsurface of revolution\b', r'\bcentroid\b', r'\bcenter of mass\b', r'\bpappus\b'
        ],
        'MATH-2.5': [
            r'\bdouble integral\b', r'\btriple integral\b', r'\bmultiple integral\b',
            r'\biterated integral\b', r'\bpolar coordinate\w* integral\b', r'\bcylindrical coordinate\b',
            r'\bspherical coordinate\b', r'\bmoment of inertia by integration\b'
        ],

        # 3.0 Differential Equation
        'MATH-3.1': [
            r'\bseparable\b', r'\bhomogeneous diff\w*', r'\bexact differential\b',
            r'\bintegrating factor\b', r'\bbernoulli\b', r'\blinear first order\b',
            r'\border and degree\b', r'\border 1\b', r'\bdegree 1\b', r'\borthogonal trajectories\b',
            r'\bgrowth and decay\b', r'\bnewton\'?s law of cooling\b'
        ],
        'MATH-3.2': [
            r'\bhigher[- ]order (?:ode|differential)\b', r'\bauxiliary equation\b', r'\bcomplementary function\b',
            r'\bparticular integral\b', r'\bmethod of undetermined\b', r'\bvariation of parameters\b',
            r'\bwronskian\b', r'\bcauchy-euler\b', r'\bcharacteristic equation\b', r'\bvibration\w*\b'
        ],
        'MATH-3.3': [
            r'\blaplace transform\b', r'\binverse laplace\b', r'\bs-domain\b', r'\bunit step function\b',
            r'\bheaviside\b', r'\bdirac delta\b', r'\binitial value theorem\b', r'\bfinal value theorem\b',
            r'\bconvolution theorem\b', r'\btransform of derivative\b'
        ],

        # 4.0 Advanced Engineering Mathematics
        'MATH-4.1': [
            r'\bcomplex number\b', r'\bimaginary\b', r'\bargand\b', r'\bde moivre\b',
            r'\beuler\'?s formula\b', r'\bcauchy-riemann\b', r'\banalytic function\b', r'\bharmonic function\b'
        ],
        'MATH-4.2': [
            r'\bpower series\b', r'\btaylor series\b', r'\bmaclaurin\b', r'\bbessel\b',
            r'\blegendre\b', r'\bfourier series\b', r'\bfourier transform\b', r'\bdirichlet\b'
        ],
        'MATH-4.3': [
            r'\bpde\b', r'\bpartial differential equation\b', r'\bheat equation\b',
            r'\bwave equation\b', r'\blaplace\'?s equation\b', r'\bseparation of variables\b'
        ],
        'MATH-4.4': [
            r'\bmatrix\b', r'\bmatrices\b', r'\bdeterminant\b', r'\bcramer\'?s\b',
            r'\beigenvalue\b', r'\beigenvector\b', r'\blinear algebra\b', r'\binverse matrix\b',
            r'\brank of\b', r'\bgauss-jordan\b', r'\bgauss elimination\b', r'\bsimultaneous equation\b'
        ],
        'MATH-4.5': [
            r'\bnewton-raphson\b', r'\brunge-kutta\b', r'\bsimpson\'?s rule\b', r'\btrapezoidal rule\b',
            r'\bnumerical method\b', r'\bbisection method\b', r'\bsecant method\b', r'\beuler\'?s method\b'
        ],

        # 5.0 Engineering Data Analysis
        'MATH-5.1': [
            r'\bdata collection\b', r'\bsurvey\b', r'\bcensus\b', r'\brandom sampling\b',
            r'\bqualitative\b', r'\bquantitative\b', r'\bdiscrete data\b', r'\bcontinuous data\b'
        ],
        'MATH-5.2': [
            r'\bmean\b', r'\bmedian\b', r'\bmode\b', r'\bstandard deviation\b', r'\bvariance\b',
            r'\bnormal distribution\b', r'\bz-score\b', r'\bbinomial\b', r'\bpoisson\b',
            r'\bconfidence interval\b', r'\bcentral limit theorem\b', r'\bprobability\b', r'\bquartile\b'
        ],
        'MATH-5.3': [
            r'\bhypothesis\b', r'\bnull hypothesis\b', r'\balternative hypothesis\b',
            r'\btype i error\b', r'\btype ii error\b', r'\bp-value\b', r'\bt-test\b', r'\bchi-square\b',
            r'\bsignificance level\b'
        ],
        'MATH-5.4': [
            r'\bregression\b', r'\bcorrelation\b', r'\br-squared\b', r'\bpearson\b',
            r'\bscatter plot\b', r'\bleast squares\b', r'\bcovariance\b'
        ],
        'MATH-5.5': [
            r'\banova\b', r'\banalysis of variance\b', r'\bfactorial design\b', r'\bf-test\b',
            r'\bdesign of experiment\b', r'\brandomized block\b'
        ],

        # 6.0 Electromagnetics
        'MATH-6.1': [
            r'\bdot product\b', r'\bcross product\b', r'\bunit vector\b', r'\bscalar product\b',
            r'\bvector product\b', r'\bdirection cosines\b', r'\bvector analysis\b'
        ],
        'MATH-6.2': [
            r'\bgradient\b', r'\bdivergence\b', r'\bcurl\b', r'\bdel operator\b',
            r'\bdirectional derivative\b', r'\bsolenoidal\b', r'\birrotational\b', r'\blaplacian\b'
        ],
        'MATH-6.3': [
            r'\bgreen\'?s theorem\b', r'\bdivergence theorem\b', r'\bstokes\'? theorem\b',
            r'\bline integral\b', r'\bsurface integral\b', r'\bflux\b', r'\bconservative field\b'
        ],

        # 7.0 Signals & Spectra
        'MATH-7.1': [
            r'\bz-transform\b', r'\binverse z-transform\b', r'\bregion of convergence\b', r'\broc\b'
        ],
        'MATH-7.2': [
            r'\bconvolution\b', r'\bconvolution sum\b', r'\bcontinuous convolution\b', r'\bimpulse response\b'
        ],
        'MATH-7.3': [
            r'\bcross-correlation\b', r'\bauto-correlation\b', r'\bcorrelation function\b', r'\bpower spectral density\b'
        ],

        # 8.0 Feedback & Control
        'MATH-8.1': [
            r'\bpole\b', r'\bzero\b', r'\bpoles and zeros\b', r'\broot locus\b',
            r'\brouth-hurwitz\b', r'\brouth array\b', r'\bstability criterion\b'
        ],
        'MATH-8.2': [
            r'\btransient response\b', r'\bdamping ratio\b', r'\bnatural frequency\b',
            r'\bsettling time\b', r'\brise time\b', r'\bovershoot\b', r'\bsteady state error\b'
        ],
        'MATH-8.3': [
            r'\bblock diagram\b', r'\bsignal flow\b', r'\bmason\'?s gain\b', r'\bsumming point\b'
        ]
    },

    'ELECS': {
        # 1.0 DC Electrical Circuits
        'ELECS-1.1': [
            r'\bohm\'?s law\b', r'\bresistor\b', r'\bresistance\b', r'\bseries circuit\b',
            r'\bparallel circuit\b', r'\bvoltage divider\b', r'\bcurrent divider\b',
            r'\bcolor code\b', r'\bconductance\b', r'\bmho\b', r'\bsiemens\b', r'\bdelta-wye\b', r'\bstar-delta\b'
        ],
        'ELECS-1.2': [
            r'\bmesh analysis\b', r'\bnode analysis\b', r'\bnodal analysis\b', r'\bmesh current\b',
            r'\bnode voltage\b', r'\bkcl\b', r'\bkvl\b', r'\bkirchhoff\b', r'\bsupermesh\b', r'\bsupernode\b'
        ],
        'ELECS-1.3': [
            r'\bthevenin\b', r'\bnorton\b', r'\bsuperposition theorem\b', r'\bmaximum power transfer\b',
            r'\bsource transformation\b', r'\bmillman\b', r'\breciprocity theorem\b'
        ],
        'ELECS-1.4': [
            r'\brc transient\b', r'\brl transient\b', r'\btime constant\b', r'\bcharging capacitor\b',
            r'\bdischarging inductor\b', r'\btransient analysis\b', r'\bstep response\b'
        ],
        'ELECS-1.5': [
            r'\bwheatstone\b', r'\bdc bridge\b', r'\bpotentiometer\b', r'\bdc network\b'
        ],

        # 2.0 AC Electrical Circuits
        'ELECS-2.1': [
            r'\bac circuit\b', r'\balternating current\b', r'\bsinusoid\w*\b', r'\brms\b',
            r'\beffective value\b', r'\bpeak value\b', r'\baverage value\b', r'\bform factor\b', r'\bcrest factor\b'
        ],
        'ELECS-2.2': [
            r'\bcomplex impedance\b', r'\breactance\b', r'\binductive reactance\b',
            r'\bcapacitive reactance\b', r'\badmittance\b', r'\bsusceptance\b', r'\bphasor\b'
        ],
        'ELECS-2.3': [
            r'\bresonance\b', r'\bresonant frequency\b', r'\bseries resonance\b',
            r'\bparallel resonance\b', r'\bquality factor\b', r'\bq-factor\b', r'\btank circuit\b', r'\bbandwidth\b'
        ],
        'ELECS-2.4': [
            r'\breal power\b', r'\breactive power\b', r'\bapparent power\b', r'\bpower factor\b',
            r'\bthree-phase\b', r'\b3-phase\b', r'\bdelta connection\b', r'\bwye connection\b', r'\bvar\b', r'\bvolt-ampere\b'
        ],
        'ELECS-2.5': [
            r'\btwo-port\b', r'\bz-parameter\b', r'\by-parameter\b', r'\bh-parameter\b',
            r'\babcd parameter\b', r'\btransmission parameter\b'
        ],

        # 3.0 Electromagnetics
        'ELECS-3.1': [
            r'\bcoulomb\'?s law\b', r'\belectric field intensity\b', r'\bmagnetic flux density\b',
            r'\bbiot-savart\b', r'\bampere\'?s circuital law\b', r'\belectric potential\b'
        ],
        'ELECS-3.2': [
            r'\bpermittivity\b', r'\bpermeability\b', r'\bdielectric\b', r'\bferromagnetic\b',
            r'\bhysteresis\b', r'\bb-h curve\b', r'\bsusceptibility\b'
        ],
        'ELECS-3.3': [
            r'\bmutual inductance\b', r'\bdot convention\b', r'\breluctance\b',
            r'\bmagnetic circuit\b', r'\bmagnetomotive\b', r'\bmmf\b', r'\bcoupling coefficient\b'
        ],
        'ELECS-3.4': [
            r'\bmaxwell\'?s equations\b', r'\bfaraday\'?s law\b', r'\blenz\'?s law\b',
            r'\bdisplacement current\b', r'\bpoynting vector\b', r'\btime-varying field\b'
        ],

        # 4.0 Electronic Devices and Circuits
        'ELECS-4.1': [
            r'\bclipper\b', r'\bclamper\b', r'\bzener\b', r'\bvaractor\b', r'\btunnel diode\b',
            r'\bschottky\b', r'\bled\b', r'\bphotodiode\b', r'\bwave shaping\b'
        ],
        'ELECS-4.2': [
            r'\bre model\b', r'\bh-parameter\b', r'\bsmall signal\b', r'\btransconductance\b',
            r'\binput impedance\b', r'\boutput impedance\b', r'\bvoltage gain\b', r'\bcurrent gain\b'
        ],
        'ELECS-4.3': [
            r'\bdiode equivalent\b', r'\bideal diode\b', r'\bbarrier potential\b',
            r'\bforward resistance\b', r'\breverse saturation current\b', r'\bshockley\b'
        ],
        'ELECS-4.4': [
            r'\brectifier\b', r'\bhalf-wave\b', r'\bfull-wave\b', r'\bbridge rectifier\b',
            r'\bvoltage multiplier\b', r'\bvoltage doubler\b', r'\bripple factor\b', r'\bpower supply\b'
        ],
        'ELECS-4.5': [
            r'\bbjt\b', r'\btransistor\b', r'\bnpn\b', r'\bpnp\b', r'\bcommon emitter\b',
            r'\bcommon base\b', r'\bcommon collector\b', r'\bjfet\b', r'\bmosfet\b',
            r'\bpinch-off\b', r'\bdrain current\b', r'\bgate voltage\b', r'\bthreshold voltage\b'
        ],

        # 5.0 Electronic Circuit Analysis and Design
        'ELECS-5.1': [
            r'\bfrequency response\b', r'\bcutoff frequency\b', r'\bmiller effect\b',
            r'\bhigh frequency response\b', r'\blow frequency response\b', r'\bbode plot\b'
        ],
        'ELECS-5.2': [
            r'\bcascode\b', r'\bcascade\b', r'\bdarlington\b', r'\bmultistage amplifier\b'
        ],
        'ELECS-5.3': [
            r'\bcurrent mirror\b', r'\bwidlar\b', r'\bwilson current\b', r'\bactive load\b', r'\bcurrent source\b'
        ],
        'ELECS-5.4': [
            r'\bop-amp\b', r'\boperational amplifier\b', r'\bdifferential amplifier\b',
            r'\bcmrr\b', r'\bvirtual ground\b', r'\binverting amp\w*\b', r'\bnon-inverting amp\w*\b',
            r'\bsumming amp\w*\b', r'\binstrumentation amp\w*\b', r'\bslew rate\b'
        ],
        'ELECS-5.5': [
            r'\boscillator\b', r'\bbarkhausen\b', r'\bwien bridge\b', r'\brc phase shift\b',
            r'\bcolpitts\b', r'\bhartley\b', r'\bactive filter\b', r'\bbutterworth\b', r'\bchebyshev\b'
        ],

        # 6.0 Electronic Systems and Design
        'ELECS-6.1': [
            r'\bthyristor\b', r'\bscr\b', r'\btriac\b', r'\bdiac\b', r'\bujt\b',
            r'\bput\b', r'\bfiring angle\b', r'\brelaxation oscillator\b'
        ],
        'ELECS-6.2': [
            r'\boptoelectronic\b', r'\boptocoupler\b', r'\bphototransistor\b', r'\bldr\b', r'\bsolar cell\b'
        ],
        'ELECS-6.3': [
            r'\btransducer\b', r'\bdata acquisition\b', r'\bdaq\b', r'\blvdt\b',
            r'\bthermocouple\b', r'\brtd\b', r'\bstrain gauge\b', r'\bpiezoelectric\b'
        ],
        'ELECS-6.4': [
            r'\bplc\b', r'\bprogrammable logic controller\b', r'\bladder logic\b', r'\brung\b'
        ],
        'ELECS-6.5': [
            r'\bbms\b', r'\bhvac\b', r'\bbuilding management\b', r'\bbuilding automation\b'
        ],
        'ELECS-6.6': [
            r'\bcctv\b', r'\bfire alarm\b', r'\bsurveillance\b', r'\bburglar alarm\b', r'\baccess control\b'
        ],

        # 7.0 Logic Circuits
        'ELECS-7.1': [
            r'\bboolean algebra\b', r'\blogic gate\b', r'\band gate\b', r'\bor gate\b',
            r'\bxor\b', r'\bxnor\b', r'\bnand\b', r'\bnor\b', r'\btruth table\b', r'\bde morgan\b'
        ],
        'ELECS-7.2': [
            r'\bk-map\b', r'\bkarnaugh\b', r'\bminimization\b', r'\bdon\'?t care\b', r'\bquine-mccluskey\b'
        ],
        'ELECS-7.3': [
            r'\bflip-flop\b', r'\blatch\b', r'\bsr flip-flop\b', r'\bjk flip-flop\b',
            r'\bd flip-flop\b', r'\bt flip-flop\b', r'\bshift register\b', r'\bcounter\b', r'\bripple counter\b'
        ],
        'ELECS-7.4': [
            r'\basm chart\b', r'\balgorithmic state machine\b', r'\bstate diagram\b', r'\bmealy\b', r'\bmoore machine\b'
        ],
        'ELECS-7.5': [
            r'\basynchronous sequential\b', r'\bhazard\b', r'\brace condition\b', r'\bflow table\b'
        ],

        # 8.0 Microprocessor Systems
        'ELECS-8.1': [
            r'\bmicroprocessor\b', r'\bcpu\b', r'\balu\b', r'\bprogram counter\b',
            r'\bstack pointer\b', r'\b8086\b', r'\bfetch-decode-execute\b', r'\bregister array\b'
        ],
        'ELECS-8.2': [
            r'\bram\b', r'\brom\b', r'\bsram\b', r'\bdram\b', r'\beeprom\b',
            r'\bflash memory\b', r'\bmemory subsystem\b', r'\bcache memory\b'
        ],
        'ELECS-8.3': [
            r'\bi/o subsystem\b', r'\binterrupt\b', r'\bdma\b', r'\bmemory-mapped i/o\b', r'\bserial interface\b'
        ],
        'ELECS-8.4': [
            r'\bassembly language\b', r'\binstruction set\b', r'\baddressing mode\b',
            r'\bopcode\b', r'\bmnemonic\b', r'\bsubroutine\b'
        ],
        'ELECS-8.5': [
            r'\bmicrocontroller\b', r'\b8051\b', r'\bpic microcontroller\b', r'\bavr\b', r'\barduino\b', r'\bon-chip\b'
        ],

        # 9.0 Feedback & Control Systems
        'ELECS-9.1': [
            r'\bblock diagram reduction\b', r'\bsignal flow graph\b', r'\bmason\'?s formula\b', r'\bforward path\b'
        ],
        'ELECS-9.2': [
            r'\blti system\b', r'\btransient analysis of control\b', r'\bstep response\b', r'\bimpulse response\b'
        ],
        'ELECS-9.3': [
            r'\bsystem modeling\b', r'\btransfer function\b', r'\bopen loop transfer\b', r'\bclosed loop transfer\b'
        ],
        'ELECS-9.4': [
            r'\broot locus\b', r'\brouth stability\b', r'\bgain margin\b', r'\bphase margin\b', r'\bnyquist criterion\b'
        ],
        'ELECS-9.5': [
            r'\bsteady state error\b', r'\berror constant\b', r'\bpid controller\b', r'\blead-lag\b'
        ]
    },

    'GEAS': {
        # 1.0 Chemistry
        'GEAS-1.1': [
            r'\bthermochemistry\b', r'\bheat of reaction\b', r'\bcalorimetry\b', r'\bexothermic\b', r'\bendothermic\b'
        ],
        'GEAS-1.2': [
            r'\bionic bond\b', r'\bcovalent bond\b', r'\bmetallic bond\b', r'\bcorrosion\b',
            r'\boxidation\b', r'\breduction\b', r'\bredox\b', r'\belectrochemistry\b', r'\bgalvanic\b'
        ],
        'GEAS-1.3': [
            r'\bnanomaterial\b', r'\bnanotechnology\b', r'\bgraphene\b', r'\bcarbon nanotube\b', r'\bfullerene\b'
        ],
        'GEAS-1.4': [
            r'\bgreen chemistry\b', r'\bacid rain\b', r'\bgreenhouse gas\b', r'\bwater chemistry\b'
        ],

        # 2.0 Physics
        'GEAS-2.1': [
            r'\bwork-energy\b', r'\bkinetic energy\b', r'\bpotential energy\b', r'\bmechanical power\b', r'\bconservation of energy\b'
        ],
        'GEAS-2.2': [
            r'\bimpulse\b', r'\bmomentum\b', r'\belastic collision\b', r'\binelastic collision\b', r'\bcoefficient of restitution\b'
        ],
        'GEAS-2.3': [
            r'\bkinematics\b', r'\bprojectile motion\b', r'\brectilinear\b', r'\bacceleration\b', r'\bvelocity\b'
        ],
        'GEAS-2.4': [
            r'\bnewton\'?s laws\b', r'\bfriction\b', r'\bnormal force\b', r'\bcentripetal force\b', r'\bfree body diagram\b'
        ],
        'GEAS-2.5': [
            r'\btorque\b', r'\bmoment of inertia\b', r'\bangular momentum\b', r'\brotational motion\b'
        ],
        'GEAS-2.6': [
            r'\bhooke\'?s law\b', r'\byoung\'?s modulus\b', r'\bshear modulus\b', r'\bbulk modulus\b', r'\belasticity\b'
        ],
        'GEAS-2.7': [
            r'\bsimple harmonic\b', r'\bpendulum\b', r'\bwave speed\b', r'\bsound wave\b', r'\bdoppler\b'
        ],
        'GEAS-2.8': [
            r'\bbuoyancy\b', r'\barchimedes\b', r'\bpascals principle\b', r'\bbernoulli\'?s principle\b', r'\bfluid statics\b'
        ],
        'GEAS-2.9': [
            r'\bheat transfer\b', r'\bconduction\b', r'\bconvection\b', r'\bradiation heat\b', r'\bspecific heat\b', r'\blatent heat\b'
        ],
        'GEAS-2.10': [
            r'\bsnell\'?s law\b', r'\brefraction\b', r'\breflection\b', r'\blens\b', r'\bmirror\b', r'\bcoulomb\b'
        ],

        # 3.0 Engineering Economics
        'GEAS-3.1': [
            r'\binterest\b', r'\bsimple interest\b', r'\bcompound interest\b', r'\bnominal rate\b', r'\beffective rate\b'
        ],
        'GEAS-3.2': [
            r'\bannuity\b', r'\bdeferred annuity\b', r'\bperpetuity\b', r'\bcash flow\b', r'\bgradient series\b'
        ],
        'GEAS-3.3': [
            r'\bpresent worth\b', r'\bfuture worth\b', r'\bannual worth\b', r'\brate of return\b', r'\birr\b', r'\bbenefit-cost\b'
        ],
        'GEAS-3.4': [
            r'\bbreak-even\b', r'\bdepreciation\b', r'\bstraight line dep\w*\b', r'\bdeclining balance\b', r'\bsum-of-the-years\b', r'\bsalvage value\b'
        ],
        'GEAS-3.5': [
            r'\bdecision tree\b', r'\bexpected monetary value\b', r'\brisk analysis\b'
        ],
        'GEAS-3.6': [
            r'\bmaximin\b', r'\bmaximax\b', r'\bminimax regret\b', r'\blaplace criterion\b'
        ],

        # 4.0 Engineering Management
        'GEAS-4.1': [
            r'\btaylor\b', r'\bfayol\b', r'\bhawthorne\b', r'\bscientific management\b'
        ],
        'GEAS-4.2': [
            r'\bmanagerial role\b', r'\bconceptual skill\b', r'\bmanagement function\b'
        ],
        'GEAS-4.3': [
            r'\bplanning\b', r'\borganizing\b', r'\bleading\b', r'\bcontrolling\b',
            r'\bmaslow\b', r'\bherzberg\b', r'\bmotivation\b', r'\bleadership\b'
        ],
        'GEAS-4.4': [
            r'\bpert\b', r'\bcpm\b', r'\bcritical path\b', r'\bgantt\b', r'\beoq\b',
            r'\btqm\b', r'\bsix sigma\b', r'\bquality control\b'
        ],
        'GEAS-4.5': [
            r'\bmarketing mix\b', r'\b4 ps\b', r'\bbalance sheet\b', r'\bincome statement\b'
        ],

        # 5.0 Technopreneurship 101
        'GEAS-5.1': [
            r'\btechnopreneurship\b', r'\bstartup ethics\b', r'\bsocial responsibility\b'
        ],
        'GEAS-5.2': [
            r'\bvalue proposition\b', r'\bcustomer segment\b', r'\bpain point\b'
        ],
        'GEAS-5.3': [
            r'\btam sam som\b', r'\bmarket sizing\b', r'\bmarket research\b'
        ],
        'GEAS-5.4': [
            r'\bporter\'?s five\b', r'\bswot analysis\b', r'\bcompetitive advantage\b'
        ],
        'GEAS-5.5': [
            r'\bbusiness model canvas\b', r'\bpatent\b', r'\bintellectual property\b', r'\btrademark\b', r'\bcopyright\b'
        ],
        'GEAS-5.6': [
            r'\bmvp\b', r'\bminimum viable product\b', r'\bpitch deck\b', r'\bbusiness plan\b'
        ],
        'GEAS-5.7': [
            r'\brunway\b', r'\bburn rate\b', r'\bunit economic\b', r'\bgross margin\b'
        ],
        'GEAS-5.8': [
            r'\bventure capital\b', r'\bangel investor\b', r'\bseed funding\b', r'\bcrowdfunding\b'
        ],

        # 6.0 Physics 2
        'GEAS-6.1': [
            r'\bthermodynamics\b', r'\bcarnot\b', r'\bentropy\b', r'\bfirst law of thermo\w*\b', r'\bsecond law of thermo\w*\b', r'\bideal gas\b'
        ],
        'GEAS-6.2': [
            r'\belectric flux\b', r'\bgauss\'?s law\b', r'\bmagnetic force\b'
        ],
        'GEAS-6.3': [
            r'\binductance\b', r'\bself inductance\b', r'\bmutual induction\b', r'\bem induction\b'
        ],
        'GEAS-6.4': [
            r'\brlc series\b', r'\brlc parallel\b', r'\bac physics\b'
        ],
        'GEAS-6.5': [
            r'\bphotoelectric effect\b', r'\bnuclear reaction\b', r'\bradioactivity\b', r'\bhalf-life\b', r'\bwave optics\b'
        ],

        # 7.0 Materials Science
        'GEAS-7.1': [
            r'\batomic bonding\b', r'\bprimary bonding\b', r'\belectronegativity\b'
        ],
        'GEAS-7.2': [
            r'\bunit cell\b', r'\bbcc\b', r'\bfcc\b', r'\bhcp\b', r'\bmiller indices\b', r'\bcrystal structure\b'
        ],
        'GEAS-7.3': [
            r'\bpoint defect\b', r'\bvacancy\b', r'\bdislocation\b', r'\bgrain boundary\b'
        ],
        'GEAS-7.4': [
            r'\bfick\'?s first law\b', r'\bfick\'?s second law\b', r'\bdiffusion in solid\b', r'\bcarburizing\b'
        ],
        'GEAS-7.5': [
            r'\btensile test\b', r'\bstress-strain\b', r'\byield point\b', r'\bductility\b',
            r'\bbrinell\b', r'\brockwell\b', r'\bcharpy\b', r'\bfatigue\b', r'\bcreep\b'
        ],
        'GEAS-7.6': [
            r'\bphase diagram\b', r'\biron-carbon\b', r'\bsteel\b', r'\bpolymer\b', r'\bceramic\b', r'\bcomposite\b'
        ],
        'GEAS-7.7': [
            r'\bband theory\b', r'\bdielectric strength\b', r'\bferromagnetism\b'
        ],

        # 8.0 Computer Programming
        'GEAS-8.1': [
            r'\boop\b', r'\bobject oriented\b', r'\bclass\b', r'\binheritance\b', r'\bpolymorphism\b', r'\bencapsulation\b', r'\buml\b'
        ],
        'GEAS-8.2': [
            r'\bdesign pattern\b', r'\bsolid principle\b', r'\bsoftware architecture\b'
        ],
        'GEAS-8.3': [
            r'\bprogramming\b', r'\bvariable\b', r'\bdata type\b', r'\bloop\b', r'\barray\b', r'\bpointer\b', r'\balgorithm\b'
        ],
        'GEAS-8.4': [
            r'\bexception\b', r'\btry catch\b', r'\berror handling\b'
        ],
        'GEAS-8.5': [
            r'\bgui\b', r'\bevent-driven\b', r'\bcallback\b', r'\bwidget\b'
        ],

        # 9.0 Environmental Science
        'GEAS-9.1': [
            r'\becosystem\b', r'\bfood chain\b', r'\bbiodiversity\b', r'\becology\b'
        ],
        'GEAS-9.2': [
            r'\brenewable resource\b', r'\bnon-renewable\b', r'\bwater resource\b'
        ],
        'GEAS-9.3': [
            r'\bpollution\b', r'\bair pollution\b', r'\bwater pollution\b', r'\bsolid waste\b',
            r'\bclimate change\b', r'\bglobal warming\b', r'\bozone layer\b'
        ],
        'GEAS-9.4': [
            r'\beia\b', r'\benvironmental impact\b', r'\becc\b', r'\benvironmental compliance\b'
        ],
        'GEAS-9.5': [
            r'\bsustainability\b', r'\bsustainable development\b', r'\bcarbon footprint\b'
        ],

        # 10.0 ECE Laws
        'GEAS-10.1': [
            r'\bcontract\b', r'\bobligation\b', r'\bbreach of contract\b', r'\btort\b', r'\bcivil code\b'
        ],
        'GEAS-10.2': [
            r'\bcode of ethics\b', r'\bece pledge\b', r'\bethical conduct\b', r'\bmoral\b'
        ],
        'GEAS-10.3': [
            r'\bboard exam\b', r'\bpassing score\b', r'\bprc exam\b'
        ],
        'GEAS-10.4': [
            r'\bra 9292\b', r'\bece law\b', r'\bpece\b', r'\bect\b', r'\bprc board of electronics\b', r'\bboard of electronics\b'
        ],
        'GEAS-10.5': [
            r'\bra 7925\b', r'\bra 8792\b', r'\be-commerce act\b', r'\bpublic telecommunications\b'
        ],
        'GEAS-10.6': [
            r'\bphilippine electrical code\b', r'\bpec\b', r'\bosha\b', r'\bsafety standard\b'
        ],

        # 11.0 CAD
        'GEAS-11.1': [
            r'\bcad\b', r'\bautocad\b', r'\bcoordinate system\b', r'\bviewport\b'
        ],
        'GEAS-11.2': [
            r'\bosnap\b', r'\bsnapping\b', r'\bortho\b', r'\bpolar tracking\b'
        ],
        'GEAS-11.3': [
            r'\bdimensioning\b', r'\bplotting\b', r'\bdrawing scale\b'
        ]
    },

    'EST': {
        # 1.0 Signals & Spectra
        'EST-1.1': [
            r'\bperiodic signal\b', r'\banalog signal\b', r'\bdigital signal\b', r'\benergy signal\b', r'\bpower signal\b'
        ],
        'EST-1.2': [
            r'\bnyquist\b', r'\bsampling theorem\b', r'\baliasing\b', r'\bantialiasing\b', r'\bnyquist rate\b'
        ],
        'EST-1.3': [
            r'\bfir filter\b', r'\biir filter\b', r'\bdifference equation\b', r'\bfilter design\b'
        ],
        'EST-1.4': [
            r'\bconvolution\b', r'\bcircular convolution\b', r'\bcross-correlation\b', r'\bauto-correlation\b'
        ],
        'EST-1.5': [
            r'\bz-transform\b', r'\bpole-zero plot\b', r'\broc\b'
        ],
        'EST-1.6': [
            r'\bdft\b', r'\bfft\b', r'\bfast fourier\b', r'\bdiscrete fourier\b', r'\bspectral analysis\b'
        ],

        # 2.0 Principles of Communications
        'EST-2.1': [
            r'\bcommunication system\b', r'\btransmitter\b', r'\breceiver\b', r'\bchannel capacity\b', r'\bshannon\b', r'\bhartley\b'
        ],
        'EST-2.2': [
            r'\bamplitude modulation\b', r'\bam\b', r'\bmodulation index\b', r'\bthermal noise\b',
            r'\bjohnson noise\b', r'\bsnr\b', r'\bnoise figure\b', r'\bdsb-fc\b', r'\bsideband power\b'
        ],
        'EST-2.3': [
            r'\bssb\b', r'\bssb-sc\b', r'\bbalanced modulator\b', r'\bvestigial sideband\b', r'\bvsb\b'
        ],
        'EST-2.4': [
            r'\bfrequency modulation\b', r'\bfm\b', r'\bcarson\'?s rule\b', r'\bfrequency deviation\b',
            r'\bpre-emphasis\b', r'\bde-emphasis\b', r'\bphase modulation\b', r'\bpm\b'
        ],
        'EST-2.5': [
            r'\bsuperheterodyne\b', r'\bintermediate frequency\b', r'\bif stage\b', r'\bimage frequency\b',
            r'\bagc\b', r'\bselectivity\b', r'\bsensitivity\b'
        ],
        'EST-2.6': [
            r'\bground wave\b', r'\bsky wave\b', r'\bspace wave\b', r'\bionosphere\b',
            r'\bmuf\b', r'\bcritical frequency\b', r'\bskip distance\b', r'\bfading\b'
        ],
        'EST-2.7': [
            r'\bpam\b', r'\bpwm\b', r'\bppm\b', r'\bpulse modulation\b'
        ],
        'EST-2.8': [
            r'\bbroadband\b', r'\bcellular system\b', r'\bgsm\b', r'\blte\b', r'\b5g\b', r'\bsatellite communication\b'
        ],

        # 3.0 Digital Communications
        'EST-3.1': [
            r'\bdigital communication\b', r'\bdigital transmission\b'
        ],
        'EST-3.2': [
            r'\bline coding\b', r'\bnrz\b', r'\brz\b', r'\bmanchester\b', r'\bami\b',
            r'\bintersymbol interference\b', r'\bisi\b', r'\beye pattern\b'
        ],
        'EST-3.3': [
            r'\bpcm\b', r'\bpulse code modulation\b', r'\bquantization\b', r'\bcompanding\b',
            r'\ba-law\b', r'\bmu-law\b', r'\bdelta modulation\b', r'\bdpcm\b', r'\bsqnr\b'
        ],
        'EST-3.4': [
            r'\bask\b', r'\bfsk\b', r'\bpsk\b', r'\bbpsk\b', r'\bqpsk\b', r'\bqam\b',
            r'\b16-qam\b', r'\b64-qam\b', r'\bconstellation diagram\b', r'\bber\b', r'\bbit error rate\b'
        ],
        'EST-3.5': [
            r'\binformation theory\b', r'\bentropy\b', r'\bshannon limit\b', r'\bparity\b',
            r'\bchecksum\b', r'\bcrc\b', r'\bhamming code\b', r'\bforward error correction\b'
        ],
        'EST-3.6': [
            r'\bfdm\b', r'\btdm\b', r'\bwdm\b', r'\bfdma\b', r'\btdma\b', r'\bcdma\b',
            r'\bspread spectrum\b', r'\bdsss\b', r'\bfhss\b', r'\bmultiplexing\b'
        ],

        # 4.0 Transmission & Antennas
        'EST-4.1': [
            r'\btransmission line\b', r'\bcoaxial\b', r'\bcharacteristic impedance\b', r'\bpropagation velocity\b', r'\btwo-wire\b'
        ],
        'EST-4.2': [
            r'\bstanding wave\b', r'\bswr\b', r'\bvswr\b', r'\breflection coefficient\b',
            r'\bquarter-wave\b', r'\bstub matching\b', r'\battenuation constant\b', r'\breturn loss\b'
        ],
        'EST-4.3': [
            r'\bsmith chart\b', r'\bstub tuning\b'
        ],
        'EST-4.4': [
            r'\bradio wave propagation\b', r'\bfree space path loss\b', r'\bfspl\b', r'\bfriis\b', r'\bfresnel\b'
        ],
        'EST-4.5': [
            r'\bpower density\b', r'\bfield strength\b', r'\beirp\b', r'\berp\b', r'\beffective radiated power\b'
        ],
        'EST-4.6': [
            r'\bantenna\b', r'\bdipole\b', r'\byagi\b', r'\bparabolic\b', r'\bhorn antenna\b',
            r'\bantenna gain\b', r'\bdirectivity\b', r'\bradiation pattern\b', r'\bbeamwidth\b', r'\bpolarization\b'
        ],
        'EST-4.7': [
            r'\bwaveguide\b', r'\bcutoff frequency\b', r'\bte mode\b', r'\btm mode\b',
            r'\boptical fiber\b', r'\bfiber optic\b', r'\bcore\b', r'\bcladding\b',
            r'\bnumerical aperture\b', r'\btotal internal reflection\b', r'\bsingle mode fiber\b', r'\bmultimode fiber\b'
        ],

        # 5.0 Electronics 3: Electronic Systems
        'EST-5.1': [
            r'\bpower semiconductor\b', r'\bscr\b', r'\btriac\b', r'\bdiac\b', r'\bujt\b', r'\bthyristor\b'
        ],
        'EST-5.2': [
            r'\boptoelectronic\b', r'\boptical encoder\b', r'\blaser sensor\b', r'\bphotodetector\b'
        ],
        'EST-5.3': [
            r'\btransducer\b', r'\b4-20ma\b', r'\bcurrent loop\b', r'\bsignal conditioning\b'
        ],
        'EST-5.4': [
            r'\bplc\b', r'\bindustrial automation\b', r'\bscada\b'
        ],
        'EST-5.5': [
            r'\bbuilding management\b', r'\bbms\b', r'\bpublic address\b', r'\bfire and life safety\b', r'\bsecurity system\b'
        ],

        # 6.0 Data Communications
        'EST-6.1': [
            r'\bdata communication\b', r'\bsimplex\b', r'\bhalf-duplex\b', r'\bfull-duplex\b', r'\bdte\b', r'\bdce\b'
        ],
        'EST-6.2': [
            r'\btopology\b', r'\bstar topology\b', r'\bbus topology\b', r'\bring topology\b', r'\bmesh topology\b'
        ],
        'EST-6.3': [
            r'\basynchronous transmission\b', r'\bsynchronous transmission\b', r'\bbaud rate\b', r'\bbit rate\b', r'\bframing\b'
        ],
        'EST-6.4': [
            r'\brs-232\b', r'\busb\b', r'\brouter\b', r'\bswitch\b', r'\bmodem\b', r'\bmultiplexer\b'
        ],
        'EST-6.5': [
            r'\bcryptography\b', r'\bencryption\b', r'\bdes\b', r'\baes\b', r'\brsa\b', r'\bfirewall\b', r'\bssl\b', r'\btls\b'
        ],
        'EST-6.6': [
            r'\bosi model\b', r'\btcp/ip\b', r'\bip address\b', r'\bipv4\b', r'\bipv6\b',
            r'\bsubnet\w*\b', r'\btcp\b', r'\budp\b', r'\barp\b', r'\bdns\b', r'\bhttp\b'
        ],
        'EST-6.7': [
            r'\bhdlc\b', r'\bsna\b', r'\barq\b', r'\bsliding window\b', r'\bstop-and-wait\b', r'\bselective repeat\b'
        ],
        'EST-6.8': [
            r'\blan\b', r'\bwan\b', r'\bman\b', r'\bethernet\b', r'\bieee 802\b', r'\bwi-fi\b', r'\bbluetooth\b', r'\bvlan\b'
        ]
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. PARENT TOPIC FALLBACK RULES
# ─────────────────────────────────────────────────────────────────────────────
PARENT_RULES = {
    'MATH': {
        'MATH-1.0': [r'\bcalculus\b', r'\bdiff\w*\b', r'\bderivative\b'],
        'MATH-2.0': [r'\bintegral\b', r'\bintegrat\w*\b', r'\bantiderivative\b'],
        'MATH-3.0': [r'\bdifferential equation\b', r'\bode\b'],
        'MATH-4.0': [r'\badv\w* math\b', r'\bcomplex\b', r'\bseries\b', r'\bmatrix\b'],
        'MATH-5.0': [r'\bstatistics\b', r'\bprobability\b', r'\bdata analysis\b'],
        'MATH-6.0': [r'\belectromagnetics\b', r'\bvector\b', r'\bmaxwell\b'],
        'MATH-7.0': [r'\bsignal\b', r'\bspectra\b', r'\bsignal processing\b'],
        'MATH-8.0': [r'\bcontrol system\b', r'\bfeedback\b', r'\btransfer function\b'],
    },
    'ELECS': {
        'ELECS-1.0': [r'\bdc\b', r'\bdc circuit\b', r'\bohm\b', r'\bresist\w*\b'],
        'ELECS-2.0': [r'\bac\b', r'\bac circuit\b', r'\balternating current\b', r'\bphasor\b'],
        'ELECS-3.0': [r'\belectromagnetics\b', r'\bmagnetic\b', r'\bfield\b'],
        'ELECS-4.0': [r'\bdiode\b', r'\btransistor\b', r'\bbjt\b', r'\bfet\b', r'\bsemiconductor\b'],
        'ELECS-5.0': [r'\bop-amp\b', r'\bamplifier\b', r'\boscillator\b', r'\bfilter\b'],
        'ELECS-6.0': [r'\bthyristor\b', r'\btransducer\b', r'\bplc\b', r'\bbms\b'],
        'ELECS-7.0': [r'\blogic\b', r'\bgate\b', r'\bboolean\b', r'\bflip-flop\b', r'\bcounter\b'],
        'ELECS-8.0': [r'\bmicroprocessor\b', r'\bmicrocontroller\b', r'\bcpu\b', r'\bassembly\b'],
        'ELECS-9.0': [r'\bfeedback\b', r'\bcontrol\b', r'\broot locus\b', r'\bpid\b'],
    },
    'GEAS': {
        'GEAS-1.0': [r'\bchemistry\b', r'\bchemical\b', r'\bmolecule\b', r'\batom\b'],
        'GEAS-2.0': [r'\bphysics\b', r'\bvelocity\b', r'\bforce\b', r'\bwork\b', r'\benergy\b'],
        'GEAS-3.0': [r'\beconomics\b', r'\becon\b', r'\binterest\b', r'\bannuity\b', r'\bpresent worth\b'],
        'GEAS-4.0': [r'\bmanagement\b', r'\bplanning\b', r'\bleading\b', r'\borganizing\b'],
        'GEAS-5.0': [r'\btechnopreneurship\b', r'\bstartup\b', r'\bbusiness plan\b'],
        'GEAS-6.0': [r'\bthermodynamics\b', r'\bphysics 2\b', r'\boptics\b', r'\bnuclear\b'],
        'GEAS-7.0': [r'\bmaterial science\b', r'\bcrystal\b', r'\bmetallurgy\b', r'\bstress-strain\b'],
        'GEAS-8.0': [r'\bprogramming\b', r'\bcomputer\b', r'\bsoftware\b', r'\boop\b'],
        'GEAS-9.0': [r'\benvironment\b', r'\becology\b', r'\bpollution\b'],
        'GEAS-10.0': [r'\blaw\b', r'\bethics\b', r'\bra 9292\b', r'\bcontract\b', r'\bpec\b'],
        'GEAS-11.0': [r'\bcad\b', r'\bautocad\b', r'\bdrafting\b'],
    },
    'EST': {
        'EST-1.0': [r'\bsignals\b', r'\bsampling\b', r'\bfilter\b', r'\bfourier\b'],
        'EST-2.0': [r'\bcommunication\b', r'\bmodulation\b', r'\bam\b', r'\bfm\b', r'\breceiver\b'],
        'EST-3.0': [r'\bdigital comm\b', r'\bpcm\b', r'\bpsk\b', r'\bqam\b', r'\berror detection\b'],
        'EST-4.0': [r'\btransmission line\b', r'\bantenna\b', r'\bwave propagation\b', r'\bfiber\b', r'\bwaveguide\b'],
        'EST-5.0': [r'\belectronics 3\b', r'\btransducer\b', r'\bplc\b', r'\bbms\b'],
        'EST-6.0': [r'\bdata comm\b', r'\bnetwork\b', r'\bosi\b', r'\btcp/ip\b', r'\bethernet\b'],
    }
}

# Mapping each decimal subtopic to its parent topic (e.g. 'MATH-1.4' -> 'MATH-1.0')
SUBTOPIC_TO_PARENT = {}
for subj, topic_dict in SUBTOPIC_RULES.items():
    for sub_id in topic_dict:
        m = re.match(r'^([A-Z]+-\d+)\.\d+$', sub_id)
        if m:
            SUBTOPIC_TO_PARENT[sub_id] = f"{m.group(1)}.0"

# Precompile all regex rules for maximum performance
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

def classify_text(text, subject_code):
    """
    Score text against all decimal subtopics for the given subject.
    Returns the most specific subtopic ID (e.g. 'MATH-1.4'), or falls back to parent (e.g. 'MATH-1.0').
    """
    if subject_code not in COMPILED_SUBTOPIC_RULES:
        return None

    subtopic_scores = Counter()
    for sub_id, patterns in COMPILED_SUBTOPIC_RULES[subject_code].items():
        for pat in patterns:
            cnt = len(pat.findall(text))
            if cnt > 0:
                subtopic_scores[sub_id] += cnt

    if subtopic_scores:
        best_subtopic = subtopic_scores.most_common(1)[0][0]
        return best_subtopic

    # If no specific subtopic pattern matched, test parent-level rules
    parent_scores = Counter()
    if subject_code in COMPILED_PARENT_RULES:
        for p_id, patterns in COMPILED_PARENT_RULES[subject_code].items():
            for pat in patterns:
                cnt = len(pat.findall(text))
                if cnt > 0:
                    parent_scores[p_id] += cnt

    if parent_scores:
        return parent_scores.most_common(1)[0][0]

    # Subject-level fallback to topic 1.0
    fallback_map = {
        'MATH': 'MATH-1.0',
        'ELECS': 'ELECS-1.0',
        'GEAS': 'GEAS-2.0',
        'EST': 'EST-2.0',
    }
    return fallback_map.get(subject_code, None)

def extract_card_text(data_str, card_type):
    if not data_str:
        return ''
    try:
        data = json.loads(data_str)
        if isinstance(data, dict):
            parts = []
            if 'question' in data and data['question']:
                parts.append(str(data['question']))
            if 'front' in data and data['front']:
                parts.append(str(data['front']))
            if 'back' in data and data['back']:
                parts.append(str(data['back']))
            if 'choices' in data and isinstance(data['choices'], list):
                parts.extend([str(c) for c in data['choices']])
            if 'explanation' in data and data['explanation']:
                parts.append(str(data['explanation']))
            return ' '.join(parts)
        return str(data_str)
    except:
        return str(data_str)

def run_classification(db_path=DEFAULT_DB_PATH, deck_id=None, apply_changes=False, output_json=False):
    if not os.path.exists(db_path):
        err_msg = f"Database not found at {db_path}"
        if output_json:
            print(json.dumps({"success": False, "error": err_msg}))
        else:
            print(f"Error: {err_msg}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
        SELECT c.id, t.subject, t.name, c.type, c.data, c.tos_topic_id, t.id
        FROM cards c
        JOIN topics t ON c.topic_id = t.id
    """
    params = []
    if deck_id:
        query += " WHERE t.id = ?"
        params.append(deck_id)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    total = len(rows)

    updates = []
    distribution = Counter()
    subject_distribution = Counter()
    subtopic_count = 0
    parent_count = 0

    for r in rows:
        card_id, subject_raw, deck_name, card_type, data_raw, existing_tos, d_id = r
        subject_code = normalize_subject(subject_raw)

        card_text = extract_card_text(data_raw, card_type)
        assigned_topic = classify_text(card_text, subject_code)

        if assigned_topic:
            updates.append((assigned_topic, card_id))
            distribution[assigned_topic] += 1
            subject_distribution[subject_code] += 1
            if '.' in assigned_topic and not assigned_topic.endswith('.0'):
                subtopic_count += 1
            else:
                parent_count += 1

    if apply_changes and updates:
        cursor.executemany("UPDATE cards SET tos_topic_id = ? WHERE id = ?", updates)
        conn.commit()

    conn.close()

    result = {
        "success": True,
        "mode": "applied" if apply_changes else "dry-run",
        "total_cards": total,
        "classified_cards": len(updates),
        "subtopic_count": subtopic_count,
        "parent_count": parent_count,
        "subject_distribution": dict(subject_distribution),
        "top_classifications": dict(distribution.most_common(20))
    }

    if output_json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\nECEngine TOS Classification ({result['mode'].upper()})")
        print(f"Total cards processed: {total}")
        print(f"Classified into decimal subtopics: {subtopic_count} ({subtopic_count/max(total,1)*100:.1f}%)")
        print(f"Classified into parent topics:    {parent_count} ({parent_count/max(total,1)*100:.1f}%)")
        print("\n--- By Subject ---")
        for subj, cnt in sorted(subject_distribution.items()):
            print(f"  {subj:8s}: {cnt:5d} cards")
        print("\n--- Top 20 TOS Classifications ---")
        for tid, cnt in distribution.most_common(20):
            print(f"  {tid:12s}: {cnt:5d} cards")
        if not apply_changes:
            print("\n[NOTE] Ran in DRY-RUN mode. Use --apply to commit changes to database.")

    return 0

def main():
    parser = argparse.ArgumentParser(description="Classify ECEngine database into PRC TOS topics & subtopics")
    parser.add_argument('--apply', action='store_true', help="Commit changes to database (default is dry-run)")
    parser.add_argument('--dry-run', action='store_true', help="Run in dry-run mode without writing to database")
    parser.add_argument('--json', action='store_true', help="Output results in JSON format")
    parser.add_argument('--db', default=DEFAULT_DB_PATH, help=f"Path to SQLite database (default: {DEFAULT_DB_PATH})")
    parser.add_argument('--deck-id', default=None, help="Target a specific deck/topic ID")

    args = parser.parse_args()
    apply_mode = args.apply and not args.dry_run

    sys.exit(run_classification(
        db_path=args.db,
        deck_id=args.deck_id,
        apply_changes=apply_mode,
        output_json=args.json
    ))

if __name__ == '__main__':
    main()
