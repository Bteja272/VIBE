import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message:
      'Display name can only contain letters, numbers, spaces, underscores, and hyphens',
  })
  displayName: string;
}
