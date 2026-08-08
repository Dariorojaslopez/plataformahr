export declare function wouldCreateParentCycle(nodeId: string, parentId: string, parentsById: Map<string, string | null>): boolean;
export declare function wouldCreateReportingCycle(employeeId: string, managerId: string, reportsToByEmployee: Map<string, string[]>): boolean;
export declare function assertNoCycle(condition: boolean, message: string): void;
export declare function emptyToNull(value?: string | null): string | null | undefined;
export declare function normalizeEmail(email: string): string;
