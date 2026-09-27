import { handleVercelSignup } from '../server/vercel-auth-upstash.js'

export default function signup(request, response) {
    return handleVercelSignup(request, response)
}