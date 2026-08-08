import type { TenantContext } from '../../auth/auth.types';
import { ApplicationsService } from '../applications/applications.service';
export declare class PipelineController {
    private readonly applicationsService;
    constructor(applicationsService: ApplicationsService);
    pipeline(tenant: TenantContext, vacancyId: string): Promise<{
        vacancy: {
            id: string;
            status: import("@prisma/client").$Enums.VacancyStatus;
            title: string;
        };
        columns: {
            stage: "PENDING_REVIEW" | "CONTACTED" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED" | "WITHDRAWN";
            count: number;
            applications: {
                applicationId: string;
                candidateId: string;
                candidateName: string;
                candidateEmail: string;
                stage: import("@prisma/client").$Enums.ApplicationStage;
                lastStageChangedAt: Date;
            }[];
        }[];
    }>;
}
