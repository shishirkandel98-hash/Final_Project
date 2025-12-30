#!/bin/bash

# Supabase Update Script

echo "🚀 Starting Supabase Database Update..."

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Use npx supabase if supabase is not globally installed
SUPABASE_CMD="npx supabase"
if command_exists supabase; then
  SUPABASE_CMD="supabase"
fi

echo "Using Supabase CLI: $SUPABASE_CMD"

# Check if logged in
echo "Checking login status..."
if ! $SUPABASE_CMD projects list >/dev/null 2>&1; then
  echo "⚠️  You are not logged in to Supabase CLI."
  echo "👉 Please log in now (a browser window may open):"
  $SUPABASE_CMD login
fi

# Link project (if not already linked or to confirm)
echo "----------------------------------------------------------------"
echo "🔗 Linking to remote project..."
echo "If you haven't linked your project yet, you'll need your Project Reference ID."
echo "You can find it in your Supabase Dashboard URL: https://supabase.com/dashboard/project/<project-id>"
echo "----------------------------------------------------------------"

# Check if already linked
if [ -f "supabase/config.toml" ]; then
    echo "✅ Project seems to be linked (config found)."
else
    read -p "Enter your Supabase Project Reference ID: " PROJECT_ID
    $SUPABASE_CMD link --project-ref "$PROJECT_ID"
fi

# Push migrations
echo "----------------------------------------------------------------"
echo "⬆️  Pushing migrations to remote database..."
echo "----------------------------------------------------------------"

$SUPABASE_CMD db push

if [ $? -eq 0 ]; then
  echo "✅ Database updated successfully!"
else
  echo "❌ Error updating database. Please check the logs above."
  exit 1
fi

echo "----------------------------------------------------------------"
echo "🎉 All done! Your Supabase server is up to date."
echo "----------------------------------------------------------------"
