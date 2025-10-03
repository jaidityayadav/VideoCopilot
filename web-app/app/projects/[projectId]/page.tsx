"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface Transcript {
    id: string;
    language: string;
    srtUrl: string;
    txtUrl: string;
    createdAt: string;
}

interface Video {
    id: string;
    s3Key: string;
    transcripts?: Transcript[];
}

interface VideoWithSignedUrl extends Video {
    signedUrl?: string;
}

interface Project {
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

const LANGUAGE_NAMES: { [key: string]: string } = {
    'en': 'English',
    'es': 'Spanish',
    'hi': 'Hindi',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ta': 'Tamil'
};

// Chat interfaces
interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    message: string;
    sources?: Array<{
        video_id?: string;
        chunk_index?: number;
        timestamp?: string;
        content_preview?: string;
        score?: number;
    }>;
    timestamp: Date;
}

interface ChatState {
    messages: ChatMessage[];
    isConnected: boolean;
    isTyping: boolean;
    connectionError?: string;
}

export default function ProjectDetail({ params }: { params: Promise<{ projectId: string }> }) {
    const resolvedParams = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [videosWithUrls, setVideosWithUrls] = useState<VideoWithSignedUrl[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [deletingVideos, setDeletingVideos] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [selectedTranscriptLanguage, setSelectedTranscriptLanguage] = useState<{ [videoId: string]: string }>({});
    const [transcriptContents, setTranscriptContents] = useState<{ [txtUrl: string]: string }>({});
    const [loadingTranscripts, setLoadingTranscripts] = useState<Set<string>>(new Set());

    // Chat state
    const [chatState, setChatState] = useState<ChatState>({
        messages: [],
        isConnected: false,
        isTyping: false
    });
    const [chatInput, setChatInput] = useState('');
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const chatMessagesRef = useRef<HTMLDivElement>(null);

    const router = useRouter();

    useEffect(() => {
        fetchProject();

        // Auto-refresh if project is still processing
        const interval = setInterval(() => {
            if (project?.status === 'PROCESSING') {
                fetchProject();
            }
        }, 10000); // Refresh every 10 seconds

        return () => clearInterval(interval);
    }, [resolvedParams.projectId, project?.status]);

    const fetchSignedUrl = async (s3Key: string, videoId: string): Promise<string> => {
        try {
            console.log('Fetching signed URL for:', { s3Key, videoId });

            const response = await axios.post('/api/signed-url', {
                key: s3Key,
                videoId
            }, {
                withCredentials: true
            });

            console.log('Signed URL response:', response.status, response.data);

            if (response.status !== 200) {
                throw new Error(`Failed to get signed URL: ${response.status}`);
            }

            const { signedUrl } = response.data;
            if (!signedUrl) {
                throw new Error('No signed URL in response');
            }

            return signedUrl;
        } catch (error) {
            console.error('Error fetching signed URL for key', s3Key, ':', error);
            if (axios.isAxiosError(error)) {
                console.error('Response data:', error.response?.data);
                console.error('Response status:', error.response?.status);
            }
            return '';
        }
    };

    const fetchTranscriptContent = async (txtUrl: string, videoId: string): Promise<string> => {
        try {
            if (transcriptContents[txtUrl]) {
                return transcriptContents[txtUrl];
            }

            setLoadingTranscripts(prev => new Set(prev).add(txtUrl));

            console.log('Fetching transcript content for txtUrl:', txtUrl, 'Video ID:', videoId);

            // Use our server-side proxy endpoint to fetch transcript content
            const response = await axios.post('/api/transcript-content', {
                txtUrl: txtUrl,
                videoId: videoId
            }, {
                withCredentials: true
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch transcript content: ${response.status}`);
            }

            const { content, success } = response.data;
            if (!success || !content) {
                throw new Error('Invalid response from transcript API');
            }

            console.log('Successfully fetched transcript content, length:', content.length);
            console.log('Content preview (first 200 chars):', content.substring(0, 200));

            setTranscriptContents(prev => {
                const newState = { ...prev, [txtUrl]: content };
                console.log('Updated transcript contents state:', Object.keys(newState));
                return newState;
            });
            return content;
        } catch (error) {
            console.error('Error fetching transcript content:', error);
            console.error('txtUrl:', txtUrl, 'videoId:', videoId);

            // Set error message in transcripts
            const errorMessage = `Failed to load transcript: ${error instanceof Error ? error.message : 'Unknown error'}`;
            setTranscriptContents(prev => ({ ...prev, [txtUrl]: errorMessage }));
            return errorMessage;
        } finally {
            setLoadingTranscripts(prev => {
                const newSet = new Set(prev);
                newSet.delete(txtUrl);
                return newSet;
            });
        }
    };

    const handleLanguageSelect = async (videoId: string, language: string, txtUrl: string) => {
        setSelectedTranscriptLanguage(prev => ({ ...prev, [videoId]: language }));
        await fetchTranscriptContent(txtUrl, videoId);
    };

    const fetchProject = async () => {
        try {
            const response = await axios.get(`/api/projects/${resolvedParams.projectId}`, {
                withCredentials: true
            });

            if (response.status !== 200) {
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

            const data = response.data;
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
            const response = await axios.delete(`/api/projects/${project.id}`, {
                withCredentials: true
            });

            if (response.status !== 200) {
                const errorData = response.data;
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
            const response = await axios.delete(`/api/projects/${project?.id}/videos/${videoId}`, {
                withCredentials: true
            });

            if (response.status !== 200) {
                const errorData = response.data;
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

    // Chat functions
    const connectToChat = () => {
        if (wsRef.current || !project) return;

        const wsUrl = `ws://localhost:8002/chat/${project.id}`;
        console.log('Connecting to intelligence service:', wsUrl);

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            console.log('Connected to intelligence service');
            setChatState(prev => ({ ...prev, isConnected: true, connectionError: undefined }));
        };

        wsRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            switch (data.type) {
                case 'welcome':
                    setChatState(prev => ({
                        ...prev,
                        messages: [...prev.messages, {
                            id: Date.now().toString(),
                            type: 'system',
                            message: data.message,
                            timestamp: new Date()
                        }]
                    }));
                    break;

                case 'typing':
                    setChatState(prev => ({ ...prev, isTyping: true }));
                    break;

                case 'response':
                    setChatState(prev => ({
                        ...prev,
                        isTyping: false,
                        messages: [...prev.messages, {
                            id: Date.now().toString(),
                            type: 'assistant',
                            message: data.message,
                            sources: data.sources || [],
                            timestamp: new Date()
                        }]
                    }));
                    break;

                case 'error':
                    setChatState(prev => ({
                        ...prev,
                        isTyping: false,
                        messages: [...prev.messages, {
                            id: Date.now().toString(),
                            type: 'system',
                            message: `Error: ${data.message}`,
                            timestamp: new Date()
                        }]
                    }));
                    break;
            }
        };

        wsRef.current.onclose = () => {
            console.log('Disconnected from intelligence service');
            setChatState(prev => ({ ...prev, isConnected: false }));
            wsRef.current = null;
        };

        wsRef.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            setChatState(prev => ({
                ...prev,
                connectionError: 'Failed to connect to intelligence service. Make sure it\'s running on port 8002.'
            }));
        };
    };

    const disconnectFromChat = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setChatState(prev => ({ ...prev, isConnected: false }));
    };

    const sendChatMessage = () => {
        if (!chatInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            message: chatInput.trim(),
            timestamp: new Date()
        };

        setChatState(prev => ({
            ...prev,
            messages: [...prev.messages, userMessage]
        }));

        wsRef.current.send(JSON.stringify({ message: chatInput.trim() }));
        setChatInput('');
    };

    const handleChatKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    };

    // Auto-scroll chat messages
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [chatState.messages]);

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

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
                                                    onError={(e) => {
                                                        console.error('Video failed to load:', video.signedUrl);
                                                        console.error('Video error:', e);
                                                    }}
                                                    onLoadStart={() => console.log('Video load started:', video.signedUrl)}
                                                    onLoadedData={() => console.log('Video loaded successfully:', video.signedUrl)}
                                                />
                                            ) : video.signedUrl === '' ? (
                                                <div className="text-center">
                                                    <div className="text-3xl mb-2">❌</div>
                                                    <p className="text-sm text-red-400">Failed to load video</p>
                                                    <p className="text-xs text-gray-500 mt-1">Check console for details</p>
                                                </div>
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
                                            <div className="text-xs text-gray-500 mb-2">
                                                S3 Key: {video.s3Key}
                                            </div>
                                            <div className="flex items-center justify-between text-sm text-gray-400">
                                                <span>
                                                    {video.signedUrl ? 'Video ready' : video.signedUrl === '' ? 'Load failed' : 'Loading...'}
                                                </span>
                                                <button
                                                    onClick={() => console.log('Video details:', video)}
                                                    className="text-blue-400 hover:text-blue-300 transition"
                                                >
                                                    Debug Info
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

                    {/* Transcripts Section */}
                    {videosWithUrls.some(video => video.transcripts && video.transcripts.length > 0) && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Generated Transcripts</h2>
                            <div className="space-y-6">
                                {videosWithUrls.map((video, videoIndex) => {
                                    if (!video.transcripts || video.transcripts.length === 0) return null;

                                    const selectedLanguage = selectedTranscriptLanguage[video.id];
                                    const selectedTranscript = selectedLanguage
                                        ? video.transcripts.find(t => t.language === selectedLanguage)
                                        : video.transcripts[0]; // Default to first transcript

                                    return (
                                        <div key={video.id} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                            <h3 className="text-lg font-semibold mb-4">Video {videoIndex + 1} Transcripts</h3>

                                            {/* Language Selector */}
                                            <div className="mb-6">
                                                <label htmlFor={`language-${video.id}`} className="block text-sm font-medium text-gray-300 mb-2">
                                                    Select Language:
                                                </label>
                                                <select
                                                    id={`language-${video.id}`}
                                                    value={selectedLanguage || video.transcripts[0]?.language}
                                                    onChange={(e) => {
                                                        const selectedLang = e.target.value;
                                                        const transcript = video.transcripts?.find(t => t.language === selectedLang);
                                                        if (transcript) {
                                                            handleLanguageSelect(video.id, selectedLang, transcript.txtUrl);
                                                        }
                                                    }}
                                                    className="w-full md:w-auto px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    {video.transcripts.map((transcript) => (
                                                        <option key={transcript.id} value={transcript.language}>
                                                            {LANGUAGE_NAMES[transcript.language] || transcript.language}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Transcript Content */}
                                            {selectedTranscript && (
                                                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-xl">📝</span>
                                                            <span className="font-medium">
                                                                {LANGUAGE_NAMES[selectedTranscript.language] || selectedTranscript.language} Transcript
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(selectedTranscript.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    {loadingTranscripts.has(selectedTranscript.txtUrl) ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                                                            <span className="text-gray-400">Loading transcript...</span>
                                                        </div>
                                                    ) : transcriptContents[selectedTranscript.txtUrl] ? (
                                                        <div className="max-h-96 overflow-y-auto">
                                                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                                                                {(() => {
                                                                    const content = transcriptContents[selectedTranscript.txtUrl];
                                                                    console.log('Rendering transcript content for:', selectedTranscript.txtUrl, 'Content length:', content?.length);
                                                                    return content;
                                                                })()}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6">
                                                            <button
                                                                onClick={() => fetchTranscriptContent(selectedTranscript.txtUrl, video.id)}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                                                            >
                                                                Load Transcript
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* AI Chat Section */}
                    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <div
                            className="flex items-center justify-between p-4 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors"
                            onClick={() => setIsChatExpanded(!isChatExpanded)}
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></div>
                                <h3 className="text-lg font-semibold">AI Assistant</h3>
                                <span className="text-sm text-gray-400">
                                    Ask questions about your video content
                                </span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {chatState.connectionError && (
                                    <span className="text-red-400 text-sm">Connection Error</span>
                                )}
                                {chatState.isConnected ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-green-400 text-sm">Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                        <span className="text-gray-400 text-sm">Disconnected</span>
                                    </div>
                                )}
                                <svg
                                    className={`w-5 h-5 text-gray-400 transition-transform ${isChatExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {isChatExpanded && (
                            <div className="p-4">
                                {/* Connection Controls */}
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm text-gray-400">
                                        {chatState.isConnected
                                            ? "Connected to AI assistant. Ask questions about your video transcripts!"
                                            : "Connect to start chatting with AI about your video content."
                                        }
                                    </p>
                                    {!chatState.isConnected ? (
                                        <button
                                            onClick={connectToChat}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                                        >
                                            Connect
                                        </button>
                                    ) : (
                                        <button
                                            onClick={disconnectFromChat}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>

                                {chatState.connectionError && (
                                    <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                                        <p className="text-red-400 text-sm">{chatState.connectionError}</p>
                                        <p className="text-gray-400 text-xs mt-1">
                                            Make sure the intelligence service is running on port 8002
                                        </p>
                                    </div>
                                )}

                                {/* Chat Messages */}
                                <div
                                    ref={chatMessagesRef}
                                    className="h-96 overflow-y-auto bg-gray-800 rounded-lg p-4 mb-4 space-y-4"
                                >
                                    {chatState.messages.length === 0 ? (
                                        <div className="text-center text-gray-500 py-8">
                                            <div className="text-4xl mb-2">🤖</div>
                                            <p>No messages yet. Start a conversation!</p>
                                        </div>
                                    ) : (
                                        chatState.messages.map((message) => (
                                            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${message.type === 'user'
                                                        ? 'bg-blue-600 text-white'
                                                        : message.type === 'system'
                                                            ? 'bg-gray-700 text-gray-300'
                                                            : 'bg-gray-700 text-white'
                                                    }`}>
                                                    <p className="whitespace-pre-wrap">{message.message}</p>
                                                    {message.sources && message.sources.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                                            <p className="text-xs text-gray-400 mb-1">Sources:</p>
                                                            {message.sources.map((source, idx) => (
                                                                <div key={idx} className="text-xs text-gray-300 mb-1">
                                                                    <span className="font-medium">Video {source.video_id}</span>
                                                                    {source.timestamp && (
                                                                        <span className="text-gray-400"> at {source.timestamp}</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {message.timestamp.toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    {chatState.isTyping && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-700 rounded-lg px-4 py-2">
                                                <div className="flex space-x-1">
                                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Chat Input */}
                                <div className="flex space-x-2">
                                    <textarea
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={handleChatKeyPress}
                                        placeholder={chatState.isConnected ? "Ask about your video content..." : "Connect to start chatting"}
                                        disabled={!chatState.isConnected}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={1}
                                    />
                                    <button
                                        onClick={sendChatMessage}
                                        disabled={!chatState.isConnected || !chatInput.trim()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Processing Status */}
                    {project.status === 'PROCESSING' && (
                        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
                                <h3 className="text-lg font-semibold text-yellow-400">Processing Videos</h3>
                            </div>
                            <p className="text-gray-300 mb-4">
                                We're generating transcripts for your videos in multiple languages. This may take a few minutes depending on video length.
                            </p>
                            <div className="text-sm text-gray-400">
                                This page will automatically refresh to show progress.
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
