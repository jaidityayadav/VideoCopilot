import os
import tempfile
import asyncio
from typing import List, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager

import whisper
import boto3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import ffmpeg
from prisma import Prisma
from deep_translator import GoogleTranslator

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Initialize AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

# Initialize Prisma client
prisma = Prisma()

# Load Whisper model (you can change the model size as needed)
whisper_model = whisper.load_model("base")
# Note: GoogleTranslator is used directly in the translation function

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    await prisma.connect()
    yield
    # Shutdown
    await prisma.disconnect()

# Initialize FastAPI app
app = FastAPI(
    title="Video Processing Service", 
    version="1.0.0",
    lifespan=lifespan
)

class ProcessVideoRequest(BaseModel):
    video_s3_url: str
    project_id: str
    video_id: str
    languages: List[str]

class TranscriptResponse(BaseModel):
    language: str
    srt_url: str

class ProcessVideoResponse(BaseModel):
    video_id: str
    transcripts: List[TranscriptResponse]
    status: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "video-processing"}

@app.post("/process-video", response_model=ProcessVideoResponse)
async def process_video(request: ProcessVideoRequest):
    """
    Main endpoint to process video and generate transcripts
    """
    try:
        # Validate that project exists
        project = await prisma.project.find_unique(
            where={"id": request.project_id},
            include={"owner": True}
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Update video status to PROCESSING immediately
        await prisma.video.update(
            where={"id": request.video_id},
            data={"status": "PROCESSING"}
        )
        
        # Start processing in background (don't await)
        asyncio.create_task(process_video_background(request, project.owner.id))
        
        # Return immediately with accepted status
        return ProcessVideoResponse(
            video_id=request.video_id,
            transcripts=[],
            status="processing_started"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start processing: {str(e)}")

async def process_video_background(request: ProcessVideoRequest, user_id: str):
    """
    Background task to process video and generate transcripts
    """
    video_file_path = None
    
    try:
        print(f"🎬 Starting background processing for video {request.video_id}")
        
        # Download video from S3
        video_file_path = await download_video_from_s3(request.video_s3_url)
        
        # Process transcripts for each language
        transcripts = []
        for language in request.languages:
            try:
                transcript_data = await process_transcript(
                    video_file_path, 
                    language, 
                    user_id, 
                    request.project_id, 
                    request.video_id
                )
                transcripts.append(transcript_data)
                print(f"✅ Completed transcript for {language}")
            except Exception as e:
                print(f"❌ Failed to process transcript for {language}: {str(e)}")
                # Continue with other languages
        
        # Clean up temporary video file
        if video_file_path and os.path.exists(video_file_path):
            os.unlink(video_file_path)
        
        # Update video status to DONE
        await prisma.video.update(
            where={"id": request.video_id},
            data={"status": "DONE"}
        )
        
        # Check if all videos in project are done
        await check_and_update_project_status(request.project_id)
        
        print(f"🎉 Completed processing video {request.video_id} with {len(transcripts)} transcripts")
        
    except Exception as e:
        print(f"❌ Error in background processing: {str(e)}")
        # Update video status to indicate error
        try:
            await prisma.video.update(
                where={"id": request.video_id},
                data={"status": "PENDING"}  # Reset to pending on error
            )
        except:
            pass  # Don't fail if we can't update status
        
        # Clean up temporary files
        if video_file_path and os.path.exists(video_file_path):
            os.unlink(video_file_path)

async def download_video_from_s3(s3_url: str) -> str:
    """
    Download video file from S3 to temporary location
    """
    # Parse S3 URL to get bucket and key
    # Handle different S3 URL formats:
    # 1. s3://bucket-name/key
    # 2. Just the key (assuming default bucket)
    # 3. https://bucket-name.s3.region.amazonaws.com/key
    
    if s3_url.startswith('s3://'):
        # Handle s3:// format
        parts = s3_url[5:].split('/', 1)
        bucket_name = parts[0]
        key = parts[1]
    elif s3_url.startswith('https://'):
        # Handle https:// format - extract bucket and key from URL
        # This is a simplified parser - you might need more robust URL parsing
        raise HTTPException(status_code=400, detail="Please provide S3 URL in s3:// format or just the S3 key")
    else:
        # Handle case where only the S3 key is provided
        # Use default bucket from environment or hardcoded
        bucket_name = os.getenv('S3_BUCKET_NAME', 'vidwise')
        key = s3_url
    
    # Downloading video from S3...
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
    temp_file_path = temp_file.name
    temp_file.close()
    
    try:
        # Download file from S3
        s3_client.download_file(bucket_name, key, temp_file_path)
        print("✓ Video downloaded successfully")
        return temp_file_path
    except Exception as e:
        # Clean up temp file if download fails
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Failed to download video from s3://{bucket_name}/{key}: {str(e)}")

async def process_transcript(video_path: str, language: str, user_id: str, project_id: str, video_id: str) -> TranscriptResponse:
    """
    Process video to generate transcript in specified language
    """
    audio_path = None
    srt_path = None
    
    try:
        print(f"Processing transcript for language: {language}")
        
        # Check if video file exists
        if not os.path.exists(video_path):
            raise Exception(f"Video file not found: {video_path}")
        
        # Extract audio from video using ffmpeg
        audio_path = video_path.replace('.mp4', f'_{language}.wav')
        # Audio extraction...
        
        # Extract audio
        (
            ffmpeg
            .input(video_path)
            .output(audio_path, acodec='pcm_s16le', ac=1, ar='16k')
            .overwrite_output()
            .run(quiet=True)
        )
        
        # Check if audio file was created
        if not os.path.exists(audio_path):
            raise Exception(f"Audio extraction failed: {audio_path}")
        
        print("✓ Audio extracted")
        
        # Transcribe using Whisper (always transcribe in the original language first)
        print("🎤 Transcribing audio...")
        # Let Whisper auto-detect the language for the first transcription
        result = whisper_model.transcribe(audio_path)
        
        print(f"✓ Transcription complete (detected: {result.get('language', 'unknown')})")
        
        # Check if result has segments
        if not result or 'segments' not in result:
            raise Exception(f"Whisper transcription failed - no segments returned")
        
        # Generate SRT content in the target language
        srt_content = await generate_srt_with_translation(result, language)
        
        if not srt_content:
            raise Exception("SRT content generation failed")
        
        print(f"✓ Generated {language} transcript")
        
        # Create SRT file
        srt_filename = f"{video_id}_{language}.srt"
        srt_path = os.path.join(tempfile.gettempdir(), srt_filename)
        
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        # Upload SRT to S3
        s3_key = f"{user_id}/{project_id}/transcripts/{srt_filename}"
        bucket_name = os.getenv('S3_BUCKET_NAME', 'vidwise')
        
        s3_client.upload_file(srt_path, bucket_name, s3_key)
        srt_url = f"s3://{bucket_name}/{s3_key}"
        
        # Save transcript record to database
        await prisma.transcript.create(
            data={
                "language": language,
                "srtUrl": srt_url,
                "videoId": video_id
            }
        )
        
        # Clean up temporary files
        if audio_path and os.path.exists(audio_path):
            os.unlink(audio_path)
        if srt_path and os.path.exists(srt_path):
            os.unlink(srt_path)
        
        return TranscriptResponse(language=language, srt_url=srt_url)
        
    except Exception as e:
        print(f"Error in process_transcript: {str(e)}")
        # Clean up any temporary files on error
        if audio_path and os.path.exists(audio_path):
            os.unlink(audio_path)
        if srt_path and os.path.exists(srt_path):
            os.unlink(srt_path)
        raise Exception(f"Failed to process transcript for {language}: {str(e)}")

async def generate_srt_with_translation(result: Dict[str, Any], target_language: str) -> str:
    """
    Convert Whisper transcription result to SRT format with translation
    """
    srt_content = ""
    detected_language = result.get('language', 'en')
    
    # Generating SRT with translation if needed...
    
    for i, segment in enumerate(result['segments'], 1):
        start_time = format_timestamp(segment['start'])
        end_time = format_timestamp(segment['end'])
        original_text = segment['text'].strip()
        
        # If target language is the same as detected language, no translation needed
        if target_language == detected_language or target_language == 'en':
            translated_text = original_text
        else:
            # Translate the text to target language
            try:
                # Map language codes to Google Translate codes
                lang_map = {
                    'en': 'en',   # English
                    'es': 'es',   # Spanish
                    'hi': 'hi',   # Hindi
                    'fr': 'fr',   # French
                    'de': 'de',   # German
                    'it': 'it',   # Italian
                    'pt': 'pt',   # Portuguese
                    'ru': 'ru',   # Russian
                    'ja': 'ja',   # Japanese
                    'ko': 'ko',   # Korean
                    'zh': 'zh',   # Chinese
                    'ta': 'ta'    # Tamil
                }

                
                target_lang_code = lang_map.get(target_language, target_language)
                
                translated_text = GoogleTranslator(source='auto', target=target_lang_code).translate(original_text)
                
            except Exception as e:
                print(f"Translation failed for segment {i}: {str(e)}")
                # Fall back to original text if translation fails
                translated_text = original_text
        
        srt_content += f"{i}\n"
        srt_content += f"{start_time} --> {end_time}\n"
        srt_content += f"{translated_text}\n\n"
    
    return srt_content

def format_timestamp(seconds: float) -> str:
    """
    Format timestamp for SRT format (HH:MM:SS,mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds_remainder = seconds % 60
    milliseconds = int((seconds_remainder % 1) * 1000)
    seconds_int = int(seconds_remainder)
    
    return f"{hours:02d}:{minutes:02d}:{seconds_int:02d},{milliseconds:03d}"

async def check_and_update_project_status(project_id: str):
    """
    Check if all videos in project are done and update project status accordingly
    """
    # Get all videos for the project
    videos = await prisma.video.find_many(
        where={"projectId": project_id}
    )
    
    # Check if all videos are done
    all_done = all(video.status == "DONE" for video in videos)
    
    if all_done:
        # Update project status and processedVideos count
        await prisma.project.update(
            where={"id": project_id},
            data={
                "status": "COMPLETED",
                "processedVideos": len(videos)
            }
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)