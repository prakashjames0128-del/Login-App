import { handleVercelLogin } from '../server/vercel-auth.js'

export default function login(request, response) {
    return handleVercelLogin(request, response)
}