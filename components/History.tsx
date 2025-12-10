
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { WeeklyArchive, AppState, MACHINE_LABELS, MachineId, WeekOption } from '../types';
import Dashboard from './Dashboard';
import StaffPlanning from './StaffPlanning';
import WeeklySetup from './WeeklySetup';
import { FileText, Calendar, ArrowLeft, Loader2, Archive, LayoutDashboard, Settings, Users } from 'lucide-react';

interface HistoryProps {
  onBackToApp: () => void;
}

const History: React.FC<HistoryProps> = ({ onBackToApp }) => {
  const [archives, setArchives] = useState<WeeklyArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArchive, setSelectedArchive] = useState<WeeklyArchive | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Onglet actif dans la vue archive
  const [archiveTab, setArchiveTab] = useState<'dashboard' | 'planning' | 'setup'>('dashboard');

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('weekly_archives')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted: WeeklyArchive[] = data.map((d: any) => ({
          id: d.id,
          weekLabel: d.week_label,
          startDate: d.start_date,
          createdAt: d.created_at,
          data: d.data
        }));
        setArchives(formatted);
      }
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeMachineIds = selectedArchive 
      ? (Object.keys(selectedArchive.data.machineConfigs).filter(k => selectedArchive.data.machineConfigs[k as MachineId].active) as MachineId[]) 
      : [];

  // Generate Week Options for Dashboard Navigation within Archives
  const weekOptions: WeekOption[] = archives.map(a => ({
      id: a.id,
      label: a.weekLabel,
      type: 'ARCHIVE'
  }));

  const handleSelectWeek = (id: string) => {
      const arch = archives.find(a => a.id === id);
      if (arch) {
          setSelectedArchive(arch);
      }
  };

  if (selectedArchive) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header Archive */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center no-print sticky top-0 z-50 shadow-md">
            <button 
                onClick={() => setSelectedArchive(null)}
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
                <ArrowLeft className="w-5 h-5" /> Retour à la liste
            </button>
            <div className="font-bold flex items-center gap-2 text-lg">
                <Archive className="w-5 h-5 text-orange-400" />
                <span className="text-orange-100">Consultation :</span> {selectedArchive.weekLabel}
            </div>
            <div className="text-xs text-slate-400">
                Archivé le {new Date(selectedArchive.createdAt).toLocaleDateString()}
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 px-4 pt-4 no-print sticky top-16 z-40">
            <div className="flex gap-4 max-w-7xl mx-auto">
                <button
                    onClick={() => setArchiveTab('dashboard')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                        archiveTab === 'dashboard' 
                        ? 'border-brand-600 text-brand-600 bg-brand-50/50' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <LayoutDashboard className="w-4 h-4" /> Bilan & Performance
                </button>
                <button
                    onClick={() => setArchiveTab('planning')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                        archiveTab === 'planning' 
                        ? 'border-brand-600 text-brand-600 bg-brand-50/50' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Users className="w-4 h-4" /> Planning Archivé
                </button>
                <button
                    onClick={() => setArchiveTab('setup')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                        archiveTab === 'setup' 
                        ? 'border-brand-600 text-brand-600 bg-brand-50/50' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Settings className="w-4 h-4" /> Configuration & Objectifs
                </button>
            </div>
        </div>
        
        {/* Content */}
        <div className="p-4 md:p-8 flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto">
                {archiveTab === 'dashboard' && (
                    <Dashboard 
                        configs={selectedArchive.data.machineConfigs}
                        logs={selectedArchive.data.logs}
                        planning={selectedArchive.data.planning}
                        globalForecasts={selectedArchive.data.globalForecasts}
                        weekLabel={selectedArchive.weekLabel}
                        onTogglePreview={() => setPreviewMode(!previewMode)}
                        weekOptions={weekOptions}
                        selectedWeekId={selectedArchive.id}
                        onSelectWeek={handleSelectWeek}
                        readOnly={true}
                    />
                )}

                {archiveTab === 'planning' && (
                    <StaffPlanning 
                        planning={selectedArchive.data.planning}
                        savePlanning={() => {}} // No-op in read-only
                        activeMachineIds={activeMachineIds}
                        staffList={[]} // Pour l'archive, on n'a pas forcément besoin de la liste complète pour l'affichage simple, ou on pourrait la stocker
                        readOnly={true}
                        initialDate={selectedArchive.startDate}
                    />
                )}

                {archiveTab === 'setup' && (
                    <WeeklySetup 
                        configs={selectedArchive.data.machineConfigs}
                        updateConfig={() => {}} // No-op
                        globalForecasts={selectedArchive.data.globalForecasts}
                        setGlobalForecasts={() => {}} // No-op
                        onResetWeek={() => {}} // No-op
                        weekLabel={selectedArchive.weekLabel}
                        readOnly={true}
                    />
                )}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Historique & Bilans</h2>
            <p className="text-gray-500">Sélectionnez une semaine passée pour consulter l'intégralité du dossier (Bilan, Planning, Config).</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : archives.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune archive disponible.</p>
            <p className="text-sm text-gray-400">Les semaines archivées apparaîtront ici après validation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
            {archives.map(archive => (
                <button
                    key={archive.id}
                    onClick={() => setSelectedArchive(archive)}
                    className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all text-left group"
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-brand-50 rounded-lg group-hover:bg-brand-100 transition-colors">
                            <FileText className="w-6 h-6 text-brand-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 group-hover:text-brand-700 transition-colors">{archive.weekLabel}</h3>
                            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                <Calendar className="w-3 h-3" /> Archivé le {new Date(archive.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-0 flex flex-col items-end">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-2">
                            {archive.data.logs.reduce((acc: number, l: any) => acc + l.balProduced, 0).toLocaleString()} BAL
                        </span>
                        <span className="text-xs text-gray-400">
                             Cliquez pour ouvrir le dossier complet
                        </span>
                    </div>
                </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default History;
