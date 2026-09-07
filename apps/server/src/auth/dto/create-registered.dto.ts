import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRegisteredDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}