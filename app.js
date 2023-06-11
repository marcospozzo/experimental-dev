const axios = require("axios");
const OpenAI = require("openai");

const querystring = require("querystring");

const token = process.env.SLACK_BOT_TOKEN;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

exports.handler = async (event, context) => {
  try {
    const body = querystring.parse(
      Buffer.from(event.body, "base64").toString("utf-8")
    );

    const channelName = body.text;
    const userId = body.user_id;
    let response = {};

    const channelId = await getChannelId(channelName);
    if (channelId) {
      response.message = `The ID of '${channelName}' is: ${channelId}`;

      // Enqueue the summarization task in the background
      await summarizeSlackChannelInBackground(channelName, channelId, userId);
    } else {
      response.message = `Channel '${channelName}' not found.`;
    }

    // Return an immediate response to Slack
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    // Handle errors and include error message in the response
    console.error(`Error occurred: ${error}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function getChannelId(channelName) {
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

async function summarizeSlackChannelInBackground(
  channelName,
  channelId,
  userId
) {
  try {
    const messages = await getChannelMessages(channelId);
    // Here I filter out all the messages that contain subtype prop (such as welcoming messages)
    const filteredMessages = messages.filter((message) => !message.subtype);
    const textCompilation = filteredMessages
      .map((message) => message.text)
      .join(" ");
    const summary = await summarizeSlackChannel(channelName, textCompilation);

    // Send DM to the user that requested the channel summary
    await sendSummaryToUser(userId, summary);
  } catch (error) {
    console.error("Error occurred while summarizing Slack channel:", error);
    // Handle the error appropriately, e.g., log, notify, etc.
  }
}

async function getChannelMessages(channelId) {
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
    throw new Error("Failed to summarize Slack channel.");
  }
}

async function sendSummaryToUser(userId, summary) {
  try {
    // Open a DM channel with the user
    const response = await axios.post(
      "https://slack.com/api/conversations.open",
      {
        users: userId,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const dmChannelId = response.data.channel.id;

    // Send a DM to the user
    const message = {
      channel: dmChannelId,
      text: summary,
    };

    await axios.post("https://slack.com/api/chat.postMessage", message, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error("Error occurred while sending summary to user:", error);
    // Handle the error appropriately, e.g., log, notify, etc.
  }
}
