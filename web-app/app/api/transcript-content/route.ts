import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromCookies } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { txtUrl, videoId } = body;

        if (!txtUrl || !videoId) {
            return NextResponse.json(
                { error: 'txtUrl and videoId are required' },
                { status: 400 }
            );
        }

        // Verify authentication using the same helper as other API routes
        const userId = await verifyTokenFromCookies(request);
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Verify the user owns the video (and thus can access its transcripts)
        const video = await prisma.video.findFirst({
            where: {
                id: videoId,
                project: {
                    ownerId: userId
                }
            }
        });

        if (!video) {
            return NextResponse.json(
                { error: 'Video not found or access denied' },
                { status: 404 }
            );
        }

        // Extract S3 key from txtUrl (format: s3://bucket/key)
        const s3Key = txtUrl.replace(/^s3:\/\/[^\/]+\//, '');

        // Generate signed URL using the same logic as signed-url route
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const s3Client = new S3Client({
            region: process.env.AWS_REGION!,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: s3Key,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        // Fetch the content from S3 using the signed URL (server-side, no CORS issues)
        const response = await fetch(signedUrl);

        if (!response.ok) {
            console.error('Failed to fetch from S3:', response.status, response.statusText);
            return NextResponse.json(
                { error: `Failed to fetch transcript content: ${response.status}` },
                { status: 500 }
            );
        }

        const content = await response.text();

        return NextResponse.json({
            content,
            success: true
        });

    } catch (error) {
        console.error('Error in transcript-content API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}