#!/usr/bin/env python3
"""
scripts/classify_database_tos.py
High-accuracy Table of Specifications (TOS) classifier for ECEngine database.
Classifies all cards in SQLite into the 35 official PRC ECE Table of Specifications topics.
"""

import sys
import os
import re
import json
import sqlite3
from collections import Counter

DB_PATH = os.path.expanduser('~/.config/ECEngine/ecengine.sqlite')

# Complete keyword & regex patterns for each of the 35 PRC TOS topics
RULES = {
    'MATH': {
        'MATH-1.0': [
            r'\bderivative\b', r'\bdiff\b', r'\bdifferenti\w+', r'\bdy/dx\b', r'\blimit\b', r'\blimits\b',
            r'\bcontinuity\b', r'\bcontinuous\b', r'\btangent\b', r'\bnormal line\b', r'\bmaxima\b', r'\bminima\b',
            r'\binflection\b', r'\bconcav\w+', r'\bradius of curvature\b', r'\bparametric\b', r'\bpartial diff\w+',
            r'\bl\'hopital\b', r'\blhopital\b', r'\brelated rate\w*', r'\boptimization\b', r'\bchain rule\b',
            r'\bquotient rule\b', r'\bproduct rule\b', r'\basymptote\b', r'\bmean value theorem\b', r'\brolle\'s\b',
            r'\bcritical point\w*', r'\bslope of\b', r'\brate of change\b'
        ],
        'MATH-2.0': [
            r'\bintegral\b', r'\bintegrat\w+', r'\bantiderivative\b', r'\barea under\b', r'\barea bounded\b',
            r'\bvolume of revolution\b', r'\bcentroid\b', r'\bcenter of mass\b', r'\bwasher\b', r'\bshell method\b',
            r'\bdisk method\b', r'\bimproper integral\b', r'\bdouble integral\b', r'\btriple integral\b',
            r'\bmultiple integral\b', r'\bby parts\b', r'\bpartial fraction\b', r'\btrigonometric sub\w+',
            r'\blength of arc\b', r'\barc length\b', r'\bsurface of revolution\b', r'\bmoment of inertia\b',
            r'\bpappus\b', r'\bdefinite integral\b'
        ],
        'MATH-3.0': [
            r'\bdifferential equation\b', r'\bode\b', r'\border and degree\b', r'\bseparable\b',
            r'\bhomogeneous diff\w*', r'\bexact differential\b', r'\bintegrating factor\b',
            r'\bbernoulli\b', r'\bauxiliary equation\b', r'\bcomplementary\b', r'\bparticular integral\b',
            r'\bhigher order\b', r'\blaplace transform\b', r'\binverse laplace\b', r'\bs-domain\b',
            r'\bwronskian\b', r'\binitial value problem\b', r'\bdirac delta\b', r'\bheaviside\b',
            r'\bcharacteristic equation\b', r'\bmethod of undetermined\b', r'\bvariation of parameters\b'
        ],
        'MATH-4.0': [
            r'\bcomplex number\b', r'\bimaginary\b', r'\breal part\b', r'\bargand\b', r'\bde moivre\b',
            r'\beuler\'?s formula\b', r'\bcauchy-riemann\b', r'\banalytic function\b', r'\bpower series\b',
            r'\btaylor series\b', r'\bmaclaurin\b', r'\bbessel\b', r'\blegendre\b', r'\bfourier series\b',
            r'\bfourier transform\b', r'\bpde\b', r'\bpartial differential\b', r'\bheat equation\b',
            r'\bwave equation\b', r'\bmatrix\b', r'\bmatrices\b', r'\bdeterminant\b', r'\beigenvalue\b',
            r'\beigenvector\b', r'\bcramer\'?s\b', r'\bnewton-raphson\b', r'\brunge-kutta\b',
            r'\bsimpson\'?s rule\b', r'\btrapezoidal rule\b', r'\bnumerical method\b', r'\blinear algebra\b',
            r'\binverse matrix\b', r'\brank of\b', r'\bgauss-jordan\b', r'\bgauss elimination\b'
        ],
        'MATH-5.0': [
            r'\bprobability\b', r'\bpermutation\b', r'\bcombination\b', r'\bstandard deviation\b',
            r'\bvariance\b', r'\bmean\b', r'\bmedian\b', r'\bmode\b', r'\bexpected value\b',
            r'\bnormal distribution\b', r'\bbinomial\b', r'\bpoisson\b', r'\bgeometric dist\w*',
            r'\bhypergeometric\b', r'\bsampling\b', r'\bconfidence interval\b', r'\bhypothesis\b',
            r'\bnull hypothesis\b', r'\bz-score\b', r'\bt-test\b', r'\bchi-square\b', r'\bregression\b',
            r'\bcorrelation\b', r'\br-squared\b', r'\banova\b', r'\bscatter plot\b', r'\brandom variable\b',
            r'\bconditional probability\b', r'\bbayes\b', r'\bmutually exclusive\b', r'\bindependent event\b',
            r'\bquartile\b', r'\bpercentile\b', r'\bfrequency distribution\b'
        ],
        'MATH-6.0': [
            r'\bvector analysis\b', r'\bdot product\b', r'\bcross product\b', r'\bgradient\b',
            r'\bdivergence\b', r'\bcurl\b', r'\bdel operator\b', r'\bdirectional derivative\b',
            r'\bline integral\b', r'\bsurface integral\b', r'\bgreen\'?s theorem\b',
            r'\bdivergence theorem\b', r'\bstokes\'? theorem\b', r'\bgauss\'?s law\b', r'\belectrostatic\b',
            r'\belectric field\b', r'\bcoulomb\b', r'\bmagnetic flux\b', r'\bpoynting\b',
            r'\bmaxwell\'?s equation\b', r'\bpermittivity\b', r'\bpermeability\b', r'\belectric potential\b',
            r'\blorentz force\b', r'\bampere\'?s law\b', r'\bfaraday\'?s law\b', r'\bscalar potential\b'
        ],
        'MATH-7.0': [
            r'\bz-transform\b', r'\binverse z-transform\b', r'\bregion of convergence\b', r'\broc\b',
            r'\bconvolution\b', r'\bcontinuous convolution\b', r'\bdiscrete convolution\b',
            r'\bcross-correlation\b', r'\bauto-correlation\b', r'\bimpulse response\b',
            r'\bdiscrete-time\b', r'\bsampling theorem\b', r'\bnyquist rate\b', r'\bdft\b', r'\bfft\b',
            r'\bdiscrete fourier\b', r'\bfilter design\b', r'\biir\b', r'\bfir\b', r'\bsignal processing\b',
            r'\bdtft\b', r'\blinear time-invariant\b', r'\blti\b', r'\bspectral analysis\b'
        ],
        'MATH-8.0': [
            r'\bcontrol system\b', r'\btransfer function\b', r'\bopen loop\b', r'\bclosed loop\b',
            r'\bfeedback\b', r'\bblock diagram\b', r'\bsignal flow\b', r'\bmason\'?s gain\b',
            r'\bpole\b', r'\bzero\b', r'\broot locus\b', r'\brouth-hurwitz\b', r'\brouth array\b',
            r'\bbode plot\b', r'\bnyquist plot\b', r'\bphase margin\b', r'\bgain margin\b',
            r'\bdamping ratio\b', r'\bnatural frequency\b', r'\bovershoot\b', r'\bsettling time\b',
            r'\bsteady state error\b', r'\btype-0\b', r'\btype-1\b', r'\btype-2\b', r'\bpid\b',
            r'\bproportional-integral\b', r'\bstate space\b', r'\blead-lag\b'
        ]
    },
    'GEAS': {
        'GEAS-1.0': [
            r'\bchemistry\b', r'\batom\b', r'\batomic\b', r'\bmolecule\b', r'\bmolecular\b',
            r'\belement\b', r'\bperiodic table\b', r'\bmole\b', r'\bmolar\b', r'\bstoichiometry\b',
            r'\bchemical equation\b', r'\breaction\b', r'\bvalence\b', r'\bionic\b', r'\bcovalent\b',
            r'\bchemical bond\b', r'\boxidation\b', r'\breduction\b', r'\bredox\b', r'\bacid\b',
            r'\bbase\b', r'\bph\b', r'\bbuffer\b', r'\bequilibrium\b', r'\bsolution\b',
            r'\bsolvent\b', r'\bsolute\b', r'\belectrochemistry\b', r'\bcorrosion\b', r'\bgalvaniz\w+',
            r'\banode\b', r'\bcathode\b', r'\belectrolyte\b', r'\bgas law\b', r'\bavogadro\b'
        ],
        'GEAS-2.0': [
            r'\bphysics\b', r'\bkinematics\b', r'\bvelocity\b', r'\bacceleration\b', r'\bprojectile\b',
            r'\bnewton\'?s law\b', r'\bforce\b', r'\bfriction\b', r'\bwork\b', r'\benergy\b',
            r'\bkinetic energy\b', r'\bpotential energy\b', r'\bmomentum\b', r'\bimpulse\b',
            r'\bconservation of momentum\b', r'\bcollision\b', r'\brotational\b', r'\btorque\b',
            r'\bangular momentum\b', r'\bgravitation\b', r'\bkepler\b', r'\bwave\b', r'\boptics\b',
            r'\bsnell\'?s law\b', r'\bindex of refraction\b', r'\blens\b', r'\bmirror\b',
            r'\breflection\b', r'\brefraction\b', r'\binterference\b', r'\bdiffraction\b',
            r'\bsound wave\b', r'\bdoppler\b', r'\bharmonic motion\b', r'\bpendulum\b'
        ],
        'GEAS-3.0': [
            r'\bstatics\b', r'\bresultant\b', r'\bequilibrium of forces\b', r'\bconcurrent\b',
            r'\bnon-concurrent\b', r'\bmoment of force\b', r'\bcouple\b', r'\bfree body diagram\b',
            r'\btruss\b', r'\bmethod of joints\b', r'\bmethod of sections\b', r'\bcable\b',
            r'\bbelt friction\b', r'\bcenter of gravity\b', r'\bdynamics\b', r'\brectilinear\b',
            r'\bcurvilinear\b', r'\bkinetics\b', r'\bd\'alembert\b', r'\bcentripetal\b',
            r'\bcentrifugal\b', r'\bcoefficient of restitution\b'
        ],
        'GEAS-4.0': [
            r'\bstress\b', r'\bstrain\b', r'\bnormal stress\b', r'\bshear stress\b', r'\btensile\b',
            r'\bcompressive\b', r'\bdeformation\b', r'\belongation\b', r'\bmodulus of elasticity\b',
            r'\byoung\'?s modulus\b', r'\bhooke\'?s law\b', r'\bpoisson\'?s ratio\b', r'\bthermal stress\b',
            r'\bpressure vessel\b', r'\btorsion\b', r'\bangle of twist\b', r'\btorsional\b',
            r'\bshear and moment\b', r'\bbeam\b', r'\bbending stress\b', r'\bflexural\b',
            r'\bdeflection\b', r'\bcolumn\b', r'\bslenderness ratio\b', r'\byield strength\b',
            r'\bultimate strength\b', r'\bfactor of safety\b', r'\bmoment of inertia of area\b'
        ],
        'GEAS-5.0': [
            r'\bthermodynamics\b', r'\btemperature\b', r'\bheat\b', r'\binternal energy\b',
            r'\benthalpy\b', r'\bentropy\b', r'\bfirst law of thermo\w*', r'\bsecond law of thermo\w*',
            r'\bzeroth law\b', r'\bideal gas\b', r'\bpv=nrt\b', r'\bboyle\b', r'\bcharles\b',
            r'\bisobaric\b', r'\bisochoric\b', r'\bisothermal\b', r'\badiabatic\b', r'\bpolytropic\b',
            r'\bcarnot\b', r'\bheat engine\b', r'\brefrigerator\b', r'\bheat pump\b', r'\botto cycle\b',
            r'\bdiesel cycle\b', r'\brankine\b', r'\bsteam\b', r'\bpsychrometric\b', r'\bspecific heat\b',
            r'\blatent heat\b', r'\bconduction\b', r'\bconvection\b', r'\bradiation heat\b'
        ],
        'GEAS-6.0': [
            r'\bmaterial science\b', r'\bcrystal structure\b', r'\bbcc\b', r'\bfcc\b', r'\bhcp\b',
            r'\bunit cell\b', r'\blattice\b', r'\bmiller indices\b', r'\batomic packing factor\b',
            r'\bapf\b', r'\bimperfection\b', r'\bdislocation\b', r'\bgrain boundary\b',
            r'\bphase diagram\b', r'\biron-carbon\b', r'\bsteel\b', r'\balloy\b', r'\bpolymer\b',
            r'\bceramic\b', r'\bcomposite\b', r'\bsemiconductor material\b', r'\bhardness\b',
            r'\btoughness\b', r'\btensile test\b', r'\bbrittle\b', r'\bductile\b', r'\bfatigue\b',
            r'\bcreep\b', r'\bheat treatment\b', r'\bquenching\b', r'\bannealing\b'
        ],
        'GEAS-7.0': [
            r'\binterest\b', r'\bsimple interest\b', r'\bcompound interest\b', r'\bnominal rate\b',
            r'\beffective rate\b', r'\bcash flow\b', r'\bannuity\b', r'\bordinary annuity\b',
            r'\bannuity due\b', r'\bdeferred annuity\b', r'\bperpetuity\b', r'\bcapitalized cost\b',
            r'\bpresent worth\b', r'\bfuture worth\b', r'\bannual worth\b', r'\brate of return\b',
            r'\birr\b', r'\bbenefit-cost\b', r'\bdepreciation\b', r'\bstraight line dep\w*',
            r'\bdeclining balance\b', r'\bsum-of-the-years\b', r'\bbreak-even\b', r'\breplacement\b',
            r'\bsunk cost\b', r'\bmarginal cost\b', r'\bsalvage value\b', r'\bbook value\b',
            r'\btax\b', r'\binflation\b'
        ],
        'GEAS-8.0': [
            r'\benvironment\b', r'\benvironmental\b', r'\bpollution\b', r'\bair pollution\b',
            r'\bwater pollution\b', r'\bwastewater\b', r'\bwater treatment\b', r'\bbod\b', r'\bcod\b',
            r'\bsolid waste\b', r'\bgreenhouse\b', r'\bglobal warming\b', r'\bozone depletion\b',
            r'\becological\b', r'\becosystem\b', r'\bacid rain\b', r'\bclean air act\b',
            r'\bclean water act\b', r'\bra 9003\b', r'\bhazardous waste\b', r'\beia\b',
            r'\benvironmental impact\b'
        ],
        'GEAS-9.0': [
            r'\bmanagement\b', r'\bplanning\b', r'\borganizing\b', r'\bleading\b', r'\bcontrolling\b',
            r'\bdecision making\b', r'\borganization structure\b', r'\bmotivation\b', r'\bleadership\b',
            r'\bproject management\b', r'\bcpm\b', r'\bpert\b', r'\bcritical path\b', r'\bfloat\b',
            r'\bgantt\b', r'\binventory\b', r'\beoq\b', r'\bquality control\b', r'\btqm\b',
            r'\bsix sigma\b', r'\biso 900\w*\b', r'\bmaslow\b', r'\bmcgregor\b', r'\bherzberg\b'
        ],
        'GEAS-10.0': [
            r'\bdisaster\b', r'\brisk reduction\b', r'\bhazard\b', r'\bvulnerability\b',
            r'\bdisaster risk\b', r'\bmitigation\b', r'\bpreparedness\b', r'\brecovery\b',
            r'\bearthquake\b', r'\btyphoon\b', r'\bflood\b', r'\blandslide\b', r'\btsunami\b',
            r'\bndrrmc\b', r'\bra 10121\b', r'\bclimate change adaptation\b', r'\bemergency\b',
            r'\brisk assessment\b'
        ],
        'GEAS-11.0': [
            r'\bcode of ethics\b', r'\bethics\b', r'\bmoral\b', r'\bethical\b', r'\bliability\b',
            r'\bcontract\b', r'\bobligation\b', r'\bbreach of contract\b', r'\bprc\b',
            r'\bcivil code\b', r'\bintellectual property\b', r'\bpatent\b', r'\bcopyright\b',
            r'\btrademark\b', r'\btort\b', r'\bprofessional regulation\b', r'\boath\b',
            r'\bboard of electronics\b'
        ]
    },
    'ELECS': {
        'ELECS-1.0': [
            r'\bdc circuit\b', r'\bohm\'?s law\b', r'\bkirchhoff\b', r'\bkcl\b', r'\bkvl\b',
            r'\bresistor\b', r'\bresistance\b', r'\bseries circuit\b', r'\bparallel circuit\b',
            r'\bvoltage divider\b', r'\bcurrent divider\b', r'\bthevenin\b', r'\bnorton\b',
            r'\bsuperposition theorem\b', r'\bmaximum power transfer\b', r'\bmesh analysis\b',
            r'\bnodal analysis\b', r'\bsource transformation\b', r'\bwheatstone\b', r'\bdelta-wye\b',
            r'\bstar-delta\b', r'\bconductance\b', r'\bconductiv\w+', r'\bmho\b', r'\bsiemens\b',
            r'\bcolor code\b', r'\brc transient\b', r'\brl transient\b', r'\btime constant\b'
        ],
        'ELECS-2.0': [
            r'\bac circuit\b', r'\balternating current\b', r'\bsinusoid\w*', r'\bsine wave\b',
            r'\brms\b', r'\beffective value\b', r'\bpeak value\b', r'\baverage value\b',
            r'\bform factor\b', r'\bphasor\b', r'\bcomplex impedance\b', r'\breactance\b',
            r'\binductive reactance\b', r'\bcapacitive reactance\b', r'\badmittance\b',
            r'\bsusceptance\b', r'\brlc\b', r'\bresonance\b', r'\bresonant frequency\b',
            r'\bquality factor\b', r'\bq-factor\b', r'\bbandwidth\b', r'\breal power\b',
            r'\breactive power\b', r'\bapparent power\b', r'\bpower factor\b', r'\bthree-phase\b',
            r'\bbalanced 3-phase\b', r'\bdelta connection\b', r'\bwye connection\b', r'\bvar\b',
            r'\bvolt-ampere\b'
        ],
        'ELECS-3.0': [
            r'\bsemiconductor\b', r'\bintrinsic\b', r'\bextrinsic\b', r'\bp-type\b', r'\bn-type\b',
            r'\bdiode\b', r'\bpn junction\b', r'\bforward bias\b', r'\breverse bias\b',
            r'\bdepletion region\b', r'\bbarrier potential\b', r'\bzener\b', r'\bled\b',
            r'\bphotodiode\b', r'\bschottky\b', r'\bvaractor\b', r'\brectifier\b',
            r'\bhalf-wave\b', r'\bfull-wave\b', r'\bclipper\b', r'\bclamper\b', r'\bbjt\b',
            r'\btransistor\b', r'\bemitter\b', r'\bcollector\b', r'\bbase current\b',
            r'\bnpn\b', r'\bpnp\b', r'\bcommon emitter\b', r'\bcommon base\b', r'\bcommon collector\b',
            r'\bbiasing\b', r'\bload line\b', r'\bq-point\b', r'\bfet\b', r'\bjfet\b',
            r'\bmosfet\b', r'\bpinch-off\b', r'\btransconductance\b', r'\bgate voltage\b',
            r'\bdrain current\b', r'\bchannel\b'
        ],
        'ELECS-4.0': [
            r'\bpower plant\b', r'\bpower generation\b', r'\bhydroelectric\b', r'\bthermal plant\b',
            r'\bnuclear\b', r'\bsolar power\b', r'\bwind power\b', r'\bgenerator\b', r'\balternator\b',
            r'\btransformer\b', r'\bturns ratio\b', r'\bstep-up\b', r'\bstep-down\b',
            r'\bpower transmission\b', r'\bsubstation\b', r'\binsulator\b', r'\bcorona effect\b',
            r'\bsag\b', r'\bswitchgear\b', r'\bcircuit breaker\b', r'\brelay\b', r'\bprotective relay\b',
            r'\bfault\b', r'\bsymmetrical fault\b', r'\bbusbar\b', r'\btransmission tower\b'
        ],
        'ELECS-5.0': [
            r'\bop-amp\b', r'\boperational amplifier\b', r'\binverting amp\w*', r'\bnon-inverting amp\w*',
            r'\bsumming amp\w*', r'\bintegrator\b', r'\bdifferentiator\b', r'\bcomparator\b',
            r'\binstrumentation amp\w*', r'\bactive filter\b', r'\blow-pass filter\b',
            r'\bhigh-pass filter\b', r'\bband-pass filter\b', r'\boscillator\b', r'\bbarkhausen\b',
            r'\bwien bridge\b', r'\brc phase shift\b', r'\bcolpitts\b', r'\bhartley\b',
            r'\bcrystal oscillator\b', r'\b555 timer\b', r'\bmultivibrator\b', r'\bmonostable\b',
            r'\bastable\b', r'\bpower amplifier\b', r'\bclass a\b', r'\bclass b\b', r'\bclass ab\b',
            r'\bclass c\b', r'\bpush-pull\b', r'\bfeedback amplifier\b', r'\bvoltage regulator\b',
            r'\b7805\b', r'\bswitching regulator\b', r'\bbuck\b', r'\bboost\b', r'\bcommon mode\b',
            r'\bcmrr\b', r'\bslew rate\b', r'\bvirtual ground\b'
        ],
        'ELECS-6.0': [
            r'\blti system\b', r'\bcontinuous-time\b', r'\bfrequency response\b', r'\btransfer function\b',
            r'\bintermediate frequency\b', r'\bif amplifier\b', r'\bsuperheterodyne\b', r'\bmixer\b',
            r'\bdetector\b', r'\bdemodulator\b', r'\brf amplifier\b', r'\blocal oscillator\b',
            r'\bimage frequency\b', r'\bnoise figure\b', r'\bsignal-to-noise\b', r'\belectronic filter\b',
            r'\bpassive filter\b'
        ],
        'ELECS-7.0': [
            r'\bcomputer architecture\b', r'\bmicroprocessor\b', r'\bmicrocontroller\b', r'\bcpu\b',
            r'\balu\b', r'\bregister\b', r'\baccumulator\b', r'\bprogram counter\b',
            r'\bstack pointer\b', r'\bram\b', r'\brom\b', r'\beeprom\b', r'\bcache\b',
            r'\binstruction set\b', r'\baddressing mode\b', r'\bassembly\b', r'\bbus\b',
            r'\bdata bus\b', r'\baddress bus\b', r'\bcontrol bus\b', r'\binterrupt\b',
            r'\bdma\b', r'\blogic gate\b', r'\bboolean algebra\b', r'\bkarnaugh\b', r'\bk-map\b',
            r'\bflip-flop\b', r'\blatch\b', r'\bcounter\b', r'\bshift register\b', r'\bmux\b',
            r'\bmultiplexer\b', r'\bdemultiplexer\b', r'\bencoder\b', r'\bdecoder\b',
            r'\badc\b', r'\bdac\b', r'\bbinary\b', r'\bhexadecimal\b', r'\boctal\b',
            r'\b2\'?s complement\b', r'\band gate\b', r'\bor gate\b', r'\bxor\b', r'\bnand\b', r'\bnor\b'
        ]
    },
    'EST': {
        'EST-1.0': [
            r'\bcommunication system\b', r'\btransmitter\b', r'\breceiver\b', r'\bchannel\b',
            r'\binformation theory\b', r'\bshannon\b', r'\bhartley\b', r'\bnoise\b',
            r'\bthermal noise\b', r'\bjohnson noise\b', r'\bwhite noise\b', r'\bsnr\b',
            r'\bnoise figure\b', r'\bnoise factor\b', r'\bnoise temperature\b', r'\bmodulation\b',
            r'\bamplitude modulation\b', r'\bam\b', r'\bmodulation index\b', r'\bsideband\b',
            r'\bdsb\b', r'\bssb\b', r'\bvsb\b', r'\bfrequency modulation\b', r'\bfm\b',
            r'\bcarson\'?s rule\b', r'\bfrequency deviation\b', r'\bphase modulation\b',
            r'\bpm\b', r'\bpre-emphasis\b', r'\bde-emphasis\b', r'\bheterodyne\b',
            r'\bselectivity\b', r'\bsensitivity\b', r'\bfidelity\b'
        ],
        'EST-2.0': [
            r'\btransmission line\b', r'\bcharacteristic impedance\b', r'\bpropagation constant\b',
            r'\battenuation constant\b', r'\bphase constant\b', r'\bvelocity of propagation\b',
            r'\breflection coefficient\b', r'\bstanding wave\b', r'\bswr\b', r'\bvswr\b',
            r'\breturn loss\b', r'\bsmith chart\b', r'\bstub\b', r'\bquarter-wave\b',
            r'\bantenna\b', r'\bisotropic\b', r'\bdipole\b', r'\bhalf-wave dipole\b',
            r'\bhertzian\b', r'\byagi\b', r'\bparabolic\b', r'\bhorn antenna\b', r'\bloop antenna\b',
            r'\bradiation resistance\b', r'\bantenna gain\b', r'\bdirectivity\b', r'\beffective aperture\b',
            r'\bradiation pattern\b', r'\bpolarization\b', r'\bbeamwidth\b', r'\beirp\b',
            r'\bfront-to-back\b', r'\bbalun\b', r'\bmarconi\b'
        ],
        'EST-3.0': [
            r'\bwave propagation\b', r'\belectromagnetic wave\b', r'\bground wave\b',
            r'\bsurface wave\b', r'\bsky wave\b', r'\bspace wave\b', r'\bline of sight\b',
            r'\bionosphere\b', r'\bionospheric\b', r'\bd layer\b', r'\be layer\b', r'\bf layer\b',
            r'\bcritical frequency\b', r'\bmuf\b', r'\bmaximum usable frequency\b',
            r'\bskip distance\b', r'\bskip zone\b', r'\bvirtual height\b', r'\bfading\b',
            r'\btropospheric\b', r'\bducting\b', r'\bfree space path loss\b', r'\bfspl\b',
            r'\bfriis\b', r'\brefraction in atmosphere\b', r'\bk-factor\b', r'\bfresnel\b'
        ],
        'EST-4.0': [
            r'\bmicrowave\b', r'\bwaveguide\b', r'\brectangular waveguide\b', r'\bcircular waveguide\b',
            r'\bcutoff frequency\b', r'\bdominant mode\b', r'\bte mode\b', r'\btm mode\b',
            r'\bcavity resonator\b', r'\bklystron\b', r'\bmagnetron\b', r'\btwt\b',
            r'\btraveling wave tube\b', r'\bsatellite\b', r'\bgeostationary\b', r'\bgeo\b',
            r'\bleo\b', r'\bmeo\b', r'\borbital period\b', r'\bapogee\b', r'\bperigee\b',
            r'\binclination\b', r'\bfootprint\b', r'\blook angle\b', r'\bazimuth\b',
            r'\belevation\b', r'\buplink\b', r'\bdownlink\b', r'\btransponder\b',
            r'\bg/t\b', r'\blink budget\b', r'\bkepler\'?s law of planetary\b'
        ],
        'EST-5.0': [
            r'\bdigital communication\b', r'\bpcm\b', r'\bpulse code modulation\b',
            r'\bquantization\b', r'\bcompanding\b', r'\ba-law\b', r'\bmu-law\b',
            r'\bquantization noise\b', r'\bsqnr\b', r'\bdelta modulation\b', r'\bdpcm\b',
            r'\bline coding\b', r'\bnrz\b', r'\brz\b', r'\bmanchester\b', r'\bami\b',
            r'\bdigital modulation\b', r'\bask\b', r'\bfsk\b', r'\bpsk\b', r'\bbpsk\b',
            r'\bqpsk\b', r'\bqam\b', r'\b16-qam\b', r'\b64-qam\b', r'\bber\b', r'\bbit error rate\b',
            r'\beye pattern\b', r'\bmatched filter\b', r'\bequalization\b', r'\bspread spectrum\b',
            r'\bdsss\b', r'\bfhss\b', r'\bcdma\b', r'\bconstellation diagram\b'
        ],
        'EST-6.0': [
            r'\bdata communication\b', r'\bosi model\b', r'\bphysical layer\b', r'\bdata link\b',
            r'\bnetwork layer\b', r'\btransport layer\b', r'\bsession layer\b', r'\bpresentation layer\b',
            r'\bapplication layer\b', r'\btcp/ip\b', r'\bip address\b', r'\bipv4\b', r'\bipv6\b',
            r'\bsubnet\w*\b', r'\bcidr\b', r'\bmac address\b', r'\bethernet\b', r'\bcsma/cd\b',
            r'\bcsma/ca\b', r'\brouter\b', r'\bswitch\b', r'\bbridge\b', r'\bhub\b',
            r'\brouting\b', r'\brip\b', r'\bospf\b', r'\bbgp\b', r'\btcp\b', r'\budp\b',
            r'\bport number\b', r'\bflow control\b', r'\bsliding window\b', r'\berror detection\b',
            r'\bparity\b', r'\bchecksum\b', r'\bcrc\b', r'\barq\b', r'\bstop-and-wait\b',
            r'\bgo-back-n\b', r'\bselective repeat\b', r'\btopology\b', r'\blan\b', r'\bwan\b'
        ],
        'EST-7.0': [
            r'\boptical fiber\b', r'\bfiber optic\b', r'\blightwave\b', r'\bcore\b', r'\bcladding\b',
            r'\brefractive index\b', r'\btotal internal reflection\b', r'\bcritical angle\b',
            r'\bnumerical aperture\b', r'\bacceptance angle\b', r'\bstep index\b', r'\bgraded index\b',
            r'\bsingle mode\b', r'\bmultimode\b', r'\bmodal dispersion\b', r'\bchromatic dispersion\b',
            r'\battenuation in fiber\b', r'\brayleigh scattering\b', r'\blaser diode\b',
            r'\bdfb\b', r'\bpin photodiode\b', r'\bapd\b', r'\bavalanche photodiode\b',
            r'\bedfa\b', r'\bwdm\b', r'\bdwdm\b', r'\bsplice\b', r'\bconnector\b', r'\botdr\b'
        ],
        'EST-8.0': [
            r'\bcellular\b', r'\bmobile communication\b', r'\bcell\b', r'\bfrequency reuse\b',
            r'\bcluster size\b', r'\bco-channel\b', r'\bhandoff\b', r'\bhandover\b',
            r'\broaming\b', r'\bgsm\b', r'\blte\b', r'\b5g\b', r'\bmultiple access\b',
            r'\bfdma\b', r'\btdma\b', r'\bofdma\b', r'\bbroadcast\b', r'\bam radio\b',
            r'\bfm radio\b', r'\btelevision\b', r'\bntsc\b', r'\bpal\b', r'\baudio\b',
            r'\bsound\b', r'\bdecibel\b', r'\bdb spl\b', r'\bacoustics\b', r'\breverberation\b',
            r'\bsabine\b', r'\bmicrophone\b', r'\bloudspeaker\b', r'\bbase station\b', r'\bmsc\b'
        ],
        'EST-9.0': [
            r'\bra 9292\b', r'\bece law\b', r'\bra 7925\b', r'\bntc\b',
            r'\bnational telecommunications\b', r'\bkbp\b', r'\bradio control law\b',
            r'\bfranchise\b', r'\bradio station license\b', r'\bitu\b',
            r'\binternational telecommunication union\b', r'\b3gpp\b', r'\bieee 802\b',
            r'\bstandard\b', r'\btelecom laws\b', r'\btelecommunications code\b'
        ]
    }
}

COMPILED_RULES = {}
for subj, topic_dict in RULES.items():
    COMPILED_RULES[subj] = {}
    for topic_id, pattern_list in topic_dict.items():
        COMPILED_RULES[subj][topic_id] = [re.compile(p, re.IGNORECASE) for p in pattern_list]

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
    if subject_code not in COMPILED_RULES:
        return None
    
    scores = Counter()
    for topic_id, patterns in COMPILED_RULES[subject_code].items():
        for pat in patterns:
            matches = len(pat.findall(text))
            if matches > 0:
                scores[topic_id] += matches
    
    if scores:
        return scores.most_common(1)[0][0]
    
    # Fallback to topic 1.0 for that subject
    fallback_map = {
        'MATH': 'MATH-1.0',
        'GEAS': 'GEAS-2.0',
        'ELECS': 'ELECS-1.0',
        'EST': 'EST-1.0',
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

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)
        
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Fetch all cards with their deck subject and name
    cursor.execute("""
        SELECT c.id, t.subject, t.name, c.type, c.data, c.tos_topic_id
        FROM cards c
        JOIN topics t ON c.topic_id = t.id
    """)
    rows = cursor.fetchall()
    total = len(rows)
    print(f"Found {total} total cards to classify across all topics.")
    
    updates = []
    distribution = Counter()
    subject_distribution = Counter()
    
    for r in rows:
        card_id, subject_raw, deck_name, card_type, data_raw, existing_tos = r
        subject_code = normalize_subject(subject_raw)
        
        # Check specialized deck name first
        assigned_topic = None
        d_lower = deck_name.lower()
        
        # Explicit topic mappings by deck name keywords
        if subject_code == 'MATH':
            if 'calculus' in d_lower and 'diff' in d_lower:
                assigned_topic = 'MATH-1.0'
            elif 'integral' in d_lower or 'integrate' in d_lower:
                assigned_topic = 'MATH-2.0'
            elif 'differential equation' in d_lower or ' ode' in d_lower:
                assigned_topic = 'MATH-3.0'
            elif 'adv' in d_lower and 'math' in d_lower:
                assigned_topic = 'MATH-4.0'
            elif 'data' in d_lower or 'prob' in d_lower or 'stat' in d_lower:
                assigned_topic = 'MATH-5.0'
            elif 'electromagnetics' in d_lower or 'emag' in d_lower:
                assigned_topic = 'MATH-6.0'
            elif 'signals' in d_lower:
                assigned_topic = 'MATH-7.0'
            elif 'control' in d_lower or 'feedback' in d_lower:
                assigned_topic = 'MATH-8.0'
        elif subject_code == 'GEAS':
            if 'chem' in d_lower:
                assigned_topic = 'GEAS-1.0'
            elif 'physics' in d_lower:
                assigned_topic = 'GEAS-2.0'
            elif 'mechanics' in d_lower or 'statics' in d_lower or 'dynamics' in d_lower:
                assigned_topic = 'GEAS-3.0'
            elif 'strength' in d_lower or 'materials' in d_lower and 'strength' in d_lower:
                assigned_topic = 'GEAS-4.0'
            elif 'thermo' in d_lower:
                assigned_topic = 'GEAS-5.0'
            elif 'material science' in d_lower or 'engineering materials' in d_lower:
                assigned_topic = 'GEAS-6.0'
            elif 'econ' in d_lower:
                assigned_topic = 'GEAS-7.0'
            elif 'environ' in d_lower:
                assigned_topic = 'GEAS-8.0'
            elif 'management' in d_lower:
                assigned_topic = 'GEAS-9.0'
            elif 'disaster' in d_lower:
                assigned_topic = 'GEAS-10.0'
            elif 'ethics' in d_lower or 'law' in d_lower:
                assigned_topic = 'GEAS-11.0'
        elif subject_code == 'ELECS':
            if 'dc circuit' in d_lower or 'dc electrical' in d_lower:
                assigned_topic = 'ELECS-1.0'
            elif 'ac circuit' in d_lower or 'ac electrical' in d_lower:
                assigned_topic = 'ELECS-2.0'
            elif 'semiconductor' in d_lower or 'diode' in d_lower or 'transistor' in d_lower or 'bjt' in d_lower or 'fet' in d_lower or 'edc' in d_lower:
                assigned_topic = 'ELECS-3.0'
            elif 'power' in d_lower or 'generator' in d_lower or 'transformer' in d_lower:
                assigned_topic = 'ELECS-4.0'
            elif 'op-amp' in d_lower or 'amplifier' in d_lower or 'oscillator' in d_lower or 'circuit analysis' in d_lower:
                assigned_topic = 'ELECS-5.0'
            elif 'signals' in d_lower:
                assigned_topic = 'ELECS-6.0'
            elif 'micro' in d_lower or 'computer' in d_lower or 'logic' in d_lower or 'digital' in d_lower:
                assigned_topic = 'ELECS-7.0'
        elif subject_code == 'EST':
            if 'fundamentals' in d_lower or 'intro to comm' in d_lower:
                assigned_topic = 'EST-1.0'
            elif 'transmission line' in d_lower or 'antenna' in d_lower:
                assigned_topic = 'EST-2.0'
            elif 'wave prop' in d_lower or 'propagation' in d_lower:
                assigned_topic = 'EST-3.0'
            elif 'microwave' in d_lower or 'satellite' in d_lower:
                assigned_topic = 'EST-4.0'
            elif 'digi comm' in d_lower or 'digital comm' in d_lower or 'pcm' in d_lower:
                assigned_topic = 'EST-5.0'
            elif 'data comm' in d_lower or 'network' in d_lower:
                assigned_topic = 'EST-6.0'
            elif 'fiber' in d_lower or 'optical' in d_lower:
                assigned_topic = 'EST-7.0'
            elif 'cellular' in d_lower or 'wireless' in d_lower or 'mobile' in d_lower or 'acoustic' in d_lower or 'broadcast' in d_lower:
                assigned_topic = 'EST-8.0'
            elif 'law' in d_lower or 'ra 9292' in d_lower or 'ntc' in d_lower or 'telecom law' in d_lower:
                assigned_topic = 'EST-9.0'
        
        # If not uniquely determined by deck name, use deep text classification
        if not assigned_topic:
            card_text = extract_card_text(data_raw, card_type)
            assigned_topic = classify_text(card_text, subject_code)
            
        if assigned_topic:
            updates.append((assigned_topic, card_id))
            distribution[assigned_topic] += 1
            subject_distribution[subject_code] += 1
            
    print(f"\nPrepared {len(updates)} classification updates.")
    
    # Execute database update in a transaction
    cursor.executemany("UPDATE cards SET tos_topic_id = ? WHERE id = ?", updates)
    conn.commit()
    conn.close()
    
    print("\n✓ Successfully committed all updates to SQLite database!")
    print("\n--- Summary by Subject ---")
    for subj, cnt in sorted(subject_distribution.items()):
        print(f"  {subj:8s}: {cnt:5d} cards")
        
    print("\n--- Distribution across 35 TOS Topics ---")
    for tid, cnt in sorted(distribution.items()):
        print(f"  {tid:10s}: {cnt:5d} cards")

if __name__ == '__main__':
    main()
