const axios = require("axios");
const OpenAI = require("openai");

const querystring = require("querystring");

const token = process.env.SLACK_BOT_TOKEN;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

exports.handler = async (event, context) => {
  const body = querystring.parse(
    Buffer.from(event.body, "base64").toString("utf-8")
  );

  const channelName = body.text;
  let response = {};

  try {
    const channelId = await getChannelId(channelName, token);
    if (channelId) {
      response.message = `The ID of '${channelName}' is: ${channelId}`;
      const messages = await getChannelMessages(channelId, token);
      const filteredMessages = messages.filter((message) => !message.subtype);
      const textCompilation = filteredMessages
        .map((message) => message.text)
        .join(" ");

      response.summary = await summarizeSlackChannel(
        channelName,
        textCompilation
      );
    } else {
      response.message = `Channel '${channelName}' not found.`;
    }
  } catch (error) {
    response.message = "Error finding channel";
    console.log(`Error occurred: ${error}`);
  }

  return response.summary;
};

async function getChannelId(channelName, token) {
  const url = "https://slack.com/api/conversations.list";

  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.ok) {
      const channels = response.data.channels;
      const channel = channels.find((c) => c.name === channelName);
      if (channel) {
        return channel.id;
      } else {
        throw new Error(`Channel '${channelName}' not found.`);
      }
    } else {
      throw new Error("Failed to retrieve channel list.");
    }
  } catch (error) {
    throw new Error(
      `Error occurred while retrieving channel list: ${error.message}`
    );
  }
}

async function getChannelMessages(channelId, token) {
  const url = `https://slack.com/api/conversations.history?channel=${channelId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.ok) {
      const messages = response.data.messages;
      return messages;
    } else {
      throw new Error(
        `Failed to retrieve channel messages: ${response.data.error}`
      );
    }
  } catch (error) {
    throw new Error(
      `Error occurred while retrieving channel messages: ${error.message}`
    );
  }
}

// Function to summarize Slack channel chat history
async function summarizeSlackChannel(channelName, chatHistory) {
  // Set up the prompt
  const prompt = `Summarize the Slack channel: ${channelName}\n\n${chatHistory}`;

  try {
    // Make the API call
    const response = await openai.complete({
      engine: "text-davinci-003", // Or any other GPT-3.5 model
      prompt: prompt,
      maxTokens: 100, // Adjust the number of tokens as per your requirement
      temperature: 0.3,
      n: 1,
      stop: "\n\n", // Stop generation after the first paragraph
    });

    // Extract and return the summary
    const summary = response.choices[0].text.trim();
    return summary;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
