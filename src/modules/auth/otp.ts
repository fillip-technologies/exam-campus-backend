import type { FastifyInstance } from 'fastify'
import type { Env } from '../../config/env.js'
import type { Identifier } from '../../shared/identity.js'

/**
 * Sends a one-time code. Only the "log" driver exists today: the code is written to the server log so
 * login-by-OTP and password reset can be tested locally. env.ts refuses "log" in production; add an SMS
 * (MSG91 / Twilio) and email (SES / Resend) driver here when the provider is chosen.
 */
export async function deliverOtp(
  app: FastifyInstance,
  env: Env,
  { to, code, purpose }: { to: Identifier; code: string; purpose: 'LOGIN' | 'RESET_PASSWORD' },
) {
  switch (env.OTP_DELIVERY) {
    case 'log':
      app.log.warn({ to: to.value, purpose }, `OTP code ${code} (development delivery: not sent to the user)`)
      return
  }
}
