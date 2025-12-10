
import React from 'react';
import { Activity, Calendar, Settings, FileInput, LayoutDashboard, Menu, X, Users, EyeOff, Briefcase, History } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isPreviewMode?: boolean;
  setIsPreviewMode?: (val: boolean) => void;
  isPrepMode?: boolean; // Keep prop for banner display only
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, isPreviewMode = false, setIsPreviewMode, isPrepMode = false }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'planning', label: 'Planning Équipe', icon: Calendar },
    { id: 'input', label: 'Saisie Production', icon: FileInput },
    { id: 'staff', label: 'Personnel', icon: Users },
    { id: 'setup', label: 'Objectifs Semaine', icon: Settings },
  ];

  return (
    // FIX PRINT: Utilisation de print:block et print:h-auto pour casser le flexbox
    <div className="min-h-screen flex flex-col md:flex-row print:block print:h-auto print:min-h-0 print:static print:overflow-visible bg-gray-50 print:bg-white">
      {/* Print Preview Close Button */}
      {isPreviewMode && setIsPreviewMode && (
          <button 
            onClick={() => setIsPreviewMode(false)}
            className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors animate-in fade-in slide-in-from-top-4 print:hidden"
          >
              <EyeOff className="w-4 h-4" /> Fermer l'aperçu
          </button>
      )}

      {/* Mobile Header - Hidden in Preview & Print */}
      {!isPreviewMode && (
        <div className="md:hidden bg-brand-900 text-white p-4 flex justify-between items-center no-print print:hidden">
            <div className="font-bold text-xl flex items-center gap-2">
            <Activity className="w-6 h-6" /> ProdTrack
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
            </button>
        </div>
      )}

      {/* Sidebar - Hidden in Preview & Print */}
      {!isPreviewMode && (
        <aside className={`
            fixed md:relative z-20 w-64 bg-brand-900 text-white h-full min-h-screen transition-transform duration-300 ease-in-out no-print print:hidden flex flex-col
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
            <div className="p-6 font-bold text-2xl items-center gap-2 hidden md:flex border-b border-brand-700">
            <Activity className="w-8 h-8 text-brand-500" />
            <span>ProdTrack</span>
            </div>
            
            <nav className="mt-6 px-2 flex-1">
            {navItems.map((item) => (
                <button
                key={item.id}
                onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                }}
                className={`
                    w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-colors
                    ${activeTab === item.id ? 'bg-brand-600 text-white shadow-lg' : 'text-brand-100 hover:bg-brand-800'}
                `}
                >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                </button>
            ))}
            </nav>

            {isPrepMode && (
                <div className="p-4 border-t border-brand-700 bg-purple-900/30">
                     <p className="text-[10px] text-purple-300 text-center uppercase font-bold tracking-wider">
                        Mode Préparation Actif
                    </p>
                </div>
            )}

            <div className="p-4 text-xs text-brand-300 text-center">
            v1.7.0 ProdTrack Pro
            </div>
        </aside>
      )}

      {/* Main Content */}
      {/* FIX PRINT: Suppression de h-screen et overflow-y-auto lors de l'impression */}
      <main className={`
        flex-1 h-screen overflow-y-auto 
        print:h-auto print:min-h-0 print:overflow-visible print:block print:w-full print:p-0
        ${isPreviewMode ? 'bg-white p-8' : 'bg-gray-50 p-4 md:p-8'}
      `}>
        <div className={`mx-auto ${isPreviewMode ? 'max-w-none' : 'max-w-7xl'} print:max-w-none print:w-full`}>
            {/* Top Bar Alert for Prep Mode - Hidden in Print */}
            {isPrepMode && !isPreviewMode && (
                <div className="mb-6 bg-purple-100 border-l-4 border-purple-600 p-4 rounded-r-lg shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 no-print print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-200 p-2 rounded-full">
                            <Briefcase className="w-5 h-5 text-purple-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-purple-900">Mode Préparation (S+2)</h3>
                            <p className="text-sm text-purple-700">Vous préparez la semaine prochaine. Les modifications n'impactent pas la production en cours.</p>
                        </div>
                    </div>
                </div>
            )}
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
