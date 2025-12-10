
import React, { useState, useEffect, useMemo } from 'react';
import { MachineId, MachineConfig, ProductionLog, TeamType, MACHINE_LABELS } from '../types';
import { Save, CheckCircle2, List, CalendarDays, Users, SaveAll, Trash2, Pencil, AlertCircle, RotateCcw, XCircle } from 'lucide-react';

interface DailyInputProps {
  configs: Record<MachineId, MachineConfig>;
  logs: ProductionLog[];
  addLog: (log: ProductionLog) => void;
  updateLog: (log: ProductionLog) => void;
  deleteLog?: (logId: string) => void;
}

// État local d'une ligne de saisie
interface MachineInputState {
    bal: string;
    hours: string;
    status: 'clean' | 'modified' | 'saved' | 'deleted'; // clean = sync avec BDD, modified = en cours
}

const DailyInput: React.FC<DailyInputProps> = ({ configs, logs, addLog, updateLog, deleteLog }) => {
  
  // 1. SELECTEURS
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTeam, setSelectedTeam] = useState<TeamType>('MATIN');

  // 2. ÉTAT DU FORMULAIRE (Source de vérité locale)
  const [formState, setFormState] = useState<Record<string, MachineInputState>>({});
  
  // Machines actives uniquement
  const activeMachines = useMemo(() => 
    (Object.values(configs || {}) as MachineConfig[]).filter(c => c && c.active), 
  [configs]);

  // 3. CHARGEMENT DES DONNÉES (Sync BDD -> Local)
  // Se déclenche UNIQUEMENT au changement de date/équipe ou si la liste des logs change
  useEffect(() => {
      const newFormState: Record<string, MachineInputState> = {};
      
      activeMachines.forEach(m => {
          const existingLog = logs.find(l => 
              l.machineId === m.id && 
              l.date === selectedDate && 
              l.team === selectedTeam
          );

          if (existingLog) {
              newFormState[m.id] = {
                  bal: existingLog.balProduced.toString(),
                  hours: existingLog.hours.toString(),
                  status: 'clean' // Donnée propre venant de la BDD
              };
          } else {
              newFormState[m.id] = {
                  bal: '',
                  hours: '',
                  status: 'clean' // Vide mais propre
              };
          }
      });
      
      setFormState(newFormState);
  }, [selectedDate, selectedTeam, logs, activeMachines]);


  // --- HANDLERS GRILLE ---

  const handleInputChange = (machineId: string, field: 'bal' | 'hours', value: string) => {
      setFormState(prev => ({
          ...prev,
          [machineId]: {
              ...prev[machineId],
              [field]: value,
              status: 'modified' // Passe en mode "Modifié" (Orange)
          }
      }));
  };

  const handleSaveLine = (machineId: string, e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation(); // Stop propagation to prevent row clicks
      }
      
      const state = formState[machineId];
      if (!state) return;

      const balVal = parseInt(state.bal);
      const hoursVal = parseFloat(state.hours);

      // Validation basique
      if (!state.bal && !state.hours) return; // Rien à sauver
      if (isNaN(balVal) || isNaN(hoursVal)) {
          // Utilisation d'un simple log console au lieu d'alert pour éviter les blocages sandbox
          console.warn("Valeurs incorrectes");
          return;
      }

      // Chercher si existe déjà pour Update
      const existingLog = logs.find(l => l.machineId === machineId && l.date === selectedDate && l.team === selectedTeam);

      if (existingLog) {
          updateLog({
              ...existingLog,
              balProduced: balVal,
              hours: hoursVal
          });
      } else {
          addLog({
              id: Date.now().toString() + Math.random().toString().slice(2,5),
              date: selectedDate,
              machineId: machineId as MachineId,
              team: selectedTeam,
              balProduced: balVal,
              docsProduced: 0,
              hours: hoursVal
          });
      }

      // Feedback visuel immédiat
      setFormState(prev => ({
          ...prev,
          [machineId]: { ...prev[machineId], status: 'saved' }
      }));
  };

  const handleClearLine = (machineId: string, e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation(); // Critical: Stop propagation
      }

      // 1. Supprimer de la BDD si existe
      const existingLog = logs.find(l => l.machineId === machineId && l.date === selectedDate && l.team === selectedTeam);
      
      if (existingLog && deleteLog) {
          // SUPPRESSION DU CONFIRM BLOQUANT
          deleteLog(existingLog.id);
      }
      
      // 2. Vider le champ local immédiatement
      setFormState(prev => ({
          ...prev,
          [machineId]: { bal: '', hours: '', status: 'clean' }
      }));
  };

  const handleSaveAll = () => {
      activeMachines.forEach(m => {
          if (formState[m.id]?.status === 'modified') {
              handleSaveLine(m.id);
          }
      });
  };

  // --- HISTORIQUE BAS DE PAGE ---

  const getStartOfWeek = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      return monday;
  };
  
  const startOfWeek = getStartOfWeek(selectedDate);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const startDateStr = startOfWeek.toISOString().split('T')[0];
  const endDateStr = endOfWeek.toISOString().split('T')[0];

  const weekLogs = useMemo(() => {
      return logs.filter(l => l.date >= startDateStr && l.date < endDateStr)
      .sort((a, b) => b.date.localeCompare(a.date) || a.team.localeCompare(b.team));
  }, [logs, startDateStr, endDateStr]);

  const handleEditHistory = (log: ProductionLog, e: React.MouseEvent) => {
      e.stopPropagation();
      // Change la vue pour correspondre au log
      setSelectedDate(log.date);
      setSelectedTeam(log.team);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteHistory = (logId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Critical
      if (deleteLog) {
          // SUPPRESSION DU CONFIRM BLOQUANT
          deleteLog(logId);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-12">
      
      {/* EN-TETE */}
      <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Saisie Production</h2>
            <p className="text-gray-500">Renseignez les performances journalières.</p>
          </div>
          <div className="text-sm bg-white px-3 py-1 rounded border shadow-sm">
              Semaine du {startOfWeek.toLocaleDateString()}
          </div>
      </div>

      {/* SELECTEURS DATE / EQUIPE */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-brand-500" /> Date
                </label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 font-medium"
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-500" /> Équipe
                </label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {['MATIN', 'SOIR'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTeam(t as TeamType)}
                        className={`flex-1 py-2 px-4 text-sm font-bold rounded-md transition-all ${
                          selectedTeam === t
                            ? 'bg-white text-brand-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {t}
                      </button>
                  ))}
                </div>
            </div>
        </div>
      </div>

      {/* GRILLE SAISIE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Grille de Saisie Multi-Machines</h3>
              <button 
                type="button"
                onClick={handleSaveAll}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-bold shadow-sm"
              >
                  <SaveAll className="w-4 h-4" /> Tout Enregistrer
              </button>
          </div>

          <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs">
                  <tr>
                      <th className="px-6 py-4 w-1/4">Machine</th>
                      <th className="px-6 py-4 w-1/4 text-center">BAL Réalisées</th>
                      <th className="px-6 py-4 w-1/4 text-center">Heures (Centièmes)</th>
                      <th className="px-6 py-4 w-1/4 text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {activeMachines.map(m => {
                      const state = formState[m.id] || { bal: '', hours: '', status: 'clean' };
                      const isModified = state.status === 'modified';
                      const isSaved = state.status === 'saved';
                      const hasValue = state.bal !== '' || state.hours !== '';

                      return (
                          <tr key={m.id} className={`transition-colors ${isModified ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                              <td className="px-6 py-4 font-bold text-gray-800 text-lg">
                                  {MACHINE_LABELS[m.id]}
                              </td>
                              <td className="px-6 py-4">
                                  <input 
                                      type="number"
                                      value={state.bal}
                                      onChange={(e) => handleInputChange(m.id, 'bal', e.target.value)}
                                      className={`w-full text-center px-3 py-2 border rounded-md text-lg font-bold outline-none focus:ring-2 focus:ring-brand-500 ${isModified ? 'border-orange-300 bg-white' : (hasValue ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-300')}`}
                                      placeholder="0"
                                  />
                              </td>
                              <td className="px-6 py-4">
                                  <input 
                                      type="number"
                                      step="0.01"
                                      value={state.hours}
                                      onChange={(e) => handleInputChange(m.id, 'hours', e.target.value)}
                                      className={`w-full text-center px-3 py-2 border rounded-md text-lg font-bold outline-none focus:ring-2 focus:ring-brand-500 ${isModified ? 'border-orange-300 bg-white' : (hasValue ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-300')}`}
                                      placeholder="0.00"
                                  />
                              </td>
                              <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                                  {isSaved && !isModified && (
                                      <span className="text-green-600 flex items-center gap-1 text-xs font-bold mr-2 animate-in fade-in">
                                          <CheckCircle2 className="w-4 h-4" /> OK
                                      </span>
                                  )}
                                  
                                  {/* Bouton Sauvegarder (Visible si modifié) */}
                                  <button
                                      type="button"
                                      onClick={(e) => handleSaveLine(m.id, e)}
                                      disabled={!isModified}
                                      className={`p-2 rounded transition-colors ${isModified ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm' : 'text-gray-300 cursor-not-allowed'}`}
                                      title="Enregistrer la ligne"
                                  >
                                      <Save className="w-4 h-4" />
                                  </button>

                                  {/* Bouton Supprimer/Vider */}
                                  <button
                                      type="button"
                                      onClick={(e) => handleClearLine(m.id, e)}
                                      disabled={!hasValue}
                                      className={`p-2 rounded transition-colors ${hasValue ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-gray-200 cursor-not-allowed'}`}
                                      title="Supprimer / Vider"
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
      </div>

      {/* HISTORIQUE SEMAINE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <List className="w-5 h-5 text-gray-500" />
                Historique Global de la Semaine
            </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs sticky top-0">
                    <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Équipe</th>
                        <th className="px-4 py-3">Machine</th>
                        <th className="px-4 py-3 text-right">BAL</th>
                        <th className="px-4 py-3 text-right">Heures</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {weekLogs.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucune donnée cette semaine.</td></tr>
                    ) : (
                        weekLogs.map(log => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">
                                    {new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.team === 'MATIN' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {log.team}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{MACHINE_LABELS[log.machineId]}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800">{log.balProduced.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{log.hours.toFixed(2)} h</td>
                                <td className="px-4 py-3 text-center flex justify-center gap-2">
                                    <button 
                                        type="button"
                                        onClick={(e) => handleEditHistory(log, e)}
                                        className="p-1.5 text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                        title="Modifier (Charge dans le formulaire)"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => handleDeleteHistory(log.id, e)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Supprimer immédiatement"
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
  );
};

export default DailyInput;
