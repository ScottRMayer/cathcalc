/* Formula self-tests. Runs in the browser (tests.html) and in Node (verification).
   Each case checks CM.F output against independently computed expected values. */
function CM_TESTS(F){
  var out=[];
  function t(name, actual, expected, tol){
    tol = tol==null ? 1e-9 : tol;
    var pass = (typeof expected==='number')
      ? Math.abs(actual-expected)<=tol
      : actual===expected;
    out.push({name:name, pass:pass, detail:'got '+actual+' · expected '+expected});
  }

  /* eGFR MDRD — independent recomputation */
  var e1 = 186*Math.exp(-1.154*Math.log(1.0))*Math.exp(-0.203*Math.log(60));
  t('eGFR MDRD: SCr 1.0, age 60, M, race 1', F.egfrMDRD(1.0,60,false,1), e1, 1e-6);
  t('eGFR MDRD: female factor 0.742', F.egfrMDRD(1.0,60,true,1), e1*0.742, 1e-6);
  t('eGFR MDRD: race coefficient 1.21', F.egfrMDRD(1.0,60,false,1.21), e1*1.21, 1e-6);

  /* Cockcroft-Gault — textbook example: 40 y, 72 kg, M, SCr 1.0 → 100 */
  t('CrCl CG: 40y 72kg M SCr 1.0 = 100', F.cockcroftGault(40,72,false,1.0), 100, 1e-9);
  t('CrCl CG: female ×0.85', F.cockcroftGault(40,72,true,1.0), 85, 1e-9);

  /* BMI */
  t('BMI: 80 kg, 200 cm = 20', F.bmi(80,200), 20, 1e-9);

  /* Heparin & ACT re-bolus */
  t('Heparin: 80 kg × 70 U/kg = 5600', F.heparinDose(80,70), 5600);
  t('Heparin: 80 kg × 50 U/kg = 4000', F.heparinDose(80,50), 4000);
  t('ACT re-bolus: 80 kg × 25 = 2000 (nearest 500)', F.actRebolus(80,25), 2000);
  t('ACT re-bolus: 70 kg × 25 = 1750 → 2000', F.actRebolus(70,25), 2000);
  t('ACT re-bolus: 68 kg × 25 = 1700 → 1500', F.actRebolus(68,25), 1500);

  /* Max contrast */
  var c1=F.maxContrast(80,1.0,100,3);
  t('Contrast: 2.5×80/1 = 200 (weight arm)', c1.wt, 200, 1e-9);
  t('Contrast: 3×100 = 300 (eGFR arm)', c1.gfr, 300, 1e-9);
  t('Contrast: max = min(300,200,300) = 200', c1.max, 200, 1e-9);
  t('Contrast: 300 mL absolute cap', F.maxContrast(200,1.0,200,3.7).max, 300, 1e-9);

  /* Mehran */
  t('Mehran: age 80 + 250 mL + SCr 2.0 = 4+2+4 = 10 (Moderate)',
    F.mehran({age:80,contrastML:250,scr:2.0}).score, 10);
  t('Mehran: category at 10 = Moderate', F.mehran({age:80,contrastML:250,scr:2.0}).category, 'Moderate');
  t('Mehran: dialysis renal pts = 6', F.mehran({age:0,dialysis:true}).score, 6);
  t('Mehran: eGFR 50 (SCr ≤1.5) = 2 pts', F.mehran({age:0,scr:1.2,egfr:50}).score, 2);
  t('Mehran: eGFR 19 = 6 pts', F.mehran({age:0,scr:1.2,egfr:19}).score, 6);
  t('Mehran: full house 5+5+5+4+3+3+3(contrast 300)+6 = 34 → Very high',
    F.mehran({hypotension:1,iabp:1,chf:1,age:80,anemia:1,diabetes:1,contrastML:300,dialysis:true}).category, 'Very high');
  /* category boundaries */
  t('Mehran: score 5 = Low (boundary)', F.mehran({hypotension:1}).category, 'Low');
  t('Mehran: score 6 = Moderate (boundary)', F.mehran({dialysis:true}).category, 'Moderate');
  t('Mehran: score 16 = High (boundary)',
    F.mehran({hypotension:1,iabp:1,anemia:1,diabetes:1}).category, 'High');
  t('Mehran: score 17 = Very high (boundary)',
    F.mehran({hypotension:1,iabp:1,anemia:1,diabetes:1,contrastML:100}).category, 'Very high');

  /* DyeVert determination */
  t('DyeVert: eGFR 40 → Tier A mandatory', F.dyevert({egfr:40}).tier, 'A');
  t('DyeVert: eGFR 50 + diabetes → Tier A', F.dyevert({egfr:50,diabetes:true}).tier, 'A');
  t('DyeVert: eGFR 50, no diabetes → Tier B', F.dyevert({egfr:50,diabetes:false}).tier, 'B');
  t('DyeVert: Mehran 11 → Tier A', F.dyevert({egfr:70,mehran:11}).tier, 'A');
  t('DyeVert: Mehran 8 → Tier B', F.dyevert({egfr:70,mehran:8}).tier, 'B');
  t('DyeVert: ratio 3.5 → Tier A', F.dyevert({egfr:70,ratio:3.5}).tier, 'A');
  t('DyeVert: ratio 2.5 → Tier B', F.dyevert({egfr:70,ratio:2.5}).tier, 'B');
  t('DyeVert: high-acuity (STEMI/shock) → Tier A', F.dyevert({egfr:80,highAcuity:true}).tier, 'A');
  t('DyeVert: prior CI-AKI → Tier A', F.dyevert({egfr:80,priorCIAKI:true}).tier, 'A');
  t('DyeVert: single kidney → Tier A', F.dyevert({egfr:80,singleKidney:true}).tier, 'A');
  t('DyeVert: complex anatomy alone → Tier B', F.dyevert({egfr:80,complexAnatomy:true}).tier, 'B');
  t('DyeVert: age 78 + diabetes → Tier B', F.dyevert({egfr:80,age:78,diabetes:true}).tier, 'B');
  t('DyeVert: anemia + diabetes → Tier B', F.dyevert({egfr:80,anemia:true,diabetes:true}).tier, 'B');
  t('DyeVert: anemia alone (no other factor) → Tier C', F.dyevert({egfr:80,anemia:true}).tier, 'C');
  t('DyeVert: low-risk eGFR 70 non-diabetic → Tier C', F.dyevert({egfr:70,diabetes:false,mehran:3}).tier, 'C');
  t('DyeVert: Tier A recommendation text', F.dyevert({egfr:40}).recommendation, 'Deploy DyeVert');
  t('DyeVert: eGFR 44.9 → Tier A (boundary)', F.dyevert({egfr:44.9}).tier, 'A');
  t('DyeVert: eGFR 45 non-diabetic → Tier B (boundary)', F.dyevert({egfr:45,diabetes:false}).tier, 'B');
  t('DyeVert: A wins over B (eGFR 40 + complex)', F.dyevert({egfr:40,complexAnatomy:true}).tier, 'A');

  /* ACC CathPCI bleed — independent recomputation for one vignette:
     68y F, Hgb 11, BMI 27, eGFR 50, STEMI, no shock, no prior PCI */
  var x=-0.0884 + 0.0155*68 + 0.9327 + (-0.3474*11) + 0.4403 + (-0.04266*27) + 0.3346;
  var exp1=100*Math.exp(x)/(1+Math.exp(x));
  t('Bleed: 68y F STEMI Hgb 11 BMI 27 eGFR 50',
    F.cathPCIBleed({age:68,female:true,hgb:11,bmi:27,egfr:50,stemi:true,shock:false,dialysis:false,priorPCI:false}),
    exp1, 1e-6);
  t('Bleed: shock increases risk',
    F.cathPCIBleed({age:68,female:true,hgb:11,bmi:27,egfr:50,stemi:true,shock:true,dialysis:false,priorPCI:false})>exp1,
    true);
  t('Bleed: prior PCI decreases risk',
    F.cathPCIBleed({age:68,female:true,hgb:11,bmi:27,egfr:50,stemi:true,shock:false,dialysis:false,priorPCI:true})<exp1,
    true);

  /* TIMI UA/NSTEMI */
  t('TIMI UA: all 7 = score 7', F.timiUA({age65:1,riskFactors3:1,knownCAD:1,asa7d:1,severeAngina:1,stDeviation:1,markers:1}).score, 7);
  t('TIMI UA: score 7 risk 40.9%', F.timiUA({age65:1,riskFactors3:1,knownCAD:1,asa7d:1,severeAngina:1,stDeviation:1,markers:1}).risk, '40.9%');
  t('TIMI UA: score 0 risk 4.7%', F.timiUA({}).risk, '4.7%');
  t('TIMI UA: score 2 risk 8.3%', F.timiUA({age65:1,markers:1}).risk, '8.3%');
  t('TIMI UA: score 4 = Intermediate', F.timiUA({age65:1,markers:1,stDeviation:1,asa7d:1}).category, 'Intermediate');

  /* TIMI STEMI */
  t('TIMI STEMI: maximal = 14', F.timiSTEMI({age:76,dmHtnAngina:1,sbpLt100:1,hrGt100:1,killip24:1,wtLt67:1,anteriorOrLBBB:1,timeGt4h:1}).score, 14);
  t('TIMI STEMI: ≥9 risk 35.9%', F.timiSTEMI({age:76,dmHtnAngina:1,sbpLt100:1,hrGt100:1,killip24:1,wtLt67:1,anteriorOrLBBB:1,timeGt4h:1}).risk, '35.9%');
  t('TIMI STEMI: age 65–74 = 2 pts', F.timiSTEMI({age:70}).score, 2);
  t('TIMI STEMI: age ≥75 = 3 pts', F.timiSTEMI({age:75}).score, 3);
  t('TIMI STEMI: score 0 risk 0.8%', F.timiSTEMI({age:50}).risk, '0.8%');
  t('TIMI STEMI: score 5 risk 12.4%', F.timiSTEMI({age:70,sbpLt100:1}).risk, '12.4%');

  /* Zwolle */
  t('Zwolle: maximal = 16', F.zwolle({killip:3,timiFlow:1,age:60,threeVessel:1,anteriorMI:1,ischemiaGt4h:1}).score, 16);
  t('Zwolle: Killip II = 4 pts', F.zwolle({killip:2,timiFlow:3,age:0}).score, 4);
  t('Zwolle: TIMI flow 2 = 1 pt', F.zwolle({killip:1,timiFlow:2,age:0}).score, 1);
  t('Zwolle: score 0 = low risk', F.zwolle({killip:1,timiFlow:3,age:0}).low, true);
  t('Zwolle: score 3 = low risk', F.zwolle({killip:1,timiFlow:3,age:60,anteriorMI:1}).low, true);
  t('Zwolle: score 4 = not low', F.zwolle({killip:2,timiFlow:3,age:0}).low, false);

  /* Drug dosing */
  var b=F.bivalirudin(80,90,false);
  t('Bivalirudin: bolus 0.75×80 = 60 mg', b.bolus_mg, 60, 1e-9);
  t('Bivalirudin: infusion 1.75×80 = 140 mg/h', b.inf, 140, 1e-9);
  t('Bivalirudin: CrCl<30 rate 1.0', F.bivalirudin(80,25,false).rate, 1.0);
  t('Bivalirudin: dialysis rate 0.25', F.bivalirudin(80,25,true).rate, 0.25);
  var ep=F.eptifibatide(80,90,false);
  t('Eptifibatide: bolus 180×80 = 14400 mcg', ep.bolus_mcg, 14400, 1e-9);
  t('Eptifibatide: rate 2 mcg/kg/min normal renal', ep.rate, 2);
  t('Eptifibatide: rate 1 when CrCl<50', F.eptifibatide(80,40,false).rate, 1);
  t('Eptifibatide: weight capped at 121 kg', F.eptifibatide(150,90,false).bolus_mcg, 180*121, 1e-9);
  t('Eptifibatide: infusion uses capped weight (150 kg → 2×121 = 242 mcg/min)', F.eptifibatide(150,90,false).inf, 242, 1e-9);
  t('Eptifibatide: infusion capped + CrCl<50 → 1×121 = 121 mcg/min', F.eptifibatide(150,40,false).inf, 121, 1e-9);
  t('Eptifibatide: contraindicated on dialysis', !!F.eptifibatide(80,10,true).ci, true);
  var ti=F.tirofiban(80,90,false);
  t('Tirofiban: bolus 25×80 = 2000 mcg', ti.bolus_mcg, 2000, 1e-9);
  t('Tirofiban: rate 0.15 normal renal', ti.rate, 0.15);
  t('Tirofiban: rate halved CrCl≤60', F.tirofiban(80,60,false).rate, 0.075);
  var cg=F.cangrelor(80);
  t('Cangrelor: bolus 30×80 = 2400 mcg', cg.bolus_mcg, 2400, 1e-9);
  t('Cangrelor: infusion 4×80 = 320 mcg/min', cg.inf, 320, 1e-9);

  /* ---- Hemodynamics ---- */
  t('BSA Mosteller: 80 kg 180 cm = 2.0 m²', F.bsaMosteller(80,180), 2.0, 1e-9);
  t('BSA DuBois: 70 kg 170 cm ≈ 1.810', F.bsaDuBois(70,170), 0.007184*Math.pow(70,0.425)*Math.pow(170,0.725), 1e-9);
  t('MAP: 120/60 = 80', F.meanPressure(120,60), 80, 1e-9);
  var fick=F.fickCO(250,15,0.98,0.73); /* 250/(1.36×15×10×0.25)=250/51 */
  t('Fick CO: VO2 250, Hgb 15, 98/73% = 4.90 L/min', fick, 250/51, 1e-9);
  var sv=F.vascRes(93,3,5);
  t('SVR: (93−3)/5 = 18 WU', sv.wood, 18, 1e-9);
  t('SVR: 18 WU = 1440 dynes', sv.dynes, 1440, 1e-9);
  var pv=F.vascRes(25,10,5);
  t('PVR: (25−10)/5 = 3 WU = 240 dynes', pv.dynes, 240, 1e-9);
  var gor=F.gorlin(5,70,0.33,40,false); /* 5000/(70×0.33)/(44.3×√40) */
  t('Gorlin aortic: CO 5, HR 70, SEP 0.33, ΔP 40', gor, (5000/(70*0.33))/(44.3*Math.sqrt(40)), 1e-9);
  t('Gorlin mitral constant 37.7 (=44.3×0.85)', F.gorlin(5,70,0.33,40,true), gor/0.85, 1e-9);
  t('Hakki: CO 5 / √40 ≈ 0.79', F.hakki(5,40), 5/Math.sqrt(40), 1e-9);
  t('Qp:Qs: (95−65)/(98−85) ≈ 2.31', F.qpqs(95,65,98,85), 30/13, 1e-9);
  t('Qp:Qs = 1 with no step-up', F.qpqs(95,70,95,70), 1, 1e-9);
  t('Flamm MV: SVC 70, IVC 74 = 71', F.flammMV(70,74), 71, 1e-9);

  /* ---- Drips ---- */
  t('Drip: norepi 8 mcg/min @16 mcg/mL = 30 mL/h', F.dripMlPerHr(8,'mcg/min',null,16), 30, 1e-9);
  t('Drip: dobutamine 5 mcg/kg/min, 80 kg @1000 = 24 mL/h', F.dripMlPerHr(5,'mcg/kg/min',80,1000), 24, 1e-9);
  t('Drip: nicardipine 5 mg/h @100 mcg/mL = 50 mL/h', F.dripMlPerHr(5,'mg/h',null,100), 50, 1e-9);
  t('Drip: vasopressin 0.03 U/min @0.2 U/mL = 9 mL/h', F.dripMlPerHr(0.03,'U/min',null,0.2), 9, 1e-9);
  t('Drip reverse: 30 mL/h @16 = 8 mcg/min', F.dripDoseFromRate(30,'mcg/min',null,16), 8, 1e-9);
  t('Drip reverse: 24 mL/h, 80 kg @1000 = 5 mcg/kg/min', F.dripDoseFromRate(24,'mcg/kg/min',80,1000), 5, 1e-9);
  t('Drip reverse: 50 mL/h @100 = 5 mg/h', F.dripDoseFromRate(50,'mg/h',null,100), 5, 1e-9);
  t('Drip round-trip: U/min', F.dripDoseFromRate(F.dripMlPerHr(0.04,'U/min',null,0.2),'U/min',null,0.2), 0.04, 1e-12);
  /* mg/kg/h and U/kg/h (PCI anticoagulant pumps) */
  t('Drip: bivalirudin 1.75 mg/kg/h, 80 kg @5000 mcg/mL (5 mg/mL) = 28 mL/h', F.dripMlPerHr(1.75,'mg/kg/h',80,5000), 28, 1e-9);
  t('Drip: bivalirudin renal 1.0 mg/kg/h, 80 kg @5000 = 16 mL/h', F.dripMlPerHr(1.0,'mg/kg/h',80,5000), 16, 1e-9);
  t('Drip: heparin 15 U/kg/h, 80 kg @100 U/mL = 12 mL/h', F.dripMlPerHr(15,'U/kg/h',80,100), 12, 1e-9);
  t('Drip: heparin 18 U/kg/h, 62 kg @100 U/mL = 11.16 mL/h', F.dripMlPerHr(18,'U/kg/h',62,100), 11.16, 1e-9);
  t('Drip reverse: 28 mL/h, 80 kg @5000 = 1.75 mg/kg/h', F.dripDoseFromRate(28,'mg/kg/h',80,5000), 1.75, 1e-9);
  t('Drip reverse: 12 mL/h, 80 kg @100 U/mL = 15 U/kg/h', F.dripDoseFromRate(12,'U/kg/h',80,100), 15, 1e-9);
  t('Drip round-trip: mg/kg/h', F.dripDoseFromRate(F.dripMlPerHr(1.75,'mg/kg/h',75,5000),'mg/kg/h',75,5000), 1.75, 1e-12);
  t('Drip round-trip: U/kg/h', F.dripDoseFromRate(F.dripMlPerHr(12,'U/kg/h',95,100),'U/kg/h',95,100), 12, 1e-12);

  return out;
}
if (typeof module!=='undefined' && module.exports) module.exports = CM_TESTS;
