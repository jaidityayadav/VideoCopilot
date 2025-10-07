import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Basic health check - you could add database connectivity check here if needed
        return NextResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'web-app'
        });
    } catch (error) {
        return NextResponse.json({
            status: 'unhealthy',
            error: 'Service unavailable'
        }, { status: 503 });
    }
}