export interface UserSession {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  identifier: string; // CPF ou Matrícula
  pass: string;
}