import { handleVercelLogin } from '../server/vercel-auth-upstash.js'

export default function login(request, response) {
    return handleVercelLogin(request, response)
}