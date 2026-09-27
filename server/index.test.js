import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from './index.js'

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