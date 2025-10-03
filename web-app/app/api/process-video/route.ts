import { NextResponse } from 'next/server';
import { verifyTokenFromCookies } from '@/lib/auth';
import axios from 'axios';

const VIDEO_PROCESSING_SERVICE_URL = process.env.VIDEO_PROCESSING_SERVICE_URL || 'http://localhost:8000';

export async function POST(req: Request) {
    try {
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { video_s3_url, project_id, video_id, languages } = await req.json();

        // Validate required fields
        if (!video_s3_url || !project_id || !video_id || !languages || !Array.isArray(languages)) {
            return NextResponse.json({
                error: 'Missing required fields: video_s3_url, project_id, video_id, languages'
            }, { status: 400 });
        }

        // Validate languages array
        const supportedLanguages = ['en', 'es', 'hi', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ta'];
        const invalidLanguages = languages.filter((lang: string) => !supportedLanguages.includes(lang));

        if (invalidLanguages.length > 0) {
            return NextResponse.json({
                error: `Unsupported languages: ${invalidLanguages.join(', ')}. Supported languages: ${supportedLanguages.join(', ')}`
            }, { status: 400 });
        }

        // Forward request to video processing service
        console.log('Sending video processing request:', {
            video_s3_url,
            project_id,
            video_id,
            languages
        });

        const processingResponse = await axios.post(`${VIDEO_PROCESSING_SERVICE_URL}/process-video`, {
            video_s3_url,
            project_id,
            video_id,
            languages
        }, {
            timeout: 30000, // 30 second timeout for the initial request
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return NextResponse.json({
            message: 'Video processing started successfully',
            data: processingResponse.data
        }, { status: 200 });

    } catch (error) {
        console.error('Error processing video:', error);

        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                return NextResponse.json({
                    error: 'Video processing service is not available. Please try again later.'
                }, { status: 503 });
            }

            if (error.response) {
                return NextResponse.json({
                    error: error.response.data?.detail || 'Video processing service error'
                }, { status: error.response.status });
            }

            if (error.request) {
                return NextResponse.json({
                    error: 'Video processing service is not responding'
                }, { status: 503 });
            }
        }

        return NextResponse.json({
            error: 'Failed to start video processing'
        }, { status: 500 });
    }
}