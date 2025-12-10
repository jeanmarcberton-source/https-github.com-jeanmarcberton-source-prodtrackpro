import './index.css'; // S'assurer que le chemin est correct (selon l'emplacement de votre fichier index.css)
import React from 'react';
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import WeeklySetup from './components/WeeklySetup';
import DailyInput from './components/DailyInput';
import StaffPlanning from './components/StaffPlanning';
import StaffManager from './components/StaffManager';
import { MachineId, MachineConfig, ProductionLog, PlanningAssignment, StaffMember, GlobalForecasts, WeekOption, WeeklyArchive } from './types';
import { supabase } from './supabaseClient';
import { Loader2 } from 'lucide-react';

// ... le reste de votre code
// Default initial config
const DEFAULT_CONFIGS: Record<MachineId, MachineConfig> = {
  M1: { id: 'M1', active: true, targetBal: 0, targetVolume: 0, targetCadence: 0 },
  M2: { id: 'M2', active: true, targetBal: 0, targetVolume: 0, targetCadence: 0 },
  M3: { id: 'M3', active: true, targetBal: 0, targetVolume: 0, targetCadence: 0 },
  M4: { id: 'M4', active: true, targetBal: 0, targetVolume: 0, targetCadence: 0 },
  M5: { id: 'M5', active: true, targetBal: 0, targetVolume: 0, targetCadence: 0 },
  M6: { id: 'M6', active: true, targetBal: 0, targetVolume: 0, targetCadence: 0 },
  PAC: { id: 'PAC', active: true, targetBal: 0, targetVolume: 0, targetCadence: 2000 }, // Cadence forfaitaire
};

const DEFAULT_FORECASTS: GlobalForecasts = {
  totalVolume: 0,
  totalWeight: 0,
  predictedBal: 0,
  maxDocsPerHandful: 0,
  maxWeightPerHandful: 0
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // MODE: Production (false) vs Preparation (true)
  const [isPrepMode, setIsPrepMode] = useState(false);
  // Read Only Mode for Archives
  const [readOnly, setReadOnly] = useState(false);
  
  // App State
  const [globalForecasts, setGlobalForecasts] = useState<GlobalForecasts>(DEFAULT_FORECASTS);
  const [machineConfigs, setMachineConfigs] = useState<Record<MachineId, MachineConfig>>(DEFAULT_CONFIGS);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [planning, setPlanning] = useState<PlanningAssignment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Archives List
  const [archives, setArchives] = useState<WeeklyArchive[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('current'); // 'current', 'next' or archive UUID

  // --- DATE HELPER ---
  const getWeekLabel = (offsetWeeks: number = 1) => {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (7 * offsetWeeks));

    // Find Monday
    const day = targetDate.getDay();
    const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(targetDate.setDate(diff));
    
    // Find Sunday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Week Number
    const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);

    const fmt = (date: Date) => date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    //return `S${weekNo} DU ${fmt(monday)} AU ${fmt(sunday)}`;
    return (
    <div style={{ padding: '50px', backgroundColor: '#f0f0f0' }}>
      <h1>🎉 MON APPLICATION EST VIVANTE ! 🎉</h1>
      {/* Laissez le reste de votre code ici */}
    </div>
  );
  };

  // Label displayed in UI
  const currentArchive = archives.find(a => a.id === selectedWeekId);
  const currentWeekLabel = currentArchive 
    ? currentArchive.weekLabel 
    : getWeekLabel(isPrepMode ? 2 : 1);

  // Helper to get the correct start date for planning based on mode
  const getPlanningStartDate = (customOffset?: number) => {
    if (currentArchive) {
        return new Date(currentArchive.startDate);
    }
    const today = new Date();
    const offset = customOffset !== undefined ? (customOffset * 7) : (isPrepMode ? 14 : 7); // +1 week or +2 weeks
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // --- INITIAL DATA LOADING ---
  useEffect(() => {
    // Initial Load: Archives + Current Data
    loadArchives();
    fetchActiveData();
  }, []); // Run once on mount

  const loadArchives = async () => {
      const { data } = await supabase.from('weekly_archives').select('*').order('created_at', { ascending: false });
      if (data) {
          const fmt = data.map((d:any) => ({
              id: d.id,
              weekLabel: d.week_label,
              startDate: d.start_date,
              createdAt: d.created_at,
              data: d.data
          }));
          setArchives(fmt);
      }
  };

  // Handle switching weeks
  const handleWeekSelect = (id: string) => {
      setSelectedWeekId(id);
      
      if (id === 'current') {
          setIsPrepMode(false);
          setReadOnly(false);
          fetchActiveData(false); // S+1
      } else if (id === 'next') {
          setIsPrepMode(true);
          setReadOnly(false);
          fetchActiveData(true); // S+2
      } else {
          // Archive
          const arch = archives.find(a => a.id === id);
          if (arch) {
              setReadOnly(true);
              setIsPrepMode(false);
              // Load Archive Data into State (With fallbacks)
              const data = arch.data || {};
              setGlobalForecasts(data.globalForecasts || DEFAULT_FORECASTS);
              setMachineConfigs(data.machineConfigs || DEFAULT_CONFIGS);
              setLogs(data.logs || []);
              setPlanning(data.planning || []);
          }
      }
  };

  const fetchActiveData = async (prepMode: boolean = false) => {
    setIsLoading(true);
    try {
        // IDs to fetch based on mode
        const forecastId = prepMode ? 2 : 1;
        
        // 1. Forecasts
        const { data: forecastData } = await supabase
            .from('global_forecasts')
            .select('*')
            .eq('id', forecastId)
            .single();

        if (forecastData) {
            setGlobalForecasts({
                totalVolume: forecastData.total_volume,
                totalWeight: forecastData.total_weight,
                predictedBal: forecastData.predicted_bal,
                maxDocsPerHandful: forecastData.max_docs_per_handful,
                maxWeightPerHandful: forecastData.max_weight_per_handful
            });
        } else {
             setGlobalForecasts(DEFAULT_FORECASTS);
        }

        // 2. Machine Configs
        const { data: configData } = await supabase.from('machine_configs').select('*');
        
        if (configData && configData.length > 0) {
            const newConfigs: any = { ...DEFAULT_CONFIGS };
            const relevantConfigs = configData.filter((c: any) => 
                prepMode ? c.id.endsWith('_NEXT') : !c.id.endsWith('_NEXT')
            );

            relevantConfigs.forEach((row: any) => {
                const cleanId = row.id.replace('_NEXT', '');
                if (newConfigs[cleanId]) {
                    newConfigs[cleanId] = {
                        id: cleanId,
                        active: row.active,
                        targetBal: row.target_bal,
                        targetVolume: row.target_volume,
                        targetCadence: row.target_cadence
                    };
                }
            });
            setMachineConfigs(newConfigs);
        }

        // 3. Logs (Only relevant for Production mode)
        if (prepMode) {
            setLogs([]);
        } else {
            const { data: logsData } = await supabase.from('production_logs').select('*');
            if (logsData) {
                setLogs(logsData.map((l: any) => ({
                    id: l.id,
                    date: l.date,
                    machineId: l.machine_id,
                    team: l.team,
                    balProduced: l.bal_produced,
                    docsProduced: l.docs_produced,
                    hours: l.hours
                })));
            }
        }

        // 4. Staff
        const { data: staffData } = await supabase.from('staff').select('*');
        if (staffData) {
            setStaffList(staffData.map((s: any) => ({
                id: s.id,
                name: s.name,
                defaultRole: s.default_role,
                isInterim: s.is_interim,
                active: s.active,
                weeklyHours: s.weekly_hours || 35,
                assignedTeam: s.assigned_team, 
                isAbsent: s.is_absent,
                isSecouriste: s.is_secouriste || false,
                isGuideFile: s.is_guide_file || false,
                isSerreFile: s.is_serre_file || false
            })));
        }

        // 5. Planning
        const { data: planData } = await supabase.from('planning').select('*');
        if (planData) {
            setPlanning(planData.map((p: any) => ({
                date: p.date,
                team: p.team,
                assignments: p.assignments || {}
            })));
        }

    } catch (error) {
        console.error("Erreur de chargement:", error);
    } finally {
        setIsLoading(false);
    }
  };

  // --- ACTIONS ---

  const updateGlobalForecasts = async (newData: GlobalForecasts) => {
      setGlobalForecasts(newData);
      if (readOnly) return;
      
      const dbId = isPrepMode ? 2 : 1;
      await supabase.from('global_forecasts').upsert({
          id: dbId,
          total_volume: newData.totalVolume,
          total_weight: newData.totalWeight,
          predicted_bal: newData.predictedBal,
          max_docs_per_handful: newData.maxDocsPerHandful,
          max_weight_per_handful: newData.maxWeightPerHandful
      });
  };

  const updateMachineConfig = async (id: MachineId, data: Partial<MachineConfig>) => {
    const updatedConfig = { ...machineConfigs[id], ...data };
    setMachineConfigs(prev => ({ ...prev, [id]: updatedConfig }));
    if (readOnly) return;

    const dbId = id + (isPrepMode ? '_NEXT' : '');
    await supabase.from('machine_configs').upsert({
        id: dbId,
        active: updatedConfig.active,
        target_bal: updatedConfig.targetBal,
        target_volume: updatedConfig.targetVolume,
        target_cadence: updatedConfig.targetCadence
    });
  };

  // *** LOGS ACTIONS: OPTIMISTIC UPDATES FOR INSTANT UI ***

  const addLog = async (log: ProductionLog) => {
    if (isPrepMode || readOnly) {
        alert("Impossible de saisir une production dans ce mode.");
        return;
    }
    // Optimistic Update
    setLogs(prev => [...prev, log]);
    
    await supabase.from('production_logs').insert({
        id: log.id,
        date: log.date,
        machine_id: log.machineId,
        team: log.team,
        bal_produced: log.balProduced,
        docs_produced: log.docsProduced,
        hours: log.hours
    });
  };

  const updateLog = async (log: ProductionLog) => {
      if (isPrepMode || readOnly) return;
      
      // Optimistic Update
      setLogs(prev => prev.map(l => l.id === log.id ? log : l));
      
      await supabase.from('production_logs').update({
          bal_produced: log.balProduced,
          hours: log.hours
      }).eq('id', log.id);
  };

  const deleteLog = async (logId: string) => {
      if (isPrepMode || readOnly) return;

      // Optimistic Update
      setLogs(prev => prev.filter(l => l.id !== logId));
      
      await supabase.from('production_logs').delete().eq('id', logId);
  };

  // ... (Other handlers like Staff/Planning remain mostly the same) ...
  const handleAddStaff = async (member: StaffMember) => {
      setStaffList(prev => [...prev, member]);
      await supabase.from('staff').insert({
          id: member.id,
          name: member.name,
          default_role: member.defaultRole,
          is_interim: member.isInterim,
          active: member.active,
          weekly_hours: member.weeklyHours,
          assigned_team: member.assignedTeam, 
          is_absent: member.isAbsent, 
          is_secouriste: member.isSecouriste,
          is_guide_file: member.isGuideFile,
          is_serre_file: member.isSerreFile
      });
  };

  const handleUpdateStaff = async (member: StaffMember) => {
      setStaffList(prev => prev.map(s => s.id === member.id ? member : s));
      await supabase.from('staff').update({
          name: member.name,
          default_role: member.defaultRole,
          is_interim: member.isInterim,
          weekly_hours: member.weeklyHours,
          assigned_team: member.assignedTeam,
          is_absent: member.isAbsent,
          is_secouriste: member.isSecouriste,
          is_guide_file: member.isGuideFile,
          is_serre_file: member.isSerreFile
      }).eq('id', member.id);
  };

  const handleDeleteStaff = async (id: string) => {
      setStaffList(prev => prev.filter(s => s.id !== id));
      await supabase.from('staff').delete().eq('id', id);
  };
  
  const handleToggleStaff = async (id: string) => {
      const member = staffList.find(s => s.id === id);
      if(member) {
          const newVal = !member.isInterim;
          setStaffList(prev => prev.map(s => s.id === id ? { ...s, isInterim: newVal } : s));
          await supabase.from('staff').update({ is_interim: newVal }).eq('id', id);
      }
  };

  const savePlanning = async (data: PlanningAssignment | PlanningAssignment[]) => {
    if(readOnly) return;
    setPlanning(prev => {
      const updates = Array.isArray(data) ? data : [data];
      let newPlanning = [...prev];
      updates.forEach(update => {
        newPlanning = newPlanning.filter(p => !(p.date === update.date && p.team === update.team));
        newPlanning.push(update);
      });
      return newPlanning;
    });

    const updates = Array.isArray(data) ? data : [data];
    for (const p of updates) {
        await supabase.from('planning').upsert({
            date: p.date,
            team: p.team,
            assignments: p.assignments
        }, { onConflict: 'date, team' });
    }
  };

  const resetWeek = async () => {
    if(readOnly) return;
    const msg = isPrepMode 
        ? "Voulez-vous réinitialiser la préparation de la semaine prochaine (S+2) ?" 
        : "Voulez-vous réinitialiser la semaine de production actuelle (S+1) ?";
        
    if (window.confirm(msg)) {
      if (!isPrepMode) {
          setLogs([]);
          await supabase.from('production_logs').delete().neq('id', '0');
      }
      
      setGlobalForecasts(DEFAULT_FORECASTS);
      await updateGlobalForecasts(DEFAULT_FORECASTS);
      
      const newConfigs = { ...DEFAULT_CONFIGS };
      setMachineConfigs(newConfigs);
      
      const configSuffix = isPrepMode ? '_NEXT' : '';
      for (const id of Object.keys(newConfigs) as MachineId[]) {
           await supabase.from('machine_configs').upsert({
                id: id + configSuffix,
                ...newConfigs[id]
           });
      }

      alert("Semaine réinitialisée.");
    }
  };

  const handlePromoteWeek = async () => {
      if (!isPrepMode) return;
      if (!window.confirm("CONFIRMATION : Basculer S+2 vers S+1 ?")) return;
      
      setIsLoading(true);
      try {
          // 1. Archive S+1 (Current)
          const { data: currentForecast } = await supabase.from('global_forecasts').select('*').eq('id', 1).single();
          const { data: currentConfigs } = await supabase.from('machine_configs').select('*').not('id', 'like', '%_NEXT');
          const { data: currentLogs } = await supabase.from('production_logs').select('*');
          const { data: currentPlanning } = await supabase.from('planning').select('*');

          const weekLabel = getWeekLabel(1);
          const startDate = getPlanningStartDate(1).toISOString().split('T')[0];

          const configMap: any = {};
          if(currentConfigs) {
              currentConfigs.forEach((c:any) => {
                  configMap[c.id] = { id: c.id, active: c.active, targetBal: c.target_bal, targetVolume: c.target_volume, targetCadence: c.target_cadence };
              });
          }

          const archiveData = {
              logs: currentLogs || [],
              planning: currentPlanning || [], 
              machineConfigs: configMap || {}, 
              globalForecasts: currentForecast || {}
          };
          
          await supabase.from('weekly_archives').insert({
              week_label: weekLabel,
              start_date: startDate,
              data: archiveData
          });

          // 2. PROMOTE S+2 -> S+1
           const { data: nextForecast } = await supabase.from('global_forecasts').select('*').eq('id', 2).single();
           const { data: nextConfigs } = await supabase.from('machine_configs').select('*').like('id', '%_NEXT');

           if (nextForecast) {
               await supabase.from('global_forecasts').upsert({
                   id: 1, 
                   total_volume: nextForecast.total_volume,
                   total_weight: nextForecast.total_weight,
                   predicted_bal: nextForecast.predicted_bal,
                   max_docs_per_handful: nextForecast.max_docs_per_handful,
                   max_weight_per_handful: nextForecast.max_weight_per_handful
               });
           }

           if (nextConfigs) {
               for (const nc of nextConfigs) {
                   const cleanId = nc.id.replace('_NEXT', '');
                   await supabase.from('machine_configs').upsert({
                       id: cleanId,
                       active: nc.active,
                       target_bal: nc.target_bal,
                       target_volume: nc.target_volume,
                       target_cadence: nc.target_cadence
                   });
               }
           }

           // 3. CLEANUP
           await supabase.from('production_logs').delete().neq('id', '0');
           await supabase.from('global_forecasts').upsert({ id: 2, total_volume: 0, total_weight: 0, predicted_bal: 0 });
           if (nextConfigs) {
               for (const nc of nextConfigs) {
                   await supabase.from('machine_configs').upsert({
                       id: nc.id, 
                       target_bal: 0,
                       target_volume: 0
                   });
               }
           }

           alert("Semaine archivée et bascule effectuée !");
           await loadArchives();
           handleWeekSelect('current');

      } catch (err) {
          console.error("Erreur bascule:", err);
          alert("Erreur lors de la bascule.");
      } finally {
          setIsLoading(false);
      }
  };

  const activeMachineIds = Object.keys(machineConfigs).filter(k => machineConfigs[k as MachineId].active) as MachineId[];

  const weekOptions: WeekOption[] = [
      { id: 'current', label: getWeekLabel(1), type: 'CURRENT' },
      { id: 'next', label: getWeekLabel(2), type: 'FUTURE' },
      ...archives.map(a => ({ id: a.id, label: a.weekLabel, type: 'ARCHIVE' } as WeekOption))
  ];

  //if (isLoading) {
  //    return (
  //        <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
  //            <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
  //            <p className="text-gray-500 font-medium">Chargement des données...</p>
  //        </div>
  //    )
 // }

  return (
    <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isPreviewMode={isPreviewMode} 
        setIsPreviewMode={setIsPreviewMode}
        isPrepMode={isPrepMode}
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
            configs={machineConfigs} 
            logs={logs} 
            planning={planning} 
            globalForecasts={globalForecasts}
            weekLabel={currentWeekLabel}
            onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
            weekOptions={weekOptions}
            selectedWeekId={selectedWeekId}
            onSelectWeek={handleWeekSelect}
            readOnly={readOnly}
        />
      )}
      
      {activeTab === 'setup' && (
        <WeeklySetup 
            configs={machineConfigs} 
            updateConfig={updateMachineConfig} 
            globalForecasts={globalForecasts}
            setGlobalForecasts={updateGlobalForecasts}
            onResetWeek={resetWeek}
            onPromoteWeek={handlePromoteWeek}
            weekLabel={currentWeekLabel}
            isPrepMode={isPrepMode}
            staffList={staffList}
            readOnly={readOnly}
        />
      )}
      
      {activeTab === 'input' && (
        <div className="relative">
             {(isPrepMode || readOnly) && (
                <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                    <div className="text-center p-6 bg-white shadow-xl rounded-xl border border-gray-200">
                        <p className="font-bold text-gray-800 text-lg mb-2">
                            {readOnly ? "Archive (Lecture Seule)" : "Mode Préparation (S+2)"}
                        </p>
                        <p className="text-gray-500">
                            La saisie de production est désactivée dans ce mode.
                        </p>
                        <button onClick={() => handleWeekSelect('current')} className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg">Retour à la Production</button>
                    </div>
                </div>
            )}
            <DailyInput 
                configs={machineConfigs} 
                logs={logs} 
                addLog={addLog} 
                updateLog={updateLog}
                deleteLog={deleteLog}
            />
        </div>
      )}
      
      {activeTab === 'planning' && (
        <StaffPlanning 
          planning={planning} 
          savePlanning={savePlanning} 
          activeMachineIds={activeMachineIds}
          staffList={staffList}
          onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
          initialDate={getPlanningStartDate().toISOString().split('T')[0]}
          readOnly={readOnly}
        />
      )}

      {activeTab === 'staff' && (
        <StaffManagerWrapper 
            staffList={staffList} 
            onAdd={handleAddStaff} 
            onUpdate={handleUpdateStaff}
            onDelete={handleDeleteStaff} 
            onToggle={handleToggleStaff}
            logs={logs}
            planning={planning}
            onUpdatePlanning={savePlanning}
        />
      )}
    </Layout>
  );
}

const StaffManagerWrapper = ({ staffList, onAdd, onUpdate, onDelete, onToggle, logs, planning, onUpdatePlanning }: any) => {
    return (
        <StaffManager 
            staffList={staffList} 
            setStaffList={() => {}}
            // @ts-ignore
            onAdd={onAdd}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onToggle={onToggle}
            logs={logs}
            planning={planning}
            onUpdatePlanning={onUpdatePlanning}
        />
    )
}

export default App;
