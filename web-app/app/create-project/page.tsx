"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface UploadedVideo {
  file: File;
  s3Key: string;
  thumbnail?: string;
  uploading?: boolean;
  error?: string;
}

export default function CreateProject() {
  const [projectName, setProjectName] = useState("");
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Generate thumbnail from video file
  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = 1; // Seek to 1 second for thumbnail
      };

      video.onseeked = () => {
        if (context) {
          context.drawImage(video, 0, 0);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnail);
        }
      };

      video.src = URL.createObjectURL(file);
    });
  };

  // Handle file upload to S3 via server
  const uploadVideoToS3 = async (file: File, projectId: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    const uploadResponse = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (uploadResponse.status !== 200) {
      const errorData = uploadResponse.data;
      throw new Error(errorData.error || 'Failed to upload file');
    }

    const { key } = uploadResponse.data;
    return key;
  };

  // Handle file selection - just prepare files, don't upload yet
  const handleFiles = async (files: File[]) => {
    const videoFiles = files.filter(file => file.type.startsWith('video/'));

    for (const file of videoFiles) {
      // Add file to list with processing state
      const tempId = Date.now() + Math.random();
      setVideos(prev => [...prev, {
        file,
        s3Key: `temp-${tempId}`,
        uploading: true
      }]);

      try {
        // Generate thumbnail
        const thumbnail = await generateThumbnail(file);

        // Update the video entry with thumbnail (ready for upload)
        setVideos(prev => prev.map(video =>
          video.s3Key === `temp-${tempId}`
            ? { ...video, thumbnail, uploading: false }
            : video
        ));
      } catch (error) {
        console.error('Error processing video:', error);

        // Update the video entry with error
        setVideos(prev => prev.map(video =>
          video.s3Key === `temp-${tempId}`
            ? { ...video, uploading: false, error: error instanceof Error ? error.message : 'Processing failed' }
            : video
        ));
      }
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Remove video from list
  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  // Create project first, then handle video uploads
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    if (videos.length === 0) {
      alert('Please add at least one video');
      return;
    }

    // Check if videos are still uploading
    if (videos.some(v => v.uploading)) {
      alert('Please wait for videos to finish uploading');
      return;
    }

    setIsCreating(true);

    try {
      // Create project first
      const projectResponse = await axios.post('/api/projects', {
        name: projectName.trim()
      });

      if (projectResponse.status !== 200 && projectResponse.status !== 201) {
        const errorData = projectResponse.data;
        throw new Error(errorData.error || 'Failed to create project');
      }

      const { project } = projectResponse.data;
      setProjectId(project.id);

      // Now upload videos with the project ID and add them to the project
      const successfulUploads = [];

      for (const videoData of videos) {
        if (!videoData.error) {
          try {
            // Upload to S3 with proper path structure
            const s3Key = await uploadVideoToS3(videoData.file, project.id);

            // Add video to project in database
            await axios.post(`/api/projects/${project.id}/videos`, {
              s3Key: s3Key
            });

            successfulUploads.push({ ...videoData, s3Key });
          } catch (error) {
            console.error('Error uploading video:', videoData.file.name, error);
            // Continue with other videos
          }
        }
      }

      // Update project thumbnail if we have successful uploads with thumbnails
      const videoWithThumbnail = successfulUploads.find(v => v.thumbnail);
      if (videoWithThumbnail) {
        await axios.put(`/api/projects/${project.id}`, {
          thumbnail: videoWithThumbnail.thumbnail
        });
      }

      // Redirect to project page
      router.push(`/projects/${project.id}`);

    } catch (error) {
      console.error('Error creating project:', error);
      alert(error instanceof Error ? error.message : 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex flex-col relative">
      {/* Top Navbar */}
      <header className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight">VidWise</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
        >
          Dashboard
        </button>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center flex-1 px-4 py-8">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-center">
          Create Your <span className="text-blue-500">Project</span>
        </h2>
        <p className="text-gray-400 mb-8 text-center max-w-2xl">
          Start by giving your project a name and uploading your videos.
          We'll automatically generate thumbnails and prepare your content for analysis.
        </p>

        <form
          onSubmit={handleCreateProject}
          className="w-full max-w-4xl bg-gray-900 p-8 rounded-2xl shadow-lg border border-gray-800 space-y-8"
        >
          {/* Project Name */}
          <div>
            <label className="block text-gray-300 mb-3 text-lg font-semibold">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:border-blue-500 text-lg"
              placeholder="e.g., JavaScript Mastery Course"
            />
          </div>

          {/* Video Upload Area */}
          <div>
            <label className="block text-gray-300 mb-3 text-lg font-semibold">
              Upload Videos
            </label>

            {/* Drag & Drop Area */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className="space-y-4">
                <div className="text-6xl">🎬</div>
                <div>
                  <p className="text-xl font-semibold mb-2">
                    Drop your videos here or click to browse
                  </p>
                  <p className="text-gray-400">
                    Supports MP4, MOV, AVI and other video formats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Select Videos
                </button>
              </div>
            </div>

            {/* Upload Progress */}
            {videos.some(v => v.uploading) && (
              <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span>Uploading and processing videos...</span>
                </div>
              </div>
            )}

            {/* Uploaded Videos List */}
            {videos.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold">
                  Videos ({videos.filter(v => !v.uploading && !v.error).length}/{videos.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video, index) => (
                    <div key={index} className={`bg-gray-800 rounded-lg p-4 relative group ${video.error ? 'border-2 border-red-500' : ''
                      }`}>
                      {video.uploading ? (
                        <div className="w-full h-32 bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-300">Uploading...</p>
                          </div>
                        </div>
                      ) : video.error ? (
                        <div className="w-full h-32 bg-red-900/20 rounded-lg mb-3 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-3xl mb-2">❌</div>
                            <p className="text-sm text-red-400">Upload failed</p>
                          </div>
                        </div>
                      ) : video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg mb-3"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                          <span className="text-3xl">🎬</span>
                        </div>
                      )}

                      <p className="text-sm font-medium truncate">{video.file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>

                      {video.error && (
                        <p className="text-xs text-red-400 mt-1 truncate" title={video.error}>
                          {video.error}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Create Button */}
          <button
            type="submit"
            disabled={
              isCreating ||
              videos.some(v => v.uploading) ||
              videos.filter(v => !v.error && !v.uploading).length === 0 ||
              !projectName.trim()
            }
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Creating Project & Uploading Videos...</span>
              </>
            ) : videos.some(v => v.uploading) ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing Videos...</span>
              </>
            ) : (
              <>
                <span>Create Project & Upload Videos</span>
                <span>({videos.filter(v => !v.error && !v.uploading).length} video{videos.filter(v => !v.error && !v.uploading).length !== 1 ? 's' : ''})</span>
              </>
            )}
          </button>
        </form>
      </main>

      {/* Background Grid */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(40,40,40,0.3),transparent_60%)]" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
}