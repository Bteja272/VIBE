import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  VIBE_AVATAR_IDS,
} from '../avatar';

export class CreateGuestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  @Matches(
    /^[a-zA-Z0-9 _-]+$/,
    {
      message:
        'Display name may contain letters, numbers, spaces, underscores, and hyphens only',
    },
  )
  displayName: string;

  @IsString()
  @IsIn(
    VIBE_AVATAR_IDS,
  )
  avatarId: string;
}