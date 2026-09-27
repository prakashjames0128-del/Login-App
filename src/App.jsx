import { useEffect, useState } from 'react'
import './App.css'

const SESSION_KEY = 'daymark-login-session'

const starterTasks = [
    { id: 1, title: 'Review the project brief', detail: 'Studio refresh · 20 min', complete: true },
    { id: 2, title: 'Send the first draft', detail: 'Brand direction · 45 min', complete: false },
    { id: 3, title: 'Take a proper lunch break', detail: 'A little space goes a long way', complete: false },
]

function readSession() {
    try {
        const rawSession = window.localStorage.getItem(SESSION_KEY)
            || window.sessionStorage.getItem(SESSION_KEY)
        return rawSession ? JSON.parse(rawSession) : null
    } catch {
        return null
    }
}

function Brand({ light = false }) {
    return (
        <a className={`brand${light ? ' brand-light' : ''}`} href="/" aria-label="Daymark home">
            <span className="brand-symbol" aria-hidden="true"><span /></span>
            <span>daymark</span>
        </a>
    )
}

function LoginPage({ onLogin }) {
    const [mode, setMode] = useState('login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [remember, setRemember] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [errors, setErrors] = useState({})
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        const nextErrors = {}
        const normalizedEmail = email.trim()

        if (mode === 'signup' && name.trim().length < 2) {
            nextErrors.name = 'Enter your name (at least 2 characters).'
        }
        if (!normalizedEmail) {
            nextErrors.email = 'Enter your email address.'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            nextErrors.email = 'Enter a valid email address.'
        }
        if (!password) {
            nextErrors.password = 'Enter your password.'
        } else if (password.length < 8) {
            nextErrors.password = 'Use at least 8 characters.'
        }

        setErrors(nextErrors)
        setMessage('')
        if (Object.keys(nextErrors).length) return

        setLoading(true)
        try {
            const response = await fetch(mode === 'signup' ? '/api/signup' : '/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email: normalizedEmail, password }),
            })
            const result = await response.json()
            if (!response.ok) {
                setMessage(result.message || 'We could not sign you in. Check your details and try again.')
                return
            }
            onLogin(result, remember)
        } catch {
            setMessage('The sign-in service is unavailable. Please try again shortly.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="login-layout">
            <section className="welcome-panel" aria-label="Daymark introduction">
                <img
                    className="welcome-image"
                    src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85"
                    alt="A bright, plant-filled studio with room to think"
                />
                <div className="welcome-overlay" />
                <div className="welcome-top"><Brand light /><span className="edition-label">A CALMER WAY TO BEGIN</span></div>
                <div className="welcome-copy">
                    <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
                    <h1>Small steps.<br />Bright days.</h1>
                    <p className="welcome-description">A thoughtful space to find your focus, tend to the important things, and move forward at your own pace.</p>
                </div>
                <div className="welcome-bottom"><span>01</span><span className="welcome-rule" /><span>YOUR EVERYDAY, WITH INTENTION</span></div>
            </section>

            <section className="login-panel" aria-labelledby="login-title">
                <div className="mobile-brand"><Brand /></div>
                <div className="login-content">
                    <div className="welcome-chip"><span aria-hidden="true">✳</span> {mode === 'signup' ? 'A GOOD PLACE TO BEGIN' : 'WELCOME BACK'}</div>
                    <h2 id="login-title">{mode === 'signup' ? 'Create your account' : 'Sign in to your space'}</h2>
                    <p className="login-intro">{mode === 'signup' ? 'Make a little space for your next good day.' : 'Pick up right where you left off.'}</p>

                    <form className="login-form" onSubmit={handleSubmit} noValidate>
                        {mode === 'signup' && <div className="field-group">
                            <label htmlFor="name">Your name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                autoComplete="name"
                                placeholder="How should we call you?"
                                value={name}
                                aria-invalid={Boolean(errors.name)}
                                aria-describedby={errors.name ? 'name-error' : undefined}
                                onChange={(event) => setName(event.target.value)}
                            />
                            {errors.name && <span className="field-error" id="name-error">{errors.name}</span>}
                        </div>}
                        <div className="field-group">
                            <label htmlFor="email">Email address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                            {errors.email && <span className="field-error" id="email-error">{errors.email}</span>}
                        </div>

                        <div className="field-group">
                            <div className="label-line"><label htmlFor="password">Password</label></div>
                            <div className={`password-control${errors.password ? ' has-error' : ''}`}>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                    placeholder="At least 8 characters"
                                    value={password}
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                                <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {errors.password && <span className="field-error" id="password-error">{errors.password}</span>}
                        </div>

                        <label className="remember-control">
                            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                            <span className="checkmark" aria-hidden="true" />
                            Keep me signed in
                        </label>

                        {message && <div className="form-message" role="alert">{message}</div>}

                        <button className="login-button" type="submit" disabled={loading}>
                            <span>{loading ? (mode === 'signup' ? 'Creating your account...' : 'Signing you in...') : mode === 'signup' ? 'Create account' : 'Sign in'}</span>
                            <span className="button-arrow" aria-hidden="true">↗</span>
                        </button>
                    </form>

                    {mode === 'login' && <div className="demo-access">
                        <span className="demo-mark" aria-hidden="true">i</span>
                        <p>Demo access <strong>hello@daymark.app</strong><span>/</span><strong>daymark2026</strong></p>
                    </div>}
                    <p className="account-switch">{mode === 'signup' ? 'Already have an account?' : 'New to Daymark?'} <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErrors({}); setMessage('') }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
                </div>
                <footer className="login-footer"><span>DAYMARK STUDIO</span><span>PRIVATE BY DESIGN</span></footer>
            </section>
        </main>
    )
}

function Dashboard({ user, onSignOut }) {
    const [tasks, setTasks] = useState(starterTasks)
    const completedCount = tasks.filter((task) => task.complete).length
    const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

    function toggleTask(taskId) {
        setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId
            ? { ...task, complete: !task.complete }
            : task))
    }

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Brand />
                <div className="dashboard-account"><span className="account-avatar">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="account-name">{user.name}</span><button type="button" className="signout-button" onClick={onSignOut}>Sign out</button></div>
            </header>

            <div className="dashboard-main">
                <div className="dashboard-heading">
                    <div><p className="eyebrow">YOUR PERSONAL WORKSPACE</p><h1>Good to have you here, {user.name.split(' ')[0]}.</h1><p className="dashboard-intro">A little progress goes a long way. Here’s your day, at a glance.</p></div>
                    <div className="date-stamp"><span>TODAY</span><strong>{today}</strong></div>
                </div>

                <section className="summary-grid" aria-label="Daily summary">
                    <article className="summary-item"><span className="summary-label">ON YOUR LIST</span><strong>{String(tasks.length).padStart(2, '0')}</strong><span>small things, moving forward</span></article>
                    <article className="summary-item summary-highlight"><span className="summary-label">ALREADY DONE</span><strong>{String(completedCount).padStart(2, '0')}</strong><span>and counting</span></article>
                    <article className="summary-item"><span className="summary-label">PACE</span><strong>{Math.round((completedCount / tasks.length) * 100)}<small>%</small></strong><span>your day, your rhythm</span></article>
                </section>

                <div className="dashboard-columns">
                    <section className="focus-section" aria-labelledby="focus-title">
                        <div className="section-heading"><div><p className="eyebrow">ONE THING AT A TIME</p><h2 id="focus-title">Today’s focus</h2></div><span className="focus-count">{completedCount} / {tasks.length} COMPLETE</span></div>
                        <div className="task-list">{tasks.map((task) => <button className={`task-row${task.complete ? ' is-complete' : ''}`} type="button" key={task.id} aria-pressed={task.complete} onClick={() => toggleTask(task.id)}><span className="task-check" aria-hidden="true">{task.complete ? '✓' : ''}</span><span className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></span><span className="task-arrow" aria-hidden="true">↗</span></button>)}</div>
                        <p className="task-hint">Select a task to mark it complete.</p>
                    </section>

                    <aside className="daily-note"><div className="note-photo" role="img" aria-label="Morning light in a quiet studio" /><div className="note-copy"><p className="eyebrow">A NOTE FOR TODAY</p><h2>Give your attention to one good thing.</h2><p>You don’t have to do it all at once. Just begin where you are.</p></div></aside>
                </div>
                <footer className="dashboard-footer"><Brand /><span>MAKE SPACE FOR A GOOD DAY</span></footer>
            </div>
        </main>
    )
}

function App() {
    const [session, setSession] = useState(readSession)

    function navigate(path) {
        window.history.pushState({}, '', path)
    }

    useEffect(() => {
        function keepRouteInSync() {
            const expectedPath = session?.token ? '/dashboard' : '/'
            if (window.location.pathname !== expectedPath) {
                window.history.replaceState({}, '', expectedPath)
            }
        }
        keepRouteInSync()
        window.addEventListener('popstate', keepRouteInSync)
        return () => window.removeEventListener('popstate', keepRouteInSync)
    }, [session?.token])

    function handleLogin(result, remember) {
        window.localStorage.removeItem(SESSION_KEY)
        window.sessionStorage.removeItem(SESSION_KEY)
        const storage = remember ? window.localStorage : window.sessionStorage
        storage.setItem(SESSION_KEY, JSON.stringify(result))
        setSession(result)
        navigate('/dashboard')
    }

    function handleSignOut() {
        window.localStorage.removeItem(SESSION_KEY)
        window.sessionStorage.removeItem(SESSION_KEY)
        setSession(null)
        navigate('/')
    }

    if (session?.token) {
        return <Dashboard user={session.user} onSignOut={handleSignOut} />
    }
    return <LoginPage onLogin={handleLogin} />
}

export default App