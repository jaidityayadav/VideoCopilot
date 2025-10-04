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
            },
            include: {
                transcripts: true // Include transcripts for S3 cleanup
            }
        });

        if (!video) {
            return NextResponse.json({ error: "Video not found or access denied" }, { status: 404 });
        }

        // Delete the S3 files (video and all transcripts)
        const deletePromises: Promise<void>[] = [];

        // Delete video file from S3
        deletePromises.push(
            (async () => {
                try {
                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET!,
                        Key: video.s3Key,
                    });
                    await s3.send(deleteCommand);
                    console.log(`Deleted S3 video: ${video.s3Key}`);
                } catch (error) {
                    console.error(`Failed to delete S3 video ${video.s3Key}:`, error);
                }
            })()
        );

        // Delete transcript files from S3
        video.transcripts.forEach((transcript) => {
            // Delete SRT file
            deletePromises.push(
                (async () => {
                    try {
                        let s3Key = transcript.srtUrl;
                        if (s3Key.startsWith('s3://')) {
                            const parts = s3Key.split('/');
                            s3Key = parts.slice(3).join('/');
                        }

                        const deleteCommand = new DeleteObjectCommand({
                            Bucket: process.env.AWS_S3_BUCKET!,
                            Key: s3Key,
                        });
                        await s3.send(deleteCommand);
                        console.log(`Deleted S3 SRT transcript: ${s3Key}`);
                    } catch (error) {
                        console.error(`Failed to delete S3 SRT transcript ${transcript.srtUrl}:`, error);
                    }
                })()
            );

            // Delete TXT file if it exists
            if (transcript.txtUrl) {
                deletePromises.push(
                    (async () => {
                        try {
                            let s3Key = transcript.txtUrl;
                            if (s3Key.startsWith('s3://')) {
                                const parts = s3Key.split('/');
                                s3Key = parts.slice(3).join('/');
                            }

                            const deleteCommand = new DeleteObjectCommand({
                                Bucket: process.env.AWS_S3_BUCKET!,
                                Key: s3Key,
                            });
                            await s3.send(deleteCommand);
                            console.log(`Deleted S3 TXT transcript: ${s3Key}`);
                        } catch (error) {
                            console.error(`Failed to delete S3 TXT transcript ${transcript.txtUrl}:`, error);
                        }
                    })()
                );
            }
        });

        // Wait for all S3 deletions to complete (or fail)
        await Promise.allSettled(deletePromises);

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
