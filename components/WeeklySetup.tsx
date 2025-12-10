
import React, { useMemo } from 'react';
import { MachineId, MachineConfig, MACHINE_LABELS, GlobalForecasts, StaffMember } from '../types';
import { Trash2, Scale, Box, Gauge, Target, Info, FileText, Layers, Calendar, Calculator, Briefcase, Table, Clock, UserCheck, UserPlus, Rocket, Lock } from 'lucide-react';

interface WeeklySetupProps {
  configs: Record<MachineId, MachineConfig>;
  updateConfig: (id: MachineId, data: Partial<MachineConfig>) => void;
  globalForecasts: GlobalForecasts;
  setGlobalForecasts: (data: GlobalForecasts) => void;
  onResetWeek: () => void;
  onPromoteWeek?: () => void; // New Prop
  weekLabel: string;
  isPrepMode?: boolean;
  staffList?: StaffMember[];
  readOnly?: boolean; // New Prop for History
}

const WeeklySetup: React.FC<WeeklySetupProps> = ({ configs, updateConfig, globalForecasts, setGlobalForecasts, onResetWeek, onPromoteWeek, weekLabel, isPrepMode = false, staffList = [], readOnly = false }) => {
  const machineList = Object.keys(configs) as MachineId[];

  // --- HR CALCULATOR LOGIC (ESTIMATION RAPIDE / EFFECTIF) ---
  const hrNeeds = useMemo(() => {
    let requiredStaffPerShift = 0;
    
    // RÈGLES DE DOTATION :
    // M1 / M2 : 4 personnes (1 PIMA, 1 OP, 1 GEST, 1 PREP)
    if (configs['M1'].active) requiredStaffPerShift += 4;
    if (configs['M2'].active) requiredStaffPerShift += 4;

    // PAC : 2 personnes (1 OP, 1 PREP)
    if (configs['PAC'].active) requiredStaffPerShift += 2;

    // GROUPE M3/M4 : 
    // Socle : 2 personnes par machine (1 PIMA, 1 OP)
    // Commun : 2 personnes pour le groupe (1 GEST, 1 PREP) QUEL QUE SOIT LE CAS (1 ou 2 machines actives)
    const m3Active = configs['M3'].active;
    const m4Active = configs['M4'].active;
    
    if (m3Active) requiredStaffPerShift += 2; // Socle M3
    if (m4Active) requiredStaffPerShift += 2; // Socle M4
    // Si au moins une machine active, on ajoute le staff commun (Gest + Prep = 2 pers)
    if (m3Active || m4Active) requiredStaffPerShift += 2; 

    // GROUPE M5/M6 (Même logique)
    const m5Active = configs['M5'].active;
    const m6Active = configs['M6'].active;
    
    if (m5Active) requiredStaffPerShift += 2; // Socle M5
    if (m6Active) requiredStaffPerShift += 2; // Socle M6
    if (m5Active || m6Active) requiredStaffPerShift += 2; // Commun (Gest + Prep)

    // Calcul RH
    const totalSalaries = staffList.filter(s => !s.isInterim && s.active && !s.isAbsent).length;
    const totalNeedTwoShifts = requiredStaffPerShift * 2;
    const estimatedInterim = Math.max(0, totalNeedTwoShifts - totalSalaries);

    return {
        perShift: requiredStaffPerShift,
        totalNeed: totalNeedTwoShifts,
        available: totalSalaries,
        interim: estimatedInterim
    };
  }, [configs, staffList]);

  // --- DETAILED HOURS CALCULATOR (CALCUL PRECIS HEURES) ---
  const hrDetails = useMemo(() => {
      let rows: any[] = [];
      let maxShiftDuration = 0;
      let totalManHours = 0;
      const LEGAL_WEEKLY_HOURS = 35;

      // Helper pour calculer la durée de fonctionnement d'une machine
      const getRunTime = (id: MachineId) => {
          const conf = configs[id];
          if (!conf.active) return 0;
          let cad = conf.targetCadence;
          // Si cadence 0 ou non définie, on prend 2000 par défaut (PAC ou autre)
          if (!cad || cad === 0) cad = 2000;
          return (conf.targetBal || 0) / cad;
      };

      // Calcul des durées machines
      const hoursMap: Record<string, number> = {};
      machineList.forEach(id => {
          hoursMap[id] = getRunTime(id);
          if (hoursMap[id] > maxShiftDuration) maxShiftDuration = hoursMap[id];
      });

      // Fonction pour générer la ligne du tableau
      const addRow = (id: MachineId, staffCountDisplay: number, manHoursCalc: number) => {
          if (!configs[id].active) return;
          const conf = configs[id];
          const h = hoursMap[id];
          
          rows.push({
              id,
              label: MACHINE_LABELS[id],
              bal: conf.targetBal || 0,
              cad: (conf.targetCadence === 0 ? 2000 : conf.targetCadence),
              hours: h,
              staff: staffCountDisplay, // Pour affichage seulement
              manHours: manHoursCalc
          });
      };

      // --- CALCUL DES HEURES HOMMES ---
      
      // M1 & M2 : Durée * 4
      if (configs['M1'].active) {
          const mh = hoursMap['M1'] * 4;
          totalManHours += mh;
          addRow('M1', 4, mh);
      }
      if (configs['M2'].active) {
          const mh = hoursMap['M2'] * 4;
          totalManHours += mh;
          addRow('M2', 4, mh);
      }

      // PAC : Durée * 2
      if (configs['PAC'].active) {
          const mh = hoursMap['PAC'] * 2;
          totalManHours += mh;
          addRow('PAC', 2, mh);
      }

      // GROUPE M3/M4 & M5/M6 : LOGIQUE AVANCEE
      const calcGroupDetails = (id1: MachineId, id2: MachineId) => {
          const active1 = configs[id1].active;
          const active2 = configs[id2].active;
          const h1 = hoursMap[id1];
          const h2 = hoursMap[id2];
          const sharedTime = Math.max(h1, h2); // Le staff partagé reste tant qu'une machine tourne

          if (active1 && active2) {
              // CAS 1 : LES DEUX SONT ACTIVES
              // Coût Total = (H1 * 2 socle) + (H2 * 2 socle) + (Max(H1,H2) * 2 commun)
              // Répartition table : On attribue 3 pers à chaque machine (approx visuelle : 2 socle + 1 partagé)
              
              const mh1 = (h1 * 2) + (sharedTime * 1);
              totalManHours += mh1;
              addRow(id1, 3, mh1); // Visuel : 3 p.

              const mh2 = (h2 * 2) + (sharedTime * 1);
              totalManHours += mh2;
              addRow(id2, 3, mh2); // Visuel : 3 p.

          } else if (active1) {
              // CAS 2 : SEULEMENT LA PREMIERE ACTIVE
              // Elle supporte TOUT le staff commun (2 pers)
              // Coût = H1 * 2 (socle) + H1 * 2 (commun) = H1 * 4
              const mh1 = (h1 * 4);
              totalManHours += mh1;
              addRow(id1, 4, mh1); // Visuel : 4 p.

          } else if (active2) {
              // CAS 3 : SEULEMENT LA DEUXIEME ACTIVE
              const mh2 = (h2 * 4);
              totalManHours += mh2;
              addRow(id2, 4, mh2); // Visuel : 4 p.
          }
      };

      calcGroupDetails('M3', 'M4');
      calcGroupDetails('M5', 'M6');

      // Calcul RH Final
      const nbSalaries = staffList.filter(s => !s.isInterim && s.active && !s.isAbsent).length;
      const salaryCapacity = nbSalaries * LEGAL_WEEKLY_HOURS;
      const interimHours = Math.max(0, totalManHours - salaryCapacity);
      const interimStaff = Math.ceil(interimHours / LEGAL_WEEKLY_HOURS);

      return { rows, totalManHours, maxShiftDuration, nbSalaries, salaryCapacity, interimHours, interimStaff };
  }, [configs, staffList, machineList]);

  const handleToggle = (id: MachineId) => {
    if (readOnly) return;
    updateConfig(id, { active: !configs[id].active });
  };

  const handleChange = (id: MachineId, field: keyof MachineConfig, value: string) => {
    if (readOnly) return;
    const numVal = parseFloat(value) || 0;
    updateConfig(id, { [field]: numVal });
  };

  const handleGlobalChange = (field: keyof GlobalForecasts, value: string) => {
      if (readOnly) return;
      const numVal = parseFloat(value) || 0;
      setGlobalForecasts({
          ...globalForecasts,
          [field]: numVal
      });
  };

  const isCalcVisible = !readOnly; // Visible en Prod et Prep, masqué en Archive
  const modeColor = isPrepMode ? 'purple' : 'brand'; // 'brand' maps to blue/sky usually, handled via template literal logic or dedicated classes

  // Helper for dynamic colors
  const getColor = (type: 'text' | 'bg' | 'border' | 'ring', intensity: string) => {
      if (isPrepMode) return `${type}-purple-${intensity}`;
      return `${type}-brand-${intensity}`; // 'brand' colors defined in index.html (sky/blue)
  };
  
  // Hardcoded replacement for 'brand' since dynamic template literals with custom colors can be tricky with Tailwind compiler 
  // We'll use blue for production (brand) and purple for prep
  const theme = {
      text: isPrepMode ? 'text-purple-900' : 'text-blue-900',
      textLight: isPrepMode ? 'text-purple-600' : 'text-blue-600',
      bg: isPrepMode ? 'bg-purple-50' : 'bg-blue-50',
      border: isPrepMode ? 'border-purple-200' : 'border-blue-200',
      icon: isPrepMode ? 'text-purple-600' : 'text-blue-600',
  };

  return (
    <div className="space-y-8">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 ${theme.border}`}>
        <div>
          <h2 className={`text-2xl font-bold flex items-center gap-2 ${theme.text}`}>
            {readOnly && <Lock className="w-5 h-5 text-gray-400" />}
            Configuration de la Semaine 
            <span className={`px-2 py-1 rounded text-lg border flex items-center gap-1 ${isPrepMode ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                <Calendar className="w-4 h-4" /> {weekLabel}
            </span>
          </h2>
          <p className="text-gray-500 mt-1">
              {readOnly 
                ? "Consultation des objectifs archivés. Aucune modification possible."
                : (isPrepMode 
                    ? "Définissez les machines et effectifs pour la semaine prochaine (S+2)." 
                    : "Ajustez les objectifs de la production en cours (S+1).")
              }
          </p>
        </div>
        {!readOnly && (
            <div className="flex gap-4">
                {isPrepMode && onPromoteWeek && (
                    <button 
                    onClick={onPromoteWeek}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white border border-purple-700 rounded-lg hover:bg-purple-700 transition-colors text-sm font-bold shadow-md animate-pulse"
                    >
                    <Rocket className="w-4 h-4" />
                    Valider & Passer en Production
                    </button>
                )}
                <button 
                onClick={onResetWeek}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                >
                <Trash2 className="w-4 h-4" />
                Réinitialiser la Semaine
                </button>
            </div>
        )}
      </div>

      {/* HR CALCULATOR - Visible in Edit Mode (Current or Prep) */}
      {isCalcVisible && (
          <div className="space-y-6">
            <div className={`bg-gradient-to-br ${isPrepMode ? 'from-purple-50 border-purple-200' : 'from-blue-50 border-blue-200'} to-white p-6 rounded-xl shadow-sm border`}>
                <h3 className={`text-lg font-bold ${isPrepMode ? 'text-purple-900 border-purple-100' : 'text-blue-900 border-blue-100'} mb-6 flex items-center gap-2 border-b pb-2`}>
                    <Calculator className={`w-5 h-5 ${isPrepMode ? 'text-purple-600' : 'text-blue-600'}`} />
                    Estimation Rapide (Basée sur le nombre de postes)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className={`bg-white p-4 rounded-lg border shadow-sm ${isPrepMode ? 'border-purple-100' : 'border-blue-100'}`}>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Besoin / Équipe</div>
                        <div className="text-2xl font-bold text-gray-800">{hrNeeds.perShift} <span className="text-sm font-normal text-gray-400">pers.</span></div>
                    </div>
                    <div className={`bg-white p-4 rounded-lg border shadow-sm ${isPrepMode ? 'border-purple-100' : 'border-blue-100'}`}>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Besoin Total (2 Équipes)</div>
                        <div className="text-2xl font-bold text-gray-800">{hrNeeds.totalNeed} <span className="text-sm font-normal text-gray-400">pers.</span></div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                        <div className="text-xs font-bold text-blue-600 uppercase mb-1">Salariés Dispo</div>
                        <div className="text-2xl font-bold text-blue-800">{hrNeeds.available}</div>
                        <p className="text-[10px] text-blue-600 mt-1">Absents exclus</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-2 opacity-10"><Briefcase className="w-16 h-16 text-orange-500"/></div>
                        <div className="text-xs font-bold text-orange-600 uppercase mb-1">Besoin Intérim Est.</div>
                        <div className="text-3xl font-extrabold text-orange-700">{hrNeeds.interim}</div>
                        <p className="text-[10px] text-orange-600 mt-1">Postes à pourvoir</p>
                    </div>
                </div>
            </div>

            {/* TABLEAU DETAILLE DES HEURES */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Table className="w-5 h-5 text-gray-500" />
                    Calcul Précis des Heures (Production vs Capacité 35h)
                </h3>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Machine</th>
                                <th className="px-4 py-3 text-right">Obj. BAL</th>
                                <th className="px-4 py-3 text-right">Cadence</th>
                                <th className={`px-4 py-3 text-right ${isPrepMode ? 'text-purple-600' : 'text-blue-600'}`}>Heures Mach.</th>
                                <th className="px-4 py-3 text-right">Effectif</th>
                                <th className={`px-4 py-3 text-right font-bold rounded-tr-lg ${isPrepMode ? 'bg-purple-50 text-purple-800' : 'bg-blue-50 text-blue-800'}`}>Heures Hommes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {hrDetails.rows.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">Aucune machine active</td></tr>
                            ) : hrDetails.rows.map((row: any) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-800">{row.label}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{row.bal.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{row.cad.toLocaleString()}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${isPrepMode ? 'text-purple-600' : 'text-blue-600'}`}>{row.hours.toFixed(1)} h</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{row.staff} p.</td>
                                    <td className={`px-4 py-3 text-right font-bold ${isPrepMode ? 'bg-purple-50/30 text-purple-800' : 'bg-blue-50/30 text-blue-800'}`}>{row.manHours.toFixed(1)} h</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                                <td className="px-4 py-3 text-gray-800">TOTAL SEMAINE</td>
                                <td className="px-4 py-3 text-right">-</td>
                                <td className="px-4 py-3 text-right">-</td>
                                <td className={`px-4 py-3 text-right ${isPrepMode ? 'text-purple-700' : 'text-blue-700'}`}>{hrDetails.maxShiftDuration.toFixed(1)} h (Max/Mach)</td>
                                <td className="px-4 py-3 text-right">-</td>
                                <td className={`px-4 py-3 text-right text-xl ${isPrepMode ? 'text-purple-900' : 'text-blue-900'}`}>{hrDetails.totalManHours.toFixed(1)} h</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* RECAPITULATIF RH */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 border-t pt-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="text-xs font-bold text-blue-600 uppercase mb-1 flex items-center gap-2">
                            <UserCheck className="w-4 h-4" /> Capacité Salariés (35h)
                        </div>
                        <div className="text-2xl font-bold text-blue-900">{hrDetails.salaryCapacity.toFixed(1)} h</div>
                        <p className="text-xs text-blue-700 mt-1">
                            {hrDetails.nbSalaries} salariés présents × 35 heures
                        </p>
                    </div>
                    
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <div className="text-xs font-bold text-orange-600 uppercase mb-1 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Besoin Intérim (Heures)
                        </div>
                        <div className="text-2xl font-bold text-orange-900">{hrDetails.interimHours.toFixed(1)} h</div>
                        <p className="text-xs text-orange-700 mt-1">
                            Heures production restantes
                        </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${isPrepMode ? 'bg-purple-50 border-purple-100' : 'bg-indigo-50 border-indigo-100'}`}>
                        <div className={`text-xs font-bold uppercase mb-1 flex items-center gap-2 ${isPrepMode ? 'text-purple-600' : 'text-indigo-600'}`}>
                            <UserPlus className="w-4 h-4" /> Estimation Intérimaires (ETP)
                        </div>
                        <div className={`text-2xl font-bold ${isPrepMode ? 'text-purple-900' : 'text-indigo-900'}`}>{hrDetails.interimStaff} pers.</div>
                        <p className={`text-xs mt-1 ${isPrepMode ? 'text-purple-700' : 'text-indigo-700'}`}>
                            Base 35h / personne (Arrondi sup.)
                        </p>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* 1. SECTION PREVISIONS GLOBALES */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-100 pb-2">
            <Info className="w-5 h-5 text-indigo-500" />
            Prévisions Générales (Informations Dossier)
        </h3>
        
        <div className="space-y-6">
            {/* Ligne 1 : Les totaux */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                    <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Volume Global Prévu (Docs)
                    </label>
                    <input 
                        type="number" 
                        value={globalForecasts.totalVolume || ''}
                        onChange={(e) => handleGlobalChange('totalVolume', e.target.value)}
                        disabled={readOnly}
                        className={`w-full px-4 py-2 text-xl font-semibold text-gray-800 border border-indigo-200 rounded focus:ring-indigo-500 focus:border-indigo-500 bg-white ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                        placeholder="-"
                    />
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                    <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4" /> NB BAL Total Prévu
                    </label>
                    <input 
                        type="number" 
                        value={globalForecasts.predictedBal || ''}
                        onChange={(e) => handleGlobalChange('predictedBal', e.target.value)}
                        disabled={readOnly}
                        className={`w-full px-4 py-2 text-xl font-semibold text-gray-800 border border-indigo-200 rounded focus:ring-indigo-500 focus:border-indigo-500 bg-white ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                        placeholder="-"
                    />
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                    <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Scale className="w-4 h-4" /> Poids Total Prévu (kg)
                    </label>
                    <input 
                        type="number" 
                        value={globalForecasts.totalWeight || ''}
                        onChange={(e) => handleGlobalChange('totalWeight', e.target.value)}
                        disabled={readOnly}
                        className={`w-full px-4 py-2 text-xl font-semibold text-gray-800 border border-indigo-200 rounded focus:ring-indigo-500 focus:border-indigo-500 bg-white ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                        placeholder="-"
                    />
                </div>
            </div>

            {/* Ligne 2 : Les contraintes poignées */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Box className="w-4 h-4" /> Nombre Documents Max / Poignée
                    </label>
                    <input 
                        type="number" 
                        value={globalForecasts.maxDocsPerHandful || ''}
                        onChange={(e) => handleGlobalChange('maxDocsPerHandful', e.target.value)}
                        disabled={readOnly}
                        className={`w-full px-4 py-2 text-lg font-medium text-gray-700 border border-gray-300 rounded focus:ring-gray-400 focus:border-gray-400 bg-white ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                        placeholder="-"
                    />
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Scale className="w-4 h-4" /> Poids Max / Poignée (g)
                    </label>
                    <input 
                        type="number" 
                        value={globalForecasts.maxWeightPerHandful || ''}
                        onChange={(e) => handleGlobalChange('maxWeightPerHandful', e.target.value)}
                        disabled={readOnly}
                        className={`w-full px-4 py-2 text-lg font-medium text-gray-700 border border-gray-300 rounded focus:ring-gray-400 focus:border-gray-400 bg-white ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                        placeholder="-"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* 2. SECTION OBJECTIFS MACHINES */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-600" />
            Objectifs de Production par Machine
        </h3>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {machineList.map((id) => {
            const config = configs[id];
            const isPac = id === 'PAC';
            
            return (
                <div 
                key={id} 
                className={`
                    rounded-xl border shadow-sm transition-all duration-200
                    ${config.active ? 'bg-white border-brand-200 ring-1 ring-brand-100' : 'bg-gray-50 border-gray-200 opacity-70'}
                `}
                >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        {MACHINE_LABELS[id]}
                        {config.active && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>}
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={config.active}
                        onChange={() => handleToggle(id)}
                        disabled={readOnly}
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${config.active ? 'peer-checked:bg-brand-600' : ''}`}></div>
                    </label>
                </div>

                {config.active && (
                    <div className="p-4">
                        <div className="grid grid-cols-3 gap-4">
                            {/* Colonne 1 : BAL */}
                            <div>
                                <label className="block text-xs font-bold text-brand-800 mb-1">Cible BAL</label>
                                <input 
                                    type="number" 
                                    value={config.targetBal || ''}
                                    onChange={(e) => handleChange(id, 'targetBal', e.target.value)}
                                    disabled={readOnly}
                                    className={`w-full px-3 py-2 text-lg font-semibold text-brand-700 border border-brand-200 rounded focus:ring-brand-500 focus:border-brand-500 ${readOnly ? 'bg-gray-50' : ''}`}
                                    placeholder="0"
                                />
                            </div>

                            {/* Colonne 2 : Volume */}
                            <div>
                                <label className="block text-xs font-bold text-indigo-800 mb-1">Vol. Semaine</label>
                                <input 
                                    type="number" 
                                    value={config.targetVolume || ''}
                                    onChange={(e) => handleChange(id, 'targetVolume', e.target.value)}
                                    disabled={readOnly}
                                    className={`w-full px-3 py-2 text-lg font-semibold text-indigo-700 border border-indigo-200 rounded focus:ring-indigo-500 focus:border-indigo-500 ${readOnly ? 'bg-gray-50' : ''}`}
                                    placeholder="0"
                                />
                            </div>

                            {/* Colonne 3 : Cadence */}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Cadence {isPac ? '(Forfait)' : '(théo)'}</label>
                                <div className="relative">
                                    <Gauge className="w-4 h-4 absolute left-2 top-2.5 text-gray-400"/>
                                    <input 
                                        type="number" 
                                        value={config.targetCadence || ''}
                                        onChange={(e) => handleChange(id, 'targetCadence', e.target.value)}
                                        disabled={readOnly}
                                        className={`w-full pl-8 pr-2 py-2 text-lg font-semibold text-gray-700 border border-gray-200 rounded focus:ring-brand-500 focus:border-brand-500 ${readOnly ? 'bg-gray-50' : ''}`}
                                        placeholder={isPac ? "2000" : "-"}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            );
            })}
        </div>
      </div>
    </div>
  );
};

export default WeeklySetup;
