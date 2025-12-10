
import React, { useState, useEffect, useMemo } from 'react';
import { MachineId, TeamType, MACHINE_LABELS, PlanningAssignment, RoleType, StaffAssignment, StaffMember } from '../types';
import { User, HardHat, Printer, Eye, HeartPulse, Flag, ShieldCheck, Plus, X, CheckCircle2, Repeat, CalendarDays, ArrowRightToLine, AlertTriangle, Lock, Copy, CopyPlus } from 'lucide-react';

interface StaffPlanningProps {
  planning: PlanningAssignment[];
  savePlanning: (assignment: PlanningAssignment | PlanningAssignment[]) => void;
  activeMachineIds: MachineId[];
  staffList: StaffMember[];
  onTogglePreview?: () => void;
  initialDate?: string;
  readOnly?: boolean; // New Prop for History Mode
}

type PropagationMode = 'WEEK' | 'DAY' | 'FUTURE';

const StaffPlanning: React.FC<StaffPlanningProps> = ({ planning, savePlanning, activeMachineIds, staffList, onTogglePreview, initialDate, readOnly = false }) => {
  // Helper for safe local dates (YYYY-MM-DD)
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  // Date helpers that avoid Timezone issues
  const parseDate = (str: string) => {
      if(!str) return new Date();
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d);
  };
  
  const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };

  // Helper to add days to a date string YYYY-MM-DD
  const addDays = (dateStr: string, days: number) => {
      const d = parseDate(dateStr);
      d.setDate(d.getDate() + days);
      return formatDate(d);
  };

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getTodayStr());
  const [selectedTeam, setSelectedTeam] = useState<TeamType>('MATIN');
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [weekStart, setWeekStart] = useState<string>('');
  const [printError, setPrintError] = useState<string | null>(null);
  
  // NOUVEAU : Mode de propagation
  const [propagationMode, setPropagationMode] = useState<PropagationMode>('WEEK');
  
  // State to manually show the optional 2nd preparer input even if empty
  const [manualVisiblePreps, setManualVisiblePreps] = useState<string[]>([]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize weekStart on mount or prop change
  useEffect(() => {
      const targetDate = initialDate ? parseDate(initialDate) : new Date();
      if (initialDate) setSelectedDate(initialDate);
      
      const monday = getMonday(targetDate);
      setWeekStart(formatDate(monday));
  }, [initialDate]);

  // Helper pour savoir si on est au début du shift
  const isStartOfShift = (dateStr: string, team: TeamType) => {
      const d = parseDate(dateStr);
      const day = d.getDay(); // 0=Sun, 1=Mon, 2=Tue...
      if (team === 'MATIN') return day === 2; // Mardi
      if (team === 'SOIR') return day === 1; // Lundi
      return false; // Autre jour
  };

  // -- REGLE METIER : Changement automatique de jour selon l'équipe --
  const handleTeamChange = (newTeam: TeamType) => {
      setSelectedTeam(newTeam);
      
      const currentMonday = parseDate(weekStart);
      let targetDate = new Date(currentMonday);

      if (newTeam === 'MATIN') {
          // Mardi
          targetDate.setDate(currentMonday.getDate() + 1);
      } else {
          // Lundi
          targetDate.setDate(currentMonday.getDate() + 0);
      }
      
      // Reset mode to WEEK when switching team (going back to start)
      setPropagationMode('WEEK');
      setSelectedDate(formatDate(targetDate));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDateStr = e.target.value;
      if (!newDateStr) return;
      
      setSelectedDate(newDateStr);
      
      // Update weekStart immediately when changing date
      const dateObj = parseDate(newDateStr);
      const monday = getMonday(dateObj);
      setWeekStart(formatDate(monday));

      // SMART MODE SWITCHING
      if (isStartOfShift(newDateStr, selectedTeam)) {
          setPropagationMode('WEEK');
      } else {
          setPropagationMode('FUTURE');
      }
  };

  // NEW: Week Start Change Handler
  const handleWeekStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newMonday = e.target.value;
      setWeekStart(newMonday);
      
      const mondayDate = parseDate(newMonday);
      const targetDate = new Date(mondayDate);
      if (selectedTeam === 'MATIN') targetDate.setDate(targetDate.getDate() + 1); // Mardi
      
      setSelectedDate(formatDate(targetDate));
  };

  const handlePrint = () => {
      setPrintError(null);
      try {
          window.print();
      } catch (e) {
          console.error(e);
          setPrintError("L'impression est bloquée par votre navigateur (Sandbox). Essayez d'ouvrir l'application dans un nouvel onglet.");
      }
  };

  // Helper to generate dates for the selected week/team
  const getWeekDates = () => {
      if (!weekStart) return [];
      const dates = [];
      const monday = parseDate(weekStart);
      
      const offsets = selectedTeam === 'MATIN' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
      
      for (const off of offsets) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + off);
          dates.push({
              date: formatDate(d),
              label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
              obj: d
          });
      }
      return dates;
  };

  const currentAssignment = planning.find(p => p.date === selectedDate && p.team === selectedTeam) || {
    date: selectedDate,
    team: selectedTeam,
    assignments: {}
  };

  // --- LOGIQUE DE FILTRAGE DES DOUBLONS ---
  // On calcule la liste des personnes déjà assignées ce jour là pour cette équipe
  const assignedNamesSet = useMemo(() => {
      const names = new Set<string>();
      if (!currentAssignment) return names;

      Object.values(currentAssignment.assignments).forEach((val: any) => {
          const assignment = typeof val === 'string' ? { name: val } : val;
          if (assignment?.name && assignment.name.trim() !== '') {
              names.add(assignment.name.toLowerCase().trim());
          }
      });
      return names;
  }, [currentAssignment]);

  // --- LOGIQUE DE PROPAGATION INTELLIGENTE ---
  const propagateChange = (key: string, newItem: StaffAssignment) => {
      if (readOnly) return; 

      const weekDates = getWeekDates();
      const updates: PlanningAssignment[] = [];
      
      const targetDate = selectedDate;

      weekDates.forEach(d => {
          let shouldUpdate = false;

          if (propagationMode === 'WEEK') {
              shouldUpdate = true;
          } else if (propagationMode === 'DAY') {
              shouldUpdate = d.date === selectedDate;
          } else if (propagationMode === 'FUTURE') {
              shouldUpdate = d.date >= targetDate;
          }

          if (shouldUpdate) {
              const existingPlan = planning.find(p => p.date === d.date && p.team === selectedTeam);
              const prevAssignments = existingPlan ? { ...existingPlan.assignments } : {}; // Shallow copy
              
              // Deep copy of the new item to prevent reference sharing
              const itemCopy = JSON.parse(JSON.stringify(newItem));

              const newAssignments = {
                  ...prevAssignments,
                  [key]: itemCopy
              };

              updates.push({
                  date: d.date,
                  team: selectedTeam,
                  assignments: newAssignments
              });
          }
      });

      savePlanning(updates);
  };

  // --- PROPAGATION MANUELLE (BOUTON COPY) ---
  const handleManualPropagate = () => {
      if (readOnly) return;
      
      const sourceAssignments = currentAssignment.assignments;
      
      // Check if source is empty (Security)
      const hasContent = Object.values(sourceAssignments).some((val: any) => {
         const v = typeof val === 'string' ? { name: val } : val;
         return v?.name && v.name.trim() !== '';
      });

      if (!hasContent) {
          if (!window.confirm("⚠️ ATTENTION : La journée actuelle est VIDE.\n\nSi vous continuez, vous allez EFFACER le planning de toute la semaine pour cette équipe.\n\nVoulez-vous vraiment tout effacer ?")) {
              return;
          }
      } else {
           if (!window.confirm(`Copier la configuration du ${new Date(selectedDate).toLocaleDateString('fr-FR')} sur TOUTE la semaine ?`)) {
              return;
           }
      }

      const weekDates = getWeekDates();
      const updates: PlanningAssignment[] = [];

      weekDates.forEach(d => {
          // Skip source date (no need to overwrite itself)
          if (d.date === selectedDate) return;

          // Deep Clone Assignments
          const clonedAssignments = JSON.parse(JSON.stringify(sourceAssignments));
          
          updates.push({
              date: d.date,
              team: selectedTeam,
              assignments: clonedAssignments
          });
      });

      savePlanning(updates);
      setSuccessMsg("Configuration copiée avec succès !");
      setTimeout(() => setSuccessMsg(null), 3000);
  };

  // --- COPIE SEMAINE PRECEDENTE (AMÉLIORÉE) ---
  const handleCopyPreviousWeek = () => {
      if (readOnly) return;

      // 1. Définition des bornes de la semaine précédente
      const currMon = parseDate(weekStart); // Lundi de la semaine affichée
      
      const prevMonDate = new Date(currMon);
      prevMonDate.setDate(prevMonDate.getDate() - 7); // Lundi précédent
      const prevMonStr = formatDate(prevMonDate);
      
      const prevSunDate = new Date(prevMonDate);
      prevSunDate.setDate(prevSunDate.getDate() + 6); // Dimanche précédent
      const prevSunStr = formatDate(prevSunDate);

      // 2. Demande de confirmation
      if (!window.confirm(`Importer le planning de la semaine précédente ?\n\nSource : Semaine du ${prevMonDate.toLocaleDateString()} (Équipe ${selectedTeam})\nCible : Semaine du ${currMon.toLocaleDateString()}\n\n⚠️ Cela écrasera les données actuelles de la semaine cible.`)) {
          return;
      }

      // 3. Récupération des données (Filtrage robuste sur chaîne YYYY-MM-DD)
      const sourceAssignments = planning.filter(p => {
          return p.date >= prevMonStr && p.date <= prevSunStr && p.team === selectedTeam;
      });

      // 4. Vérification
      if (sourceAssignments.length === 0) {
          alert(`Aucune donnée trouvée pour l'équipe ${selectedTeam} sur la semaine précédente (du ${prevMonDate.toLocaleDateString()} au ${prevSunDate.toLocaleDateString()}).\n\nVérifiez que vous avez bien saisi des données sur la semaine précédente.`);
          return;
      }

      // 5. Préparation de la copie
      const updates: PlanningAssignment[] = [];
      sourceAssignments.forEach(src => {
          // On ajoute exactement 7 jours à la date source
          const d = parseDate(src.date);
          d.setDate(d.getDate() + 7);
          const newDateStr = formatDate(d);

          updates.push({
              date: newDateStr,
              team: src.team,
              assignments: JSON.parse(JSON.stringify(src.assignments)) // Copie profonde
          });
      });

      // 6. Sauvegarde
      savePlanning(updates);
      setSuccessMsg(`${updates.length} jours importés avec succès !`);
      setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleNameChange = (key: string, nameValue: string) => {
     if (readOnly) return;
     const staffMember = staffList.find(s => s.name.toLowerCase() === nameValue.toLowerCase());
     
     const prev = currentAssignment.assignments[key] || { name: '', isInterim: false };
     const newIsInterim = staffMember ? staffMember.isInterim : prev.isInterim;
     
     const newItem = { ...prev, name: nameValue, isInterim: newIsInterim };
     
     propagateChange(key, newItem);
  };

  const handleStatusChange = (key: string, isInterim: boolean) => {
      if (readOnly) return;
      const prev = currentAssignment.assignments[key] || { name: '', isInterim: false };
      const newItem = { ...prev, isInterim };
      
      propagateChange(key, newItem);
  };

  const getAssignment = (key: string, assignments: Record<string, any>): StaffAssignment => {
    const val = assignments[key];
    if (!val) return { name: '', isInterim: false };
    if (typeof val === 'string') return { name: val, isInterim: false };
    return val;
  };

  const renderQualifications = (name: string) => {
      if (!name) return null;
      const staff = staffList.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (!staff) return null;

      const hasQualif = staff.isSecouriste || staff.isGuideFile || staff.isSerreFile;
      if (!hasQualif) return null;

      return (
          <div className="flex gap-2 mt-1.5 justify-center">
              {staff.isSecouriste && (
                  <span title="Secouriste" className="flex items-center justify-center w-6 h-6 bg-red-100 border border-red-300 rounded text-red-700 shadow-sm print:bg-red-100 print:text-red-700">
                      <HeartPulse className="w-4 h-4" strokeWidth={3} />
                  </span>
              )}
              {staff.isGuideFile && (
                  <span title="Guide File" className="flex items-center justify-center w-6 h-6 bg-green-100 border border-green-300 rounded text-green-700 shadow-sm print:bg-green-100 print:text-green-700">
                      <Flag className="w-4 h-4" strokeWidth={3} />
                  </span>
              )}
              {staff.isSerreFile && (
                  <span title="Serre File" className="flex items-center justify-center w-6 h-6 bg-gray-100 border border-gray-300 rounded text-gray-700 shadow-sm print:bg-gray-100 print:text-gray-700">
                      <ShieldCheck className="w-4 h-4" strokeWidth={3} />
                  </span>
              )}
          </div>
      );
  };

  const renderInput = (machineId: MachineId, role: RoleType, index: number = 0, isShared: boolean = false, sharedLabel?: string) => {
    const key = `${machineId}_${role}_${index}`;
    const data = getAssignment(key, currentAssignment.assignments);
    
    let displayLabel = role as string;
    if (isShared) displayLabel = sharedLabel || role;
    else if (role === 'PIMA') displayLabel = 'Pilote/Opérateur';
    
    return (
      <div className={`flex flex-col ${isShared ? 'h-full justify-center bg-brand-50 rounded-md p-1' : ''}`}>
        <label className="text-xs text-gray-500 mb-1 font-medium flex justify-between">
            <span>{displayLabel}</span>
            {data.name && (
                <span className={`text-[10px] px-1 rounded ${data.isInterim ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                    {data.isInterim ? 'I' : 'S'}
                </span>
            )}
        </label>
        <div className="relative flex items-center gap-1">
            <div className="relative flex-1">
                <User className="w-3 h-3 absolute left-2 top-2.5 text-gray-400" />
                <input 
                    type="text" 
                    list={readOnly ? undefined : "staff-list"} // Disable list in readOnly
                    value={data.name}
                    onChange={(e) => handleNameChange(key, e.target.value)}
                    disabled={readOnly}
                    className={`w-full text-sm py-1.5 pl-7 pr-2 border rounded-md focus:ring-brand-500 focus:border-brand-500 ${isShared ? 'border-brand-200 bg-white' : 'border-gray-200'} ${data.isInterim ? 'border-orange-300 ring-orange-100' : ''} ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                    placeholder={readOnly ? '' : "Nom..."}
                />
            </div>
            {!readOnly && (
                <button
                    title={data.isInterim ? "Marquer comme Salarié" : "Marquer comme Intérimaire"}
                    onClick={() => handleStatusChange(key, !data.isInterim)}
                    className={`p-1.5 rounded-md border transition-colors ${
                        data.isInterim 
                        ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100' 
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                    }`}
                >
                    <HardHat className="w-4 h-4" />
                </button>
            )}
        </div>
        <div className="min-h-[24px]">
             {renderQualifications(data.name)}
        </div>
      </div>
    );
  };

  const isPairActive = (m1: MachineId, m2: MachineId) => {
      return activeMachineIds.includes(m1) || activeMachineIds.includes(m2);
  };

  const toggleSecondPrep = (key: string) => {
      if (readOnly) return;
      if (manualVisiblePreps.includes(key)) {
          setManualVisiblePreps(prev => prev.filter(x => x !== key));
      } else {
          setManualVisiblePreps(prev => [...prev, key]);
      }
  }

  const renderWeeklyTable = () => {
    const weekDates = getWeekDates();
    const rows: { label: string, key: string, isShared?: boolean }[] = [];
    
    const hasSecondPrep = (baseKey: string) => {
        return weekDates.some(d => {
            const plan = planning.find(p => p.date === d.date && p.team === selectedTeam);
            if (!plan) return false;
            return !!getAssignment(`${baseKey}_1`, plan.assignments).name;
        });
    };

    activeMachineIds.forEach(m => {
        if (m === 'M1' || m === 'M2') {
             rows.push({ label: `${MACHINE_LABELS[m]} - Pilote/Opérateur`, key: `${m}_PIMA_0` });
             rows.push({ label: `${MACHINE_LABELS[m]} - Opérateur`, key: `${m}_OPERATEUR_0` });
             rows.push({ label: `${MACHINE_LABELS[m]} - Gestionnaire`, key: `${m}_GESTIONNAIRE_0` });
             rows.push({ label: `${MACHINE_LABELS[m]} - Préparateur`, key: `${m}_PREPARATEUR_0` });
        } else if (m === 'M3' || m === 'M4' || m === 'M5' || m === 'M6') {
             rows.push({ label: `${MACHINE_LABELS[m]} - Pilote/Opérateur`, key: `${m}_PIMA_0` });
             rows.push({ label: `${MACHINE_LABELS[m]} - Opérateur`, key: `${m}_OPERATEUR_0` });
             
             if (m === 'M3') {
                rows.push({ label: `M3/M4 - Gestionnaire`, key: `M3_GESTIONNAIRE_0`, isShared: true });
                rows.push({ label: `M3/M4 - Préparateur 1`, key: `M3_PREPARATEUR_0`, isShared: true });
                if (hasSecondPrep('M3_PREPARATEUR')) {
                    rows.push({ label: `M3/M4 - Préparateur 2`, key: `M3_PREPARATEUR_1`, isShared: true });
                }
             } else if (m === 'M5') {
                rows.push({ label: `M5/M6 - Gestionnaire`, key: `M5_GESTIONNAIRE_0`, isShared: true });
                rows.push({ label: `M5/M6 - Préparateur 1`, key: `M5_PREPARATEUR_0`, isShared: true });
                if (hasSecondPrep('M5_PREPARATEUR')) {
                    rows.push({ label: `M5/M6 - Préparateur 2`, key: `M5_PREPARATEUR_1`, isShared: true });
                }
             }
        } else if (m === 'PAC') {
             rows.push({ label: `PAC - Opérateur`, key: `PAC_OPERATEUR_0` });
             rows.push({ label: `PAC - Préparateur`, key: `PAC_PREPARATEUR_0` });
        }
    });

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        <th className="border bg-gray-100 p-2 text-left w-48">Poste</th>
                        {weekDates.map(d => (
                            <th key={d.date} className="border bg-gray-100 p-2 text-center min-w-[100px]">{d.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={idx} className={row.isShared ? "bg-brand-50/30" : ""}>
                            <td className="border p-2 font-medium">{row.label}</td>
                            {weekDates.map(d => {
                                const plan = planning.find(p => p.date === d.date && p.team === selectedTeam);
                                const assignment = plan ? getAssignment(row.key, plan.assignments) : { name: '', isInterim: false };
                                return (
                                    <td key={d.date} className="border p-2 text-center relative group align-top h-14">
                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold text-gray-800">{assignment.name}</span>
                                                {assignment.name && (
                                                    <span className={`text-[9px] px-1 rounded ${assignment.isInterim ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {assignment.isInterim ? 'I' : 'S'}
                                                    </span>
                                                )}
                                            </div>
                                            {renderQualifications(assignment.name)}
                                        </div>
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="space-y-6 print-stack">
      {!readOnly && (
          <datalist id="staff-list">
            {staffList
                .filter(s => !s.isAbsent)
                // NEW: FILTER OUT STAFF ALREADY ASSIGNED THIS DAY/TEAM
                .filter(s => !assignedNamesSet.has(s.name.toLowerCase().trim()))
                .map(staff => (
                    <option key={staff.id} value={staff.name}>{staff.defaultRole} {staff.assignedTeam ? `- EQ${staff.assignedTeam}` : ''}</option>
            ))}
          </datalist>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="flex items-center gap-3">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    {readOnly && <Lock className="w-5 h-5 text-gray-400" />}
                    Planning Équipe
                </h2>
                <p className="text-sm text-gray-500">
                    {readOnly ? "Consultation des affectations archivées." : "Gérez les affectations. Le mode s'adapte automatiquement (Semaine ou Futur)."}
                </p>
            </div>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
            {/* BOUTONS ACTIONS RAPIDES */}
            {!readOnly && (
                <>
                <button 
                    onClick={handleCopyPreviousWeek}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                    title="Importer le planning de la semaine précédente (S-1) pour cette équipe"
                >
                    <CopyPlus className="w-4 h-4" /> Importer S-1
                </button>
                <button 
                    onClick={handleManualPropagate}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                    title="Copier la configuration de CE JOUR sur TOUTE la semaine"
                >
                    <Copy className="w-4 h-4" /> Propager
                </button>
                </>
            )}
            
            {successMsg && (
                 <span className="text-xs font-bold text-green-600 animate-in fade-in slide-in-from-right flex items-center bg-green-50 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3 mr-1"/> {successMsg}
                 </span>
            )}
            
            {printError && (
                <div className="text-red-500 text-xs font-bold flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> {printError}
                </div>
            )}

            <div className="h-6 w-px bg-gray-300 mx-1 hidden md:block"></div>

            <div className="flex bg-gray-100 rounded-lg p-1">
                <button 
                    onClick={() => setViewMode('daily')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Vue Jour
                </button>
                <button 
                    onClick={() => setViewMode('weekly')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'weekly' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Vue Semaine
                </button>
            </div>
            
            {onTogglePreview && (
                <button 
                    onClick={onTogglePreview}
                    className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                    <Eye className="w-4 h-4" /> Aperçu
                </button>
            )}
            <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
            >
                <Printer className="w-4 h-4" /> Imprimer
            </button>
        </div>
      </div>

      <div className="print:block hidden mb-4">
        <h1 className="text-2xl font-bold">Planning {viewMode === 'daily' ? 'Journalier' : 'Hebdomadaire'} - Équipe {selectedTeam}</h1>
        <p>{viewMode === 'daily' ? `Date: ${selectedDate}` : `Semaine du ${weekStart}`}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SELECTEURS DATE & EQUIPE */}
        <div className="flex gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Équipe</label>
                <select 
                    value={selectedTeam}
                    onChange={(e) => handleTeamChange(e.target.value as TeamType)}
                    className="w-full border-gray-300 rounded-md text-sm focus:ring-brand-500 focus:border-brand-500"
                >
                    <option value="MATIN">Matin (Mar-Sam)</option>
                    <option value="SOIR">Soir (Lun-Ven)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                    {selectedTeam === 'MATIN' ? 'Semaine : Mardi à Samedi' : 'Semaine : Lundi à Vendredi'}
                </p>
            </div>

            {/* Week Selector is always visible now */}
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Semaine du (Lundi)</label>
                <input 
                    type="date" 
                    value={weekStart}
                    onChange={handleWeekStartChange}
                    className="w-full border-gray-300 rounded-md text-sm"
                />
            </div>
            
            {viewMode === 'daily' && (
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jour</label>
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="w-full border-gray-300 rounded-md text-sm"
                    />
                </div>
            )}
        </div>

        {/* SELECTEUR MODE PROPAGATION (HIDDEN IN READ ONLY) */}
        {!readOnly && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm no-print flex flex-col justify-center">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Mode de Saisie</label>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setPropagationMode('WEEK')}
                        className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all ${propagationMode === 'WEEK' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100'}`}
                        title="Copie sur TOUTE la semaine"
                    >
                        <Repeat className="w-4 h-4 mb-1" />
                        Semaine
                    </button>
                    <button 
                        onClick={() => setPropagationMode('DAY')}
                        className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all ${propagationMode === 'DAY' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100'}`}
                        title="Modifie UNIQUEMENT ce jour"
                    >
                        <CalendarDays className="w-4 h-4 mb-1" />
                        Jour Unique
                    </button>
                    <button 
                        onClick={() => setPropagationMode('FUTURE')}
                        className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all ${propagationMode === 'FUTURE' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100'}`}
                        title="Modifie ce jour ET les suivants"
                    >
                        <ArrowRightToLine className="w-4 h-4 mb-1" />
                        Futur
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* ALERT INFO MODE */}
      {!readOnly && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm font-bold no-print transition-colors ${
            propagationMode === 'WEEK' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
            propagationMode === 'FUTURE' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
            'bg-gray-100 text-gray-700 border border-gray-200'
        }`}>
            {propagationMode === 'WEEK' && <Repeat className="w-4 h-4" />}
            {propagationMode === 'FUTURE' && <ArrowRightToLine className="w-4 h-4" />}
            {propagationMode === 'DAY' && <CalendarDays className="w-4 h-4" />}
            
            <span>
                {propagationMode === 'WEEK' && "MODE ACTIF : Vos saisies seront copiées sur TOUTE LA SEMAINE (Mardi-Samedi)."}
                {propagationMode === 'FUTURE' && `MODE ACTIF : Vos saisies modifieront ce jour (${new Date(selectedDate).toLocaleDateString('fr-FR', {weekday: 'long'})}) et les JOURS SUIVANTS.`}
                {propagationMode === 'DAY' && "MODE ACTIF : Vos saisies ne modifieront QUE ce jour."}
            </span>
        </div>
      )}

      {readOnly && (
          <div className="p-3 rounded-lg flex items-center gap-2 text-sm font-bold no-print bg-amber-50 text-amber-800 border border-amber-200">
              <Lock className="w-4 h-4" /> MODE ARCHIVE : Lecture seule. Aucune modification possible.
          </div>
      )}

      <div className="flex flex-wrap items-center gap-6 text-sm bg-gray-50 p-3 rounded-lg border border-gray-200 justify-center print:border-none print:bg-transparent print:justify-start print:px-0 print:py-2 print:gap-8">
          <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Légende :</span>
          <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-red-100 border border-red-300 rounded text-red-700 shadow-sm"><HeartPulse className="w-4 h-4" strokeWidth={3} /></span>
              <span className="font-bold text-gray-700 text-xs">Secouriste</span>
          </div>
          <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-green-100 border border-green-300 rounded text-green-700 shadow-sm"><Flag className="w-4 h-4" strokeWidth={3} /></span>
              <span className="font-bold text-gray-700 text-xs">Guide File</span>
          </div>
          <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-gray-100 border border-gray-300 rounded text-gray-700 shadow-sm"><ShieldCheck className="w-4 h-4" strokeWidth={3} /></span>
              <span className="font-bold text-gray-700 text-xs">Serre File</span>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
        {viewMode === 'weekly' ? (
            <div className="p-4 print:p-0">
                {renderWeeklyTable()}
            </div>
        ) : (
            <div className="divide-y divide-gray-100">
                <div className="grid grid-cols-12 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase py-3 px-4 print:bg-gray-100">
                    <div className="col-span-2">Machine</div>
                    <div className="col-span-10 grid grid-cols-4 gap-4">
                        <div>Pilote/Opérateur</div>
                        <div>Opérateur</div>
                        <div>Gestionnaire</div>
                        <div>Préparateur</div>
                    </div>
                </div>
            {['M1', 'M2'].map((mid) => {
                const id = mid as MachineId;
                if (!activeMachineIds.includes(id)) return null;
                return (
                    <div key={id} className="grid grid-cols-12 items-center py-4 px-4 hover:bg-gray-50 print:break-inside-avoid">
                        <div className="col-span-2 font-bold text-gray-800">{MACHINE_LABELS[id]}</div>
                        <div className="col-span-10 grid grid-cols-4 gap-4">
                            {renderInput(id, 'PIMA')}
                            {renderInput(id, 'OPERATEUR')}
                            {renderInput(id, 'GESTIONNAIRE')}
                            {renderInput(id, 'PREPARATEUR')}
                        </div>
                    </div>
                )
            })}

            {isPairActive('M3', 'M4') && (
                <div className="relative print:break-inside-avoid">
                    {activeMachineIds.includes('M3') && (
                        <div className="grid grid-cols-12 items-center py-4 px-4 hover:bg-gray-50 border-b border-dashed border-gray-200">
                            <div className="col-span-2 font-bold text-gray-800">Machine 3</div>
                            <div className="col-span-10 grid grid-cols-4 gap-4">
                                {renderInput('M3', 'PIMA')}
                                {renderInput('M3', 'OPERATEUR')}
                            </div>
                        </div>
                    )}
                    {activeMachineIds.includes('M4') && (
                        <div className="grid grid-cols-12 items-center py-4 px-4 hover:bg-gray-50">
                            <div className="col-span-2 font-bold text-gray-800">Machine 4</div>
                            <div className="col-span-10 grid grid-cols-4 gap-4">
                                {renderInput('M4', 'PIMA')}
                                {renderInput('M4', 'OPERATEUR')}
                            </div>
                        </div>
                    )}
                    <div className="absolute top-0 right-4 h-full w-[40%] pointer-events-none flex">
                        <div className="w-1/2 h-full p-2 pointer-events-auto flex items-center">
                            <div className="w-full bg-white/80 p-1 rounded shadow-sm border border-gray-100 print:border-none print:shadow-none">
                                {renderInput('M3', 'GESTIONNAIRE', 0, true, 'Gest. (M3/M4)')}
                            </div>
                        </div>
                        <div className="w-1/2 h-full p-2 pointer-events-auto flex flex-col justify-center">
                             {(() => {
                                const hasPrep2 = !!getAssignment('M3_PREPARATEUR_1', currentAssignment.assignments).name;
                                const showPrep2 = hasPrep2 || manualVisiblePreps.includes('M3_PREPARATEUR');

                                return (
                                    <div className="w-full bg-white/80 p-1 rounded shadow-sm border border-gray-100 print:border-none print:shadow-none relative group">
                                         {!readOnly && (
                                            <button 
                                                onClick={() => toggleSecondPrep('M3_PREPARATEUR')}
                                                className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors z-10 no-print"
                                                title={showPrep2 ? "Masquer le 2ème préparateur (si vide)" : "Ajouter un 2ème préparateur"}
                                            >
                                                {showPrep2 ? <X size={14} /> : <Plus size={14} />}
                                            </button>
                                         )}
                                        
                                        <div className="flex flex-col gap-2">
                                            {renderInput('M3', 'PREPARATEUR', 0, true, showPrep2 ? 'Prép. 1 (M3/M4)' : 'Prép. (M3/M4)')}
                                            {showPrep2 && renderInput('M3', 'PREPARATEUR', 1, true, 'Prép. 2 (M3/M4)')}
                                        </div>
                                    </div>
                                )
                             })()}
                        </div>
                    </div>
                </div>
            )}

            {isPairActive('M5', 'M6') && (
                <div className="relative border-t border-gray-200 print:break-inside-avoid">
                    {activeMachineIds.includes('M5') && (
                        <div className="grid grid-cols-12 items-center py-4 px-4 hover:bg-gray-50 border-b border-dashed border-gray-200">
                            <div className="col-span-2 font-bold text-gray-800">Machine 5</div>
                            <div className="col-span-10 grid grid-cols-4 gap-4">
                                {renderInput('M5', 'PIMA')}
                                {renderInput('M5', 'OPERATEUR')}
                            </div>
                        </div>
                    )}
                    {activeMachineIds.includes('M6') && (
                        <div className="grid grid-cols-12 items-center py-4 px-4 hover:bg-gray-50">
                            <div className="col-span-2 font-bold text-gray-800">Machine 6</div>
                            <div className="col-span-10 grid grid-cols-4 gap-4">
                                {renderInput('M6', 'PIMA')}
                                {renderInput('M6', 'OPERATEUR')}
                            </div>
                        </div>
                    )}
                    <div className="absolute top-0 right-4 h-full w-[40%] pointer-events-none flex">
                         <div className="w-1/2 h-full p-2 pointer-events-auto flex items-center">
                            <div className="w-full bg-white/80 p-1 rounded shadow-sm border border-gray-100 print:border-none print:shadow-none">
                                {renderInput('M5', 'GESTIONNAIRE', 0, true, 'Gest. (M5/M6)')}
                            </div>
                        </div>
                        <div className="w-1/2 h-full p-2 pointer-events-auto flex flex-col justify-center">
                             {(() => {
                                const hasPrep2 = !!getAssignment('M5_PREPARATEUR_1', currentAssignment.assignments).name;
                                const showPrep2 = hasPrep2 || manualVisiblePreps.includes('M5_PREPARATEUR');

                                return (
                                    <div className="w-full bg-white/80 p-1 rounded shadow-sm border border-gray-100 print:border-none print:shadow-none relative group">
                                         {!readOnly && (
                                            <button 
                                                onClick={() => toggleSecondPrep('M5_PREPARATEUR')}
                                                className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors z-10 no-print"
                                                title={showPrep2 ? "Masquer le 2ème préparateur (si vide)" : "Ajouter un 2ème préparateur"}
                                            >
                                                {showPrep2 ? <X size={14} /> : <Plus size={14} />}
                                            </button>
                                         )}
                                        
                                        <div className="flex flex-col gap-2">
                                            {renderInput('M5', 'PREPARATEUR', 0, true, showPrep2 ? 'Prép. 1 (M5/M6)' : 'Prép. (M5/M6)')}
                                            {showPrep2 && renderInput('M5', 'PREPARATEUR', 1, true, 'Prép. 2 (M5/M6)')}
                                        </div>
                                    </div>
                                )
                             })()}
                        </div>
                    </div>
                </div>
            )}
            
            {activeMachineIds.includes('PAC') && (
                <div className="grid grid-cols-12 items-center py-4 px-4 bg-brand-50/30 print:break-inside-avoid">
                    <div className="col-span-2 font-bold text-gray-800">PAC</div>
                    <div className="col-span-10 pl-2">
                        <p className="text-sm text-gray-500 italic no-print">Affectation manuelle flexible.</p>
                        <div className="mt-2 flex gap-4 w-2/3">
                            <div className="flex-1">{renderInput('PAC', 'OPERATEUR', 0)}</div>
                            <div className="flex-1">{renderInput('PAC', 'PREPARATEUR', 0)}</div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        )}
      </div>
    </div>
  );
};

export default StaffPlanning;
