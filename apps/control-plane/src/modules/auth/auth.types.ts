/**
 * Shape of `request.user` after JWT validation.
 *
 * Returned by {@link JwtStrategy.validate} and injected via {@link CurrentUser}.
 */
export interface AuthUser {
  id: string;
  email: string;
}
