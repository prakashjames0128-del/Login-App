import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const demoCredentials = {
    email: 'hello@daymark.app',
    password: 'daymark2026',
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sendSession(response, user, status = 200) {
    return response.status(status).json({
        token: randomBytes(24).toString('base64url'),
        user: { name: user.name, email: user.email },
    })
}

function validateCredentials(body, response, includeName = false) {
    const { name, email, password } = body || {}
    if (includeName && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60)) {
        response.status(400).json({ message: 'Enter a name between 2 and 60 characters.' })
        return null
    }
    if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
        response.status(400).json({ message: 'Enter a valid email address.' })
        return null
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        response.status(400).json({ message: 'Use a password between 8 and 128 characters.' })
        return null
    }
    return { name: includeName ? name.trim() : undefined, email: email.trim().toLowerCase(), password }
}

async function redisCommand(command) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null

    const result = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([command]),
    })
    if (!result.ok) throw new Error('Account storage request failed.')
    const commands = await result.json()
    if (!Array.isArray(commands) || commands[0]?.error) throw new Error('Account storage request failed.')
    return commands[0]?.result ?? null
}

function allowPost(request, response) {
    if (request.method === 'POST') return true
    response.setHeader('Allow', 'POST')
    response.status(405).json({ message: 'Use POST for this request.' })
    return false
}

export async function handleVercelLogin(request, response) {
    if (!allowPost(request, response)) return
    const credentials = validateCredentials(request.body, response)
    if (!credentials) return

    if (credentials.email === demoCredentials.email && credentials.password === demoCredentials.password) {
        return sendSession(response, { name: 'Maya Chen', email: demoCredentials.email })
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return response.status(503).json({ message: 'Account sign-in is not configured on this deployment yet.' })
    }

    try {
        const storedUser = await redisCommand(['GET', `daymark:user:${credentials.email}`])
        if (!storedUser) return response.status(401).json({ message: 'That email and password do not match.' })
        const user = JSON.parse(storedUser)
        const submittedHash = scryptSync(credentials.password, user.salt, 64)
        const storedHash = Buffer.from(user.passwordHash, 'hex')
        if (storedHash.length !== submittedHash.length || !timingSafeEqual(submittedHash, storedHash)) {
            return response.status(401).json({ message: 'That email and password do not match.' })
        }
        return sendSession(response, user)
    } catch {
        return response.status(503).json({ message: 'Account sign-in is temporarily unavailable.' })
    }
}

export async function handleVercelSignup(request, response) {
    if (!allowPost(request, response)) return
    const account = validateCredentials(request.body, response, true)
    if (!account) return
    if (account.email === demoCredentials.email) {
        return response.status(409).json({ message: 'An account with that email already exists. Sign in instead.' })
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return response.status(503).json({ message: 'Account creation is not configured on this deployment yet.' })
    }

    try {
        const salt = randomBytes(16).toString('hex')
        const passwordHash = scryptSync(account.password, salt, 64).toString('hex')
        const user = { name: account.name, email: account.email, salt, passwordHash }
        const saved = await redisCommand(['SET', `daymark:user:${account.email}`, JSON.stringify(user), 'NX'])
        if (!saved) return response.status(409).json({ message: 'An account with that email already exists. Sign in instead.' })
        return sendSession(response, user, 201)
    } catch {
        return response.status(503).json({ message: 'Account creation is temporarily unavailable.' })
    }
}