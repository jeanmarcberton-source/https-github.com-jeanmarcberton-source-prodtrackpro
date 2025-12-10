
export type MachineId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'PAC';
export type TeamType = 'MATIN' | 'SOIR';
export type RoleType = 'PIMA' | 'OPERATEUR' | 'GESTIONNAIRE' | 'PREPARATEUR';
export type DayOfWeek = 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
export type StaffTeamId = 1 | 2 | null; // Equipe 1, Equipe 2 ou Flexible (null)

export interface GlobalForecasts {
  totalVolume: number; // Volume global prévu
  totalWeight: number; // Poids global prévu
  predictedBal: number; // Nombre BAL total prévu (Info)
  maxDocsPerHandful: number; // Contrainte technique globale
  maxWeightPerHandful: number; // Contrainte technique globale
}

export interface MachineConfig {
  id: MachineId;
  active: boolean;
  targetBal: number; // Objectif BAL
  targetVolume: number; // Objectif Volume
  targetCadence: number; // Débit théorique
}

export interface ProductionLog {
  id: string;
  date: string; // YYYY-MM-DD
  machineId: MachineId;
  team: TeamType;
  balProduced: number;
  docsProduced: number;
  hours: number; // In hundredths (e.g. 7.50)
}

export interface StaffMember {
  id: string;
  name: string;
  defaultRole?: RoleType;
  isInterim: boolean;
  active: boolean;
  weeklyHours?: number; // Contrat hebdo (ex: 35)

  // Gestion Equipes & Absences
  assignedTeam?: StaffTeamId; // 1 ou 2
  isAbsent?: boolean; // Absent longue durée ou temporaire
  
  // Qualifications Sécurité
  isSecouriste?: boolean;
  isGuideFile?: boolean;
  isSerreFile?: boolean;
  
  // Deprecated but kept for type compatibility if needed internally
  defaultTeam?: string; 
}

export interface StaffAssignment {
  name: string;
  isInterim: boolean;
  hoursOverride?: number; // Surcharge manuelle des heures (ex: départ anticipé)
}

export interface PlanningAssignment {
  date: string;
  team: TeamType;
  // Key: MachineId_Role_Index, Value: StaffAssignment object
  assignments: Record<string, StaffAssignment>; 
}

export interface AppState {
  currentWeekStart: string; // YYYY-MM-DD of Monday
  globalForecasts: GlobalForecasts;
  machineConfigs: Record<MachineId, MachineConfig>;
  logs: ProductionLog[];
  planning: PlanningAssignment[];
}

// Archive structure for History
export interface WeeklyArchive {
  id: string;
  weekLabel: string;
  startDate: string;
  createdAt: string;
  data: {
    logs: ProductionLog[];
    planning: PlanningAssignment[];
    machineConfigs: Record<MachineId, MachineConfig>;
    globalForecasts: GlobalForecasts;
  };
}

// Option pour le sélecteur de semaine
export interface WeekOption {
    id: string;
    label: string;
    type: 'CURRENT' | 'FUTURE' | 'ARCHIVE';
    dateLabel?: string;
}

export const MACHINE_LABELS: Record<MachineId, string> = {
  M1: 'Machine 1',
  M2: 'Machine 2',
  M3: 'Machine 3',
  M4: 'Machine 4',
  M5: 'Machine 5',
  M6: 'Machine 6',
  PAC: 'PAC (Manuel)',
};

export const ROLES: RoleType[] = ['PIMA', 'OPERATEUR', 'GESTIONNAIRE', 'PREPARATEUR'];

export const DAYS: DayOfWeek[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
