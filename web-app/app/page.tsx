"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex flex-col relative">
      {/* Top Navbar */}
      <header className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight cursor-pointer" onClick={() => router.push('/')}>
          VidWise
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 text-gray-300 hover:text-white transition"
          >
            Login
          </button>
          <button
            onClick={() => router.push('/signup')}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center flex-1 text-center px-4">
        <p className="text-sm text-gray-400 border border-gray-800 rounded-full px-4 py-1 mb-6">
          Empower your learning with AI-powered video insights
        </p>
        <h2 className="text-5xl md:text-6xl font-extrabold leading-tight max-w-3xl mb-6">
          Upload, Learn, <span className="text-blue-500">Master.</span>
          <br />
          Turn Videos into Interactive Knowledge.
        </h2>
        <p className="text-lg text-gray-400 max-w-xl mb-8">
          VidWise converts your videos into transcripts in multiple languages,
          lets you ask AI questions, and even generates MCQs to test your understanding.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/signup')}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
          >
            Get Started — Free
          </button>
          <button
            onClick={() => window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')}
            className="flex items-center gap-2 px-8 py-4 border border-gray-700 rounded-lg hover:bg-gray-800 transition text-lg"
          >
            ▶ Watch Demo
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 flex items-center gap-8 text-sm text-gray-500">
          <span>✨ AI-Powered Analysis</span>
          <span>🔒 Secure Storage</span>
          <span>🌍 Multi-Language Support</span>
          <span>📱 Works on All Devices</span>
        </div>
      </main>

      {/* Features Section */}
      <section className="px-8 py-20 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to learn from videos
            </h3>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Transform any video into an interactive learning experience with our AI-powered tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
              <div className="text-4xl mb-4">🎬</div>
              <h4 className="text-xl font-semibold mb-3">Smart Video Upload</h4>
              <p className="text-gray-400">
                Upload videos in any format. Our AI automatically processes and organizes your content for optimal learning.
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
              <div className="text-4xl mb-4">📝</div>
              <h4 className="text-xl font-semibold mb-3">AI Transcriptions</h4>
              <p className="text-gray-400">
                Get accurate transcripts in multiple languages with timestamps, making it easy to navigate and study.
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
              <div className="text-4xl mb-4">🧠</div>
              <h4 className="text-xl font-semibold mb-3">Interactive Q&A</h4>
              <p className="text-gray-400">
                Ask questions about your video content and get instant AI-powered answers to enhance understanding.
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
              <div className="text-4xl mb-4">📊</div>
              <h4 className="text-xl font-semibold mb-3">Progress Tracking</h4>
              <p className="text-gray-400">
                Monitor your learning progress with detailed analytics and insights about your video consumption.
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
              <div className="text-4xl mb-4">🎯</div>
              <h4 className="text-xl font-semibold mb-3">Smart Quizzes</h4>
              <p className="text-gray-400">
                Auto-generated MCQs and quizzes help test your knowledge and reinforce key concepts from videos.
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
              <div className="text-4xl mb-4">🔐</div>
              <h4 className="text-xl font-semibold mb-3">Secure & Private</h4>
              <p className="text-gray-400">
                Your videos and data are encrypted and stored securely. Only you have access to your content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-8 py-20 border-t border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to transform your video learning?
          </h3>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of learners who are already using VidWise to unlock the full potential of their video content.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/signup')}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
            >
              Start Learning for Free
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-4 border border-gray-700 rounded-lg hover:bg-gray-800 transition text-lg"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-12 border-t border-gray-800 bg-gray-950/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-xl font-bold mb-4">VidWise</h4>
              <p className="text-gray-400 text-sm">
                Transforming video learning with AI-powered insights and interactive tools.
              </p>
            </div>

            <div>
              <h5 className="font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => router.push('/signup')} className="hover:text-white transition">Features</button></li>
                <li><button onClick={() => router.push('/signup')} className="hover:text-white transition">Pricing</button></li>
                <li><button className="hover:text-white transition">API</button></li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button className="hover:text-white transition">About</button></li>
                <li><button className="hover:text-white transition">Blog</button></li>
                <li><button className="hover:text-white transition">Careers</button></li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button className="hover:text-white transition">Help Center</button></li>
                <li><button className="hover:text-white transition">Contact</button></li>
                <li><button className="hover:text-white transition">Privacy</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-500">
            <p>&copy; 2025 VidWise. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Background Grid */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(40,40,40,0.3),transparent_60%)]" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
}
