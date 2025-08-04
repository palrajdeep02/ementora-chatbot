import express from 'express';
import dialogflow from '@google-cloud/dialogflow';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const router = express.Router();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project & session setup
const projectId = process.env.DIALOGFLOW_PROJECT_ID;
const sessionClient = new dialogflow.SessionsClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

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

    // If Dialogflow fallback intent is triggered
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


// Gemini API fallback logic with corrected 'v1beta' endpoint
async function getGeminiFallback(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  // Using the 'v1beta' endpoint which supports the 1.5-flash model
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