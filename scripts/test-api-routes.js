/**
 * Test script for API routes
 * Run with: node scripts/test-api-routes.js
 */

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_AUDIO_FILE = path.join(__dirname, '../public/test-audio.mp3'); // Add a test audio file to public directory

// Test functions
async function testNewReciterRoute() {
  console.log('\n=== Testing /api/new-reciter ===');
  
  try {
    // Create form data
    const form = new FormData();
    form.append('name', 'Test Reciter ' + new Date().toISOString());
    form.append('audio', fs.createReadStream(TEST_AUDIO_FILE));
    
    // Send request
    const response = await fetch(`${API_BASE_URL}/new-reciter`, {
      method: 'POST',
      body: form
    });
    
    // Check response
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', {
        status: response.status,
        reciterId: data.reciterId,
        name: data.name
      });
      
      // Return reciter ID for use in next test
      return data.reciterId;
    } else {
      console.error('❌ Error:', {
        status: response.status,
        error: data.error
      });
      return null;
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
    return null;
  }
}

async function testReciterMatchRoute(reciterId) {
  console.log('\n=== Testing /api/reciter-match ===');
  
  try {
    // Create form data
    const form = new FormData();
    form.append('audio', fs.createReadStream(TEST_AUDIO_FILE));
    
    // Add reciter ID if provided
    if (reciterId) {
      form.append('reciterId', reciterId);
      console.log(`Using specific reciterId: ${reciterId}`);
    }
    
    // Send request
    const response = await fetch(`${API_BASE_URL}/reciter-match`, {
      method: 'POST',
      body: form
    });
    
    // Check response
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', {
        status: response.status,
        bestMatchReciter: data.bestMatch?.reciterName,
        overallScore: data.bestMatch?.similarityScore,
        matchCount: data.matchResults?.length
      });
      
      // Print aspect scores if available
      if (data.bestMatch?.aspectScores) {
        console.log('Aspect Scores:', data.bestMatch.aspectScores);
      }
    } else {
      console.error('❌ Error:', {
        status: response.status,
        error: data.error
      });
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('Starting API route tests...');
  
  // Check if test audio exists
  if (!fs.existsSync(TEST_AUDIO_FILE)) {
    console.error(`Test audio file not found: ${TEST_AUDIO_FILE}`);
    console.error('Please add a test MP3 file to the specified location.');
    return;
  }
  
  // Test new-reciter route
  const reciterId = await testNewReciterRoute();
  
  // Test reciter-match route with specific reciter
  if (reciterId) {
    await testReciterMatchRoute(reciterId);
  }
  
  // Test reciter-match route without specific reciter
  await testReciterMatchRoute(null);
  
  console.log('\nTests completed!');
}

// Run the tests
runTests(); 