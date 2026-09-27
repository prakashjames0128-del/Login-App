import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import express from 'express'

const demoCredentials = {
    email: 'hello@daymark.app',
    password: 'daymark2026',
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const defaultDataDirectory = join(dirname(fileURLToPath(import.meta.url)), 'data')

function readUsers(usersPath) {
    try {
        return JSON.parse(readFileSync(usersPath, 'utf8'))
    } catch (error) {
        if (error.code === 'ENOENT') return []
        throw error
    }
}

function saveUsers(usersPath, users) {
    mkdirSync(dirname(usersPath), { recursive: true })
    writeFileSync(usersPath, JSON.stringify(users, null, 2))
}

function createSession(user) {
    return {
        token: randomBytes(24).toString('base64url'),
        user: { name: user.name, email: user.email },
    }
}

export function createApp({ dataDirectory = defaultDataDirectory } = {}) {
    const app = express()
    const usersPath = join(dataDirectory, 'users.json')

    app.use(express.json({ limit: '10kb' }))

    app.post('/api/signup', (request, response) => {
        const { name, email, password } = request.body || {}
        if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
            return response.status(400).json({ message: 'Enter a name between 2 and 60 characters.' })
        }
        if (typeof email !== 'string' || !emailPattern.test(email.trim())) {
            return response.status(400).json({ message: 'Enter a valid email address.' })
        }
        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            return response.status(400).json({ message: 'Use a password between 8 and 128 characters.' })
        }

        const normalizedEmail = email.trim().toLowerCase()
        const users = readUsers(usersPath)
        if (users.some((user) => user.email === normalizedEmail) || normalizedEmail === demoCredentials.email) {
            return response.status(409).json({ message: 'An account with that email already exists. Sign in instead.' })
        }

        const salt = randomBytes(16).toString('hex')
        const passwordHash = scryptSync(password, salt, 64).toString('hex')
        const user = { name: name.trim(), email: normalizedEmail, salt, passwordHash }
        saveUsers(usersPath, [...users, user])
        return response.status(201).json(createSession(user))
    })

    app.post('/api/login', (request, response) => {
        const { email, password } = request.body || {}
        if (typeof email !== 'string' || typeof password !== 'string') {
            return response.status(400).json({ message: 'Enter your email address and password.' })
        }

        const normalizedEmail = email.trim().toLowerCase()
        if (!emailPattern.test(normalizedEmail)) {
            return response.status(400).json({ message: 'Enter a valid email address.' })
        }

        if (normalizedEmail === demoCredentials.email && password === demoCredentials.password) {
            return response.json(createSession({ name: 'Maya Chen', email: demoCredentials.email }))
        }

        const user = readUsers(usersPath).find((account) => account.email === normalizedEmail)
        if (!user) {
            return response.status(401).json({ message: 'That email and password do not match.' })
        }

        const submittedHash = scryptSync(password, user.salt, 64)
        const storedHash = Buffer.from(user.passwordHash, 'hex')
        if (storedHash.length !== submittedHash.length || !timingSafeEqual(submittedHash, storedHash)) {
            return response.status(401).json({ message: 'That email and password do not match.' })
        }

        return response.json(createSession(user))
    })

    return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const port = process.env.PORT || 4000
    createApp().listen(port, () => {
        console.log(`Daymark mock API listening on http://localhost:${port}`)
    })
}