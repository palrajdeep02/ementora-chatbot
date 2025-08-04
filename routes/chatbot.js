import express from 'express';
import dialogflow from '@google-cloud/dialogflow';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

dotenv.config();

const router = express.Router();

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set project ID
const projectId = process.env.DIALOGFLOW_PROJECT_ID;

let sessionClient; // to be initialized after decoding creds

// Initialize Dialogflow client after decoding base64 credentials
async function initializeDialogflowClient() {
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    const keyPath = path.join(__dirname, 'service-account.json');

    // Decode base64 to JSON and write to file
    const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
    await fs.writeFile(keyPath, decoded);

    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

    // Now safely create the session client
    sessionClient = new dialogflow.SessionsClient({
      keyFilename: keyPath,
    });
  } else {
    throw new Error("GOOGLE_CREDENTIALS_BASE64 is not defined in environment variables.");
  }
}

// Call initialization immediately
await initializeDialogflowClient();

// POST /api/chatbot
router.post('/', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: 'No message provided.' });
  }

  try {
    const sessionId = uuidv4();
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: userMessage,
          languageCode: 'en-US',
        },
      },
    };

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    let botReply = result.fulfillmentText;

    // Fallback to Gemini if Dialogflow didn't understand
    if (result.intent && result.intent.isFallback) {
      console.log('Fallback triggered, using Gemini API...');
      botReply = await getGeminiFallback(userMessage);
    }

    res.json({ reply: botReply });
  } catch (error) {
    console.error('Dialogflow Error:', error);
    res.status(500).json({ reply: 'Internal error occurred. Please try again later.' });
  }
});

// Gemini fallback
async function getGeminiFallback(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: userMessage }]
      }
    ]
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || "I'm not sure how to help with that.";
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    if (error.response) {
      console.error("Gemini API Response Data:", error.response.data);
    }
    return "Sorry, I couldn't process that right now.";
  }
}

export default router;
