# 🚀 Finance Guard - Local Testing & Deployment Guide

## 📋 Complete Workflow: Local → GitHub → Vercel

---

## **PART 1: LOCAL TESTING (VS Code)**

### **Step 1: Setup Local Environment**

```bash
cd /home/error/my-finance-guard-540bf7f7

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local
```

### **Step 2: Update .env.local with Your Credentials**

Edit `/home/error/my-finance-guard-540bf7f7/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TURNSTILE_SITE_KEY=your-turnstile-key
VITE_TELEGRAM_BOT_TOKEN=your-telegram-token
VITE_GMAIL_USER=your-email@gmail.com
```

### **Step 3: Start Development Server**

```bash
# Terminal 1: Start Vite dev server
npm run dev

# This will start at http://localhost:5173
```

### **Step 4: Test Supabase Edge Functions Locally**

**Option A: Deploy to Supabase Preview Environment**
```bash
# Test directly on Supabase (uses cloud infrastructure)
# No local setup needed, goes straight to cloud
```

**Option B: Use Supabase Local Emulator (Advanced)**
```bash
# Install Docker first, then:
docker run -d --name supabase-local supabase/supabase:latest

# Then in your project:
npm run supabase:start
```

### **Step 5: Test Email Function**

**Manual Testing in Browser Console:**

```javascript
// In browser DevTools Console (http://localhost:5173):
const { data, error } = await supabase.functions.invoke("send-report", {
  body: { 
    userEmail: "test@example.com", 
    reportType: "monthly"
  }
});

console.log(data, error);
```

**Expected Response:**
```json
{
  "success": true, 
  "message": "Report sent successfully"
}
```

### **Step 6: Verify Email Received**

1. Check your email inbox
2. Look for: "Finance Report - Monthly Summary"
3. Verify:
   - ✅ Personalized greeting ("Dear [Your Name]")
   - ✅ Professional blue design
   - ✅ Summary table (Income/Expenses/Balance)
   - ✅ Bank accounts section
   - ✅ Call-to-action for PDF

---

## **PART 2: PUSH TO GITHUB**

### **Step 1: Stage All Changes**

```bash
cd /home/error/my-finance-guard-540bf7f7

# See what changed
git status

# Stage all changes
git add .

# Or stage specific files:
git add src/pages/Dashboard.tsx
git add supabase/functions/send-report/index.ts
```

### **Step 2: Create Meaningful Commit**

```bash
git commit -m "feat: Update email report design and fix currency loading

- Professional email template with personalized greeting
- Clean blue design (removed colorful gradients)
- Summary table with Income/Expenses/Balance
- Currency loading fixed in Dashboard
- Removed unused HTML variables"
```

### **Step 3: Push to GitHub**

```bash
git push origin main

# Or if you have a feature branch:
git push origin feature-email-redesign
```

### **Step 4: Create Pull Request (if needed)**

```bash
# Go to GitHub.com
# Click "Pull Requests" tab
# Click "New Pull Request"
# Select your branch
# Add description and merge
```

---

## **PART 3: DEPLOY TO VERCEL**

### **Option A: Auto Deploy (Recommended)**

Vercel automatically deploys when you push to GitHub!

**Setup (One-time):**

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Import Project"
4. Select your repository
5. Configure:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_TURNSTILE_SITE_KEY=
   ```
7. Click "Deploy"

**Then every push to `main` branch auto-deploys!**

### **Option B: Manual Deploy with Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project directory
cd /home/error/my-finance-guard-540bf7f7
vercel

# Follow prompts:
# - Select team/account
# - Select existing project or create new
# - Confirm deployment

# View at: https://your-project.vercel.app
```

### **Step 4: Deploy Supabase Edge Functions to Production**

After GitHub push, deploy functions to Supabase:

```bash
# Option 1: Use Supabase Dashboard
# Go to: Supabase Project → Edge Functions → send-report
# Click "Deploy" (usually auto-deploys on code changes)

# Option 2: Using CLI (when available)
# supabase functions deploy send-report
```

---

## **TESTING CHECKLIST**

### **Local Testing (Before Push)**

- [ ] App starts without errors: `npm run dev`
- [ ] Dashboard loads correctly
- [ ] Currency displays from user profile
- [ ] Send Report button appears
- [ ] Email function works (check console)
- [ ] Email received with professional format

### **Production Testing (After Deploy)**

- [ ] App loads at: `https://your-project.vercel.app`
- [ ] Dashboard works on Vercel
- [ ] Send Report works end-to-end
- [ ] Email received with professional format
- [ ] No console errors

---

## **QUICK REFERENCE**

### **Local Development**
```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # Check code quality
```

### **Git Workflow**
```bash
git status           # See changes
git add .            # Stage all changes
git commit -m "..."  # Create commit
git push             # Push to GitHub
```

### **Deployment Status**
- **GitHub**: [your-repo/my-finance-guard-540bf7f7](https://github.com/Shishirkandel28/my-finance-guard-540bf7f7)
- **Vercel**: Auto-deploys on push to `main`
- **Supabase**: Functions auto-deploy on code changes

---

## **TROUBLESHOOTING**

### **Email not sending locally?**
- Check Gmail credentials in `.env.local`
- Verify GMAIL_APP_PASSWORD (not regular password)
- Check browser console for errors

### **Build fails on Vercel?**
- Check Vercel logs: Dashboard → Project → Deployments
- Verify all environment variables are set
- Ensure TypeScript compiles locally first

### **Vercel shows old version?**
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Wait 2-3 minutes for CDN to update

### **Need to update Supabase function?**
1. Edit `/supabase/functions/send-report/index.ts`
2. Push to GitHub
3. Supabase auto-deploys (or manually deploy via dashboard)

---

## **COMMON TASKS**

### **Update Email Template**
```
File: supabase/functions/send-report/index.ts
Edit: emailHtml variable (line ~74)
Deploy: Push to GitHub → Supabase auto-deploys
```

### **Change Currency Display**
```
File: src/lib/utils.ts
Edit: formatCurrency() or formatCurrencyInternational()
Deploy: Push → Vercel auto-deploys
```

### **Test on Different Device**
```bash
# Get local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Visit from phone: http://YOUR_IP:5173
# (Must be on same WiFi)
```

---

## **NEXT STEPS**

1. **Test locally** first: `npm run dev`
2. **Fix any issues** before pushing
3. **Push to GitHub**: `git push origin main`
4. **Vercel auto-deploys** (wait 1-2 minutes)
5. **Check deployment** at Vercel URL
6. **Deploy functions**: Update Supabase functions
7. **Test in production**: Email, currencies, everything

---

## **SUPPORT LINKS**

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Vite Docs: https://vitejs.dev/guide/
- GitHub: https://docs.github.com/en

