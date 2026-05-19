import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  executionDetailsResponseSchema,
  executionResultResponseSchema,
  jobStatusResponseSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ExecutionResultResponseDto extends createZodDto(executionResultResponseSchema) {}
export class JobStatusResponseDto extends createZodDto(jobStatusResponseSchema) {}
export class ExecutionDetailsResponseDto extends createZodDto(executionDetailsResponseSchema) {}
export class StaticAnalysisResultResponseDto {
  @ApiProperty({ description: 'Static analysis job ID' })
  jobId!: string;

  @ApiProperty({ enum: ['pending', 'completed', 'failed'] })
  status!: 'pending' | 'completed' | 'failed';

  @ApiProperty({ enum: ['run', 'submission'] })
  source!: 'run' | 'submission';

  @ApiProperty({ nullable: true })
  runId!: string | null;

  @ApiProperty({ nullable: true })
  submissionId!: string | null;

  @ApiProperty({ enum: ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust'] })
  language!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true })
  completedAt!: string | null;

  @ApiPropertyOptional({ type: Object })
  summary?: object;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  diagnostics?: object[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  complexity?: object[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  duplications?: object[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  toolResults?: object[];

  @ApiPropertyOptional({ nullable: true })
  error?: string | null;
}
