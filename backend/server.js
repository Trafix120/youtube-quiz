/**
 * Backend for Youtube Quizzer App
 * 
 * Takes in a youtube video id and creates a quiz from it
 * 
 * @author Erland A. Syafiq
 * 
 */

// Import statements
import { YoutubeTranscript } from 'youtube-transcript';
import express from 'express';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import wsWrapper from 'express-ws';

dotenv.config();
const app = express();
const PORT = 8080;
const expressWs = wsWrapper(app);

// Set API keys
const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
})

app.ws("/", (ws, req) => {
    const messageHistory = [];
    const systemMessage = {
        "role": "system", 
        "content": "First. Say Hi! Keep the messages to one sentence. You are a tutor chat bot to help the user, a student understand the material in a video. Learn from the video transcript below: "
    }

    ws.on('message', async (raw_message) => {
        const userMessage = JSON.parse(raw_message);
        const TYPE = userMessage["role"];

        if (TYPE == "meta") {
            const url = userMessage.content;
            const transcriptJSON = await YoutubeTranscript.fetchTranscript(url);
            const transcript = decodeTranscript(transcriptJSON);
            systemMessage["content"] += transcript;
            recordMessage(systemMessage);
            const botMessageJSON = await getBotMessageJSON(messageHistory);
            recordMessage(botMessageJSON);
            const botMessage = JSON.stringify(botMessageJSON);
            ws.send(botMessage);
        }
        if (TYPE == "user") {
            recordMessage(userMessage);
            const botMessageJSON = await getBotMessageJSON(messageHistory);
            recordMessage(botMessageJSON);
            const botMessage = JSON.stringify(botMessageJSON);
            ws.send(botMessage);
        }
        
        console.log(messageHistory);
    });

    function recordMessage(messageJSON) {
        messageHistory.push({
            role: messageJSON.role,
            content: messageJSON.content
        })
    }
})

async function getBotMessageJSON(messageHistory) {
    const chatCompletion = await openai.chat.completions.create({
        messages: messageHistory,
        model: 'gpt-3.5-turbo'
    });

    const botMessageJSON = chatCompletion.choices[0].message;
    botMessageJSON.id = Math.random();
    return botMessageJSON;
}

/**
 * Takes a Youtube url and sends a json list of questions
 * 
 * req: 
 * 
 * 
 * Example: https://www.youtube.com/watch?v=n2Fluyr3lbc
 */
app.get("/quiz", async (req, res) => {
    try {
        const transcriptJSON = await YoutubeTranscript.fetchTranscript("https://www.youtube.com/watch?v=x7X9w_GIm1s");
        const transcript = decodeTranscript(transcriptJSON);
        const question = await getTestQuestion(transcript)
        
        res.json(question);

    }
    catch (e) {
        console.log(e);
        res.status(400).json({
            "message": e
        });
    }
    
})

/**
 * Sends welcome message at root of api
 */
app.get('/', (req, res) => {
    res.send("Welcome to the Youtube Quizzer API!");
})

/**
 * Creates a structured question and answer json form a transcript
 * @param {string} transcript 
 * @returns {json}
 */
async function getMultipleChoice(transcript) {
    const systemMessage = {
        "role": "system", 
        "content": "You help create multiple choice questions from a transcript. The transcript came from a Youtube Video about the topic. Create questions that are technical and whose answers can be found in the transcript. Output in JSON."
    }

    const chatCompletion = await openai.chat.completions.create({
        messages: [systemMessage,
            {role: 'user', content: transcript}],
        model: 'gpt-3.5-turbo-0125',
        response_format :{type: "json_object"}
    })
    console.log(chatCompletion.choices[0])

    const questionString = chatCompletion.choices[0].message.content;
    const question = JSON.parse(questionString)

    return question;
}

/**
 * Creates a test question for development
 * @param {string} transcript 
 * @returns {string}
 */
async function getTestQuestion(transcript) {
    const data = await fs.readFile("test-question.txt", {encoding :'utf8'});
    return data;

}

async function getTestMessage() {
    let messageJSON = await fs.readFile("test-message.json", {encoding: 'utf8'});
    messageJSON = JSON.parse(messageJSON);
    messageJSON.id = Math.random(9999);
    return JSON.stringify(messageJSON);
}


/**
 * Decodes the transcript list object and combines it all into one string
 * @param {list} transcriptList 
 * @returns 
 */
function decodeTranscript(transcriptList) {
    var s = "";
    transcriptList.every((transcriptSegment) => {
        s += transcriptSegment["text"];
        s += " "
        
        return s.length < 1000;
    });
    return s;
}

app.listen(PORT, () => {
    console.log(`Running on: http://localhost:${PORT} `);
});