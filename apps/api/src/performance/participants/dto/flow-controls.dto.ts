import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

const PHASES = [
  'GOAL_DEFINITION',
  'FOLLOW_UP',
  'SELF_EVALUATION',
  'EVALUATION',
  'CALIBRATION',
  'CLOSING',
] as const;

export class ResetParticipantPhaseDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participantIds!: string[];

  @IsIn(PHASES)
  phase!: (typeof PHASES)[number];
}

export class ReassignLeaderDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('4', { each: true })
  participantIds!: string[];

  @IsUUID()
  managerEmployeeId!: string;
}

export class UnlockGoalsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  goalIds!: string[];
}
