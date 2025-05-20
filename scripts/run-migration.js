require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase client initialization with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function runMigration(filePath) {
  try {
    console.log(`Reading migration file: ${filePath}`);
    const sqlFile = fs.readFileSync(filePath, 'utf8');
    
    console.log('Executing SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlFile });
    
    if (error) {
      console.error('Error executing migration:', error);
      return;
    }
    
    console.log('Migration completed successfully!');
    console.log(data);
  } catch (err) {
    console.error('Error running migration:', err);
  }
}

// Get migration file path from command line argument
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide a migration file path');
  console.log('Usage: node run-migration.js ../add_recitation_style.sql');
  process.exit(1);
}

const migrationFilePath = path.resolve(args[0]);
runMigration(migrationFilePath); 