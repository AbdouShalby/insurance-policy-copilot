import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class DocumentDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) doc_id!: string;
  @IsString() @Matches(/\S/) @MaxLength(300) title!: string;
}

export class AskDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) question!: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) top_k?: number;
}

export class CrmDto {
  @IsString() @Matches(/\S/) @MaxLength(200) event_id!: string;
  @IsString() @Matches(/\S/) @MaxLength(200) case_id!: string;
  @IsString() @Matches(/\S/) @MaxLength(2000) customer_question!: string;
}
