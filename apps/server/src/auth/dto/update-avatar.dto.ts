import {
  IsIn,
  IsString,
} from 'class-validator';

import {
  VIBE_AVATAR_IDS,
} from '../avatar';

export class UpdateAvatarDto {
  @IsString()
  @IsIn(VIBE_AVATAR_IDS)
  avatarId: string;
}