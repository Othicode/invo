# invo 🚀

**invo** is a production-grade, multi-shop sales management and invoicing platform built for modern retail businesses. It features a high-performance Point of Sale (POS), real-time inventory tracking, and multi-tenant shop management.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **UI/UX**: Custom Design System with Dark Mode support, Glassmorphism, and smooth CSS animations.
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Realtime**: Supabase Realtime for instant inventory sync.
- **Audio**: Custom audio notification system for transactional feedback.

## 🚀 Deployment to Vercel

The most efficient way to deploy **invo** is using Vercel's native Git integration.

### 1. Version Control Setup
1. Initialize git: `git init`
2. Add your files: `git add .`
3. Commit: `git commit -m "Initial commit"`
4. Push to a new GitHub repository.

### 2. Vercel Dashboard Configuration
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **"New Project"**.
2. Import your GitHub repository.
3. **Environment Variables**: Add the following keys in Project Settings > Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anonymous Key.
   - `SUPABASE_SERVICE_ROLE_KEY`: (Optional) For server-side administrative tasks.
4. Click **Deploy**. Vercel will automatically detect the Vite framework and handle the rest.

### 3. Local Development
To run the frontend and serverless functions together locally:
1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Run development server: `vercel dev`

## 📂 Project Structure

- `/api`: Serverless functions (Node.js).
- `/src/components`: UI components (POS, Inventory, Dashboard, etc.).
- `/src/hooks`: Custom React hooks (Audio, etc.).
- `/lib`: Shared utilities (Supabase client).
- `/supabase`: Database schema and migrations.

## 🔒 Security

- **Row Level Security (RLS)**: Enforced at the database level via Supabase.
- **Security Headers**: Configured in `vercel.json` to prevent XSS and clickjacking.
- **Authentication**: Role-based access control (Owner, Branch Manager, Attendant).

## 📄 License

This project is licensed under the MIT License.
