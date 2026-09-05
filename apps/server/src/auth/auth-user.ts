export type IdentityType =
  | 'GUEST'
  | 'REGISTERED';

export interface AuthUser {
  id: string;
  displayName: string;
  type: IdentityType;

  email?: string;
  imageUrl?: string;
}

export interface VibeJwtPayload {
  sub: string;
  displayName: string;
  type: IdentityType;

  email?: string;
  imageUrl?: string;

  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}