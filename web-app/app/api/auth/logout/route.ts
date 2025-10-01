import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const response = NextResponse.json({ message: 'Logout successful' });

        // Clear the token cookie
        response.cookies.set('token', '', {
            httpOnly: true,
            secure: false, // Set to false for EC2 without HTTPS
            maxAge: 0, // Expire immediately
            path: '/',
            sameSite: 'lax'
        });

        return response;
    } catch (error) {
        console.error('Error during logout:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
