export type NineBoxCell = {
  row: number;
  col: number;
  label: string;
  color: string;
};

export type CalibrationEmployeeRef = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type CalibrationSession = {
  id: string;
  companyId: string;
  name: string;
  opensAt: string | null;
  closesAt: string | null;
  cells: NineBoxCell[];
  invitees: CalibrationEmployeeRef[];
  leaders: CalibrationEmployeeRef[];
  createdAt: string;
  updatedAt: string;
};

export type CalibrationConfig = {
  showNineBoxOnMyResults: boolean;
  sessionId: string | null;
  cells: NineBoxCell[];
};

export type CalibrationPlacement = {
  employee: CalibrationEmployeeRef;
  leaderEmployeeId: string;
  overallScore: string | null;
  competencyScore: string | null;
  cycleId: string | null;
  row: number | null;
  col: number | null;
  calculatedRow?: number | null;
  calculatedCol?: number | null;
  justification?: string | null;
  moved?: boolean;
};

export type CreateCalibrationSessionInput = {
  name: string;
  opensAt?: string | null;
  closesAt?: string | null;
  inviteeEmployeeIds?: string[];
  leaderEmployeeIds?: string[];
};

export type UpdateCalibrationSessionInput = {
  name?: string;
  opensAt?: string | null;
  closesAt?: string | null;
  cells?: NineBoxCell[];
  inviteeEmployeeIds?: string[];
  leaderEmployeeIds?: string[];
};
