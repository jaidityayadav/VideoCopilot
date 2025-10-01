import { NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import prisma from "@/lib/prisma";
import { verifyTokenFromCookies } from "@/lib/auth";

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string; videoId: string }> }) {
    try {
        const { projectId, videoId } = await params;
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify that the video belongs to a project owned by the user
        const video = await prisma.video.findFirst({
            where: {
                id: videoId,
                projectId: projectId,
                project: {
                    ownerId: userId
                }
            }
        });

        if (!video) {
            return NextResponse.json({ error: "Video not found or access denied" }, { status: 404 });
        }

        // Delete the S3 file
        try {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET!,
                Key: video.s3Key,
            });
            await s3.send(deleteCommand);
            console.log(`Deleted S3 object: ${video.s3Key}`);
        } catch (error) {
            console.error(`Failed to delete S3 object ${video.s3Key}:`, error);
            // Continue with database deletion even if S3 deletion fails
        }

        // Delete the video from database
        await prisma.video.delete({
            where: { id: videoId }
        });

        return NextResponse.json({
            message: "Video deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting video:", error);
        return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
    }
}
