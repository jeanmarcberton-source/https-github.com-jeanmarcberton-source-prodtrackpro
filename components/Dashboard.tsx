
import React, { useState } from 'react';
import { MachineId, MachineConfig, ProductionLog, MACHINE_LABELS, PlanningAssignment, StaffAssignment, GlobalForecasts, WeekOption, TeamType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, Layers, Users, HardHat, Briefcase, FileDown, AlertTriangle, Scale, Info, FileText, Box, Calendar, Eye, PenTool, ChevronDown, Lock, Calculator, Table, Activity, X } from 'lucide-react';

interface DashboardProps {
  configs: Record<MachineId, MachineConfig>;
  logs: ProductionLog[];
  planning?: PlanningAssignment[];
  globalForecasts: GlobalForecasts;
  weekLabel: string;
  onTogglePreview?: () => void;
  weekOptions: WeekOption[];
  selectedWeekId: string;
  onSelectWeek: (id: string) => void;
  readOnly?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ configs, logs, planning = [], globalForecasts, weekLabel, onTogglePreview, weekOptions, selectedWeekId, onSelectWeek, readOnly = false }) => {
  const activeMachineIds = Object.keys(configs).filter(k => configs[k as MachineId].active) as MachineId[];
  const [showReportOnScreen, setShowReportOnScreen] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  // --- Date Helpers ---
  function getMonday(d: Date) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // Determine the Monday of the week to display based on data or today
  let refDate = new Date();
  if (logs.length > 0) {
      const sortedLogs = [...logs].sort((a,b) => b.date.localeCompare(a.date));
      refDate = new Date(sortedLogs[0].date);
  } else if (planning.length > 0) {
      const sortedPlan = [...planning].sort((a,b) => b.date.localeCompare(a.date));
      refDate = new Date(sortedPlan[0].date);
  }
  const mondayDate = getMonday(refDate);

  // Generate Mon-Sat objects
  const weekDays = [];
  const daysLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  for (let i = 0; i < 6; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      weekDays.push({
          date: d.toISOString().split('T')[0],
          label: daysLabels[i],
          fullLabel: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
      });
  }

  const weekStartStr = weekDays[0].date;
  const weekEndObj = new Date(mondayDate);
  weekEndObj.setDate(weekEndObj.getDate() + 6);
  const weekEndStr = weekEndObj.toISOString().split('T')[0];

  // Filter logs for current week
  const currentWeekLogs = logs.filter(l => l.date >= weekStartStr && l.date <= weekEndStr);

  // --- 1. GLOBAL KPIs ---
  const totalTargetBal = activeMachineIds.reduce((acc, id) => acc + (configs[id]?.targetBal || 0), 0);
  const totalProducedBal = currentWeekLogs.reduce((acc, log) => acc + log.balProduced, 0);
  const progressPercentBal = totalTargetBal > 0 ? (totalProducedBal / totalTargetBal) * 100 : 0;

  // --- 2. TEAM PERFORMANCE ---
  const calculateTeamMetrics = (team: 'MATIN' | 'SOIR') => {
      const teamLogs = currentWeekLogs.filter(l => l.team === team);
      
      const producedBal = teamLogs.reduce((acc, l) => acc + l.balProduced, 0);
      const hours = teamLogs.reduce((acc, l) => acc + l.hours, 0);
      const avgCadence = hours > 0 ? Math.round(producedBal / hours) : 0;

      let totalStandardHours = 0;
      let totalActualHoursForGap = 0; 

      teamLogs.forEach(log => {
          const config = configs[log.machineId];
          if (!config) return;
          let cadence = config.targetCadence;
          if (log.machineId === 'PAC' && (!cadence || cadence === 0)) cadence = 2000;

          if (cadence > 0) {
              const standardHours = log.balProduced / cadence;
              totalStandardHours += standardHours;
              totalActualHoursForGap += log.hours;
          }
      });

      const gapHours = totalStandardHours - totalActualHoursForGap;
      return { producedBal, avgCadence, hours, gapHours };
  };

  const matinMetrics = calculateTeamMetrics('MATIN');
  const soirMetrics = calculateTeamMetrics('SOIR');

  // --- 3. DETAILED MACHINE DATA ---
  const machineTableData = activeMachineIds.map(id => {
      const config = configs[id];
      if (!config) return null;
      
      const mLogs = currentWeekLogs.filter(l => l.machineId === id);
      
      let cadence = config.targetCadence;
      if (id === 'PAC' && (!cadence || cadence === 0)) cadence = 2000;

      const calcDayData = (date: string, team?: TeamType) => {
          const dayLogs = mLogs.filter(l => l.date === date && (!team || l.team === team));
          const bal = dayLogs.reduce((acc, l) => acc + l.balProduced, 0);
          const hours = dayLogs.reduce((acc, l) => acc + l.hours, 0);
          
          let gap = 0;
          if (cadence > 0 && hours > 0) {
              gap = (bal / cadence) - hours;
          } else if (cadence > 0 && bal > 0 && hours === 0) {
              gap = 0; 
          }
          return { date, bal, hours, gap };
      };

      const matinDays = weekDays.map(day => calcDayData(day.date, 'MATIN'));
      const soirDays = weekDays.map(day => calcDayData(day.date, 'SOIR'));
      const totalDays = weekDays.map(day => calcDayData(day.date));

      const calcTotal = (ls: ProductionLog[]) => {
          const bal = ls.reduce((acc, l) => acc + l.balProduced, 0);
          const h = ls.reduce((acc, l) => acc + l.hours, 0);
          let gap = 0;
          if (cadence > 0 && h > 0) {
              gap = (bal / cadence) - h;
          }
          return { bal, h, gap };
      };

      const matinTotal = calcTotal(mLogs.filter(l => l.team === 'MATIN'));
      const soirTotal = calcTotal(mLogs.filter(l => l.team === 'SOIR'));
      const grandTotal = calcTotal(mLogs);

      return {
          id,
          label: MACHINE_LABELS[id],
          targetBal: config.targetBal,
          matinDays,
          soirDays,
          totalDays,
          matinTotal,
          soirTotal,
          grandTotal,
          progressBal: config.targetBal > 0 ? (grandTotal.bal / config.targetBal) * 100 : 0
      };
  }).filter(Boolean) as any[];

  // CHART DATA: Production Histogram (Realized vs Target)
  const productionChartData = activeMachineIds.map(id => {
      const config = configs[id];
      if (!config) return null;
      const mLogs = currentWeekLogs.filter(l => l.machineId === id);
      const produced = mLogs.reduce((acc, l) => acc + l.balProduced, 0);
      
      return {
          name: id,
          Réalisé: produced,
          Objectif: config.targetBal || 0
      };
  }).filter(Boolean);

  // --- 4. HR ANALYSIS (Aggregated Only) ---
  const getMachineHours = (date: string, team: string, machineId: string) => {
    const log = currentWeekLogs.find(l => l.date === date && l.team === team && l.machineId === machineId);
    return log ? log.hours : 0;
  };

  const roleStats = {
      PIMA: { salUnique: new Set<string>(), intUnique: new Set<string>(), salHours: 0, intHours: 0 },
      OPERATEUR: { salUnique: new Set<string>(), intUnique: new Set<string>(), salHours: 0, intHours: 0 },
      GESTIONNAIRE: { salUnique: new Set<string>(), intUnique: new Set<string>(), salHours: 0, intHours: 0 },
      PREPARATEUR: { salUnique: new Set<string>(), intUnique: new Set<string>(), salHours: 0, intHours: 0 },
  };

  const currentWeekPlanning = planning.filter(p => p.date >= weekStartStr && p.date <= weekEndStr);

  currentWeekPlanning.forEach(plan => {
      Object.entries(plan.assignments).forEach(([key, val]) => {
          const person = typeof val === 'string' ? { name: val, isInterim: false } : (val as StaffAssignment);
          if (!person.name || person.name.trim() === '') return;

          const [mId, roleRaw] = key.split('_');
          const role = roleRaw as keyof typeof roleStats;
          
          if (!roleStats[role]) return;

          let h = 0;
          if (mId === 'M3' && (role === 'GESTIONNAIRE' || role === 'PREPARATEUR')) {
               const h3 = getMachineHours(plan.date, plan.team, 'M3');
               const h4 = getMachineHours(plan.date, plan.team, 'M4');
               h = Math.max(h3, h4);
          } else if (mId === 'M5' && (role === 'GESTIONNAIRE' || role === 'PREPARATEUR')) {
               const h5 = getMachineHours(plan.date, plan.team, 'M5');
               const h6 = getMachineHours(plan.date, plan.team, 'M6');
               h = Math.max(h5, h6);
          } else if (mId === 'PAC') {
             h = getMachineHours(plan.date, plan.team, 'PAC');
          } else {
             h = getMachineHours(plan.date, plan.team, mId);
          }

          if (person.isInterim) {
              roleStats[role].intUnique.add(person.name);
              roleStats[role].intHours += h;
          } else {
              roleStats[role].salUnique.add(person.name);
              roleStats[role].salHours += h;
          }
      });
  });

  const handlePrint = () => {
    setPrintError(null);
    try {
        window.print();
    } catch (e) {
        console.error(e);
        setPrintError("L'impression est bloquée par votre navigateur (Sandbox). Essayez d'ouvrir l'application dans un nouvel onglet.");
    }
  };

  // --- RENDER FUNCTIONS ---

  const renderRoleBreakdown = () => {
      const roles = Object.keys(roleStats) as (keyof typeof roleStats)[];
      let totalSalHours = 0;
      let totalIntHours = 0;

      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6 avoid-break">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2 bg-indigo-50">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-800">Détail Répartition par Rôle & Statut</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 border-r">Poste</th>
                            <th className="px-4 py-3 text-center border-r bg-blue-50/50 text-blue-800" colSpan={2}>Salariés</th>
                            <th className="px-4 py-3 text-center border-r bg-orange-50/50 text-orange-800" colSpan={2}>Intérimaires</th>
                            <th className="px-4 py-3 text-right bg-gray-100 font-bold">Total Heures</th>
                            <th className="px-4 py-3 text-right bg-gray-100 font-bold text-orange-600">% Intérim</th>
                        </tr>
                        <tr className="border-b">
                            <th className="px-4 py-2 border-r"></th>
                            <th className="px-2 py-2 text-center text-xs text-gray-400 bg-blue-50/30">Effectif</th>
                            <th className="px-2 py-2 text-center text-xs text-gray-400 border-r bg-blue-50/30">Heures</th>
                            <th className="px-2 py-2 text-center text-xs text-gray-400 bg-orange-50/30">Effectif</th>
                            <th className="px-2 py-2 text-center text-xs text-gray-400 border-r bg-orange-50/30">Heures</th>
                            <th colSpan={2} className="bg-gray-50"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {roles.map(role => {
                            const data = roleStats[role];
                            const totalH = data.salHours + data.intHours;
                            const intPercent = totalH > 0 ? (data.intHours / totalH) * 100 : 0;
                            totalSalHours += data.salHours;
                            totalIntHours += data.intHours;

                            return (
                                <tr key={role} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-bold text-gray-800 border-r">{role === 'PIMA' ? 'Pilote/Opérateur' : role.charAt(0) + role.slice(1).toLowerCase()}</td>
                                    <td className="px-4 py-3 text-center font-medium text-blue-700 bg-blue-50/10">{data.salUnique.size} p.</td>
                                    <td className="px-4 py-3 text-center text-gray-600 border-r bg-blue-50/10">{data.salHours.toFixed(1)} h</td>
                                    <td className="px-4 py-3 text-center font-medium text-orange-700 bg-orange-50/10">{data.intUnique.size} p.</td>
                                    <td className="px-4 py-3 text-center text-gray-600 border-r bg-orange-50/10">{data.intHours.toFixed(1)} h</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-800 bg-gray-50">{totalH.toFixed(1)} h</td>
                                    <td className="px-4 py-3 text-right font-bold text-orange-600 bg-gray-50">{intPercent.toFixed(1)}%</td>
                                </tr>
                            )
                        })}
                         <tr className="bg-gray-100 border-t-2 border-gray-200 font-bold">
                            <td className="px-4 py-3 border-r">TOTAL SEMAINE</td>
                            <td className="px-4 py-3 text-center text-blue-800">-</td>
                            <td className="px-4 py-3 text-center text-blue-800 border-r">{totalSalHours.toFixed(1)} h</td>
                            <td className="px-4 py-3 text-center text-orange-800">-</td>
                            <td className="px-4 py-3 text-center text-orange-800 border-r">{totalIntHours.toFixed(1)} h</td>
                            <td className="px-4 py-3 text-right text-gray-900">{(totalSalHours + totalIntHours).toFixed(1)} h</td>
                            <td className="px-4 py-3 text-right text-orange-600">
                                {(totalSalHours + totalIntHours) > 0 ? ((totalIntHours / (totalSalHours + totalIntHours)) * 100).toFixed(1) : 0}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      );
  };

  const renderReportContent = () => (
      <div id="print-report-container" className="bg-white p-8 min-h-screen">
          {/* EN-TETE RAPPORT */}
          <div className="flex justify-between items-end border-b-2 border-brand-900 pb-4 mb-8">
              <div>
                  <h1 className="text-3xl font-bold text-brand-900 flex items-center gap-3">
                      <Activity className="w-8 h-8" /> ProdTrack Pro
                  </h1>
                  <p className="text-gray-500 mt-1">Rapport de Production Hebdomadaire</p>
              </div>
              <div className="text-right">
                  <div className="text-xl font-bold text-gray-800 uppercase">{weekLabel}</div>
                  <div className="text-sm text-gray-500">Généré le {new Date().toLocaleDateString()}</div>
              </div>
          </div>

          {/* SYNTHESE */}
          <div className="mb-8 avoid-break">
               <h2 className="text-lg font-bold text-brand-800 uppercase border-b border-gray-200 pb-2 mb-4">1. Synthèse Globale</h2>
               <div className="grid grid-cols-4 gap-4 mb-6">
                   <div className="p-4 bg-gray-50 border rounded-lg">
                       <div className="text-xs text-gray-500 uppercase">Production BAL</div>
                       <div className="text-2xl font-bold text-gray-900">{totalProducedBal.toLocaleString()}</div>
                       <div className="text-xs text-gray-500">Obj: {totalTargetBal.toLocaleString()}</div>
                   </div>
                   <div className="p-4 bg-gray-50 border rounded-lg">
                       <div className="text-xs text-gray-500 uppercase">Avancement</div>
                       <div className="text-2xl font-bold text-blue-600">{progressPercentBal.toFixed(1)}%</div>
                   </div>
                    <div className="p-4 bg-gray-50 border rounded-lg">
                       <div className="text-xs text-gray-500 uppercase">Équipe Matin</div>
                       <div className="text-xl font-bold text-gray-900">{matinMetrics.producedBal.toLocaleString()}</div>
                       <div className={`text-xs font-bold ${matinMetrics.gapHours >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           {matinMetrics.gapHours > 0 ? '+' : ''}{matinMetrics.gapHours.toFixed(1)} h
                       </div>
                   </div>
                   <div className="p-4 bg-gray-50 border rounded-lg">
                       <div className="text-xs text-gray-500 uppercase">Équipe Soir</div>
                       <div className="text-xl font-bold text-gray-900">{soirMetrics.producedBal.toLocaleString()}</div>
                       <div className={`text-xs font-bold ${soirMetrics.gapHours >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           {soirMetrics.gapHours > 0 ? '+' : ''}{soirMetrics.gapHours.toFixed(1)} h
                       </div>
                   </div>
               </div>
          </div>

          {/* DETAIL MACHINE */}
          <div className="mb-8">
               <h2 className="text-lg font-bold text-brand-800 uppercase border-b border-gray-200 pb-2 mb-4">2. Détail Production par Machine</h2>
               {machineTableData.length === 0 ? (
                   <p className="text-center text-gray-500 italic p-4">Aucune machine active cette semaine.</p>
               ) : (
                   <table className="w-full text-xs border collapse mb-4">
                       <thead>
                           <tr className="bg-gray-100 text-gray-600">
                               <th className="border p-2">Machine</th>
                               <th className="border p-2">Équipe</th>
                               {weekDays.map(d => <th key={d.date} className="border p-2 text-center">{d.label}</th>)}
                               <th className="border p-2 text-right bg-gray-200">Total</th>
                           </tr>
                       </thead>
                       {machineTableData.map(m => (
                           <tbody key={m.id} className="break-inside-avoid border-b-2 border-gray-300">
                               <tr className="border-t border-gray-300">
                                   <td rowSpan={3} className="border p-2 font-bold bg-gray-50 align-top pt-4">
                                       {m.label}
                                       <div className="text-[9px] font-normal text-gray-500 mt-1">Obj: {m.targetBal?.toLocaleString()}</div>
                                   </td>
                                   <td className="border p-1 bg-blue-50 text-blue-800 font-bold">Matin</td>
                                   {m.matinDays.map((d: any) => (
                                       <td key={d.date} className="border p-1 text-center">
                                           <div>{d.bal > 0 ? d.bal.toLocaleString() : '-'}</div>
                                           {d.hours > 0 && <div className="text-[9px] text-gray-500">{Math.round(d.bal/d.hours)} b/h</div>}
                                       </td>
                                   ))}
                                   <td className="border p-1 text-right font-bold bg-gray-50">{m.matinTotal.bal.toLocaleString()}</td>
                               </tr>
                               <tr>
                                   <td className="border p-1 bg-indigo-50 text-indigo-800 font-bold">Soir</td>
                                   {m.soirDays.map((d: any) => (
                                       <td key={d.date} className="border p-1 text-center">
                                           <div>{d.bal > 0 ? d.bal.toLocaleString() : '-'}</div>
                                           {d.hours > 0 && <div className="text-[9px] text-gray-500">{Math.round(d.bal/d.hours)} b/h</div>}
                                       </td>
                                   ))}
                                   <td className="border p-1 text-right font-bold bg-gray-50">{m.soirTotal.bal.toLocaleString()}</td>
                               </tr>
                               <tr className="bg-gray-100 font-bold">
                                   <td className="border p-1">TOTAL</td>
                                   {m.totalDays.map((d: any) => <td key={d.date} className="border p-1 text-center">{d.bal > 0 ? d.bal.toLocaleString() : '-'}</td>)}
                                   <td className="border p-1 text-right bg-gray-200">
                                        <div className="flex flex-col items-end">
                                            <span>{m.grandTotal.bal.toLocaleString()}</span>
                                            <span className={`text-[9px] px-1 rounded ${m.progressBal >= 100 ? 'bg-green-200 text-green-800' : 'bg-gray-300 text-gray-700'}`}>
                                                {m.progressBal.toFixed(1)}%
                                            </span>
                                            <div className={`text-[9px] ${m.grandTotal.gap >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                {m.grandTotal.gap > 0 ? '+' : ''}{m.grandTotal.gap.toFixed(1)} h
                                            </div>
                                        </div>
                                   </td>
                               </tr>
                           </tbody>
                       ))}
                   </table>
               )}
          </div>

          <div className="page-break"></div>

          {/* ANALYSE RH */}
          <div className="mb-8">
               <h2 className="text-lg font-bold text-brand-800 uppercase border-b border-gray-200 pb-2 mb-4">3. Analyse Ressources Humaines (Synthèse)</h2>
               {renderRoleBreakdown()}
          </div>

          {/* SIGNATURES */}
          <div className="grid grid-cols-3 gap-8 mt-12 border-t pt-8 avoid-break">
              <div className="border rounded h-32 p-4">
                  <p className="text-xs text-gray-500 uppercase font-bold">Chef d'Équipe Matin</p>
              </div>
              <div className="border rounded h-32 p-4">
                  <p className="text-xs text-gray-500 uppercase font-bold">Chef d'Équipe Soir</p>
              </div>
              <div className="border rounded h-32 p-4 bg-gray-50">
                   <p className="text-xs text-gray-500 uppercase font-bold">Validation Direction</p>
              </div>
          </div>
      </div>
  );

  return (
    <>
    {/* ------------------------------------------------------------------------------------ */}
    {/* CONTROLS BAR - ALWAYS VISIBLE ON SCREEN (no-print) */}
    {/* ------------------------------------------------------------------------------------ */}
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div className="flex-1 w-full md:w-auto">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Semaine Sélectionnée</label>
            <div className="relative">
                <select
                    value={selectedWeekId}
                    onChange={(e) => onSelectWeek(e.target.value)}
                    className={`appearance-none w-full pl-4 pr-10 py-2.5 rounded-lg border font-semibold text-gray-800 focus:ring-2 focus:ring-brand-500 cursor-pointer ${readOnly ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-300'}`}
                >
                    <optgroup label="En Cours & Futur">
                        {weekOptions.filter(o => o.type !== 'ARCHIVE').map(o => (
                            <option key={o.id} value={o.id}>
                                {o.type === 'CURRENT' ? '🟢' : '🚀'} {o.label}
                            </option>
                        ))}
                    </optgroup>
                    <optgroup label="Historique (Lecture Seule)">
                            {weekOptions.filter(o => o.type === 'ARCHIVE').length === 0 && <option disabled>Aucune archive</option>}
                            {weekOptions.filter(o => o.type === 'ARCHIVE').map(o => (
                            <option key={o.id} value={o.id}>
                                🗂️ {o.label}
                            </option>
                        ))}
                    </optgroup>
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {printError && (
                <div className="text-red-500 text-xs font-bold flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> {printError}
                </div>
            )}
            
            {onTogglePreview && (
                <button 
                    onClick={() => setShowReportOnScreen(!showReportOnScreen)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors shadow-sm ${
                        showReportOnScreen 
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                        : 'bg-white text-brand-700 border-brand-200 hover:bg-brand-50'
                    }`}
                >
                    {showReportOnScreen ? <X className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    <span className="hidden md:inline font-bold">{showReportOnScreen ? "Fermer Rapport" : "Voir Rapport PDF"}</span>
                </button>
            )}
            {onTogglePreview && (
                <button 
                    onClick={onTogglePreview}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Plein Écran"
                >
                    <Eye className="w-4 h-4" />
                    <span className="hidden md:inline">Aperçu</span>
                </button>
            )}
            <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
            >
                <FileDown className="w-4 h-4" />
                <span className="hidden md:inline">Imprimer / PDF</span>
            </button>
        </div>
    </div>


    {/* ------------------------------------------------------------------------------------ */}
    {/* VUE ECRAN (INTERACTIVE) - Visible only if NOT showReportOnScreen */}
    {/* ------------------------------------------------------------------------------------ */}
    <div className={`space-y-8 ${showReportOnScreen ? 'hidden' : 'print:hidden'}`}>
        
        {/* INFO GLOBALE */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 shadow-sm">
         <h3 className="text-indigo-900 font-bold text-lg mb-4 flex items-center gap-2">
            <Info className="w-5 h-5" /> Informations & Prévisions Semaine
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm col-span-1">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                    <FileText className="w-3 h-3 text-indigo-400" /> Volume (Docs)
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-800">{globalForecasts.totalVolume > 0 ? globalForecasts.totalVolume.toLocaleString() : '-'}</span>
                    <span className="text-[10px] text-gray-400">Prévu global</span>
                </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm col-span-1">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                    <Layers className="w-3 h-3 text-indigo-400" /> Total BAL
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-bold text-gray-800">{globalForecasts.predictedBal > 0 ? globalForecasts.predictedBal.toLocaleString() : '-'}</span>
                    <span className="text-[10px] text-gray-400">Prévu global</span>
                </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm col-span-1">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                    <Scale className="w-3 h-3 text-indigo-400" /> Poids (kg)
                </div>
                <div className="flex flex-col">
                     <span className="text-xl font-bold text-gray-800">{globalForecasts.totalWeight > 0 ? globalForecasts.totalWeight.toLocaleString() : '-'}</span>
                     <span className="text-[10px] text-gray-400">Prévu global</span>
                </div>
            </div>
             <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm col-span-1">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                    <Box className="w-3 h-3 text-indigo-400" /> Docs / Poignée
                </div>
                <div className="flex flex-col">
                     <span className="text-xl font-bold text-gray-800">{globalForecasts.maxDocsPerHandful > 0 ? globalForecasts.maxDocsPerHandful.toLocaleString() : '-'}</span>
                     <span className="text-[10px] text-gray-400">Max</span>
                </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm col-span-1">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                    <Scale className="w-3 h-3 text-indigo-400" /> Poids / Poignée
                </div>
                <div className="flex flex-col">
                     <span className="text-xl font-bold text-gray-800">{globalForecasts.maxWeightPerHandful > 0 ? globalForecasts.maxWeightPerHandful.toLocaleString() + ' g' : '-'}</span>
                     <span className="text-[10px] text-gray-400">Max</span>
                </div>
            </div>
         </div>
      </div>

      {/* KPI & PERFORMANCE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Production BAL Globale
          </h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-3xl font-bold text-brand-900">{totalProducedBal.toLocaleString()}</span>
            <span className="text-sm text-gray-400 mb-1">/ {totalTargetBal.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className="bg-brand-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, progressPercentBal)}%` }}></div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">{progressPercentBal.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="text-blue-600 text-sm font-bold mb-4 flex items-center gap-2 uppercase">
            <Clock className="w-4 h-4" /> Équipe Matin
          </h3>
          <div className="flex justify-between items-center mb-2">
              <span className="text-2xl font-bold text-gray-800">{matinMetrics.producedBal.toLocaleString()} <span className="text-xs text-gray-400 font-normal">BAL</span></span>
              <div className={`px-2 py-1 rounded text-xs font-bold ${matinMetrics.gapHours >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {matinMetrics.gapHours > 0 ? '+' : ''}{matinMetrics.gapHours.toFixed(1)} h
              </div>
          </div>
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t flex justify-between">
              <span>Cadence Moy: <strong>{matinMetrics.avgCadence}</strong></span>
              <span>Heures: <strong>{matinMetrics.hours.toFixed(1)}</strong></span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="text-indigo-600 text-sm font-bold mb-4 flex items-center gap-2 uppercase">
            <Clock className="w-4 h-4" /> Équipe Soir
          </h3>
          <div className="flex justify-between items-center mb-2">
              <span className="text-2xl font-bold text-gray-800">{soirMetrics.producedBal.toLocaleString()} <span className="text-xs text-gray-400 font-normal">BAL</span></span>
              <div className={`px-2 py-1 rounded text-xs font-bold ${soirMetrics.gapHours >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {soirMetrics.gapHours > 0 ? '+' : ''}{soirMetrics.gapHours.toFixed(1)} h
              </div>
          </div>
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t flex justify-between">
              <span>Cadence Moy: <strong>{soirMetrics.avgCadence}</strong></span>
              <span>Heures: <strong>{soirMetrics.hours.toFixed(1)}</strong></span>
          </div>
        </div>
      </div>

      {/* GRAPH: HISTOGRAMME PRODUCTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Performance Production par Machine
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} />
                    <Legend />
                    <Bar dataKey="Réalisé" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Objectif" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* DETAILED PRODUCTION TABLE (SCREEN VERSION) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Table className="w-5 h-5 text-brand-600" />
                Suivi Détaillé par Machine (Matin/Soir)
            </h3>
        </div>
        <div className="overflow-x-auto">
            {activeMachineIds.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    Aucune machine active. <br />
                    Veuillez activer des machines dans l'onglet "Objectifs Semaine" pour voir le détail.
                </div>
            ) : (
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 min-w-[120px]">Machine</th>
                            <th className="px-4 py-3">Équipe</th>
                            {weekDays.map(d => <th key={d.date} className="px-2 py-3 text-center">{d.label}</th>)}
                            <th className="px-4 py-3 text-right bg-gray-100 font-bold">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {machineTableData.map(m => (
                            <React.Fragment key={m.id}>
                                {/* LIGNE MATIN */}
                                <tr className="border-t border-gray-200 hover:bg-gray-50">
                                    <td rowSpan={3} className="px-4 py-3 font-bold text-gray-800 border-r align-top pt-4">
                                        <div className="flex items-center gap-2">
                                            {m.label}
                                            {configs[m.id]?.active ? <span className="w-2 h-2 rounded-full bg-green-500"></span> : <span className="w-2 h-2 rounded-full bg-gray-300"></span>}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1 font-normal">Obj: {m.targetBal?.toLocaleString()}</div>
                                    </td>
                                    <td className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50/30">MATIN</td>
                                    {m.matinDays.map((d: any) => (
                                        <td key={d.date} className="px-2 py-2 text-center align-top">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-bold ${d.bal > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{d.bal > 0 ? d.bal.toLocaleString() : '-'}</span>
                                                {d.hours > 0 && <span className="text-[10px] text-gray-500">{Math.round(d.bal/d.hours)} b/h</span>}
                                                {d.gap !== 0 && (
                                                    <span className={`text-[10px] px-1 rounded mt-1 ${d.gap >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {d.gap > 0 ? '+' : ''}{d.gap.toFixed(1)}h
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right font-bold text-gray-800 bg-gray-50">
                                        {m.matinTotal.bal.toLocaleString()}
                                        <div className={`text-[10px] ${m.matinTotal.gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.matinTotal.gap > 0 ? '+' : ''}{m.matinTotal.gap.toFixed(1)} h
                                        </div>
                                    </td>
                                </tr>
                                {/* LIGNE SOIR */}
                                <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50/30">SOIR</td>
                                    {m.soirDays.map((d: any) => (
                                        <td key={d.date} className="px-2 py-2 text-center align-top">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-bold ${d.bal > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{d.bal > 0 ? d.bal.toLocaleString() : '-'}</span>
                                                {d.hours > 0 && <span className="text-[10px] text-gray-500">{Math.round(d.bal/d.hours)} b/h</span>}
                                                {d.gap !== 0 && (
                                                    <span className={`text-[10px] px-1 rounded mt-1 ${d.gap >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {d.gap > 0 ? '+' : ''}{d.gap.toFixed(1)}h
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right font-bold text-gray-800 bg-gray-50">
                                        {m.soirTotal.bal.toLocaleString()}
                                         <div className={`text-[10px] ${m.soirTotal.gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {m.soirTotal.gap > 0 ? '+' : ''}{m.soirTotal.gap.toFixed(1)} h
                                        </div>
                                    </td>
                                </tr>
                                {/* LIGNE TOTAL */}
                                <tr className="bg-gray-100 font-bold border-b-2 border-gray-200">
                                    <td className="px-4 py-2 text-xs text-gray-500 uppercase">Total</td>
                                    {m.totalDays.map((d: any) => (
                                        <td key={d.date} className="px-2 py-2 text-center text-gray-800">
                                            {d.bal > 0 ? d.bal.toLocaleString() : '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-right text-brand-900 text-lg bg-gray-200">
                                        <div className="flex flex-col items-end">
                                            <span>{m.grandTotal.bal.toLocaleString()}</span>
                                            <span className={`text-[10px] px-1 rounded ${m.progressBal >= 100 ? 'bg-green-200 text-green-800' : 'bg-white/50 text-gray-600 border border-gray-300'}`}>
                                                {m.progressBal.toFixed(1)}%
                                            </span>
                                            <div className={`text-xs ${m.grandTotal.gap >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                {m.grandTotal.gap > 0 ? '+' : ''}{m.grandTotal.gap.toFixed(1)} h
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>

      {/* HR ANALYSIS SECTION */}
      {renderRoleBreakdown()}
    
    </div>

    {/* ------------------------------------------------------------------------------------ */}
    {/* VUE RAPPORT PDF (MASQUEE ECRAN, VISIBLE PRINT OU PREVIEW) */}
    {/* ------------------------------------------------------------------------------------ */}
    <div className={`hidden print:block ${showReportOnScreen ? '!block' : ''}`}>
        {renderReportContent()}
    </div>
    </>
  );
};

export default Dashboard;
