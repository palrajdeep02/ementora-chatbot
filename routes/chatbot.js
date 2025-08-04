import express from 'express';
import dialogflow from '@google-cloud/dialogflow';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

dotenv.config();
const router = express.Router();

const projectId = process.env.DIALOGFLOW_PROJECT_ID;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Initialize Dialogflow client using credentials file path
const sessionClient = new dialogflow.SessionsClient({
  keyFilename: credentialsPath,
});

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

    if (result.intent && result.intent.isFallback) {
      console.log('Fallback intent detected, switching to Gemini...');
      botReply = await getGeminiFallback(userMessage);
    }

    res.json({ reply: botReply });
  } catch (error) {
    console.error('Dialogflow Error:', error);
    res.status(500).json({ reply: 'Something went wrong. Please try again later.' });
  }
});

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
    return "Sorry, I couldn't get a response right now.";
  }
}

export default router;
