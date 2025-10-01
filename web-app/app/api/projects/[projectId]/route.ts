import { NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import prisma from '@/lib/prisma';
import { verifyTokenFromCookies } from '@/lib/auth';

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

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
                videos: true,
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

        // Verify project ownership and get project with videos
        const existingProject = await prisma.project.findFirst({
            where: {
                id: projectId,
                ownerId: userId
            },
            include: {
                videos: true
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Delete S3 files for all videos
        const deletePromises = existingProject.videos.map(async (video) => {
            try {
                const deleteCommand = new DeleteObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET!,
                    Key: video.s3Key,
                });
                await s3.send(deleteCommand);
                console.log(`Deleted S3 object: ${video.s3Key}`);
            } catch (error) {
                console.error(`Failed to delete S3 object ${video.s3Key}:`, error);
                // Continue with deletion even if S3 deletion fails
            }
        });

        // Wait for all S3 deletions to complete (or fail)
        await Promise.allSettled(deletePromises);

        // Delete all videos from database
        await prisma.video.deleteMany({
            where: { projectId: projectId }
        });

        // Delete all invitations for this project
        await prisma.invitation.deleteMany({
            where: { projectId: projectId }
        });

        // Delete the project
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
