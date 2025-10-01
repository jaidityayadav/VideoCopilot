import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyTokenFromCookies } from '@/lib/auth';

// GET - Fetch all projects for the authenticated user
export async function GET(req: Request) {
    try {
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projects = await prisma.project.findMany({
            where: { ownerId: userId },
            include: {
                videos: true,
                _count: {
                    select: { videos: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ projects }, { status: 200 });
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}

// POST - Create a new project
export async function POST(req: Request) {
    try {
        const userId = await verifyTokenFromCookies(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, thumbnail } = await req.json();

        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
        }

        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                ownerId: userId,
                status: 'PROCESSING', // Default status from schema
                thumbnail: thumbnail || null
            },
            include: {
                videos: true,
                _count: {
                    select: { videos: true }
                }
            }
        });

        return NextResponse.json({
            message: 'Project created successfully',
            project
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
}