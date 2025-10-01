import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTokenFromCookies } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const userId = await verifyTokenFromCookies(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { s3Key } = await req.json();

    if (!s3Key) {
      return NextResponse.json({ error: "S3 key is required" }, { status: 400 });
    }

    // Verify that the project belongs to the user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId
      }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const video = await prisma.video.create({
      data: {
        s3Key,
        projectId,
      },
    });

    return NextResponse.json({ message: "Video added successfully", video });
  } catch (error) {
    console.error("Error adding video to project:", error);
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
  }
}
