"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface Video {
    id: string;
    s3Key: string;
    transcript: any;
}

interface VideoWithSignedUrl extends Video {
    signedUrl?: string;
}interface Project {
    id: string;
    name: string;
    thumbnail?: string;
    status: 'PROCESSING' | 'COMPLETED';
    createdAt: string;
    videos: Video[];
    _count: {
        videos: number;
    };
}

export default function ProjectDetail({ params }: { params: Promise<{ projectId: string }> }) {
    const resolvedParams = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [videosWithUrls, setVideosWithUrls] = useState<VideoWithSignedUrl[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [deletingVideos, setDeletingVideos] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchProject();
    }, [resolvedParams.projectId]);

    const fetchSignedUrl = async (s3Key: string, videoId: string): Promise<string> => {
        try {
            const response = await fetch('/api/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: s3Key, videoId }),
            });

            if (!response.ok) {
                throw new Error('Failed to get signed URL');
            }

            const { signedUrl } = await response.json();
            return signedUrl;
        } catch (error) {
            console.error('Error fetching signed URL:', error);
            return '';
        }
    };

    const fetchProject = async () => {
        try {
            const response = await fetch(`/api/projects/${resolvedParams.projectId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    setError("Project not found");
                } else if (response.status === 401) {
                    router.push('/login');
                    return;
                } else {
                    setError("Failed to load project");
                }
                return;
            }

            const data = await response.json();
            setProject(data.project);

            // Fetch signed URLs for all videos
            if (data.project.videos && data.project.videos.length > 0) {
                const videosWithSignedUrls = await Promise.all(
                    data.project.videos.map(async (video: Video) => {
                        const signedUrl = await fetchSignedUrl(video.s3Key, video.id);
                        return { ...video, signedUrl };
                    })
                );
                setVideosWithUrls(videosWithSignedUrls);
            }
        } catch (err) {
            setError("Failed to load project");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async () => {
        if (!project) return;

        const confirmDelete = window.confirm(
            `Are you sure you want to delete "${project.name}"? This action cannot be undone and will permanently delete all videos and data.`
        );

        if (!confirmDelete) return;

        setDeleting(true);

        try {
            const response = await fetch(`/api/projects/${project.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete project');
            }

            // Redirect to dashboard after successful deletion
            router.push('/dashboard');
        } catch (error) {
            console.error('Error deleting project:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete project. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteVideo = async (videoId: string, event: React.MouseEvent) => {
        event.stopPropagation();

        const confirmDelete = window.confirm(
            'Are you sure you want to delete this video? This action cannot be undone.'
        );

        if (!confirmDelete) return;

        setDeletingVideos(prev => new Set(prev).add(videoId));

        try {
            const response = await fetch(`/api/projects/${project?.id}/videos/${videoId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete video');
            }

            // Remove video from local state
            setVideosWithUrls(prev => prev.filter(v => v.id !== videoId));

            // Update project video count
            if (project) {
                setProject(prev => prev ? {
                    ...prev,
                    videos: prev.videos.filter(v => v.id !== videoId),
                    _count: { videos: prev._count.videos - 1 }
                } : null);
            }
        } catch (error) {
            console.error('Error deleting video:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete video. Please try again.');
        } finally {
            setDeletingVideos(prev => {
                const newSet = new Set(prev);
                newSet.delete(videoId);
                return newSet;
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-400">Loading project...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="text-6xl">😞</div>
                    <h2 className="text-2xl font-bold">{error || "Project not found"}</h2>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100">
            {/* Top Navbar */}
            <header className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-gray-400 hover:text-white transition"
                    >
                        ← Back
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight">VidWise</h1>
                </div>
                <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${project.status === 'COMPLETED'
                        ? 'bg-green-600 text-white'
                        : 'bg-yellow-600 text-white'
                        }`}>
                        {project.status}
                    </span>
                    <button
                        onClick={handleDeleteProject}
                        disabled={deleting}
                        className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                        {deleting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Deleting...</span>
                            </>
                        ) : (
                            <>
                                <span>🗑️</span>
                                <span>Delete Project</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
                    >
                        Dashboard
                    </button>
                </div>
            </header>

            {/* Project Header */}
            <div className="px-8 py-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-start space-x-6">
                        {project.thumbnail ? (
                            <img
                                src={project.thumbnail}
                                alt={project.name}
                                className="w-32 h-32 object-cover rounded-xl border border-gray-700"
                            />
                        ) : (
                            <div className="w-32 h-32 bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center">
                                <span className="text-4xl">🎬</span>
                            </div>
                        )}

                        <div className="flex-1">
                            <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
                            <p className="text-gray-400 mb-4">
                                Created {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex items-center space-x-6 text-sm text-gray-300">
                                <span>{project._count.videos} video{project._count.videos !== 1 ? 's' : ''}</span>
                                <span>Status: {project.status.toLowerCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Project Content */}
            <div className="px-8 pb-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* Videos Section */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Videos ({project.videos.length})</h2>

                        {videosWithUrls.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {videosWithUrls.map((video, index) => (
                                    <div key={video.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden group">
                                        <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
                                            {video.signedUrl ? (
                                                <video
                                                    src={video.signedUrl}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    preload="metadata"
                                                />
                                            ) : (
                                                <div className="text-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                                    <p className="text-sm text-gray-400">Loading video...</p>
                                                </div>
                                            )}

                                            {/* Delete Button */}
                                            <button
                                                onClick={(e) => handleDeleteVideo(video.id, e)}
                                                disabled={deletingVideos.has(video.id)}
                                                className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                                                title="Delete video"
                                            >
                                                {deletingVideos.has(video.id) ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                ) : (
                                                    "🗑️"
                                                )}
                                            </button>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold mb-2">Video {index + 1}</h3>
                                            <div className="flex items-center justify-between text-sm text-gray-400">
                                                <span>
                                                    {video.transcript ? 'Transcript available' : 'Processing...'}
                                                </span>
                                                <button className="text-blue-400 hover:text-blue-300 transition">
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : project.videos.length > 0 ? (
                            <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                <h3 className="text-xl font-semibold mb-2">Loading videos...</h3>
                                <p className="text-gray-400">Generating secure video URLs</p>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
                                <div className="text-6xl mb-4">📹</div>
                                <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
                                <p className="text-gray-400 mb-6">Upload videos to get started with analysis</p>
                                <button
                                    onClick={() => router.push('/create-project')}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                                >
                                    Add Videos
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Analysis Section */}
                    {project.status === 'COMPLETED' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Analysis & Insights</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                    <h3 className="font-semibold mb-4">📊 Video Analytics</h3>
                                    <p className="text-gray-400 text-sm">
                                        View detailed analytics about your video content, engagement patterns, and key insights.
                                    </p>
                                    <button className="mt-4 text-blue-400 hover:text-blue-300 transition text-sm">
                                        View Analytics →
                                    </button>
                                </div>

                                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                    <h3 className="font-semibold mb-4">📝 Transcripts</h3>
                                    <p className="text-gray-400 text-sm">
                                        Access automatically generated transcripts with timestamps and speaker identification.
                                    </p>
                                    <button className="mt-4 text-blue-400 hover:text-blue-300 transition text-sm">
                                        View Transcripts →
                                    </button>
                                </div>

                                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                    <h3 className="font-semibold mb-4">🎯 Key Moments</h3>
                                    <p className="text-gray-400 text-sm">
                                        Discover the most important moments and highlights from your video content.
                                    </p>
                                    <button className="mt-4 text-blue-400 hover:text-blue-300 transition text-sm">
                                        Explore Moments →
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Background Grid */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(40,40,40,0.3),transparent_60%)]" />
            <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>
    );
}
