import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scryptSync } from 'node:crypto'
import test from 'node:test'
import { createApp } from './index.js'
import { handleVercelLogin, handleVercelSignup } from './vercel-auth-upstash.js'

function mockResponse() {
    return {
        statusCode: 200,
        headers: {},
        status(code) {
            this.statusCode = code
            return this
        },
        setHeader(name, value) {
            this.headers[name] = value
        },
        json(body) {
            this.body = body
            return this
        },
    }
}

async function withTestServer(run) {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'daymark-auth-test-'))
    const server = createApp({ dataDirectory }).listen(0)
    await once(server, 'listening')

    try {
        await run(`http://127.0.0.1:${server.address().port}`, dataDirectory)
    } finally {
        server.close()
        await once(server, 'close')
        rmSync(dataDirectory, { recursive: true, force: true })
    }
}

function post(baseUrl, route, body) {
    return fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

test('signup stores a password hash and a new account can sign in', async () => {
    await withTestServer(async (baseUrl, dataDirectory) => {
        const invalid = await post(baseUrl, '/api/signup', {
            name: 'A',
            email: 'not-an-email',
            password: 'short',
        })
        assert.equal(invalid.status, 400)

        const signup = await post(baseUrl, '/api/signup', {
            name: 'Ada Lovelace',
            email: ' ADA@example.com ',
            password: 'correct-horse-42',
        })
        assert.equal(signup.status, 201)
        const created = await signup.json()
        assert.equal(created.user.name, 'Ada Lovelace')
        assert.equal(created.user.email, 'ada@example.com')
        assert.ok(created.token)

        const storedUsers = JSON.parse(readFileSync(join(dataDirectory, 'users.json'), 'utf8'))
        assert.notEqual(storedUsers[0].passwordHash, 'correct-horse-42')
        assert.ok(storedUsers[0].salt)

        const duplicate = await post(baseUrl, '/api/signup', {
            name: 'Ada Again',
            email: 'ada@example.com',
            password: 'another-password',
        })
        assert.equal(duplicate.status, 409)

        const wrongPassword = await post(baseUrl, '/api/login', {
            email: 'ada@example.com',
            password: 'incorrect-password',
        })
        assert.equal(wrongPassword.status, 401)

        const login = await post(baseUrl, '/api/login', {
            email: 'ADA@example.com',
            password: 'correct-horse-42',
        })
        assert.equal(login.status, 200)
        assert.deepEqual((await login.json()).user, created.user)
    })
})

test('the documented static demo account still signs in', async () => {
    await withTestServer(async (baseUrl) => {
        const invalid = await post(baseUrl, '/api/login', {
            email: 'hello@daymark.app',
            password: 'incorrect-password',
        })
        assert.equal(invalid.status, 401)

        const accepted = await post(baseUrl, '/api/login', {
            email: ' HELLO@DAYMARK.APP ',
            password: 'daymark2026',
        })
        assert.equal(accepted.status, 200)
        assert.deepEqual((await accepted.json()).user, {
            name: 'Maya Chen',
            email: 'hello@daymark.app',
        })
    })
})

test('Vercel handlers accept demo login and use durable Redis when configured', async () => {
    const previousUrl = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL
    const previousToken = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
    const originalFetch = globalThis.fetch
    const savedUsers = new Map()
    const salt = 'test-salt'
    const account = {
        name: 'Vercel Member',
        email: 'vercel-member@example.com',
        salt,
        passwordHash: scryptSync('correct-horse-42', salt, 64).toString('hex'),
    }

    try {
        delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL
        delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
        const demoResponse = mockResponse()
        await handleVercelLogin({ method: 'POST', body: { email: 'hello@daymark.app', password: 'daymark2026' } }, demoResponse)
        assert.equal(demoResponse.statusCode, 200)
        assert.equal(demoResponse.body.user.email, 'hello@daymark.app')

        const storageMissingResponse = mockResponse()
        await handleVercelLogin({ method: 'POST', body: { email: 'member@example.com', password: 'correct-horse-42' } }, storageMissingResponse)
        assert.equal(storageMissingResponse.statusCode, 503)
        const signupWithoutStorage = mockResponse()
        await handleVercelSignup({ method: 'POST', body: { name: 'Member', email: 'member@example.com', password: 'correct-horse-42' } }, signupWithoutStorage)
        assert.equal(signupWithoutStorage.statusCode, 503)

        process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = 'https://redis.example.test'
        process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = 'test-token'
        globalThis.fetch = async (_url, options) => {
            const [[command, key, value, nx]] = JSON.parse(options.body)
            if (command === 'SET') {
                if (nx === 'NX' && savedUsers.has(key)) return { ok: true, json: async () => [{ result: null }] }
                savedUsers.set(key, value)
                return { ok: true, json: async () => [{ result: 'OK' }] }
            }
            return { ok: true, json: async () => [{ result: savedUsers.get(key) || null }] }
        }

        const signupResponse = mockResponse()
        await handleVercelSignup({ method: 'POST', body: { name: account.name, email: account.email, password: 'correct-horse-42' } }, signupResponse)
        assert.equal(signupResponse.statusCode, 201)
        assert.equal(signupResponse.body.user.email, account.email)

        const loginResponse = mockResponse()
        await handleVercelLogin({ method: 'POST', body: { email: account.email, password: 'correct-horse-42' } }, loginResponse)
        assert.equal(loginResponse.statusCode, 200)
        assert.equal(loginResponse.body.user.name, account.name)

        const duplicateResponse = mockResponse()
        await handleVercelSignup({ method: 'POST', body: { name: account.name, email: account.email, password: 'correct-horse-42' } }, duplicateResponse)
        assert.equal(duplicateResponse.statusCode, 409)
    } finally {
        globalThis.fetch = originalFetch
        if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_URL
        else process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = previousUrl
        if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
        else process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = previousToken
    }
})