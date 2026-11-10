/**
 * Creates a staff account, or updates the role/password of an existing one.
 *
 *   npm run admin:create -- --name "Asha Verma" --identifier asha@example.com [--role SUPER_ADMIN]
 *
 * The password is read from the ADMIN_PASSWORD environment variable or asked for on the terminal (not echoed),
 * so it never ends up in shell history.
 */
import { stdin, stdout } from 'node:process'
import { parseArgs } from 'node:util'
import { createPrisma } from '../src/lib/db.js'
import { hashPassword } from '../src/lib/password.js'
import { identifier, password as passwordSchema, personName } from '../src/shared/identity.js'
import { role } from '../src/shared/schemas.js'

try {
  process.loadEnvFile('.env')
} catch {
  // variables come from the environment
}

const { values } = parseArgs({
  options: { name: { type: 'string' }, identifier: { type: 'string' }, role: { type: 'string', default: 'SUPER_ADMIN' } },
})

const id = identifier.parse(values.identifier ?? '')
const staffRole = role.exclude(['STUDENT']).parse(values.role)

async function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) throw new Error('Set ADMIN_PASSWORD or run in a terminal')
  stdout.write(question)
  stdin.setRawMode(true)
  stdin.resume()
  let value = ''
  return new Promise((resolve, reject) => {
    const onData = (buf: Buffer) => {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          stdout.write('\n')
          return resolve(value)
        }
        if (ch === '\u0003') return reject(new Error('Cancelled'))
        if (ch === '\u007f') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

const pw = process.env.ADMIN_PASSWORD ?? (await askHidden('Password (min 8 characters): '))
const password = passwordSchema.parse(pw)
if (!process.env.ADMIN_PASSWORD && (await askHidden('Repeat password: ')) !== password) throw new Error('Passwords do not match')

const db = createPrisma(process.env.DATABASE_URL!)
try {
  const where = id.kind === 'email' ? { email: id.value } : { mobile: id.value }
  const existing = await db.user.findFirst({ where })
  const passwordHash = await hashPassword(password)
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role: staffRole, passwordHash, isActive: true, ...(values.name ? { name: personName.parse(values.name) } : {}) } })
    await db.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } })
    console.log(`Updated ${id.value}: role ${staffRole}, new password set.`)
  } else {
    await db.user.create({ data: { name: personName.parse(values.name ?? ''), ...where, role: staffRole, passwordHash } })
    console.log(`Created ${staffRole} ${id.value}.`)
  }
} finally {
  await db.$disconnect()
}
