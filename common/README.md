# @videocopilot/common

Shared schema and type definitions for VideoCopilot services.

## Overview

This package provides a centralized schema management system for the VideoCopilot project, enabling type-safe communication between different services:

- **Next.js Web Application** (TypeScript)
- **Video Processing Service** (Node.js/TypeScript) 
- **Whisper Transcription Service** (Python)

## 📁 Structure

```
common/
├── schema/
│   └── schema.prisma           # Source of truth - Prisma schema
├── generated/
│   ├── typescript/             # Generated TypeScript types
│   │   ├── client/             # Prisma client
│   │   └── index.ts            # Exported types
│   └── python/                 # Generated Python models
│       ├── __init__.py
│       └── models.py           # Pydantic models
├── scripts/
│   ├── generate-typescript.ts  # TypeScript generator
│   └── generate-python-models.ts # Python generator
├── package.json
└── README.md
```

## 🚀 Usage

### Generate All Types

```bash
cd common
npm install
npm run generate:all
```

### Generate Specific Types

```bash
npm run generate:typescript  # TypeScript only
npm run generate:python      # Python only
```

### Database Operations

```bash
npm run db:push     # Push schema to database
npm run db:migrate  # Create migration
```

## 📦 Using Generated Types

### Next.js Frontend / Node.js Backend

```typescript
// Import shared types
import { User, Project, Video, CreateProject, UpdateUser } from '@videocopilot/common';

// Use in your code
const createProject = async (data: CreateProject): Promise<Project> => {
  // Your implementation
};
```

### Python Whisper Service

```python
# Import shared models
from common.generated.python import User, Project, Video, Status

# Use in your code
def process_video(video: Video) -> None:
    if video.status == Status.PENDING:
        # Your implementation
        pass
```

## ⚠️ Important Rules

1. **Never edit generated files directly** - they will be overwritten
2. **Always modify `schema/schema.prisma`** as the single source of truth
3. **Run `npm run generate:all`** after any schema changes
4. **Commit generated files** to ensure all services use the same types

## 🔄 Development Workflow

1. Edit `schema/schema.prisma`
2. Run `npm run generate:all`
3. Test in your services
4. Commit both schema and generated files
5. Update services to use new types

## 🎯 Benefits

- ✅ **Type Safety**: Catch type errors at compile time
- ✅ **Single Source of Truth**: One schema for all services
- ✅ **Automatic Sync**: Generated types stay in sync with schema
- ✅ **Cross-Language**: TypeScript and Python from same schema
- ✅ **Version Control**: Track schema changes over time