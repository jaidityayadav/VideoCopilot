import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifyTokenFromCookies } from "@/lib/auth";
import prisma from "@/lib/prisma";

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function POST(req: Request) {
    try {
        // Verify authentication
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { key, videoId } = await req.json();

        if (!key) {
            return NextResponse.json({ error: "S3 key is required" }, { status: 400 });
        }

        // If videoId is provided, verify the user has access to this video
        if (videoId) {
            const video = await prisma.video.findFirst({
                where: {
                    id: videoId,
                    project: {
                        ownerId: userId
                    }
                }
            });

            if (!video) {
                return NextResponse.json({ error: "Video not found or access denied" }, { status: 404 });
            }
        } else {
            // If no videoId, check if the key belongs to the user (based on path structure)
            if (!key.startsWith(`uploads/${userId}/`)) {
                return NextResponse.json({ error: "Access denied" }, { status: 403 });
            }
        }

        // Generate signed URL (valid for 1 hour)
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: key,
        });

        const signedUrl = await getSignedUrl(s3, command, {
            expiresIn: 3600 // 1 hour
        });

        return NextResponse.json({
            signedUrl,
            expiresIn: 3600
        });
    } catch (error) {
        console.error("Signed URL generation error:", error);
        return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
    }
}
