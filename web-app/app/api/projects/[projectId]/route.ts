import { NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Pinecone } from '@pinecone-database/pinecone';
import prisma from '@/lib/prisma';
import { verifyTokenFromCookies } from '@/lib/auth';

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

// Initialize Pinecone client (moved to function level to avoid build-time issues)
function getPineconeClient() {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
        throw new Error('PINECONE_API_KEY environment variable is required');
    }
    return new Pinecone({
        apiKey,
    });
}

// GET - Fetch a single project by ID
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
    try {
        const { projectId } = await params;
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                ownerId: userId
            },
            include: {
                videos: {
                    include: {
                        transcripts: true
                    }
                },
                _count: {
                    select: { videos: true }
                }
            }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ project }, { status: 200 });
    } catch (error) {
        console.error('Error fetching project:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

// PUT - Update project
export async function PUT(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
    try {
        const { projectId } = await params;
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, thumbnail, status } = await req.json();

        // Verify project ownership
        const existingProject = await prisma.project.findFirst({
            where: {
                id: projectId,
                ownerId: userId
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: {
                ...(name && { name: name.trim() }),
                ...(thumbnail !== undefined && { thumbnail }),
                ...(status && { status })
            },
            include: {
                videos: true,
                _count: {
                    select: { videos: true }
                }
            }
        });

        return NextResponse.json({
            message: 'Project updated successfully',
            project
        }, { status: 200 });
    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

// DELETE - Delete project
export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
    try {
        const { projectId } = await params;
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify project ownership and get project with videos and transcripts
        const existingProject = await prisma.project.findFirst({
            where: {
                id: projectId,
                ownerId: userId
            },
            include: {
                videos: {
                    include: {
                        transcripts: true
                    }
                }
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Delete S3 files for all videos and transcripts
        const deletePromises: Promise<void>[] = [];

        // Delete video files from S3
        existingProject.videos.forEach((video) => {
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
                            // Extract S3 key from transcript srtUrl
                            // srtUrl format: s3://bucket-name/key or just the key
                            let s3Key = transcript.srtUrl;
                            if (s3Key.startsWith('s3://')) {
                                // Extract key from s3://bucket-name/key format
                                const parts = s3Key.split('/');
                                s3Key = parts.slice(3).join('/'); // Remove s3://bucket-name/
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
                                // Extract S3 key from transcript txtUrl
                                let s3Key = transcript.txtUrl;
                                if (s3Key.startsWith('s3://')) {
                                    // Extract key from s3://bucket-name/key format
                                    const parts = s3Key.split('/');
                                    s3Key = parts.slice(3).join('/'); // Remove s3://bucket-name/
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
        });

        // Wait for all S3 deletions to complete (or fail)
        await Promise.allSettled(deletePromises);

        // Delete Pinecone vectors for this project
        try {
            const indexName = process.env.PINECONE_INDEX_NAME || 'vidwise-embeddings';
            const pc = getPineconeClient();
            const index = pc.index(indexName);

            // Delete all vectors in the project's namespace
            await index.namespace(projectId).deleteAll();
            console.log(`Deleted Pinecone vectors for project namespace: ${projectId}`);
        } catch (error) {
            console.error(`Failed to delete Pinecone vectors for project ${projectId}:`, error);
            // Don't fail the entire deletion if Pinecone cleanup fails
        }

        // Delete database records in the correct order due to foreign key constraints
        // 1. First delete all transcripts for videos in this project
        await prisma.transcript.deleteMany({
            where: {
                video: {
                    projectId: projectId
                }
            }
        });

        // 2. Then delete all videos from database
        await prisma.video.deleteMany({
            where: { projectId: projectId }
        });

        // 3. Delete embeddings if they exist
        await prisma.embedding.deleteMany({
            where: { projectId: projectId }
        });

        // 4. Finally delete the project
        await prisma.project.delete({
            where: { id: projectId }
        });

        return NextResponse.json({
            message: 'Project deleted successfully'
        }, { status: 200 });
    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}
