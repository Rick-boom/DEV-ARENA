import { AUTH_ENDPOINTS } from '@/constants/api.js';
import { baseApi } from './base-api.js';
import type {
  ForgotPasswordPayload,
  LoginPayload,
  OAuthProvider,
  ResetPasswordPayload,
  SignupPayload,
  User,
  VerifyEmailPayload,
} from '@/types/auth.types.js';

interface AuthResponse {
  user: User;
  accessToken: string;
}

/**
 * Auth endpoints. Mutations invalidate the Session tag so anything
 * reading the current user re-fetches automatically after login/logout.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginPayload>({
      query: (body) => ({ url: AUTH_ENDPOINTS.LOGIN, method: 'POST', data: body }),
      invalidatesTags: ['Session'],
    }),

    signup: builder.mutation<AuthResponse, SignupPayload>({
      query: (body) => ({ url: AUTH_ENDPOINTS.SIGNUP, method: 'POST', data: body }),
      invalidatesTags: ['Session'],
    }),

    logout: builder.mutation<{ ok: true }, void>({
      query: () => ({ url: AUTH_ENDPOINTS.LOGOUT, method: 'POST' }),
      invalidatesTags: ['Session'],
    }),

    /** Session recovery on boot: the httpOnly cookie proves who we are. */
    refreshSession: builder.mutation<AuthResponse, void>({
      query: () => ({ url: AUTH_ENDPOINTS.REFRESH, method: 'POST' }),
      invalidatesTags: ['Session'],
    }),

    me: builder.query<User, void>({
      query: () => ({ url: AUTH_ENDPOINTS.ME, method: 'GET' }),
      providesTags: ['Session'],
    }),

    forgotPassword: builder.mutation<{ ok: true }, ForgotPasswordPayload>({
      query: (body) => ({ url: AUTH_ENDPOINTS.FORGOT_PASSWORD, method: 'POST', data: body }),
    }),

    resetPassword: builder.mutation<{ ok: true }, ResetPasswordPayload>({
      query: (body) => ({ url: AUTH_ENDPOINTS.RESET_PASSWORD, method: 'POST', data: body }),
    }),

    verifyEmail: builder.mutation<{ ok: true }, VerifyEmailPayload>({
      query: (body) => ({ url: AUTH_ENDPOINTS.VERIFY_EMAIL, method: 'POST', data: body }),
      invalidatesTags: ['Session'],
    }),

    resendVerification: builder.mutation<{ ok: true }, void>({
      query: () => ({ url: AUTH_ENDPOINTS.RESEND_VERIFICATION, method: 'POST' }),
    }),

    /** Exchanges the provider `code` from the OAuth callback for a session. */
    exchangeOAuth: builder.mutation<
      AuthResponse,
      { provider: OAuthProvider; code: string; state?: string }
    >({
      query: (body) => ({ url: AUTH_ENDPOINTS.OAUTH_EXCHANGE, method: 'POST', data: body }),
      invalidatesTags: ['Session'],
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useRefreshSessionMutation,
  useMeQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useExchangeOAuthMutation,
} = authApi;
