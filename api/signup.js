import { handleVercelSignup } from '../server/vercel-auth.js'

export default function signup(request, response) {
    return handleVercelSignup(request, response)
}