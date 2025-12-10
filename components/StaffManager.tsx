
import React, { useState, useMemo } from 'react';
import { StaffMember, ROLES, RoleType, StaffTeamId, ProductionLog, PlanningAssignment, StaffAssignment, TeamType } from '../types';
import { Plus, Trash2, Edit2, User, Check, X, HeartPulse, Flag, ShieldCheck, Save, RotateCcw, AlertOctagon, Users, Clock, ClipboardList, Briefcase, Calendar, PenTool } from 'lucide-react';

interface StaffManagerProps {
  staffList: StaffMember[];
  setStaffList: (list: StaffMember[]) => void;
  // New props for DB mode
  onAdd?: (member: StaffMember) => void;
  onUpdate?: (member: StaffMember) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string) => void;
  
  // Props for Activity Tracking
  logs?: ProductionLog[];
  planning?: PlanningAssignment[];
  onUpdatePlanning?: (plan: PlanningAssignment) => void;
}

const StaffManager: React.FC<StaffManagerProps> = ({ staffList, setStaffList, onAdd, onUpdate, onDelete, onToggle, logs = [], planning = [], onUpdatePlanning }) => {
  // State for View Mode
  const [viewMode, setViewMode] = useState<'manage' | 'tracking'>('manage');
  
  // State for Form
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<RoleType>('OPERATEUR');
  const [newIsInterim, setNewIsInterim] = useState(false);
  const [newWeeklyHours, setNewWeeklyHours] = useState<number>(35);
  
  // Nouveaux états
  const [newTeam, setNewTeam] = useState<StaffTeamId>(null);
  const [isAbsent, setIsAbsent] = useState(false);
  
  // États pour les qualifications sécurité
  const [isSecouriste, setIsSecouriste] = useState(false);
  const [isGuideFile, setIsGuideFile] = useState(false);
  const [isSerreFile, setIsSerreFile] = useState(false);

  // State for Editing Hours in Tracking Grid
  // Format: "staffId_date" -> string value
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tempHours, setTempHours] = useState<string>("");

  // --- CALCULATION LOGIC FOR TRACKING VIEW ---
  const trackingData = useMemo(() => {
    // Filter for Interims (or allow toggle later)
    const trackedStaff = staffList.filter(s => s.isInterim);

    // Get Current Week Dates (Mon-Sat)
    // Use the logs date to determine the current week to display
    let refDate = new Date();
    if (logs.length > 0) refDate = new Date(logs[0].date);
    else if (planning.length > 0) refDate = new Date(planning[0].date);
    
    const getMonday = (d: Date) => {
        d = new Date(d);
        var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }
    const monday = getMonday(refDate);
    const days = [];
    for(let i=0; i<6; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push({
            date: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
        });
    }

    // Calculate Hours for each staff/day
    const data = trackedStaff.map(staff => {
        const dayData: Record<string, { hours: number, info: string, isOverride: boolean, team?: TeamType, assignKey?: string }> = {};
        let totalHours = 0;

        days.forEach(day => {
            let h = 0;
            let info = '-';
            let isOverride = false;
            let foundTeam: TeamType | undefined;
            let foundKey: string | undefined;

            // Find assignments across ALL teams (Matin & Soir)
            const dailyPlans = planning.filter(p => p.date === day.date);
            
            dailyPlans.forEach(plan => {
                 Object.entries(plan.assignments).forEach(([key, val]) => {
                     const assignment = typeof val === 'string' ? { name: val, isInterim: false } : (val as StaffAssignment);
                     
                     if (assignment.name.toLowerCase() === staff.name.toLowerCase()) {
                         const [machineId, roleRaw] = key.split('_');
                         info = machineId; // Store machine name as info
                         foundTeam = plan.team;
                         foundKey = key;
                         
                         // Check for Manual Override first
                         if (assignment.hoursOverride !== undefined) {
                             h = assignment.hoursOverride;
                             isOverride = true;
                         } else {
                             // Calculate Hours from Logs
                             const log = logs.find(l => l.date === day.date && l.team === plan.team && l.machineId === machineId);
                             
                             if (log) {
                                 h = log.hours;
                             } else {
                                 // Handle Shared resources logic
                                 if ((machineId === 'M3' || machineId === 'M5') && (roleRaw === 'GESTIONNAIRE' || roleRaw === 'PREPARATEUR')) {
                                     // Look for partner machine
                                     const partnerId = machineId === 'M3' ? 'M4' : 'M6';
                                     const log1 = logs.find(l => l.date === day.date && l.team === plan.team && l.machineId === machineId);
                                     const log2 = logs.find(l => l.date === day.date && l.team === plan.team && l.machineId === partnerId);
                                     h = Math.max(log1?.hours || 0, log2?.hours || 0);
                                 } else if (machineId === 'PAC') {
                                     const logPac = logs.find(l => l.date === day.date && l.team === plan.team && l.machineId === 'PAC');
                                     h = logPac?.hours || 0;
                                 }
                             }
                         }
                     }
                 });
            });
            
            dayData[day.date] = { hours: h, info, isOverride, team: foundTeam, assignKey: foundKey };
            totalHours += h;
        });

        return {
            id: staff.id,
            name: staff.name,
            role: staff.defaultRole,
            days: dayData,
            total: totalHours
        };
    });

    return { days, rows: data, totalInterimHours: data.reduce((acc, r) => acc + r.total, 0) };
  }, [staffList, logs, planning]);


  const handleEditClick = (staff: StaffMember, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(staff.id);
      setNewName(staff.name);
      setNewRole(staff.defaultRole || 'OPERATEUR');
      setNewIsInterim(staff.isInterim);
      setNewWeeklyHours(staff.weeklyHours || 35);
      setNewTeam(staff.assignedTeam || null);
      setIsAbsent(staff.isAbsent || false);
      setIsSecouriste(staff.isSecouriste || false);
      setIsGuideFile(staff.isGuideFile || false);
      setIsSerreFile(staff.isSerreFile || false);
      setViewMode('manage'); // Switch to manage to edit
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setNewName('');
      setNewRole('OPERATEUR');
      setNewIsInterim(false);
      setNewWeeklyHours(35);
      setNewTeam(null);
      setIsAbsent(false);
      setIsSecouriste(false);
      setIsGuideFile(false);
      setIsSerreFile(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Creation vs Edit mode
    if (editingId && onUpdate) {
        // UPDATE MODE
        const updatedMember: StaffMember = {
            id: editingId,
            name: newName.trim(),
            defaultRole: newRole,
            isInterim: newIsInterim,
            active: true, // Keep active true
            weeklyHours: newWeeklyHours,
            assignedTeam: newTeam,
            isAbsent: isAbsent,
            isSecouriste: isSecouriste,
            isGuideFile: isGuideFile,
            isSerreFile: isSerreFile
        };
        onUpdate(updatedMember);
    } else {
        // CREATE MODE
        const newMember: StaffMember = {
            id: Date.now().toString(),
            name: newName.trim(),
            defaultRole: newRole,
            isInterim: newIsInterim,
            active: true,
            weeklyHours: newWeeklyHours,
            assignedTeam: newTeam,
            isAbsent: isAbsent,
            isSecouriste: isSecouriste,
            isGuideFile: isGuideFile,
            isSerreFile: isSerreFile
        };
    
        if (onAdd) {
            onAdd(newMember);
        } else {
            setStaffList([...staffList, newMember]);
        }
    }

    // Reset form
    handleCancelEdit();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // SUPPRESSION DU CONFIRM BLOQUANT
    if (onDelete) {
        onDelete(id);
    } else {
        setStaffList(staffList.filter(s => s.id !== id));
    }
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggle) {
          onToggle(id);
      } else {
          setStaffList(staffList.map(s => s.id === id ? { ...s, isInterim: !s.isInterim } : s));
      }
  };

  // --- MANUAL HOUR OVERRIDE HANDLERS ---
  const handleCellClick = (staffId: string, date: string, currentHours: number) => {
      setEditingCell(`${staffId}_${date}`);
      setTempHours(currentHours.toString());
  };

  const handleCellBlur = (staffId: string, date: string, team?: TeamType, assignKey?: string) => {
      if (!onUpdatePlanning || !team || !assignKey) {
          setEditingCell(null);
          return;
      }

      const val = parseFloat(tempHours);
      
      // Find the planning object
      const plan = planning.find(p => p.date === date && p.team === team);
      if (plan) {
          const oldAssign = plan.assignments[assignKey];
          // Determine new assignment object
          let newAssign: StaffAssignment;
          
          if (typeof oldAssign === 'string') {
              // Should not happen for tracked items usually, but handle it
              newAssign = { name: oldAssign, isInterim: true, hoursOverride: isNaN(val) ? undefined : val };
          } else {
              newAssign = { ...oldAssign, hoursOverride: isNaN(val) ? undefined : val };
          }

          // Create update object
          const updatedPlan: PlanningAssignment = {
              ...plan,
              assignments: {
                  ...plan.assignments,
                  [assignKey]: newAssign
              }
          };
          
          onUpdatePlanning(updatedPlan);
      }

      setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, staffId: string, date: string, team?: TeamType, assignKey?: string) => {
      if (e.key === 'Enter') {
          handleCellBlur(staffId, date, team, assignKey);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Ressources Humaines</h2>
          <p className="text-gray-500">Gérez vos équipes et suivez l'activité des intérimaires.</p>
        </div>
        
        {/* Toggle View Buttons */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
                type="button"
                onClick={() => setViewMode('manage')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'manage' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Users className="w-4 h-4" /> Gestion Personnel
            </button>
            <button 
                type="button"
                onClick={() => setViewMode('tracking')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'tracking' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <ClipboardList className="w-4 h-4" /> Suivi Intérim
            </button>
        </div>
      </div>

      {/* ================================================================================== */}
      {/* VUE GESTION (CRUD) */}
      {/* ================================================================================== */}
      {viewMode === 'manage' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
        {/* Formulaire Ajout / Edition */}
        <div className="lg:col-span-1">
            <div className={`p-6 rounded-xl shadow-sm border sticky top-4 transition-colors ${editingId ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold mb-4 flex items-center ${editingId ? 'text-orange-800' : 'text-gray-800'}`}>
                    {editingId ? (
                        <><Edit2 className="w-5 h-5 mr-2" /> Modifier le collaborateur</>
                    ) : (
                        <><Plus className="w-5 h-5 mr-2 text-brand-600" /> Ajouter un collaborateur</>
                    )}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom Prénom</label>
                        <input 
                            type="text" 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                            placeholder="Ex: Dupont Jean"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle Défaut</label>
                            <select 
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as RoleType)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 text-sm"
                            >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Affectation Équipe</label>
                            <select 
                                value={newTeam || ''}
                                onChange={(e) => setNewTeam(e.target.value ? parseInt(e.target.value) as StaffTeamId : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 text-sm"
                            >
                                <option value="">Flexible / Aucune</option>
                                <option value="1">Équipe 1</option>
                                <option value="2">Équipe 2</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contrat Hebdo (Heures)</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={newWeeklyHours}
                            onChange={(e) => setNewWeeklyHours(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                            placeholder="35"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2 border-b border-gray-100 pb-4">
                        <div className="flex items-center">
                            <input
                                id="is-interim"
                                type="checkbox"
                                checked={newIsInterim}
                                onChange={(e) => setNewIsInterim(e.target.checked)}
                                className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                            />
                            <label htmlFor="is-interim" className="ml-2 block text-sm font-medium text-gray-900">
                                Est Intérimaire
                            </label>
                        </div>
                         <div className="flex items-center">
                            <input
                                id="is-absent"
                                type="checkbox"
                                checked={isAbsent}
                                onChange={(e) => setIsAbsent(e.target.checked)}
                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                            />
                            <label htmlFor="is-absent" className="ml-2 block text-sm font-medium text-red-700 flex items-center">
                                <AlertOctagon className="w-3 h-3 mr-1"/> Actuellement Absent (Exclu)
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Qualifications Sécurité</label>
                        
                        <div className="flex items-center">
                            <input
                                id="is-secouriste"
                                type="checkbox"
                                checked={isSecouriste}
                                onChange={(e) => setIsSecouriste(e.target.checked)}
                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                            />
                            <label htmlFor="is-secouriste" className="ml-2 flex items-center text-sm text-gray-700">
                                <HeartPulse className="w-4 h-4 mr-1 text-red-500" /> Secouriste
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="is-guide"
                                type="checkbox"
                                checked={isGuideFile}
                                onChange={(e) => setIsGuideFile(e.target.checked)}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            />
                            <label htmlFor="is-guide" className="ml-2 flex items-center text-sm text-gray-700">
                                <Flag className="w-4 h-4 mr-1 text-green-500" /> Guide File
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="is-serre"
                                type="checkbox"
                                checked={isSerreFile}
                                onChange={(e) => setIsSerreFile(e.target.checked)}
                                className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                            />
                            <label htmlFor="is-serre" className="ml-2 flex items-center text-sm text-gray-700">
                                <ShieldCheck className="w-4 h-4 mr-1 text-gray-500" /> Serre File
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="flex-1 flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" /> Annuler
                            </button>
                        )}
                        <button 
                            type="submit"
                            className={`flex-1 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-colors ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                        >
                            {editingId ? (
                                <><Save className="w-4 h-4 mr-2" /> Modifier</>
                            ) : (
                                <><Plus className="w-4 h-4 mr-2" /> Ajouter</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {/* Liste */}
        <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom & Qualifications</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle Défaut</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Équipe</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {staffList.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                    Aucun collaborateur. Ajoutez-en un à gauche.
                                </td>
                            </tr>
                        ) : (
                            staffList.map((staff) => (
                                <tr key={staff.id} className={`hover:bg-gray-50 transition-colors ${editingId === staff.id ? 'bg-orange-50 ring-1 ring-orange-200' : ''} ${staff.isAbsent ? 'bg-gray-50 opacity-60' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border ${staff.isAbsent ? 'bg-gray-200 text-gray-400 border-gray-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                {staff.isAbsent ? <AlertOctagon className="w-6 h-6" /> : <User className="w-6 h-6" />}
                                            </div>
                                            <div className="ml-4">
                                                <div className={`text-sm font-bold ${staff.isAbsent ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                                    {staff.name}
                                                    {staff.isAbsent && <span className="ml-2 text-xs text-red-500 no-underline font-normal">(Absent)</span>}
                                                </div>
                                                <div className="flex gap-2 mt-1.5">
                                                    {staff.isSecouriste && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200" title="Secouriste">
                                                            <HeartPulse className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} /> Secouriste
                                                        </span>
                                                    )}
                                                    {staff.isGuideFile && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200" title="Guide File">
                                                            <Flag className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} /> Guide
                                                        </span>
                                                    )}
                                                    {staff.isSerreFile && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300" title="Serre File">
                                                            <ShieldCheck className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} /> Serre
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <button 
                                                type="button"
                                                onClick={(e) => handleToggleStatus(staff.id, e)}
                                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 border w-fit ${staff.isInterim ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}
                                            >
                                                {staff.isInterim ? 'Intérimaire' : 'Salarié'}
                                            </button>
                                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                                <Clock className="w-3 h-3" />
                                                <span>{staff.weeklyHours || 35}h / sem</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                                        {staff.defaultRole}
                                    </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                                        {staff.assignedTeam === 1 && (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                <Users className="w-3 h-3 mr-1"/> Équipe 1
                                            </span>
                                        )}
                                        {staff.assignedTeam === 2 && (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                                <Users className="w-3 h-3 mr-1"/> Équipe 2
                                            </span>
                                        )}
                                        {!staff.assignedTeam && <span className="text-gray-400 text-xs italic">Flexible</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            type="button"
                                            onClick={(e) => handleEditClick(staff, e)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-3 p-2 hover:bg-indigo-50 rounded-full transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={(e) => handleDelete(staff.id, e)}
                                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
      )}

      {/* ================================================================================== */}
      {/* VUE SUIVI INTERIMAIRE (TABLEAU NOMINATIF) */}
      {/* ================================================================================== */}
      {viewMode === 'tracking' && (
          <div className="animate-in fade-in space-y-6">
              
              <div className="flex gap-6">
                  <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex-1 flex items-center justify-between shadow-sm">
                      <div>
                          <p className="text-xs font-bold text-orange-600 uppercase mb-1">Total Intérimaires Actifs</p>
                          <p className="text-3xl font-bold text-orange-800">{trackingData.rows.length}</p>
                      </div>
                      <div className="p-3 bg-white rounded-full text-orange-600 shadow-sm"><Users className="w-6 h-6"/></div>
                  </div>
                   <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex-1 flex items-center justify-between shadow-sm">
                      <div>
                          <p className="text-xs font-bold text-orange-600 uppercase mb-1">Total Heures Semaine</p>
                          <p className="text-3xl font-bold text-orange-800">{trackingData.totalInterimHours.toFixed(1)} h</p>
                      </div>
                      <div className="p-3 bg-white rounded-full text-orange-600 shadow-sm"><Clock className="w-6 h-6"/></div>
                  </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                       <Calendar className="w-5 h-5 text-gray-500" />
                       <h3 className="font-bold text-gray-800">Suivi Hebdomadaire Nominatif</h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-500 font-medium uppercase text-xs">
                              <tr>
                                  <th className="px-4 py-3 border-r bg-gray-100 sticky left-0 z-10">Intérimaire</th>
                                  {trackingData.days.map(d => (
                                      <th key={d.date} className="px-2 py-3 text-center border-r min-w-[80px]">{d.label}</th>
                                  ))}
                                  <th className="px-4 py-3 text-right font-bold bg-orange-50 text-orange-800">Total</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {trackingData.rows.length === 0 ? (
                                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucun intérimaire enregistré dans la liste.</td></tr>
                              ) : trackingData.rows.map(row => (
                                  <tr key={row.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 font-medium text-gray-800 border-r bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                          {row.name}
                                          <div className="text-[10px] text-gray-400 font-normal">{row.role}</div>
                                      </td>
                                      {trackingData.days.map(d => {
                                          const data = row.days[d.date];
                                          const cellKey = `${row.id}_${d.date}`;
                                          const isEditing = editingCell === cellKey;

                                          return (
                                              <td key={d.date} className="px-2 py-3 text-center border-r p-0 relative">
                                                  {isEditing ? (
                                                      <input 
                                                        autoFocus
                                                        type="number"
                                                        step="0.5"
                                                        value={tempHours}
                                                        onChange={(e) => setTempHours(e.target.value)}
                                                        onBlur={() => handleCellBlur(row.id, d.date, data.team, data.assignKey)}
                                                        onKeyDown={(e) => handleKeyDown(e, row.id, d.date, data.team, data.assignKey)}
                                                        className="w-full h-full absolute inset-0 text-center border-2 border-brand-500 focus:outline-none bg-white text-sm"
                                                      />
                                                  ) : (
                                                      data.assignKey ? (
                                                        <div 
                                                            onClick={() => handleCellClick(row.id, d.date, data.hours)}
                                                            className={`w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 min-h-[50px] ${data.isOverride ? 'bg-blue-50/50' : ''}`}
                                                            title="Cliquez pour modifier manuellement"
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                <span className={`font-bold ${data.isOverride ? 'text-blue-700' : 'text-gray-800'}`}>
                                                                    {data.hours.toFixed(1)} h
                                                                </span>
                                                                {data.isOverride && <PenTool className="w-3 h-3 text-blue-400" />}
                                                            </div>
                                                            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded mt-0.5">{data.info}</span>
                                                        </div>
                                                      ) : (
                                                          <span className="text-gray-300">-</span>
                                                      )
                                                  )}
                                              </td>
                                          )
                                      })}
                                      <td className="px-4 py-3 text-right font-bold text-orange-700 bg-orange-50/30">
                                          {row.total.toFixed(1)} h
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StaffManager;
