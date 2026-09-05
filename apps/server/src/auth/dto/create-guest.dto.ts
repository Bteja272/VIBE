import {
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateGuestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message:
      'Display name may contain letters, numbers, spaces, underscores, and hyphens only',
  })
  displayName: string;
}