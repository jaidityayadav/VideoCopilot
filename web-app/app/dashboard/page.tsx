"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Project {
    id: string;
    name: string;
    thumbnail?: string;
    status: 'PROCESSING' | 'COMPLETED';
    createdAt: string;
    _count: {
        videos: number;
    };
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingProjects, setDeletingProjects] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const router = useRouter(); useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await fetch('/api/projects');

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch projects');
            }

            const data = await response.json();
            setProjects(data.projects || []);
        } catch (err) {
            setError('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleDeleteProject = async (projectId: string, projectName: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent navigation to project detail

        const confirmDelete = window.confirm(
            `Are you sure you want to delete "${projectName}"? This action cannot be undone and will permanently delete all videos and data.`
        );

        if (!confirmDelete) return;

        setDeletingProjects(prev => new Set(prev).add(projectId));

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete project');
            }

            // Remove project from local state
            setProjects(prev => prev.filter(p => p.id !== projectId));
        } catch (error) {
            console.error('Error deleting project:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete project. Please try again.');
        } finally {
            setDeletingProjects(prev => {
                const newSet = new Set(prev);
                newSet.delete(projectId);
                return newSet;
            });
        }
    }; if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-400">Loading your projects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100">
            {/* Top Navbar */}
            <header className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
                <h1 className="text-2xl font-bold tracking-tight">VidWise Dashboard</h1>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/create-project')}
                        className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                    >
                        + New Project
                    </button>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-8 py-8">
                <div className="max-w-7xl mx-auto">
                    {/* Welcome Section */}
                    <div className="mb-12">
                        <h2 className="text-4xl font-bold mb-4">
                            Welcome back! 👋
                        </h2>
                        <p className="text-gray-400 text-lg">
                            Manage your video projects and track their processing status.
                        </p>
                    </div>

                    {/* Stats Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm">Total Projects</p>
                                    <p className="text-3xl font-bold">{projects.length}</p>
                                </div>
                                <div className="text-3xl">📁</div>
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm">Processing</p>
                                    <p className="text-3xl font-bold">
                                        {projects.filter(p => p.status === 'PROCESSING').length}
                                    </p>
                                </div>
                                <div className="text-3xl">⏳</div>
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm">Completed</p>
                                    <p className="text-3xl font-bold">
                                        {projects.filter(p => p.status === 'COMPLETED').length}
                                    </p>
                                </div>
                                <div className="text-3xl">✅</div>
                            </div>
                        </div>
                    </div>

                    {/* Projects Section */}
                    <div>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-bold">Your Projects</h3>
                            {projects.length > 0 && (
                                <button
                                    onClick={() => router.push('/create-project')}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                                >
                                    + Create New Project
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
                                <p className="text-red-400">{error}</p>
                            </div>
                        )}

                        {projects.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {projects.map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => router.push(`/projects/${project.id}`)}
                                        className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-600 transition-all cursor-pointer group"
                                    >
                                        {/* Project Thumbnail */}
                                        <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
                                            {project.thumbnail ? (
                                                <img
                                                    src={project.thumbnail}
                                                    alt={project.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                            ) : (
                                                <div className="text-6xl">🎬</div>
                                            )}

                                            {/* Status Badge */}
                                            <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold ${project.status === 'COMPLETED'
                                                ? 'bg-green-600 text-white'
                                                : 'bg-yellow-600 text-white'
                                                }`}>
                                                {project.status}
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                onClick={(e) => handleDeleteProject(project.id, project.name, e)}
                                                disabled={deletingProjects.has(project.id)}
                                                className="absolute top-3 left-3 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                                                title="Delete project"
                                            >
                                                {deletingProjects.has(project.id) ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                ) : (
                                                    "🗑️"
                                                )}
                                            </button>
                                        </div>

                                        {/* Project Info */}
                                        <div className="p-6">
                                            <h4 className="font-semibold text-lg mb-2 group-hover:text-blue-400 transition-colors">
                                                {project.name}
                                            </h4>
                                            <div className="flex items-center justify-between text-sm text-gray-400">
                                                <span>{project._count.videos} video{project._count.videos !== 1 ? 's' : ''}</span>
                                                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-800">
                                <div className="text-8xl mb-6">🎥</div>
                                <h3 className="text-2xl font-bold mb-4">No projects yet</h3>
                                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                                    Create your first project to start analyzing your video content and generating insights.
                                </p>
                                <button
                                    onClick={() => router.push('/create-project')}
                                    className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
                                >
                                    Create Your First Project
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Background Grid */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(40,40,40,0.3),transparent_60%)]" />
            <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>
    );
}
