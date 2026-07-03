/* Clara Maass Medical Center — Cath Lab Tools
   core.js: formula library + shared patient state + page shell.
   All clinical math lives in CM.F (pure functions, covered by tests.html).
   Decision-support only. Verify against local protocol / package inserts. */
(function(){
'use strict';
var CM = window.CM = {};
CM.VERSION = '2.3.2';
CM.REVIEWED = '2026-07-03'; /* formulas last reviewed */

/* ============================ FORMULAS (pure) ============================ */
var F = CM.F = {};

/* eGFR: MDRD 4-variable, legacy race coefficient — retained deliberately to
   match the ACC CathPCI bleeding model inputs. */
F.egfrMDRD = function(scrMgdl, age, female, raceCoef){
  return 186*Math.pow(scrMgdl,-1.154)*Math.pow(age,-0.203)*(female?0.742:1)*(raceCoef||1);
};
/* Cockcroft-Gault CrCl (actual body weight). */
F.cockcroftGault = function(age, kg, female, scrMgdl){
  return ((140-age)*kg*(female?0.85:1))/(72*scrMgdl);
};
F.bmi = function(kg, cm){ return kg/Math.pow(cm/100,2); };
F.heparinDose = function(kg, uPerKg){ return kg*uPerKg; };
F.actRebolus = function(kg, uPerKg){ return Math.round(kg*uPerKg/500)*500; };
/* Max contrast: halved Cigarroa (2.5×kg/SCr) vs multiplier×eGFR; 300 mL cap. */
F.maxContrast = function(kg, scrMgdl, egfr, mult){
  var w=2.5*kg/scrMgdl, g=mult*egfr;
  return {wt:w, gfr:g, max:Math.min(300,w,g)};
};
/* ACC CathPCI simplified post-PCI bleeding model (unchanged coefficients). */
F.cathPCIBleed = function(p){
  var x=-0.0884;
  x+=0.0155*Math.min(p.age,70)+0.02097*Math.max(0,p.age-70);
  x+=p.stemi?0.9327:0;
  x+=-0.3474*Math.min(p.hgb,13)+0.03236*Math.max(0,p.hgb-13);
  x+=p.female?0.4403:0; x+=p.shock?1.9807:0;
  x+=-0.04266*Math.min(p.bmi,30)+-0.00201*Math.max(0,p.bmi-30);
  if(p.egfr<29.99||p.dialysis)x+=0.6309;
  else if(p.egfr>=45&&p.egfr<=59.99)x+=0.3346;
  else if(p.egfr>=30&&p.egfr<=44.99)x+=0.5016;
  x+=p.priorPCI?-0.2131:0;
  return 100*Math.exp(x)/(1+Math.exp(x));
};
/* Mehran CI-AKI (classic 2004 model). */
F.mehran = function(o){
  var s=0;
  if(o.hypotension)s+=5; if(o.iabp)s+=5; if(o.chf)s+=5;
  if(o.age>75)s+=4; if(o.anemia)s+=3; if(o.diabetes)s+=3;
  if(o.contrastML)s+=Math.floor(Math.max(0,o.contrastML)/100);
  if(o.dialysis)s+=6;
  else if(o.scr!=null&&o.scr>1.5)s+=4;
  else if(o.egfr!=null){ if(o.egfr<20)s+=6; else if(o.egfr<40)s+=4; else if(o.egfr<60)s+=2; }
  var cat,cin,dia,cls;
  if(s<=5){cat='Low';cin='7.5%';dia='0.04%';cls='good';}
  else if(s<=10){cat='Moderate';cin='14.0%';dia='0.12%';cls='warn';}
  else if(s<=16){cat='High';cin='26.1%';dia='1.09%';cls='bad';}
  else {cat='Very high';cin='57.3%';dia='21.6%';cls='bad';}
  return {score:s,category:cat,cinRisk:cin,dialysisRisk:dia,cls:cls};
};
/* Drug dosing (weight-based, renal-adjusted per label). */
F.bivalirudin = function(kg,crcl,dial){ var r=1.75; if(dial)r=0.25; else if(crcl<30)r=1.0;
  return {bolus_mg:0.75*kg, rate:r, inf:r*kg}; };
F.eptifibatide = function(kg,crcl,dial){ if(dial)return {ci:true};
  var dw=Math.min(kg,121), rate=crcl<50?1:2;
  return {bolus_mcg:180*dw, rate:rate, inf:rate*dw, reduced:crcl<50, capped:kg>121}; };
F.tirofiban = function(kg,crcl,dial){ var rate=crcl<=60?0.075:0.15;
  return {bolus_mcg:25*kg, rate:rate, inf:rate*kg, reduced:crcl<=60, caution:(dial||crcl<30)}; };
F.cangrelor = function(kg){ return {bolus_mcg:30*kg, rate:4, inf:4*kg}; };

/* TIMI risk score — UA/NSTEMI (Antman JAMA 2000). 7 × 1 pt.
   14-day death/MI/urgent revascularization. */
F.timiUA = function(o){
  var s=0;
  if(o.age65)s++; if(o.riskFactors3)s++; if(o.knownCAD)s++; if(o.asa7d)s++;
  if(o.severeAngina)s++; if(o.stDeviation)s++; if(o.markers)s++;
  var risk = s<=1?'4.7%' : s===2?'8.3%' : s===3?'13.2%' : s===4?'19.9%' : s===5?'26.2%' : '40.9%';
  var cls = s<=2?'good' : s<=4?'warn' : 'bad';
  var cat = s<=2?'Low' : s<=4?'Intermediate' : 'High';
  return {score:s, max:7, risk:risk, category:cat, cls:cls};
};
/* TIMI risk score — STEMI (Morrow Circulation 2000). 0–14 pts.
   30-day mortality. */
F.timiSTEMI = function(o){
  var s=0;
  if(o.age>=75)s+=3; else if(o.age>=65)s+=2;
  if(o.dmHtnAngina)s+=1;
  if(o.sbpLt100)s+=3;
  if(o.hrGt100)s+=2;
  if(o.killip24)s+=2;
  if(o.wtLt67)s+=1;
  if(o.anteriorOrLBBB)s+=1;
  if(o.timeGt4h)s+=1;
  var table={0:'0.8%',1:'1.6%',2:'2.2%',3:'4.4%',4:'7.3%',5:'12.4%',6:'16.1%',7:'23.4%',8:'26.8%'};
  var risk = s>=9?'35.9%':table[s];
  var cls = s<=2?'good' : s<=4?'warn' : 'bad';
  return {score:s, max:14, risk:risk, cls:cls};
};
/* Zwolle risk score for primary PCI (De Luca Circulation 2004).
   Score ≤3 → low 30-day mortality (~0.5%); early-discharge candidate. */
F.zwolle = function(o){
  var s=0;
  if(o.killip===2)s+=4; else if(o.killip>=3)s+=9;
  if(o.timiFlow<=1)s+=2; else if(o.timiFlow===2)s+=1;
  if(o.age>=60)s+=2;
  if(o.threeVessel)s+=1;
  if(o.anteriorMI)s+=1;
  if(o.ischemiaGt4h)s+=1;
  var low = s<=3;
  return {score:s, max:16, low:low,
    category: low?'Low risk':'Not low risk',
    note: low?'30-day mortality ≈0.5% — early discharge (48–72 h) may be considered per protocol.'
             :'30-day mortality risk elevated — standard monitoring/length of stay.',
    cls: low?'good':'bad'};
};

/* ---- Hemodynamics ---- */
F.bsaMosteller = function(kg,cm){ return Math.sqrt(kg*cm/3600); };
F.bsaDuBois = function(kg,cm){ return 0.007184*Math.pow(kg,0.425)*Math.pow(cm,0.725); };
F.meanPressure = function(sys,dia){ return (sys+2*dia)/3; };
/* Fick CO (L/min). Sats as fractions (0–1), Hgb g/dL, VO2 mL/min.
   O2 content difference (mL O2/L blood) = 1.36 × Hgb × 10 × (SaO2 − SvO2). */
F.fickCO = function(vo2, hgb, sao2, svo2){ return vo2/(1.36*hgb*10*(sao2-svo2)); };
/* Resistance: returns Wood units and dynes·s·cm⁻⁵. */
F.vascRes = function(inflow, outflow, co){ var w=(inflow-outflow)/co; return {wood:w, dynes:80*w}; };
/* Gorlin valve area (cm²). co L/min, period s/beat (SEP aortic / DFP mitral),
   meanGrad mmHg. Constant 44.3, ×0.85 for mitral. */
F.gorlin = function(coLmin, hr, periodSec, meanGrad, mitral){
  return (coLmin*1000/(hr*periodSec))/(44.3*(mitral?0.85:1)*Math.sqrt(meanGrad));
};
/* Hakki simplified valve area: CO / √gradient. */
F.hakki = function(coLmin, grad){ return coLmin/Math.sqrt(grad); };
/* Shunt fraction from sats (any consistent units): Qp:Qs = (SA−MV)/(PV−PA). */
F.qpqs = function(saO2, mvO2, pvO2, paO2){ return (saO2-mvO2)/(pvO2-paO2); };
/* Flamm mixed venous sat: (3×SVC + IVC)/4. */
F.flammMV = function(svc,ivc){ return (3*svc+ivc)/4; };

/* ---- Infusion drips ----
   concPerMl: mcg/mL for mcg- and mg-based units, U/mL for U/min. */
F.dripMlPerHr = function(dose, unit, kg, concPerMl){
  if(unit==='mcg/min') return dose*60/concPerMl;
  if(unit==='mcg/kg/min') return dose*kg*60/concPerMl;
  if(unit==='mg/h') return dose*1000/concPerMl;
  if(unit==='U/min') return dose*60/concPerMl;
  return NaN;
};
F.dripDoseFromRate = function(mlh, unit, kg, concPerMl){
  if(unit==='mcg/min') return mlh*concPerMl/60;
  if(unit==='mcg/kg/min') return mlh*concPerMl/(60*kg);
  if(unit==='mg/h') return mlh*concPerMl/1000;
  if(unit==='U/min') return mlh*concPerMl/60;
  return NaN;
};

/* ============================ SHARED STATE ============================ */
var BLANK = {pid:'',age:null,sex:'',race:1,dial:false,kg:null,cm:null,scr:null,hgb:null,_ts:null};
function loadP(){ try{ var j=sessionStorage.getItem('cmPatient'); return j?JSON.parse(j):Object.assign({},BLANK); }catch(e){ return Object.assign({},BLANK); } }
var P = loadP();
function saveP(){ P._ts=Date.now(); try{ sessionStorage.setItem('cmPatient',JSON.stringify(P)); }catch(e){} }
CM.patient = function(){ return P; };
CM.setPatient = function(k,v){ P[k]=v; saveP(); notify(); };
CM.clearPatient = function(){ P=Object.assign({},BLANK); saveP(); CM.setContrastUsed(0);
  fillPanel(); notify(); };

CM.contrastUsed = function(){ var v=parseFloat(sessionStorage.getItem('cmContrast')); return isNaN(v)?0:Math.max(0,v); };
CM.setContrastUsed = function(v){ try{ sessionStorage.setItem('cmContrast',String(Math.max(0,v||0))); }catch(e){} notify(); };

CM.units = function(){ return localStorage.getItem('cmUnits')==='si'?'si':'us'; };
CM.setUnits = function(u){ try{ localStorage.setItem('cmUnits',u); }catch(e){} fillPanel(); notify(); };

/* Derived values (canonical metric internally). */
CM.derived = function(){
  var female = P.sex==='F';
  var bmi = (P.kg&&P.cm)? F.bmi(P.kg,P.cm) : null;
  var egfr = (P.age&&P.scr&&P.sex)? F.egfrMDRD(P.scr,P.age,female,P.race) : null;
  var crcl = (P.age&&P.kg&&P.scr&&P.sex)? F.cockcroftGault(P.age,P.kg,female,P.scr) : null;
  return {bmi:bmi, egfr:egfr, crcl:crcl, female:female};
};

var listeners=[];
function notify(){ renderSummary(); listeners.forEach(function(fn){ try{fn();}catch(e){console.error(e);} }); }
CM.onChange = function(fn){ listeners.push(fn); };

/* ============================ HELPERS ============================ */
var $ = CM.$ = function(id){ return document.getElementById(id); };
CM.fmt = function(n){ return Number(n).toLocaleString('en-US'); };
CM.round100 = function(n){ return Math.round(n/100)*100; };
CM.setNum = function(id,val,cls){ var el=$(id); el.textContent=val;
  el.classList.remove('good','warn','bad','neutral'); if(cls)el.classList.add(cls); };
CM.esc = function(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

/* Segmented yes/no group builder. name → callback(value). */
CM.wireSegs = function(root, onAny){
  (root||document).querySelectorAll('.seg').forEach(function(g){
    g.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x.classList.contains('on')?'true':'false');});
    g.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b)return;
      g.querySelectorAll('button').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-pressed','false');});
      b.classList.add('on'); b.setAttribute('aria-pressed','true');
      if(onAny)onAny(g.getAttribute('data-field'),b.getAttribute('data-v'));
    });
  });
};
CM.seg = function(field,root){ var b=(root||document).querySelector('.seg[data-field="'+field+'"] button.on');
  return b?b.getAttribute('data-v'):''; };
CM.segYes = function(field,root){ return CM.seg(field,root)==='Yes'; };
CM.resetSegs = function(root){ (root||document).querySelectorAll('.seg').forEach(function(g){
  g.querySelectorAll('button').forEach(function(b){b.classList.remove('on');b.setAttribute('aria-pressed','false');});
  var d=g.querySelector('[data-def]'); if(d){d.classList.add('on');d.setAttribute('aria-pressed','true');} }); };

CM.copyText = function(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){ return navigator.clipboard.writeText(t); }
  return new Promise(function(res,rej){ var ta=document.createElement('textarea'); ta.value=t;
    ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select();
    try{ document.execCommand('copy'); res(); }catch(e){ rej(e); } document.body.removeChild(ta); });
};

/* ============================ SHELL ============================ */
var ROOT = (function(){ var s=document.currentScript; if(!s)return './';
  return s.src.replace(/assets\/core\.js.*$/,''); })();
CM.root = ROOT;

var NAV = [
  ['Home','index.html','home'],
  ['Hemo','calc/hemodynamics.html','hemo'],
  ['Drips','calc/drips.html','dose'],
  ['Heparin','calc/heparin.html','dose'],
  ['ACT','calc/act.html','dose'],
  ['Contrast','calc/contrast.html','contrast'],
  ['Drugs','calc/drugs.html','dose'],
  ['Bleed','calc/bleed-risk.html','risk'],
  ['Mehran','calc/mehran.html','contrast'],
  ['TIMI','calc/timi.html','risk'],
  ['Zwolle','calc/zwolle.html','risk']
];

/* Realistic PQRST ECG motif: flat baseline → P wave → PR segment → Q dip →
   tall R spike → deep S → ST segment → rounded T wave → baseline. */
function ecgSeg(o){
  return ' H'+(9.5+o)+' Q'+(11+o)+' 30.6 '+(12.5+o)+' 33 H'+(15.4+o)
    +' L'+(16.4+o)+' 34.6 L'+(18.2+o)+' 23.5 L'+(19.8+o)+' 37.2 L'+(21+o)+' 33'
    +' H'+(24.6+o)+' Q'+(27.6+o)+' 28.6 '+(30.6+o)+' 33 H'+(39+o);
}
var ECG_ONE='M5 33'+ecgSeg(0);
var ECG_STRIP='M5 33'+[0,34,68,102].map(ecgSeg).join('');

var LOGO = '<svg viewBox="0 0 44 44" width="44" height="44" role="img" aria-label="Clara Maass Medical Center">'
 +'<rect width="44" height="44" rx="10" fill="#00548b"/>'
 +'<text x="22" y="20.5" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="800" font-size="11" letter-spacing="-0.3" fill="#ffffff">CMMC</text>'
 +'<path d="'+ECG_ONE+'" fill="none" stroke="#d02b2e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function panelHTML(){
  return ''
  +'<div class="grid">'
  +'<div class="field" style="grid-column:1/-1"><label id="lblUnits">Units</label>'
  +'<div class="seg" role="group" aria-labelledby="lblUnits" id="unitSeg" data-field="units">'
  +'<button type="button" data-v="us">US (lb, mg/dL)</button><button type="button" data-v="si">Metric / SI</button></div></div>'
  +'<div class="field"><label for="pid">Patient ID / room <span class="hint">(optional)</span></label><input id="pid" type="text" autocomplete="off" placeholder="e.g. Rm 3 / initials"></div>'
  +'<div class="field"><label for="age">Age <span class="hint">(yrs)</span></label><input id="age" type="number" inputmode="numeric" step="1" min="18" max="120" autocomplete="off" placeholder="68"></div>'
  +'<div class="field"><label id="lblSex">Sex at birth</label>'
  +'<div class="seg" role="group" aria-labelledby="lblSex" data-field="sex"><button type="button" data-v="M">Male</button><button type="button" data-v="F">Female</button></div></div>'
  +'<div class="field"><label for="race">Race <span class="hint">(MDRD eGFR)</span></label><select id="race">'
  +'<option value="1">White / Other</option><option value="1">Asian</option>'
  +'<option value="1">American Indian / Alaska Native</option>'
  +'<option value="1.21">Black or African American</option>'
  +'<option value="1">Hispanic or Latino</option><option value="1">Native Hawaiian / Pacific Isl.</option></select></div>'
  +'<div class="field"><label for="wt">Weight <span class="hint" id="wLab">(lb)</span></label><input id="wt" type="number" inputmode="decimal" step="0.1" min="1" autocomplete="off" placeholder="weight"><div class="derived" id="wtDeriv"></div></div>'
  +'<div class="field" id="wrapHeightUS"><label for="ft">Height</label><div class="row2"><input id="ft" type="number" inputmode="numeric" step="1" min="0" max="8" autocomplete="off" placeholder="ft" aria-label="Height feet"><input id="in" type="number" inputmode="numeric" step="1" min="0" max="11" autocomplete="off" placeholder="in" aria-label="Height inches"></div></div>'
  +'<div class="field" id="wrapHeightSI" style="display:none"><label for="cmH">Height <span class="hint">(cm)</span></label><input id="cmH" type="number" inputmode="decimal" step="0.1" min="30" max="250" autocomplete="off" placeholder="175"></div>'
  +'<div class="field"><label for="scr">Creatinine <span class="hint" id="scrLab">(mg/dL)</span></label><input id="scr" type="number" inputmode="decimal" step="0.01" min="0.1" autocomplete="off" placeholder="1.0"></div>'
  +'<div class="field"><label for="hgb">Hemoglobin <span class="hint" id="hgbLab">(g/dL)</span></label><input id="hgb" type="number" inputmode="decimal" step="0.1" min="1" max="25" autocomplete="off" placeholder="13.5"></div>'
  +'<div class="field"><label id="lblDial">On dialysis?</label>'
  +'<div class="seg" role="group" aria-labelledby="lblDial" data-field="dial"><button type="button" data-v="No" data-def>No</button><button type="button" data-v="Yes">Yes</button></div></div>'
  +'</div><div class="flag" id="rangeFlag"></div>'
  +'<div class="note">eGFR uses MDRD 4-variable with the legacy race coefficient — retained deliberately to match the ACC CathPCI bleed model. CrCl uses Cockcroft-Gault (actual body weight; consider ideal/adjusted weight in obesity). Values are shared across every calculator and clear when the app is closed or on New patient.</div>';
}

function panelStatus(){
  var d=CM.derived(), bits=[];
  if(P.pid)bits.push(CM.esc(P.pid));
  if(P.age)bits.push(P.age+'y '+(P.sex||''));
  if(P.kg)bits.push(P.kg.toFixed(1)+' kg');
  if(d.egfr)bits.push('eGFR '+d.egfr.toFixed(0));
  if(!bits.length)return 'No patient entered — tap to add';
  if(P._ts){
    var min=Math.round((Date.now()-P._ts)/60000);
    bits.push(min<1?'just now':(min<60?min+' min ago':(Math.round(min/60)+' h ago'+(min>=360?' ⚠ verify current patient':''))));
  }
  return bits.join(' · ');
}

/* Fill panel inputs from state (used on load / unit switch / clear). */
function fillPanel(){
  var panel=$('ppanelBody'); if(!panel)return;
  var si=CM.units()==='si';
  var us=$('unitSeg');
  us.querySelectorAll('button').forEach(function(b){
    var on=b.getAttribute('data-v')===(si?'si':'us');
    b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');});
  $('wrapHeightUS').style.display=si?'none':'';
  $('wrapHeightSI').style.display=si?'':'none';
  $('wLab').textContent=si?'(kg)':'(lb)';
  $('scrLab').textContent=si?'(µmol/L)':'(mg/dL)';
  $('hgbLab').textContent=si?'(g/L)':'(g/dL)';
  $('pid').value=P.pid||'';
  $('age').value=P.age!=null?P.age:'';
  $('wt').value=P.kg!=null?(si?P.kg.toFixed(1):(P.kg*2.20462).toFixed(1)):'';
  if(P.cm!=null){ if(si){$('cmH').value=P.cm.toFixed(1);}
    else{ var ti=P.cm/2.54, f=Math.floor(ti/12), i=Math.round(ti-f*12); if(i===12){f++;i=0;} $('ft').value=f; $('in').value=i; } }
  else { $('cmH').value=''; $('ft').value=''; $('in').value=''; }
  $('scr').value=P.scr!=null?(si?(P.scr*88.4).toFixed(0):P.scr.toFixed(2).replace(/0$/,'')):'';
  $('hgb').value=P.hgb!=null?(si?(P.hgb*10).toFixed(0):P.hgb):'';
  var ropts=$('race').options;
  for(var r=0;r<ropts.length;r++){ ropts[r].selected=(parseFloat(ropts[r].value)===P.race && (P.race!==1||r===0)); }
  if(P.race===1)$('race').selectedIndex=0;
  document.querySelectorAll('#ppanelBody .seg[data-field="sex"] button').forEach(function(b){
    var on=b.getAttribute('data-v')===P.sex; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');});
  document.querySelectorAll('#ppanelBody .seg[data-field="dial"] button').forEach(function(b){
    var on=b.getAttribute('data-v')===(P.dial?'Yes':'No'); b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');});
  rangeFlag();
}

function num(id){ var v=parseFloat($(id).value); return isNaN(v)?null:v; }
function readPanel(){
  var si=CM.units()==='si';
  P.pid=$('pid').value.trim();
  var a=num('age'); P.age=(a&&a>0)?a:null;
  var w=num('wt'); P.kg=(w&&w>0)?(si?w:w/2.20462):null;
  if(si){ var c=num('cmH'); P.cm=(c&&c>0)?c:null; }
  else { var ft=num('ft'); P.cm=(ft!=null)?((ft*12+(num('in')||0))*2.54):null; if(P.cm!=null&&P.cm<=0)P.cm=null; }
  var s=num('scr'); P.scr=(s&&s>0)?(si?s/88.4:s):null;
  var h=num('hgb'); P.hgb=(h&&h>0)?(si?h/10:h):null;
  P.race=parseFloat($('race').value)||1;
  saveP(); rangeFlag(); notify();
}
function rangeFlag(){
  var el=$('rangeFlag'); if(!el)return; var warns=[];
  if(P.kg!=null&&(P.kg>250||P.kg<30))warns.push('weight');
  if(P.scr!=null&&P.scr>15)warns.push('creatinine');
  if(P.age!=null&&P.age<18)warns.push('age');
  el.textContent=warns.length?('Verify — '+warns.join(', ')+' outside typical range.'):'';
  el.className='flag'+(warns.length?' warn':'');
}

function renderSummary(){
  var d=CM.derived();
  if($('sWt'))$('sWt').textContent=P.kg!=null?P.kg.toFixed(1):'—';
  if($('sBmi')){ $('sBmi').textContent=d.bmi!=null?d.bmi.toFixed(1):'—';
    $('sGfr').textContent=d.egfr!=null?d.egfr.toFixed(0):'—';
    $('sCrcl').textContent=d.crcl!=null?d.crcl.toFixed(0):'—'; }
  if($('wtDeriv'))$('wtDeriv').textContent=P.kg!=null?('= '+P.kg.toFixed(1)+' kg'):'';
  var st=$('ppanelStatus'); if(st)st.textContent=panelStatus();
  var pm=$('printmeta'); if(pm)pm.textContent=(P.pid?('Patient: '+P.pid+'  ·  '):'')+'Generated '+new Date().toLocaleString('en-US');
}

/* Build the page shell. opts: {title, desc, home, copy:fn->string, onClear:fn} */
CM.init = function(opts){
  opts=opts||{};
  var top=$('shell-top');
  var isHome=!!opts.home;
  var h='';
  h+='<header class="brandbar'+(isHome?'':' compact')+'">'
    +'<svg class="ecgbg" viewBox="0 20 146 20" preserveAspectRatio="none" aria-hidden="true"><path d="'+ECG_STRIP+'"/></svg>'
    +'<a class="brandbar-main" href="'+(isHome?'#':ROOT+'index.html')+'">'
    +'<span class="brandmark">'+LOGO+'</span><span class="brandtext">'
    +'<span class="hosp">Clara Maass Medical Center</span>'
    +'<span class="dept">Cardiac Catheterization Lab · Belleville, NJ</span></span></a>'
    +'<span class="brandbtns">'
    +(opts.copy?'<button class="btn" id="copyBtn" type="button">Copy</button>':'')
    +'<button class="btn" id="clearBtn" type="button">New patient</button></span></header>';
  h+='<h1 class="apptitle">'+CM.esc(opts.title||'Cath Lab Tools')+'</h1>';
  if(!isHome)h+='<p class="crumb"><a href="'+ROOT+'index.html">‹ All calculators</a></p>';
  if(opts.desc)h+='<p class="tagline">'+opts.desc+'</p>';
  h+='<div class="printmeta" id="printmeta"></div>';
  h+='<div class="summary" id="summaryBar" role="button" tabindex="0" aria-label="Derived values — tap to edit patient" title="Tap to edit patient">'
    +'<div class="s"><div class="lab">Wt kg</div><div class="val" id="sWt">—</div></div>'
    +'<div class="s"><div class="lab">BMI</div><div class="val" id="sBmi">—</div></div>'
    +'<div class="s"><div class="lab">eGFR·MDRD</div><div class="val" id="sGfr">—</div></div>'
    +'<div class="s"><div class="lab">CrCl</div><div class="val" id="sCrcl">—</div></div></div>';
  h+='<details class="ppanel"'+(isHome?' open':'')+'><summary>Patient <span class="st" id="ppanelStatus"></span></summary>'
    +'<div class="pbody" id="ppanelBody">'+panelHTML()+'</div></details>';
  top.innerHTML=h;

  var bottom=$('shell-bottom');
  bottom.innerHTML='<p class="disc"><strong>Clara Maass Medical Center</strong> · Cardiac Catheterization Lab · 1 Clara Maass Drive, Belleville, NJ 07109 · (973) 450-2000<br>'
    +'For internal clinical use. Decision-support estimates only — not a substitute for clinical judgment. Verify against local protocol.</p>'
    +'<p class="ver">Cath Lab Tools v'+CM.VERSION+' · formulas last reviewed '+CM.REVIEWED
    +' · <a href="'+ROOT+'tests.html">formula self-test</a></p>'
    +'<div class="sr-only" aria-live="polite" id="srlive"></div>';

  /* wire panel */
  fillPanel();
  ['pid','age','wt','ft','in','cmH','scr','hgb'].forEach(function(id){
    $(id).addEventListener('input',readPanel); });
  $('race').addEventListener('change',readPanel);
  CM.wireSegs($('ppanelBody'),function(field,v){
    if(field==='units'){ CM.setUnits(v); }
    else if(field==='sex'){ P.sex=v; saveP(); notify(); }
    else if(field==='dial'){ P.dial=(v==='Yes'); saveP(); notify(); }
  });
  /* New patient = two-tap confirm so a stray touch can't wipe a case */
  var clearArm=null;
  $('clearBtn').addEventListener('click',function(){
    var b=this;
    if(clearArm){ clearTimeout(clearArm); clearArm=null;
      b.textContent='New patient'; b.classList.remove('confirm');
      CM.clearPatient(); if(opts.onClear)opts.onClear(); return; }
    b.textContent='Tap again to clear'; b.classList.add('confirm');
    clearArm=setTimeout(function(){ clearArm=null; b.textContent='New patient'; b.classList.remove('confirm'); },3500);
  });
  if(opts.copy){ $('copyBtn').addEventListener('click',function(){ var b=this;
    CM.copyText(opts.copy()).then(function(){ var o=b.textContent; b.textContent='Copied';
      setTimeout(function(){b.textContent=o;},1200); },
      function(){ b.textContent='Copy failed'; setTimeout(function(){b.textContent='Copy';},1400); }); }); }

  renderSummary();

  /* bottom quick-nav */
  var cur=location.pathname.split('/').pop()||'index.html';
  var nav='<nav class="qnav" aria-label="Calculator quick navigation">'+NAV.map(function(n){
    var isCur=n[1].split('/').pop()===cur;
    return '<a href="'+ROOT+n[1]+'"'+(isCur?' class="cur" aria-current="page"':'')
      +'><i class="d-'+n[2]+'" aria-hidden="true"></i>'+n[0]+'</a>';
  }).join('')+'</nav>';
  document.body.insertAdjacentHTML('beforeend',nav);
  var curLink=document.querySelector('.qnav a.cur');
  if(curLink)curLink.scrollIntoView({inline:'center',block:'nearest'});

  /* summary bar and error messages open the patient panel */
  function openPanel(focusEmpty){
    var det=document.querySelector('details.ppanel'); if(!det)return;
    det.open=true; det.scrollIntoView({behavior:'smooth',block:'start'});
    if(focusEmpty){ var first=['age','wt','scr','hgb'].map(function(id){return $(id);})
      .filter(function(el){return el&&!el.value;})[0];
      if(first)setTimeout(function(){first.focus();},350); }
  }
  var sb=$('summaryBar');
  if(sb){ sb.addEventListener('click',function(){openPanel(true);});
    sb.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel(true);}}); }
  document.addEventListener('click',function(e){
    var err=e.target.closest('.err');
    if(err&&/weight|creatinine|age|sex|hemoglobin|height|patient/i.test(err.textContent))openPanel(true);
  });

  /* recently-used tracking (for the home screen) */
  if(!isHome && location.pathname.indexOf('/calc/')>=0){
    try{
      var file='calc/'+cur, rec=JSON.parse(localStorage.getItem('cmRecent')||'[]');
      rec=[file].concat(rec.filter(function(r){return r!==file;})).slice(0,4);
      localStorage.setItem('cmRecent',JSON.stringify(rec));
    }catch(e){}
  }

  /* service worker (needs http(s); silently skipped on file://) + update toast */
  if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
    navigator.serviceWorker.register(ROOT+'sw.js').then(function(reg){
      reg.addEventListener('updatefound',function(){
        var nw=reg.installing; if(!nw)return;
        nw.addEventListener('statechange',function(){
          if(nw.state==='installed'&&navigator.serviceWorker.controller&&!$('updToast')){
            document.body.insertAdjacentHTML('beforeend',
              '<div class="toast" id="updToast">Updated version available'
              +'<button type="button" onclick="location.reload()">Reload</button></div>');
          }
        });
      });
    }).catch(function(){});
  }
};

CM.recent = function(){ try{ return JSON.parse(localStorage.getItem('cmRecent')||'[]'); }catch(e){ return []; } };

CM.announce = (function(){ var t; return function(msg){ clearTimeout(t);
  t=setTimeout(function(){ var el=$('srlive'); if(el)el.textContent=msg; },700); }; })();

})();
