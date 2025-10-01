import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export interface AuthenticatedUser {
    userId: string;
}

// Helper function to verify JWT token from cookies
export async function verifyTokenFromCookies(req: Request): Promise<string | null> {
    try {
        const cookieHeader = req.headers.get('cookie');
        if (!cookieHeader) {
            return null;
        }

        // Parse the token from cookies
        const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});

        const token = cookies.token;
        if (!token) {
            return null;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
        return decoded.userId;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

// Helper function to create JWT token
export function createJWTToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Helper function to set authentication cookie
export function setAuthCookie(response: Response, token: string): void {
    const cookieOptions = {
        httpOnly: true,
        secure: false, // Set to false for EC2 without HTTPS
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
        sameSite: 'lax' as const
    };

    // Type assertion to handle the cookie setting
    (response as any).cookies?.set('token', token, cookieOptions);
}

// Helper function to clear authentication cookie
export function clearAuthCookie(response: Response): void {
    const cookieOptions = {
        httpOnly: true,
        secure: false, // Set to false for EC2 without HTTPS
        maxAge: 0, // Expire immediately
        path: '/',
        sameSite: 'lax' as const
    };

    // Type assertion to handle the cookie setting
    (response as any).cookies?.set('token', '', cookieOptions);
}
